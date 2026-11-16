import { useRef, type ComponentRef } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Boton } from '@/componentes/Boton';
import { CampoConPasos } from '@/componentes/CampoConPasos';
import { Icono } from '@/componentes/Icono';
import { Tarjeta } from '@/componentes/Tarjeta';
import type { Medida } from '@/datos/catalogo';
import type { Ejercicio } from '@/datos/ejercicios';
import { horaDeInstante } from '@/datos/fechas';
import { usePaleta } from '@/tema/colores';
import { datos, esLetraGrande, espacio, radio, texto, titulos, toqueMinimo } from '@/tema/medidas';

import { Descansos } from './Descansos';
import {
  anadirVuelta,
  cambiarSerie,
  enlazar,
  igualQueLaAnterior,
  marcarHecha,
  pasoDeSerie,
  quitarBloque,
  quitarVuelta,
  separar,
  serieVaciaDeDatos,
  textoDeSegundos,
  type BloqueDeEjercicios,
  type CampoDeSerie,
  type EntrenoEnEdicion,
  type NombreDeBloque,
  type SerieEnEdicion,
} from './editor';

type Cambio = (e: EntrenoEnEdicion) => EntrenoEnEdicion;

/** Lo que dice una serie en su fila: «62,5 kg × 8», «8 reps», «1:30» o «Sin apuntar». */
export function resumenDeSerie(serie: SerieEnEdicion): string {
  if (serieVaciaDeDatos(serie)) return 'Sin apuntar';
  if (serie.segundos.trim() !== '') {
    const s = Number(serie.segundos);
    return Number.isInteger(s) ? textoDeSegundos(s) : serie.segundos;
  }
  const peso = serie.peso.trim() === '' ? null : `${serie.peso} kg`;
  const reps = serie.repeticiones.trim() === '' ? null : serie.repeticiones;
  if (peso && reps) return `${peso} × ${reps}`;
  return peso ?? `${reps} reps`;
}

/** El espacio duro: no deja partir la línea donde está. */
const DURO = '\u00a0';

/**
 * El resumen de una serie para un texto que se puede partir en líneas, como
 * «Igual que la anterior (62,5 kg × 8)», con espacios duros donde no conviene
 * partirlo. Con la letra hasta el 200 % cabe entero en una línea, así que no
 * se parte por dentro. Con los tamaños de accesibilidad del iPhone, del 264 %
 * al 314 %, ya no cabe: solo van juntas cada cifra y su unidad, y «×» con las
 * repeticiones, y la línea se parte antes de «×». Con el más grande, 357 %, ni
 * «102,5 kg» cabe al lado del icono, y se deja partir por cualquier espacio,
 * antes que por dentro de una cifra o de una palabra.
 */
export function resumenSinPartir(serie: SerieEnEdicion, fontScale: number): string {
  const resumen = resumenDeSerie(serie);
  if (fontScale <= 2) return resumen.replace(/ /g, DURO);
  if (fontScale <= 3.3) return resumen.replace(/ (?=kg|reps)/g, DURO).replace('× ', `×${DURO}`);
  return resumen;
}

const ETIQUETAS: Record<CampoDeSerie, string> = { peso: 'Peso (kg)', repeticiones: 'Repeticiones', segundos: 'Segundos' };

/** Lo que se apunta de un ejercicio: los segundos en una plancha, o el peso y las repeticiones. */
function camposDe(ejercicio: Ejercicio | undefined): CampoDeSerie[] {
  const mide = (medida: Medida) => ejercicio?.mide.includes(medida) ?? false;
  if (mide('tiempo')) return ['segundos'];
  return [...(mide('peso') ? (['peso'] as const) : []), ...(mide('repeticiones') ? (['repeticiones'] as const) : [])];
}

/** Lo que conviene saber al apuntar un ejercicio, o null. */
function notaDe(ejercicio: Ejercicio | undefined): string | null {
  if (ejercicio?.porMancuerna) return 'peso por mancuerna';
  return ejercicio?.mide.includes('tiempo') ? 'en segundos' : null;
}

/** El hueco del final de cada fila de serie, donde va su marca: hecha, o abierta. */
const MARCA = 26;

/**
 * Un ejercicio del entreno con sus series, una por línea, o una superserie,
 * con una línea por ejercicio en cada vuelta. La serie elegida se abre debajo
 * con botones grandes: se apunta de pie, con una mano. Lo más usado va arriba
 * del panel: repetir la serie anterior.
 */
export function BloqueDeEjercicio({
  bloque,
  nombre,
  ejercicios,
  siguiente,
  ultimo,
  elegida,
  alElegir,
  cambiar,
  conDeshacer,
  asegurarVisible,
  nuevoId,
}: {
  bloque: BloqueDeEjercicios;
  /** Cómo se nombra el bloque para el lector de pantalla y en los avisos, con su ordinal si hace falta. */
  nombre: NombreDeBloque;
  /** Los ejercicios del bloque, en su orden; undefined si alguno no se encuentra. */
  ejercicios: (Ejercicio | undefined)[];
  /** El nombre del bloque de ejercicios de después, con el que se puede enlazar en superserie, o null. */
  siguiente: string | null;
  /** El último bloque no tiene descanso hasta el siguiente. */
  ultimo: boolean;
  elegida: string | null;
  alElegir: (serieId: string | null) => void;
  cambiar: (cambio: Cambio) => void;
  /** Hace un cambio que se puede deshacer desde el aviso, como quitar o enlazar. */
  conDeshacer: (aviso: string, cambio: Cambio) => void;
  /** Desplaza la pantalla hasta que se vea lo que ocupa esta franja de la ventana. */
  asegurarVisible: (desdeArriba: number, alto: number) => void;
  nuevoId: () => string;
}) {
  const paleta = usePaleta();
  // El número y la marca de cada fila crecen con la letra del sistema, como el texto de al lado.
  const { fontScale } = useWindowDimensions();
  // Con la letra grande, lo que va en fila se parte en líneas, como en la maqueta.
  const grande = esLetraGrande(fontScale);
  const panel = useRef<ComponentRef<typeof View>>(null);
  // Lo que se ve: los nombres sin ordinal. El lector de pantalla y los avisos usan los de «nombre».
  const nombres = bloque.ejercicioIds.map((id, c) => ejercicios[c]?.nombre ?? id);
  const superserie = nombres.length > 1;
  const notas = ejercicios.flatMap((ejercicio, c) => {
    const nota = notaDe(ejercicio);
    if (nota === null) return [];
    return [{ c, texto: superserie ? `${nombres[c]}: ${nota}` : nota.charAt(0).toUpperCase() + nota.slice(1) }];
  });

  const titulo = (
    <>
      <Text accessibilityRole="header" style={[estilos.titulo, { color: paleta.texto }]}>
        {nombres.join(' + ')}
      </Text>
      {notas.map((nota) => (
        <Text key={nota.c} style={[estilos.nota, { color: paleta.textoTenue }]}>
          {nota.texto}
        </Text>
      ))}
    </>
  );
  const quitar = (
    <Boton
      titulo="Quitar"
      etiqueta={`Quitar ${nombre.enFrase}`}
      variante="sutil"
      alPulsar={() =>
        conDeshacer(`${nombre.alEmpezar} ${superserie ? 'quitada' : 'quitado'}`, (e) => quitarBloque(e, bloque.id))
      }
    />
  );
  const marca = { width: MARCA * fontScale, height: MARCA * fontScale, borderRadius: (MARCA * fontScale) / 2 };
  /** Lo apuntado en una serie, en cifras tabulares, o «Sin apuntar» en el color tenue. */
  const textoDelResumen = (serie: SerieEnEdicion) => {
    const vacia = serieVaciaDeDatos(serie);
    return (
      <Text
        style={[
          datos,
          superserie ? estilos.resumenDeSuperserie : estilos.resumen,
          vacia && estilos.sinApuntar,
          { color: vacia ? paleta.textoTenue : paleta.texto },
        ]}
      >
        {resumenDeSerie(serie)}
      </Text>
    );
  };

  return (
    <Tarjeta testID="bloque" relleno={espacio[2]} style={estilos.bloque}>
      {superserie ? (
        // En una superserie, el nombre es largo: la insignia y los botones van encima, y el nombre debajo, entero.
        <View testID="encabezado">
          <View testID="cabecera" style={[estilos.cabecera, estilos.cabeceraDeSuperserie]}>
            <Text style={[estilos.insignia, { backgroundColor: paleta.insignia, color: paleta.primarioTexto }]}>
              SUPERSERIE
            </Text>
            <View testID="botones-de-la-cabecera" style={estilos.botonesDeLaCabecera}>
              <Boton
                titulo="Separar"
                etiqueta={`Separar ${nombre.enFrase}`}
                variante="sutil"
                alPulsar={() => conDeshacer('Superserie separada', (e) => separar(e, bloque.id, nuevoId))}
              />
              {quitar}
            </View>
          </View>
          <View style={estilos.nombre}>{titulo}</View>
        </View>
      ) : (
        <View testID="cabecera" style={estilos.cabecera}>
          <View style={[estilos.nombre, estilos.nombreAlLado]}>{titulo}</View>
          {quitar}
        </View>
      )}

      <View testID="vueltas" style={superserie && estilos.vueltas}>
        {bloque.vueltas.map((vuelta, v) => (
          <View key={vuelta[0].id}>
            {vuelta.map((serie, c) => {
              const abierta = serie.id === elegida;
              const anterior = bloque.vueltas[v - 1]?.[c];
              const ejercicio = ejercicios[c];
              const resumen = resumenDeSerie(serie);
              return (
                // La serie abierta y su panel van juntos, en el rosa suave y con el borde rosa.
                <View
                  key={serie.id}
                  testID={abierta ? 'serie-abierta' : undefined}
                  style={abierta && [estilos.abierta, { backgroundColor: paleta.tintePrimario, borderColor: paleta.primario }]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${superserie ? `Vuelta ${v + 1}, ${nombre.ejercicios[c]}` : `Serie ${v + 1}`}: ${resumen}${serie.hecha !== null ? ', hecha' : ''}`}
                    accessibilityState={{ expanded: abierta }}
                    onPress={() => alElegir(abierta ? null : serie.id)}
                    style={({ pressed }) => [estilos.fila, pressed && estilos.pulsado]}
                  >
                    <Text
                      style={[
                        datos,
                        estilos.numero,
                        { width: espacio[6] * fontScale, color: abierta ? paleta.primarioTexto : paleta.textoTenue },
                        abierta && estilos.numeroAbierto,
                      ]}
                    >
                      {c === 0 ? v + 1 : ''}
                    </Text>
                    {superserie && grande ? (
                      // Con la letra grande, el nombre entero y el resumen debajo.
                      <View testID="ejercicio-y-resumen" style={estilos.enColumna}>
                        <Text style={[estilos.deQue, { color: paleta.textoTenue }]}>{nombres[c]}</Text>
                        {textoDelResumen(serie)}
                      </View>
                    ) : (
                      <>
                        {superserie && (
                          <Text
                            numberOfLines={1}
                            style={[estilos.deQue, estilos.deQueEnFila, { color: paleta.textoTenue }]}
                          >
                            {nombres[c]}
                          </Text>
                        )}
                        {textoDelResumen(serie)}
                      </>
                    )}
                    {/* Al final, la flecha para plegar la serie abierta, el círculo de hecha o un
                        hueco del mismo ancho, para que los resúmenes queden en columna. */}
                    {abierta ? (
                      <View testID="marca-abierta" style={[estilos.marca, marca]}>
                        <Icono nombre="plegar" color={paleta.primario} tamano={22} />
                      </View>
                    ) : serie.hecha !== null ? (
                      <View testID="marca-de-hecha" style={[estilos.marca, marca, { backgroundColor: paleta.primario }]}>
                        <Icono nombre="hecha" color={paleta.sobrePrimario} tamano={16} />
                      </View>
                    ) : (
                      <View testID="marca-vacia" style={marca} />
                    )}
                  </Pressable>

                  {abierta && (
                    <View
                      ref={panel}
                      onLayout={() =>
                        panel.current?.measureInWindow((_x, y, _ancho, alto) => asegurarVisible(y, alto))
                      }
                      testID="panel"
                      style={estilos.panel}
                    >
                      {anterior !== undefined && !serieVaciaDeDatos(anterior) && (
                        <Boton
                          // El resumen no se parte por dentro, como en «70 kg ×» y «8)»: si no cabe,
                          // la línea se parte antes del paréntesis. El lector de pantalla lee la
                          // etiqueta, con espacios normales.
                          titulo={`Igual que la anterior (${resumenSinPartir(anterior, fontScale)})`}
                          etiqueta={`Igual que la anterior (${resumenDeSerie(anterior)})`}
                          icono="repetir"
                          variante="contorno"
                          alPulsar={() => cambiar((e) => igualQueLaAnterior(e, bloque.id, serie.id))}
                        />
                      )}
                      <View testID="campos" style={estilos.campos}>
                        {camposDe(ejercicio).map((campo) => (
                          <CampoConPasos
                            key={campo}
                            etiqueta={
                              campo === 'peso' && ejercicio?.porMancuerna ? 'Peso (kg por mancuerna)' : ETIQUETAS[campo]
                            }
                            valor={serie[campo]}
                            decimales={campo === 'peso'}
                            enFila
                            alCambiar={(valor) => cambiar((e) => cambiarSerie(e, bloque.id, serie.id, { [campo]: valor }))}
                            alDarUnPaso={(sentido) =>
                              cambiar((e) => pasoDeSerie(e, bloque.id, serie.id, campo, sentido))
                            }
                          />
                        ))}
                      </View>
                      {/* Hecha y Quitar van en fila, como en la maqueta, salvo con la letra grande o
                          con la serie ya hecha, que dice a qué hora: entonces Hecha ocupa su línea. */}
                      <View testID="acciones" style={estilos.acciones}>
                        <View
                          testID="hecha"
                          style={[estilos.hecha, (grande || serie.hecha !== null) && estilos.lineaEntera]}
                        >
                          <Boton
                            titulo={
                              serie.hecha === null ? 'Hecha' : `Hecha a las ${horaDeInstante(serie.hecha)}: quitar la marca`
                            }
                            icono="hecha"
                            iconoDetras={serie.hecha === null}
                            variante={serie.hecha === null ? 'relleno' : 'secundario'}
                            alPulsar={() => {
                              cambiar((e) => marcarHecha(e, bloque.id, serie.id, serie.hecha === null ? Date.now() : null));
                              if (serie.hecha !== null) return;
                              // En una superserie se sigue con el ejercicio siguiente de la vuelta. El
                              // botón desaparece, así que el lector de pantalla dice adónde se ha ido.
                              const otra = vuelta[c + 1];
                              alElegir(otra?.id ?? null);
                              AccessibilityInfo.announceForAccessibility(
                                otra === undefined
                                  ? `${superserie ? 'Vuelta' : 'Serie'} ${v + 1} hecha.`
                                  : `Hecha. Ahora, ${nombre.ejercicios[c + 1]}, vuelta ${v + 1}.`,
                              );
                            }}
                          />
                        </View>
                        <Boton
                          titulo={superserie ? `Quitar la vuelta ${v + 1}` : 'Quitar esta serie'}
                          variante="sutil"
                          alPulsar={() => {
                            conDeshacer(
                              `${superserie ? 'Vuelta' : 'Serie'} ${v + 1} de ${nombre.enFrase} quitada`,
                              (e) => quitarVuelta(e, bloque.id, serie.id),
                            );
                            alElegir(null);
                          }}
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <View testID="anadir-serie" style={estilos.alPrincipio}>
        <Boton
          titulo={superserie ? 'Vuelta' : 'Serie'}
          etiqueta={superserie ? `Añadir una vuelta a ${nombre.enFrase}` : `Añadir una serie de ${nombre.enFrase}`}
          icono="mas"
          variante="enlace"
          alPulsar={() => {
            const ids = bloque.ejercicioIds.map(() => nuevoId());
            cambiar((e) => anadirVuelta(e, bloque.id, ids));
            alElegir(ids[0]);
          }}
        />
      </View>

      <Descansos
        bloqueId={bloque.id}
        nombre={nombre.enFrase}
        entreSeries={{ titulo: superserie ? 'Entre vueltas' : 'Entre series', valor: bloque.descansoEntreSeries }}
        despues={ultimo ? null : bloque.descansoDespues}
        cambiar={cambiar}
      />

      {/* Enlazar es cosa de dos bloques: va donde se tocan, al final del primero, y nombra al
          segundo. Va apartado de los descansos, para no tocarlo sin querer, y se puede deshacer. */}
      {siguiente !== null && (
        <View testID="enlazar" style={estilos.enlazar}>
          <Boton
            titulo={`Enlazar en superserie con ${siguiente}`}
            icono="enlazar"
            variante="enlaceLargo"
            alPulsar={() => conDeshacer(`En superserie con ${siguiente}`, (e) => enlazar(e, bloque.id, nuevoId))}
          />
        </View>
      )}
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  bloque: {
    gap: espacio[1],
  },
  cabecera: {
    minHeight: toqueMinimo,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[2],
  },
  cabeceraDeSuperserie: {
    justifyContent: 'space-between',
    // Con la letra grande, los botones bajan a otra línea antes que salirse.
    flexWrap: 'wrap',
  },
  botonesDeLaCabecera: {
    flexDirection: 'row',
    // Con la letra enorme, Separar y Quitar se apilan, a la derecha, antes que salirse de la pantalla.
    flexWrap: 'wrap',
    flexShrink: 1,
    justifyContent: 'flex-end',
    gap: espacio[1],
  },
  insignia: {
    marginLeft: espacio[3],
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: texto.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  nombre: {
    marginHorizontal: espacio[3],
  },
  nombreAlLado: {
    flex: 1,
    marginRight: 0,
  },
  titulo: titulos.bloque,
  nota: {
    fontSize: texto.s,
  },
  vueltas: {
    marginTop: 2,
    gap: 6,
  },
  abierta: {
    borderWidth: 2,
    borderRadius: radio.boton,
    overflow: 'hidden',
  },
  fila: {
    minHeight: toqueMinimo,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: espacio[3],
  },
  numero: {
    fontSize: texto.m,
    fontWeight: '600',
    textAlign: 'center',
  },
  numeroAbierto: {
    fontWeight: '700',
  },
  deQue: {
    fontSize: texto.s,
  },
  deQueEnFila: {
    flex: 1,
  },
  enColumna: {
    flex: 1,
  },
  resumen: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
  },
  resumenDeSuperserie: {
    // Con la letra normal, un resumen muy largo se parte antes que salirse de la fila.
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '500',
  },
  sinApuntar: {
    fontSize: texto.m,
  },
  marca: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    paddingTop: 2,
    paddingHorizontal: espacio[2],
    paddingBottom: 10,
    gap: espacio[2],
  },
  campos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacio[2],
  },
  acciones: {
    marginTop: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacio[2],
  },
  hecha: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 140,
  },
  lineaEntera: {
    flexBasis: '100%',
  },
  alPrincipio: {
    alignItems: 'flex-start',
  },
  enlazar: {
    marginTop: 6,
  },
  pulsado: {
    opacity: 0.7,
  },
});

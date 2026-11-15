import { useRef, type ComponentRef } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/componentes/Boton';
import { CampoConPasos } from '@/componentes/CampoConPasos';
import type { Medida } from '@/datos/catalogo';
import type { Ejercicio } from '@/datos/ejercicios';
import { horaDeInstante } from '@/datos/fechas';
import { usePaleta } from '@/tema/colores';
import { datos, espacio, radio, texto, titulos, toqueMinimo } from '@/tema/medidas';

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
  color,
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
  color: string;
}) {
  const paleta = usePaleta();
  const panel = useRef<ComponentRef<typeof View>>(null);
  // Lo que se ve: los nombres sin ordinal. El lector de pantalla y los avisos usan los de «nombre».
  const nombres = bloque.ejercicioIds.map((id, c) => ejercicios[c]?.nombre ?? id);
  const superserie = nombres.length > 1;
  const notas = ejercicios.flatMap((ejercicio, c) => {
    const nota = notaDe(ejercicio);
    if (nota === null) return [];
    return [{ c, texto: superserie ? `${nombres[c]}: ${nota}` : nota.charAt(0).toUpperCase() + nota.slice(1) }];
  });

  return (
    <View style={[estilos.bloque, { borderColor: paleta.textoTenue }]}>
      <View style={estilos.cabecera}>
        <View style={estilos.nombre}>
          {superserie && <Text style={[estilos.insignia, { color }]}>SUPERSERIE</Text>}
          <Text accessibilityRole="header" style={[estilos.titulo, { color: paleta.texto }]}>
            {nombres.join(' + ')}
          </Text>
          {notas.map((nota) => (
            <Text key={nota.c} style={[estilos.nota, { color: paleta.textoTenue }]}>
              {nota.texto}
            </Text>
          ))}
        </View>
        {superserie && (
          <Boton
            titulo="Separar"
            etiqueta={`Separar ${nombre.enFrase}`}
            variante="sutil"
            color={paleta.textoTenue}
            alPulsar={() => conDeshacer('Superserie separada', (e) => separar(e, bloque.id, nuevoId))}
          />
        )}
        <Boton
          titulo="Quitar"
          etiqueta={`Quitar ${nombre.enFrase}`}
          variante="sutil"
          color={paleta.textoTenue}
          alPulsar={() =>
            conDeshacer(`${nombre.alEmpezar} ${superserie ? 'quitada' : 'quitado'}`, (e) => quitarBloque(e, bloque.id))
          }
        />
      </View>

      {bloque.vueltas.map((vuelta, v) => (
        <View key={vuelta[0].id} style={superserie && v > 0 ? estilos.otraVuelta : undefined}>
          {vuelta.map((serie, c) => {
            const abierta = serie.id === elegida;
            const anterior = bloque.vueltas[v - 1]?.[c];
            const ejercicio = ejercicios[c];
            const resumen = resumenDeSerie(serie);
            return (
              <View key={serie.id}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${superserie ? `Vuelta ${v + 1}, ${nombre.ejercicios[c]}` : `Serie ${v + 1}`}: ${resumen}${serie.hecha !== null ? ', hecha' : ''}`}
                  accessibilityState={{ expanded: abierta }}
                  onPress={() => alElegir(abierta ? null : serie.id)}
                  style={[estilos.fila, abierta && { backgroundColor: paleta.superficie }]}
                >
                  <Text style={[datos, estilos.numero, { color: paleta.textoTenue }]}>{c === 0 ? v + 1 : ''}</Text>
                  {superserie && (
                    <Text numberOfLines={1} style={[estilos.deQue, { color: paleta.textoTenue }]}>
                      {nombres[c]}
                    </Text>
                  )}
                  <Text
                    style={[
                      datos,
                      superserie ? estilos.resumenDeSuperserie : estilos.resumen,
                      { color: serieVaciaDeDatos(serie) ? paleta.textoTenue : paleta.texto },
                    ]}
                  >
                    {resumen}
                  </Text>
                  {serie.hecha !== null && <Text style={[estilos.hecha, { color }]}>✓</Text>}
                </Pressable>

                {abierta && (
                  <View
                    ref={panel}
                    onLayout={() =>
                      panel.current?.measureInWindow((_x, y, _ancho, alto) => asegurarVisible(y, alto))
                    }
                    style={[estilos.panel, { backgroundColor: paleta.superficie }]}
                  >
                    {anterior !== undefined && !serieVaciaDeDatos(anterior) && (
                      <Boton
                        titulo={`Igual que la anterior (${resumenDeSerie(anterior)})`}
                        alPulsar={() => cambiar((e) => igualQueLaAnterior(e, bloque.id, serie.id))}
                      />
                    )}
                    {camposDe(ejercicio).map((campo) => (
                      <CampoConPasos
                        key={campo}
                        etiqueta={campo === 'peso' && ejercicio?.porMancuerna ? 'Peso (kg por mancuerna)' : ETIQUETAS[campo]}
                        valor={serie[campo]}
                        decimales={campo === 'peso'}
                        alCambiar={(valor) => cambiar((e) => cambiarSerie(e, bloque.id, serie.id, { [campo]: valor }))}
                        alDarUnPaso={(sentido) => cambiar((e) => pasoDeSerie(e, bloque.id, serie.id, campo, sentido))}
                      />
                    ))}
                    <View style={estilos.acciones}>
                      <Boton
                        titulo={serie.hecha === null ? 'Hecha ✓' : `Hecha a las ${horaDeInstante(serie.hecha)}: quitar ✓`}
                        variante={serie.hecha === null ? 'principal' : 'secundario'}
                        color={color}
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
                      <Boton
                        titulo={superserie ? `Quitar la vuelta ${v + 1}` : 'Quitar esta serie'}
                        variante="sutil"
                        color={paleta.textoTenue}
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

      <Boton
        titulo={superserie ? '+ Vuelta' : '+ Serie'}
        etiqueta={superserie ? `Añadir una vuelta a ${nombre.enFrase}` : `Añadir una serie de ${nombre.enFrase}`}
        variante="sutil"
        color={color}
        alPulsar={() => {
          const ids = bloque.ejercicioIds.map(() => nuevoId());
          cambiar((e) => anadirVuelta(e, bloque.id, ids));
          alElegir(ids[0]);
        }}
      />

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
        <View style={estilos.enlazar}>
          <Boton
            titulo={`Enlazar en superserie con ${siguiente}`}
            variante="sutil"
            color={color}
            alPulsar={() => conDeshacer(`En superserie con ${siguiente}`, (e) => enlazar(e, bloque.id, nuevoId))}
          />
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radio.tarjeta,
    paddingVertical: espacio[2],
    gap: espacio[1],
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: espacio[3],
  },
  nombre: {
    flex: 1,
  },
  insignia: {
    fontSize: texto.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  titulo: titulos.bloque,
  nota: {
    fontSize: texto.s,
  },
  otraVuelta: {
    marginTop: espacio[2],
  },
  fila: {
    minHeight: toqueMinimo,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[3],
    paddingHorizontal: espacio[3],
  },
  numero: {
    width: espacio[6],
    fontSize: texto.m,
  },
  deQue: {
    flex: 1,
    fontSize: texto.s,
  },
  resumen: {
    flex: 1,
    fontSize: texto.l,
  },
  resumenDeSuperserie: {
    fontSize: texto.l,
  },
  hecha: {
    fontSize: texto.l,
    fontWeight: '700',
  },
  panel: {
    padding: espacio[3],
    gap: espacio[3],
  },
  acciones: {
    gap: espacio[2],
  },
  enlazar: {
    marginTop: espacio[3],
  },
});

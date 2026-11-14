import { useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Boton } from '@/componentes/Boton';
import type { Ejercicio } from '@/datos/ejercicios';
import { horaDeInstante } from '@/datos/fechas';
import { usePaleta } from '@/tema/colores';
import { datos, espacio, radio, texto, toqueMinimo } from '@/tema/medidas';

import {
  anadirSerie,
  cambiarSerie,
  igualQueLaAnterior,
  marcarHecha,
  pasoDeSerie,
  quitarBloque,
  quitarSerie,
  serieVaciaDeDatos,
  type BloqueEnEdicion,
  type CampoDeSerie,
  type EntrenoEnEdicion,
  type SerieEnEdicion,
} from './editor';

type Cambio = (e: EntrenoEnEdicion) => EntrenoEnEdicion;

/** Lo que dice una serie en su fila: «62,5 kg × 8», «8 reps», «1:30» o «Sin apuntar». */
export function resumenDeSerie(serie: SerieEnEdicion): string {
  if (serieVaciaDeDatos(serie)) return 'Sin apuntar';
  if (serie.segundos.trim() !== '') {
    const s = Number(serie.segundos);
    return Number.isInteger(s) ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : serie.segundos;
  }
  const peso = serie.peso.trim() === '' ? null : `${serie.peso} kg`;
  const reps = serie.repeticiones.trim() === '' ? null : serie.repeticiones;
  if (peso && reps) return `${peso} × ${reps}`;
  return peso ?? `${reps} reps`;
}

/**
 * Un ejercicio del entreno con sus series, una por línea. La serie elegida se
 * abre debajo con botones grandes: se apunta de pie, con una mano. Lo más
 * usado va arriba del panel: repetir la serie anterior.
 */
export function BloqueDeEjercicio({
  bloque,
  ejercicio,
  elegida,
  alElegir,
  cambiar,
  quitar,
  asegurarVisible,
  nuevoId,
  color,
}: {
  bloque: BloqueEnEdicion;
  ejercicio: Ejercicio | undefined;
  elegida: string | null;
  alElegir: (serieId: string | null) => void;
  cambiar: (cambio: Cambio) => void;
  /** Quita algo, con la opción de deshacerlo. */
  quitar: (que: string, cambio: Cambio) => void;
  /** Desplaza la pantalla hasta que se vea lo que ocupa esta franja de la ventana. */
  asegurarVisible: (desdeArriba: number, alto: number) => void;
  nuevoId: () => string;
  color: string;
}) {
  const paleta = usePaleta();
  const panel = useRef<ComponentRef<typeof View>>(null);
  const nombre = ejercicio?.nombre ?? bloque.ejercicioId;
  const mide = (medida: 'peso' | 'repeticiones' | 'tiempo') => ejercicio?.mide.includes(medida) ?? false;
  const campos: CampoDeSerie[] = mide('tiempo')
    ? ['segundos']
    : [...(mide('peso') ? (['peso'] as const) : []), ...(mide('repeticiones') ? (['repeticiones'] as const) : [])];
  const nota = ejercicio?.porMancuerna ? 'Peso por mancuerna' : mide('tiempo') ? 'En segundos' : null;

  return (
    <View style={[estilos.bloque, { borderColor: paleta.textoTenue }]}>
      <View style={estilos.cabecera}>
        <View style={estilos.nombre}>
          <Text accessibilityRole="header" style={[estilos.titulo, { color: paleta.texto }]}>
            {nombre}
          </Text>
          {nota && <Text style={[estilos.nota, { color: paleta.textoTenue }]}>{nota}</Text>}
        </View>
        <Boton
          titulo="Quitar"
          etiqueta={`Quitar ${nombre}`}
          variante="sutil"
          color={paleta.textoTenue}
          alPulsar={() => quitar(`${nombre} quitado`, (e) => quitarBloque(e, bloque.id))}
        />
      </View>

      {bloque.series.map((serie, i) => {
        const abierta = serie.id === elegida;
        const anterior = bloque.series[i - 1];
        return (
          <View key={serie.id}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Serie ${i + 1}: ${resumenDeSerie(serie)}${serie.hecha ? ', hecha' : ''}`}
              accessibilityState={{ expanded: abierta }}
              onPress={() => alElegir(abierta ? null : serie.id)}
              style={[estilos.fila, abierta && { backgroundColor: paleta.fondoElevado }]}
            >
              <Text style={[datos, estilos.numero, { color: paleta.textoTenue }]}>{i + 1}</Text>
              <Text style={[datos, estilos.resumen, { color: serieVaciaDeDatos(serie) ? paleta.textoTenue : paleta.texto }]}>
                {resumenDeSerie(serie)}
              </Text>
              {serie.hecha !== null && <Text style={[estilos.hecha, { color }]}>✓</Text>}
            </Pressable>

            {abierta && (
              <View
                ref={panel}
                onLayout={() =>
                  panel.current?.measureInWindow((_x, y, _ancho, alto) => asegurarVisible(y, alto))
                }
                style={[estilos.panel, { backgroundColor: paleta.fondoElevado }]}
              >
                {anterior !== undefined && !serieVaciaDeDatos(anterior) && (
                  <Boton
                    titulo={`Igual que la anterior (${resumenDeSerie(anterior)})`}
                    alPulsar={() => cambiar((e) => igualQueLaAnterior(e, bloque.id, serie.id))}
                  />
                )}
                {campos.map((campo) => (
                  <CampoConPasos
                    key={campo}
                    campo={campo}
                    valor={serie[campo]}
                    porMancuerna={ejercicio?.porMancuerna ?? false}
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
                      if (serie.hecha === null) alElegir(null);
                    }}
                  />
                  <Boton
                    titulo="Quitar esta serie"
                    variante="sutil"
                    color={paleta.textoTenue}
                    alPulsar={() => {
                      quitar(`Serie ${i + 1} de ${nombre} quitada`, (e) => quitarSerie(e, bloque.id, serie.id));
                      alElegir(null);
                    }}
                  />
                </View>
              </View>
            )}
          </View>
        );
      })}

      <Boton
        titulo="+ Serie"
        etiqueta={`Añadir una serie de ${nombre}`}
        variante="sutil"
        color={color}
        alPulsar={() => {
          const id = nuevoId();
          cambiar((e) => anadirSerie(e, bloque.id, id));
          alElegir(id);
        }}
      />
    </View>
  );
}

const ETIQUETAS: Record<CampoDeSerie, string> = { peso: 'Peso (kg)', repeticiones: 'Repeticiones', segundos: 'Segundos' };

/** Un número con un menos y un más a los lados, y el teclado en medio por si hay que saltar lejos. */
function CampoConPasos({
  campo,
  valor,
  porMancuerna,
  alCambiar,
  alDarUnPaso,
}: {
  campo: CampoDeSerie;
  valor: string;
  porMancuerna: boolean;
  alCambiar: (valor: string) => void;
  alDarUnPaso: (sentido: 1 | -1) => void;
}) {
  const paleta = usePaleta();
  const etiqueta = campo === 'peso' && porMancuerna ? 'Peso (kg por mancuerna)' : ETIQUETAS[campo];
  return (
    <View style={estilos.campo}>
      <Text style={[estilos.etiqueta, { color: paleta.textoTenue }]}>{etiqueta}</Text>
      <View style={estilos.conPasos}>
        <Boton titulo="−" etiqueta={`Bajar ${etiqueta}`} alPulsar={() => alDarUnPaso(-1)} />
        <TextInput
          accessibilityLabel={etiqueta}
          value={valor}
          onChangeText={alCambiar}
          keyboardType={campo === 'peso' ? 'decimal-pad' : 'number-pad'}
          selectTextOnFocus
          style={[datos, estilos.entrada, { color: paleta.texto, borderColor: paleta.textoTenue }]}
        />
        <Boton titulo="+" etiqueta={`Subir ${etiqueta}`} alPulsar={() => alDarUnPaso(1)} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radio,
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
  titulo: {
    fontSize: texto.l,
    fontWeight: '700',
  },
  nota: {
    fontSize: texto.s,
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
  resumen: {
    flex: 1,
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
  campo: {
    gap: espacio[1],
  },
  etiqueta: {
    fontSize: texto.s,
  },
  conPasos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[2],
  },
  entrada: {
    flex: 1,
    minHeight: toqueMinimo,
    borderWidth: 1.5,
    borderRadius: radio,
    fontSize: texto.xl,
    textAlign: 'center',
  },
  acciones: {
    gap: espacio[2],
  },
});

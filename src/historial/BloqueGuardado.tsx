import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Icono } from '@/componentes/Icono';
import { Tarjeta } from '@/componentes/Tarjeta';
import type { Ejercicio } from '@/datos/ejercicios';
import type { Bloque } from '@/datos/entrenos';
import { metrosATexto } from '@/datos/unidades';
import { notasDelBloque } from '@/gimnasio/editor';
import { usePaleta } from '@/tema/colores';
import { datos, esLetraGrande, espacio, texto, titulos } from '@/tema/medidas';

import { resumenDeSerieGuardada, textoDelDescansoGuardado, textoDelTiempoGuardado } from './textos';

/** El icono de los descansos, centrado con la primera línea de su texto, que va en líneas de 20. */
const ICONO_DE_LOS_DESCANSOS = 18;
const LINEA_DE_LOS_DESCANSOS = 20;

/**
 * Un bloque de un entreno guardado, para leerlo, en su tarjeta: una carrera
 * con su distancia y su tiempo, o un ejercicio con sus series, una por línea,
 * y lo que conviene saber de él, como «Peso por mancuerna». En una superserie,
 * cada vuelta lleva una línea por ejercicio. Abajo, tras una raya, sus
 * descansos, si se apuntaron. Con la letra grande, en una superserie, el
 * nombre de cada ejercicio va encima de lo que se hizo, entero.
 */
export function BloqueGuardado({
  bloque,
  ejercicios,
}: {
  bloque: Bloque;
  /** Los ejercicios del entreno, por su clave. */
  ejercicios: ReadonlyMap<string, Ejercicio>;
}) {
  const paleta = usePaleta();
  // El número de cada serie crece con la letra del sistema, como el texto de al lado.
  const { fontScale } = useWindowDimensions();
  const grande = esLetraGrande(fontScale);
  const descansoDespues =
    bloque.descansoMs === null ? null : `${textoDelDescansoGuardado(bloque.descansoMs)} antes del siguiente`;

  const pieDeDescansos = (frase: string) => (
    <View testID="descansos" style={[estilos.descansos, { borderTopColor: paleta.bordeSuave }]}>
      <View style={estilos.iconoDeLosDescansos}>
        <Icono nombre="cronometro" color={paleta.textoTenue} tamano={ICONO_DE_LOS_DESCANSOS} />
      </View>
      <Text style={[datos, estilos.textoDeLosDescansos, { color: paleta.textoTenue }]}>{frase}</Text>
    </View>
  );

  if (bloque.metrosCorridos !== null && bloque.series.length === 0) {
    const tiempo = bloque.tiempoMs === null ? '' : ` en ${textoDelTiempoGuardado(bloque.tiempoMs)}`;
    return (
      <Tarjeta testID="bloque" style={estilos.bloque}>
        {/* En el gimnasio, la carrera es la de la cinta. */}
        <Text accessibilityRole="header" style={[estilos.titulo, { color: paleta.texto }]}>
          Carrera en cinta
        </Text>
        <Text style={[datos, estilos.carrera, { color: paleta.texto }]}>
          {metrosATexto(bloque.metrosCorridos)} km{tiempo}
        </Text>
        {descansoDespues !== null && pieDeDescansos(`Descanso: ${descansoDespues}`)}
      </Tarjeta>
    );
  }

  // Cada sitio de la vuelta es un ejercicio; las vueltas, en orden.
  const ordenadas = [...bloque.series].sort((a, b) => a.ronda - b.ronda || a.orden - b.orden);
  const columnas = [...new Map(ordenadas.map((serie) => [serie.orden, serie.ejercicioId])).entries()].sort(
    ([a], [b]) => a - b,
  );
  const superserie = columnas.length > 1;
  const nombreDe = (ejercicioId: string) => ejercicios.get(ejercicioId)?.nombre ?? ejercicioId;
  const nombres = columnas.map(([, ejercicioId]) => nombreDe(ejercicioId));
  const notas = notasDelBloque(
    columnas.map(([, ejercicioId]) => ejercicios.get(ejercicioId)),
    nombres,
  );
  const rondas = [...new Set(ordenadas.map((serie) => serie.ronda))];
  const ultimaRonda = rondas[rondas.length - 1];
  const finDeVuelta = ordenadas.find((serie, i) => serie.ronda < ultimaRonda && ordenadas[i + 1]?.ronda !== serie.ronda);
  const descansoEntre =
    finDeVuelta === undefined || finDeVuelta.descansoMs === null
      ? null
      : `${textoDelDescansoGuardado(finDeVuelta.descansoMs)} entre ${superserie ? 'vueltas' : 'series'}`;
  const descansos = [descansoEntre, descansoDespues].filter((parte) => parte !== null);

  return (
    <Tarjeta testID="bloque" style={estilos.bloque}>
      {superserie && (
        <Text style={[estilos.insignia, { backgroundColor: paleta.insignia, color: paleta.texto }]}>SUPERSERIE</Text>
      )}
      <View testID="nombre-y-notas">
        <Text accessibilityRole="header" style={[estilos.titulo, { color: paleta.texto }]}>
          {nombres.join(' + ')}
        </Text>
        {notas.map((nota) => (
          <Text key={nota.c} style={[estilos.nota, { color: paleta.textoTenue }]}>
            {nota.texto}
          </Text>
        ))}
      </View>
      <View testID="series" style={estilos.series}>
        {rondas.map((ronda, v) => (
          <View key={ronda} style={superserie && v > 0 ? estilos.otraVuelta : undefined}>
            {ordenadas
              .filter((serie) => serie.ronda === ronda)
              .map((serie, c) => {
                const resumen = (
                  <Text style={[datos, estilos.resumen, { color: paleta.texto }]}>{resumenDeSerieGuardada(serie)}</Text>
                );
                return (
                  <View
                    key={serie.id}
                    testID="serie"
                    accessible
                    accessibilityLabel={`${superserie ? `Vuelta ${v + 1}, ${nombreDe(serie.ejercicioId)}` : `Serie ${v + 1}`}: ${resumenDeSerieGuardada(serie)}`}
                    style={estilos.fila}
                  >
                    <Text
                      style={[datos, estilos.numero, { width: espacio[6] * fontScale, color: paleta.textoTenue }]}
                    >
                      {c === 0 ? v + 1 : ''}
                    </Text>
                    {superserie && grande ? (
                      // Con la letra grande, el nombre entero y, debajo, lo que se hizo.
                      <View testID="ejercicio-y-resumen" style={estilos.enColumna}>
                        <Text style={[estilos.deQue, { color: paleta.textoTenue }]}>{nombreDe(serie.ejercicioId)}</Text>
                        {resumen}
                      </View>
                    ) : (
                      <>
                        {superserie && (
                          <Text numberOfLines={1} style={[estilos.deQue, estilos.deQueEnFila, { color: paleta.textoTenue }]}>
                            {nombreDe(serie.ejercicioId)}
                          </Text>
                        )}
                        {resumen}
                      </>
                    )}
                  </View>
                );
              })}
          </View>
        ))}
      </View>
      {descansos.length > 0 && pieDeDescansos(`Descansos: ${descansos.join(' · ')}`)}
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  // Como en la maqueta: 14 arriba y 16 a los lados y abajo, y 4 entre lo de dentro.
  bloque: {
    paddingTop: 14,
    gap: espacio[1],
  },
  insignia: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: texto.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  titulo: titulos.bloque,
  nota: {
    fontSize: texto.s,
  },
  carrera: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: '500',
  },
  series: {
    marginTop: 2,
  },
  otraVuelta: {
    marginTop: espacio[2],
  },
  fila: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[3],
  },
  numero: {
    fontSize: texto.m,
    fontWeight: '600',
    textAlign: 'center',
  },
  resumen: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '500',
  },
  enColumna: {
    flex: 1,
    paddingVertical: espacio[1],
  },
  deQue: {
    fontSize: texto.s,
  },
  deQueEnFila: {
    flex: 1,
  },
  descansos: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacio[2],
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  iconoDeLosDescansos: {
    marginTop: (LINEA_DE_LOS_DESCANSOS - ICONO_DE_LOS_DESCANSOS) / 2,
  },
  textoDeLosDescansos: {
    flexShrink: 1,
    fontSize: texto.s,
    lineHeight: LINEA_DE_LOS_DESCANSOS,
  },
});

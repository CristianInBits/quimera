import { StyleSheet, Text, View } from 'react-native';

import { Tarjeta } from '@/componentes/Tarjeta';
import type { Bloque } from '@/datos/entrenos';
import { metrosATexto } from '@/datos/unidades';
import { usePaleta } from '@/tema/colores';
import { datos, espacio, texto, titulos } from '@/tema/medidas';

import { resumenDeSerieGuardada, textoDelDescansoGuardado, textoDelTiempoGuardado } from './textos';

/**
 * Un bloque de un entreno guardado, para leerlo: una carrera con su distancia
 * y su tiempo, o un ejercicio con sus series, una por línea. En una superserie,
 * cada vuelta lleva una línea por ejercicio. Debajo, sus descansos, si se
 * apuntaron.
 */
export function BloqueGuardado({
  bloque,
  nombres,
  color,
}: {
  bloque: Bloque;
  /** El nombre de cada ejercicio, por su clave. */
  nombres: ReadonlyMap<string, string>;
  color: string;
}) {
  const paleta = usePaleta();
  const descansoDespues =
    bloque.descansoMs === null ? null : `${textoDelDescansoGuardado(bloque.descansoMs)} antes del siguiente`;

  if (bloque.metrosCorridos !== null && bloque.series.length === 0) {
    const tiempo = bloque.tiempoMs === null ? '' : ` en ${textoDelTiempoGuardado(bloque.tiempoMs)}`;
    return (
      <Tarjeta style={estilos.bloque}>
        {/* En el gimnasio, la carrera es la de la cinta. */}
        <Text accessibilityRole="header" style={[estilos.titulo, { color: paleta.texto }]}>
          Carrera en cinta
        </Text>
        <Text style={[datos, estilos.linea, { color: paleta.texto }]}>
          {metrosATexto(bloque.metrosCorridos)} km{tiempo}
        </Text>
        {descansoDespues !== null && (
          <Text style={[estilos.descansos, { color: paleta.textoTenue }]}>Descanso: {descansoDespues}</Text>
        )}
      </Tarjeta>
    );
  }

  // Cada sitio de la vuelta es un ejercicio; las vueltas, en orden.
  const ordenadas = [...bloque.series].sort((a, b) => a.ronda - b.ronda || a.orden - b.orden);
  const columnas = [...new Map(ordenadas.map((serie) => [serie.orden, serie.ejercicioId])).entries()].sort(
    ([a], [b]) => a - b,
  );
  const superserie = columnas.length > 1;
  const nombreDe = (ejercicioId: string) => nombres.get(ejercicioId) ?? ejercicioId;
  const rondas = [...new Set(ordenadas.map((serie) => serie.ronda))];
  const ultimaRonda = rondas[rondas.length - 1];
  const finDeVuelta = ordenadas.find((serie, i) => serie.ronda < ultimaRonda && ordenadas[i + 1]?.ronda !== serie.ronda);
  const descansoEntre =
    finDeVuelta === undefined || finDeVuelta.descansoMs === null
      ? null
      : `${textoDelDescansoGuardado(finDeVuelta.descansoMs)} entre ${superserie ? 'vueltas' : 'series'}`;
  const descansos = [descansoEntre, descansoDespues].filter((parte) => parte !== null);

  return (
    <Tarjeta style={estilos.bloque}>
      {superserie && <Text style={[estilos.insignia, { color }]}>SUPERSERIE</Text>}
      <Text accessibilityRole="header" style={[estilos.titulo, { color: paleta.texto }]}>
        {columnas.map(([, ejercicioId]) => nombreDe(ejercicioId)).join(' + ')}
      </Text>
      {rondas.map((ronda, v) => (
        <View key={ronda} style={superserie && v > 0 ? estilos.otraVuelta : undefined}>
          {ordenadas
            .filter((serie) => serie.ronda === ronda)
            .map((serie, c) => (
              <View
                key={serie.id}
                accessible
                accessibilityLabel={`${superserie ? `Vuelta ${v + 1}, ${nombreDe(serie.ejercicioId)}` : `Serie ${v + 1}`}: ${resumenDeSerieGuardada(serie)}`}
                style={estilos.fila}
              >
                <Text style={[datos, estilos.numero, { color: paleta.textoTenue }]}>{c === 0 ? v + 1 : ''}</Text>
                {superserie && (
                  <Text numberOfLines={1} style={[estilos.deQue, { color: paleta.textoTenue }]}>
                    {nombreDe(serie.ejercicioId)}
                  </Text>
                )}
                <Text style={[datos, estilos.linea, { color: paleta.texto }]}>{resumenDeSerieGuardada(serie)}</Text>
              </View>
            ))}
        </View>
      ))}
      {descansos.length > 0 && (
        <Text style={[estilos.descansos, { color: paleta.textoTenue }]}>Descansos: {descansos.join(' · ')}</Text>
      )}
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  bloque: {
    gap: espacio[1],
  },
  insignia: {
    fontSize: texto.xs,
    fontWeight: '700',
    letterSpacing: 1,
  },
  titulo: titulos.bloque,
  otraVuelta: {
    marginTop: espacio[2],
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[3],
    minHeight: 32,
  },
  numero: {
    width: espacio[6],
    fontSize: texto.m,
  },
  deQue: {
    flex: 1,
    fontSize: texto.s,
  },
  linea: {
    fontSize: texto.l,
  },
  descansos: {
    fontSize: texto.s,
    marginTop: espacio[1],
  },
});

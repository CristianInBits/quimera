import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { unirConY } from '@/gimnasio/editor';
import { cifra } from '@/inicio/comparar';
import { usePaleta } from '@/tema/colores';
import { datos, esLetraGrande, espacio } from '@/tema/medidas';

/** El alto de la barra de la semana con más carga, en puntos. */
const ALTO = 64;

/** El ancho de la caja de un nombre de debajo, que puede pasar del de su columna. */
const ANCHO_DEL_NOMBRE = 64;

/** Una caja de nombre centrada bajo la columna i de n. */
const centradoEn = (i: number, n: number) =>
  ({ left: `${((i + 0.5) / n) * 100}%`, marginLeft: -ANCHO_DEL_NOMBRE / 2 }) as const;

/**
 * El ancho que necesita una columna para que «Pasada» y «Esta», centrados en
 * dos columnas seguidas, no se pisen: la mitad de cada uno a 12 puntos, con
 * algo de aire. Crece con la letra.
 */
const MEDIA_PAREJA_DE_NOMBRES = 33;

/** Lo que mide, más o menos, una cifra de encima de una barra, a 12 puntos y en negrita. */
const anchoDeCifra = (carga: number, fontScale: number) => cifra(carga).length * 7.5 * fontScale;

/**
 * La carga de las últimas semanas en barras, de la más antigua a esta. Esta
 * semana va en el color de las acciones y con su cifra; la pasada, en un gris
 * y también con su cifra, la de la frase de la comparación; las demás, en un
 * gris más suave y sin cifra: lo que cuentan es la tendencia. Una semana sin
 * entrenos se dibuja como un punto con su «0», para que no parezca un dato que
 * falta.
 *
 * Para el lector de pantalla es una sola imagen que dice todas las cifras.
 * Si las cifras no caben encima de sus barras, o los nombres debajo, como con
 * la letra grande o en un móvil estrecho, van en una línea debajo.
 */
export function GraficaDeSemanas({ semanas }: { semanas: { lunes: string; carga: number }[] }) {
  const paleta = usePaleta();
  const { fontScale } = useWindowDimensions();
  // El ancho de la gráfica, que se sabe cuando se coloca.
  const [ancho, setAncho] = useState<number | null>(null);
  const n = semanas.length;
  const maxima = Math.max(0, ...semanas.map((semana) => semana.carga));
  const etiqueta = `Carga de las ${n} últimas semanas, de la más antigua a esta: ${unirConY(semanas.map((semana) => cifra(semana.carga)))}.`;
  const pasada = semanas[n - 2];
  const esta = semanas[n - 1];
  const columna = ancho === null ? null : ancho / n;
  const apretada =
    esLetraGrande(fontScale) ||
    (columna !== null &&
      (columna < MEDIA_PAREJA_DE_NOMBRES * fontScale ||
        [pasada, esta].some((semana) => semana !== undefined && anchoDeCifra(semana.carga, fontScale) > columna)));
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={etiqueta}
      onLayout={(evento) => setAncho(evento.nativeEvent.layout.width)}
      style={estilos.grafica}
    >
      <Text style={[estilos.titulo, { color: paleta.texto }]}>Carga de las {n} últimas semanas</Text>
      <View testID="barras" style={[estilos.barras, { borderBottomColor: paleta.bordeSuave }]}>
        {semanas.map((semana, i) => {
          const esEsta = i === n - 1;
          const esPasada = i === n - 2;
          const color = esEsta ? paleta.grafica.esta : esPasada ? paleta.grafica.pasada : paleta.grafica.anteriores;
          const conCifra = !apretada && (esEsta || esPasada || semana.carga === 0);
          return (
            <View key={semana.lunes} style={estilos.columna}>
              {conCifra && (
                <Text
                  style={[
                    datos,
                    estilos.cifra,
                    { color: esEsta ? paleta.texto : paleta.textoTenue, fontWeight: esEsta ? '700' : '600' },
                  ]}
                >
                  {cifra(semana.carga)}
                </Text>
              )}
              {semana.carga === 0 ? (
                <View testID={`semana-${i}`} style={[estilos.punto, { backgroundColor: color }]} />
              ) : (
                <View
                  testID={`semana-${i}`}
                  style={[estilos.barra, { height: Math.max(2, Math.round((semana.carga / maxima) * ALTO)), backgroundColor: color }]}
                />
              )}
            </View>
          );
        })}
      </View>
      {apretada ? (
        pasada !== undefined &&
        esta !== undefined && (
          <Text style={[estilos.leyenda, { color: paleta.textoTenue }]}>
            Pasada: {cifra(pasada.carga)} · <Text style={{ color: paleta.texto, fontWeight: '700' }}>Esta: {cifra(esta.carga)}</Text>
          </Text>
        )
      ) : (
        // Cada nombre, centrado bajo su barra aunque sea más ancho que la columna.
        <View style={{ minHeight: Math.ceil(espacio[4] * fontScale) }}>
          <Text style={[estilos.leyenda, estilos.nombre, centradoEn(n - 2, n), { color: paleta.textoTenue }]}>Pasada</Text>
          <Text style={[estilos.leyenda, estilos.nombre, centradoEn(n - 1, n), { color: paleta.texto, fontWeight: '700' }]}>
            Esta
          </Text>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  grafica: {
    gap: espacio[2],
  },
  titulo: {
    fontSize: 14,
    fontWeight: '700',
  },
  barras: {
    minHeight: ALTO + 21,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
  },
  columna: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: espacio[1],
  },
  cifra: {
    fontSize: 12,
  },
  barra: {
    width: 24,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  punto: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nombre: {
    position: 'absolute',
    top: 0,
    width: ANCHO_DEL_NOMBRE,
    textAlign: 'center',
  },
  leyenda: {
    fontSize: 12,
  },
});

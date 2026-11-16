import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { EscenarioDeLaMascota, type ProporcionesDelEscenario } from '@/componentes/EscenarioDeLaMascota';
import { Tarjeta } from '@/componentes/Tarjeta';
import type { Disciplina } from '@/datos/entrenos';
import { palabraDelEsfuerzo } from '@/gimnasio/editor';
import { usePaleta } from '@/tema/colores';
import { datos, esLetraGrande, espacio, radio, texto, titulos } from '@/tema/medidas';

/** El lado del círculo de fuera del escenario de la mascota. */
const ESCENARIO = 120;
/** Las del escenario del esfuerzo en la maqueta: el dibujo asoma un poco por encima de la caja. */
const PROPORCIONES_DEL_ESFUERZO: ProporcionesDelEscenario = { arriba: 0.133, interior: 0.733, dibujo: 1.1, alzado: 0.033 };
/** Las cifras del 1 al 10, en dos filas de cinco. */
const FILAS = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
] as const;

/**
 * El esfuerzo del entreno, del 1 al 10, en una tarjeta teñida de la
 * disciplina. Arriba, la cifra elegida en grande con la palabra de su tramo y,
 * al lado, la mascota haciendo ese esfuerzo; debajo, las cifras, a toques.
 * Entre un 6 y un 7 no hay una diferencia que se pueda nombrar: la palabra es
 * la de su tramo, como en Quimera-web.
 *
 * Con la letra grande, la mascota va arriba y la cifra debajo, y las cifras
 * siguen en dos filas de cinco, que crecen en alto.
 */
export function TarjetaDeEsfuerzo({
  disciplina,
  valor,
  alCambiar,
}: {
  disciplina: Disciplina;
  valor: number | null;
  alCambiar: (esfuerzo: number) => void;
}) {
  const paleta = usePaleta();
  const { fontScale } = useWindowDimensions();
  const grande = esLetraGrande(fontScale);
  return (
    <Tarjeta disciplina={disciplina} style={estilos.tarjeta}>
      <View testID="fila-del-esfuerzo" style={[estilos.fila, grande && estilos.filaApilada]}>
        <View testID="columna-del-esfuerzo" style={[estilos.columna, grande && estilos.columnaApilada]}>
          <Text accessibilityRole="header" style={[estilos.titulo, { color: paleta.texto }]}>
            Esfuerzo
          </Text>
          {valor === null ? (
            <Text style={[estilos.pista, { color: paleta.textoTenue }]}>Elige cuánto te ha costado</Text>
          ) : (
            <View testID="esfuerzo-elegido" style={estilos.eleccion}>
              <Text style={[datos, estilos.cifra, { color: paleta.primario }]}>{valor}</Text>
              {/* Con los tamaños de letra de accesibilidad del iPhone, «moderado» se partiría por dentro. */}
              <Text maxFontSizeMultiplier={3} style={[estilos.palabra, { color: paleta.texto }]}>
                {palabraDelEsfuerzo(valor)}
              </Text>
            </View>
          )}
        </View>
        <View style={estilos.escenario}>
          <EscenarioDeLaMascota
            disciplina={disciplina}
            esfuerzo={valor}
            tamano={ESCENARIO}
            proporciones={PROPORCIONES_DEL_ESFUERZO}
          />
        </View>
      </View>

      <View accessibilityRole="radiogroup" accessibilityLabel="Esfuerzo del 1 al 10" style={estilos.cifras}>
        {FILAS.map((fila) => (
          <View key={fila[0]} testID="fila-de-cifras" style={estilos.filaDeCifras}>
            {fila.map((n) => {
              const elegido = n === valor;
              return (
                <Pressable
                  key={n}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: elegido }}
                  accessibilityLabel={`${n}, ${palabraDelEsfuerzo(n)}`}
                  onPress={() => alCambiar(n)}
                  style={({ pressed }) => [
                    estilos.boton,
                    elegido
                      ? { backgroundColor: paleta.primario, borderColor: paleta.primario }
                      : { backgroundColor: paleta.superficie, borderColor: paleta.bordeControl },
                    pressed && estilos.pulsado,
                  ]}
                >
                  {/* Con los tamaños de letra de accesibilidad del iPhone, el 10 encoge antes que partirse. */}
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                    style={[datos, estilos.numero, { color: elegido ? paleta.sobrePrimario : paleta.texto }]}
                  >
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    gap: espacio[3],
  },
  fila: {
    flexDirection: 'row',
    gap: espacio[2],
  },
  // Con la letra grande, la mascota arriba y, debajo, el título y la cifra a todo el ancho.
  filaApilada: {
    flexDirection: 'column-reverse',
    alignItems: 'center',
  },
  columna: {
    flex: 1,
    justifyContent: 'space-between',
  },
  columnaApilada: {
    flex: 0,
    alignSelf: 'stretch',
    gap: espacio[2],
  },
  titulo: titulos.seccion,
  pista: {
    marginBottom: 6,
    fontSize: texto.m,
  },
  eleccion: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 10,
    marginBottom: 6,
  },
  cifra: {
    fontSize: 68,
    fontWeight: '700',
    letterSpacing: -1,
  },
  palabra: {
    fontSize: texto.l,
    fontWeight: '700',
  },
  escenario: {
    paddingHorizontal: espacio[1],
  },
  cifras: {
    gap: espacio[2],
  },
  filaDeCifras: {
    flexDirection: 'row',
    gap: espacio[2],
  },
  boton: {
    flex: 1,
    minHeight: 52,
    borderWidth: 2,
    borderRadius: radio.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numero: {
    fontSize: 18,
    fontWeight: '700',
  },
  pulsado: {
    opacity: 0.7,
  },
});

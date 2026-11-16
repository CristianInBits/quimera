import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePaleta } from '@/tema/colores';
import { espacio, radio } from '@/tema/medidas';

/** El lado del pico, un cuadrado girado que asoma la mitad. */
const PICO = 14;

/**
 * Lo que dice la mascota: un bocadillo en el rosa suave, con un pico arriba
 * que apunta hacia ella. Sin «pico», el pico va en el centro; con él, a esa
 * distancia del borde derecho, para que quede debajo de una mascota que va a
 * la derecha.
 */
export function Bocadillo({ children, pico }: { children: ReactNode; pico?: number }) {
  const paleta = usePaleta();
  return (
    <View testID="bocadillo" style={[estilos.bocadillo, { backgroundColor: paleta.tintePrimario }]}>
      <View
        testID="pico"
        style={[
          estilos.pico,
          { backgroundColor: paleta.tintePrimario },
          pico === undefined ? { left: '50%', marginLeft: -PICO / 2 } : { right: pico - PICO / 2 },
        ]}
      />
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  bocadillo: {
    borderRadius: radio.boton,
    paddingVertical: espacio[3],
    paddingHorizontal: espacio[4],
  },
  pico: {
    position: 'absolute',
    top: -PICO / 2,
    width: PICO,
    height: PICO,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
});

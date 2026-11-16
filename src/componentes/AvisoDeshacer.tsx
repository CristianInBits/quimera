import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePaleta } from '@/tema/colores';
import { espacio, radio, texto } from '@/tema/medidas';

import { Boton } from './Boton';

/** Lo que dura el aviso antes de irse solo. */
export const SEGUNDOS_PARA_DESHACER = 6;

/**
 * Un aviso abajo, durante unos segundos, con «Deshacer»: lo que se quita sin
 * querer, con una mano y sudando, se recupera de un toque.
 */
export function AvisoDeshacer({
  texto: mensaje,
  alDeshacer,
  alAcabar,
  enLinea = false,
  margen = espacio[4],
  onLayout,
}: {
  texto: string;
  alDeshacer: () => void;
  alAcabar: () => void;
  /**
   * En su sitio dentro de la pantalla, en vez de flotar abajo. Lo usan las
   * pestañas: en el iPhone la pantalla pasa por debajo de la barra de
   * pestañas, que taparía un aviso pegado abajo.
   */
  enLinea?: boolean;
  /**
   * Lo que deja a cada lado al flotar: el margen de los lados de su pantalla,
   * para que quede alineado con lo de debajo. Flotando, se cuenta desde el
   * borde de la pantalla, no desde el relleno de la pantalla.
   */
  margen?: number;
  /** Lo que mide al pintarse, para que la pantalla deje sitio debajo mientras se ve. */
  onLayout?: ViewProps['onLayout'];
}) {
  const paleta = usePaleta();
  // La app se dibuja hasta el borde de abajo, por detrás de la barra de
  // navegación de Android y de la raya del iPhone: el aviso va por encima.
  const margenes = useSafeAreaInsets();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${mensaje}. Se puede deshacer.`);
    const temporizador = setTimeout(alAcabar, SEGUNDOS_PARA_DESHACER * 1000);
    return () => clearTimeout(temporizador);
  }, [mensaje, alAcabar]);
  return (
    <View
      testID="aviso-deshacer"
      accessibilityLiveRegion="polite"
      onLayout={onLayout}
      style={[
        estilos.aviso,
        enLinea
          ? estilos.enLinea
          : [estilos.flotante, { left: margen, right: margen, bottom: margenes.bottom + espacio[4] }],
        { backgroundColor: paleta.texto },
      ]}
    >
      <Text style={[estilos.texto, { color: paleta.fondo }]}>{mensaje}</Text>
      <Boton titulo="Deshacer" variante="sutil" color={paleta.fondo} alPulsar={alDeshacer} />
    </View>
  );
}

const estilos = StyleSheet.create({
  aviso: {
    borderRadius: radio.boton,
    paddingLeft: espacio[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flotante: {
    position: 'absolute',
  },
  enLinea: {
    marginBottom: espacio[3],
  },
  texto: {
    flex: 1,
    fontSize: texto.m,
  },
});

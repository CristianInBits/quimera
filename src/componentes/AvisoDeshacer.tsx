import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
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
}: {
  texto: string;
  alDeshacer: () => void;
  alAcabar: () => void;
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
      accessibilityLiveRegion="polite"
      style={[estilos.aviso, { bottom: margenes.bottom + espacio[4], backgroundColor: paleta.texto }]}
    >
      <Text style={[estilos.texto, { color: paleta.fondo }]}>{mensaje}</Text>
      <Boton titulo="Deshacer" variante="sutil" color={paleta.fondo} alPulsar={alDeshacer} />
    </View>
  );
}

const estilos = StyleSheet.create({
  aviso: {
    position: 'absolute',
    left: espacio[4],
    right: espacio[4],
    borderRadius: radio,
    paddingLeft: espacio[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  texto: {
    flex: 1,
    fontSize: texto.m,
  },
});

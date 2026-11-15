import { Pressable, StyleSheet, Text } from 'react-native';

import { usePaleta } from '@/tema/colores';
import { espacio, radio, texto, toqueMinimo } from '@/tema/medidas';

type Variante = 'principal' | 'secundario' | 'sutil';

/**
 * Un botón de Quimera: nunca mide menos de 48 puntos. El principal va relleno
 * del color que se le dé (el de la disciplina), con el texto del color del
 * fondo; el secundario, con borde; y el sutil, solo con el texto.
 */
export function Boton({
  titulo,
  alPulsar,
  variante = 'secundario',
  color,
  deshabilitado = false,
  etiqueta,
}: {
  titulo: string;
  alPulsar: () => void;
  variante?: Variante;
  color?: string;
  deshabilitado?: boolean;
  /** Lo que lee el lector de pantalla, si el título no basta. */
  etiqueta?: string;
}) {
  const paleta = usePaleta();
  const acento = color ?? paleta.texto;
  const fondo = variante === 'principal' ? acento : 'transparent';
  const tinta = variante === 'principal' ? paleta.fondo : acento;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta ?? titulo}
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={alPulsar}
      style={({ pressed }) => [
        estilos.base,
        { backgroundColor: fondo },
        variante === 'secundario' && { borderColor: acento, borderWidth: 1.5 },
        pressed && estilos.pulsado,
        deshabilitado && estilos.deshabilitado,
      ]}
    >
      <Text style={[estilos.titulo, { color: tinta }]}>{titulo}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: toqueMinimo,
    minWidth: toqueMinimo,
    borderRadius: radio.boton,
    paddingHorizontal: espacio[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    fontSize: texto.m,
    fontWeight: '600',
  },
  pulsado: {
    opacity: 0.7,
  },
  deshabilitado: {
    opacity: 0.4,
  },
});

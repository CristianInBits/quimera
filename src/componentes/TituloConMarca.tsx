import { Platform, StyleSheet, Text, View } from 'react-native';

import { MarcaDeDisciplina } from '@/componentes/MarcaDeDisciplina';
import type { Disciplina } from '@/datos/entrenos';
import { usePaleta } from '@/tema/colores';
import { ESCALA_DE_LA_CABECERA, espacio, titulos } from '@/tema/medidas';

/**
 * El título de la cabecera de una pantalla de una disciplina, con su marca
 * delante, como «Gimnasio» en el editor. Va en la cabecera de la pila con
 * headerTitle, que no pone el estilo del título: lo pone este componente. La
 * cabecera es nativa y no crece con la letra del sistema, así que el título y
 * su marca crecen como mucho hasta ESCALA_DE_LA_CABECERA.
 *
 * En Android, la pantalla le pasa a la pila un título vacío, para que esto
 * empiece justo después de la flecha de volver; desde ahí, 4 más de aire, y la
 * marca queda donde la pone la maqueta.
 */
export function TituloConMarca({ disciplina, titulo }: { disciplina: Disciplina; titulo: string }) {
  const paleta = usePaleta();
  return (
    <View style={[estilos.titulo, Platform.OS === 'android' && estilos.trasLaFlecha]}>
      <MarcaDeDisciplina disciplina={disciplina} tamano="cabecera" />
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        maxFontSizeMultiplier={ESCALA_DE_LA_CABECERA}
        style={[estilos.texto, { color: paleta.texto }]}
      >
        {titulo}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  titulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[2],
  },
  trasLaFlecha: {
    marginStart: espacio[1],
  },
  texto: {
    ...titulos.cabecera,
    flexShrink: 1,
  },
});

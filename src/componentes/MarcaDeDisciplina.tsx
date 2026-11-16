import { StyleSheet, View } from 'react-native';

import { Icono } from '@/componentes/Icono';
import type { Disciplina } from '@/datos/entrenos';
import { usePaleta } from '@/tema/colores';
import { ESCALA_DE_LA_CABECERA } from '@/tema/medidas';

/**
 * Las dos marcas que hay: la de las fichas de Inicio y la de la cabecera de
 * una pantalla, que no crece más que el título de su lado.
 */
const MEDIDAS = {
  ficha: { icono: 18, relleno: 5, radio: 9, escalaMaxima: undefined },
  cabecera: { icono: 20, relleno: 6, radio: 10, escalaMaxima: ESCALA_DE_LA_CABECERA },
} as const;

/**
 * El cuadrado del color de una disciplina, con su icono: va junto a su nombre,
 * en las fichas de Inicio y en la cabecera del editor. No tiene un lado fijo:
 * crece con su icono, que crece con la letra del sistema. Encima del rosa del
 * gimnasio, el icono va en la tinta de encima del rosa, como en la maqueta.
 */
export function MarcaDeDisciplina({
  disciplina,
  tamano = 'ficha',
}: {
  disciplina: Disciplina;
  tamano?: keyof typeof MEDIDAS;
}) {
  const paleta = usePaleta();
  const { marca } = paleta.disciplina[disciplina];
  const tinta = marca === paleta.primario ? paleta.sobrePrimario : paleta.sobreMarca;
  const { icono, relleno, radio, escalaMaxima } = MEDIDAS[tamano];
  const lado = icono + 2 * relleno;
  return (
    <View
      testID="marca-de-disciplina"
      style={[
        estilos.marca,
        { minWidth: lado, minHeight: lado, padding: relleno, borderRadius: radio, backgroundColor: marca },
      ]}
    >
      <Icono nombre={disciplina} color={tinta} tamano={icono} escalaMaxima={escalaMaxima} />
    </View>
  );
}

const estilos = StyleSheet.create({
  marca: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

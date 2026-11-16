import { StyleSheet, View } from 'react-native';

import { Icono } from '@/componentes/Icono';
import type { Disciplina } from '@/datos/entrenos';
import { usePaleta } from '@/tema/colores';
import { ESCALA_DE_LA_CABECERA } from '@/tema/medidas';

/**
 * Las tres marcas que hay: la de las fichas de Inicio, la de cada entreno del
 * historial y la de la cabecera de una pantalla, que no crece más que el
 * título de su lado.
 */
const MEDIDAS = {
  ficha: { icono: 18, relleno: 5, radio: 9, escalaMaxima: undefined },
  historial: { icono: 16, relleno: 4, radio: 8, escalaMaxima: undefined },
  cabecera: { icono: 20, relleno: 6, radio: 10, escalaMaxima: ESCALA_DE_LA_CABECERA },
} as const;

export type TamanoDeMarca = keyof typeof MEDIDAS;

/** El lado de una marca con la letra al 100 %, su icono y su relleno: lo menos que mide. */
export function ladoDeLaMarca(tamano: TamanoDeMarca): number {
  const { icono, relleno } = MEDIDAS[tamano];
  return icono + 2 * relleno;
}

/**
 * El cuadrado del color de una disciplina, con su icono: va junto a su nombre,
 * en las fichas de Inicio, en cada entreno del historial y en la cabecera del
 * editor. No tiene un lado fijo: crece con su icono, que crece con la letra
 * del sistema. Encima del rosa del gimnasio, el icono va en la tinta de
 * encima del rosa, como en la maqueta.
 */
export function MarcaDeDisciplina({
  disciplina,
  tamano = 'ficha',
}: {
  disciplina: Disciplina;
  tamano?: TamanoDeMarca;
}) {
  const paleta = usePaleta();
  const { marca } = paleta.disciplina[disciplina];
  const tinta = marca === paleta.primario ? paleta.sobrePrimario : paleta.sobreMarca;
  const { icono, relleno, radio, escalaMaxima } = MEDIDAS[tamano];
  const lado = ladoDeLaMarca(tamano);
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

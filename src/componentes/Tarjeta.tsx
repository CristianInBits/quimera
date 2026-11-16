import { StyleSheet, View, type ViewProps } from 'react-native';

import type { Disciplina } from '@/datos/entrenos';
import { sombraDeTarjeta, usePaleta } from '@/tema/colores';
import { espacio, radio } from '@/tema/medidas';

/**
 * Una tarjeta: lo que va junto, sobre la superficie, con un borde suave y, en
 * claro, una sombra leve. La destacada, como la de la semana en Inicio, lleva
 * más sombra. Con una disciplina va teñida de su color, sin sombra: es lo
 * suyo, como el resumen de un entreno.
 */
export function Tarjeta({
  disciplina,
  destacada = false,
  relleno = espacio[4],
  style,
  children,
  ...resto
}: ViewProps & {
  disciplina?: Disciplina;
  destacada?: boolean;
  /** El espacio de dentro, de borde a contenido. */
  relleno?: number;
}) {
  const paleta = usePaleta();
  const colores =
    disciplina === undefined
      ? { fondo: paleta.superficie, borde: paleta.bordeSuave, sombra: sombraDeTarjeta(paleta, destacada) }
      : { fondo: paleta.disciplina[disciplina].tinte, borde: paleta.disciplina[disciplina].borde, sombra: undefined };
  return (
    <View
      {...resto}
      style={[
        estilos.tarjeta,
        { backgroundColor: colores.fondo, borderColor: colores.borde, padding: relleno, boxShadow: colores.sombra },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    borderWidth: 1,
    borderRadius: radio.tarjeta,
  },
});

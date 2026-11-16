import { SymbolView } from 'expo-symbols';
import { Platform, StyleSheet, useWindowDimensions, type ColorValue } from 'react-native';

/**
 * Los iconos de la app, cada uno con su nombre en los dos sistemas: SF Symbols
 * en el iPhone y Material Symbols en Android, los de cada uno, como hace la
 * barra de pestañas.
 */
const ICONOS = {
  mas: { ios: 'plus', android: 'add' },
  hecha: { ios: 'checkmark', android: 'check' },
  enlazar: { ios: 'link', android: 'link' },
  calendario: { ios: 'calendar', android: 'calendar_today' },
  reloj: { ios: 'clock', android: 'schedule' },
  siguiente: { ios: 'chevron.right', android: 'chevron_right' },
  menos: { ios: 'minus', android: 'remove' },
  desplegar: { ios: 'chevron.down', android: 'expand_more' },
  plegar: { ios: 'chevron.up', android: 'expand_less' },
  cronometro: { ios: 'timer', android: 'timer' },
  repetir: { ios: 'repeat', android: 'repeat' },
  // Los de cada disciplina, para su ficha.
  gimnasio: { ios: 'dumbbell', android: 'fitness_center' },
  hyrox: { ios: 'bolt', android: 'bolt' },
  calistenia: { ios: 'figure.strengthtraining.functional', android: 'sports_gymnastics' },
  carrera: { ios: 'figure.run', android: 'directions_run' },
  natacion: { ios: 'figure.pool.swim', android: 'pool' },
} as const;

export type NombreDeIcono = keyof typeof ICONOS;

/**
 * Un icono. Siempre acompaña a un texto o va en un botón con su etiqueta, así
 * que los lectores de pantalla lo saltan.
 *
 * Crece con la letra del sistema, como el texto que acompaña. En Android,
 * expo-symbols lo dibuja como una letra de Material Symbols, que crece sola
 * pero dentro de una caja fija: la caja crece aquí con ella, para que el icono
 * no se salga ni se corte. Desde Android 14, la letra grande crece algo menos
 * que la escala de la letra, y el icono queda algo más pequeño que su caja:
 * por eso va centrado en ella. En el iPhone, el símbolo se dibuja ya a su
 * tamaño.
 *
 * El peso va como texto: el iPhone lo usa, y Android usa el normal, el que ya
 * trae la barra de pestañas. Pedir en Android un peso como objeto metería esa
 * fuente, de casi un mega, también en la app del iPhone, que no la usa.
 *
 * Con escalaMaxima, no crece más que eso con la letra del sistema, como el
 * de la cabecera, que no crece con ella.
 */
export function Icono({
  nombre,
  color,
  tamano = 20,
  escalaMaxima,
}: {
  nombre: NombreDeIcono;
  color: ColorValue;
  tamano?: number;
  escalaMaxima?: number;
}) {
  const { fontScale } = useWindowDimensions();
  const { ios, android } = ICONOS[nombre];
  const escala = escalaMaxima === undefined ? fontScale : Math.min(fontScale, escalaMaxima);
  const lado = tamano * escala;
  return (
    <SymbolView
      testID={`icono-${nombre}`}
      name={{ ios, android, web: android }}
      weight="semibold"
      tintColor={color}
      // En Android la letra ya crece sola con el sistema: se le pide el tamaño que, multiplicado
      // por fontScale, da «lado», o crecería dos veces. Desde Android 14, con la letra grande,
      // crece algo menos y queda algo más pequeña que su caja, centrada en ella.
      size={Platform.OS === 'android' ? (tamano * escala) / fontScale : lado}
      style={[estilos.centrado, { width: lado, height: lado }]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const estilos = StyleSheet.create({
  // En Android, la letra del icono, en medio de su caja.
  centrado: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

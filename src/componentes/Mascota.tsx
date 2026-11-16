import { Image, type ImageSourcePropType, type ImageStyle, type StyleProp } from 'react-native';

import type { Disciplina } from '@/datos/entrenos';

import foca from '../../assets/mascotas/foca.png';
import galgo from '../../assets/mascotas/galgo.png';
import gorila from '../../assets/mascotas/gorila.png';
import rinoceronte from '../../assets/mascotas/rinoceronte.png';
import rinoceronte1 from '../../assets/mascotas/rinoceronte-1.png';
import rinoceronte2 from '../../assets/mascotas/rinoceronte-2.png';
import rinoceronte3 from '../../assets/mascotas/rinoceronte-3.png';
import rinoceronte4 from '../../assets/mascotas/rinoceronte-4.png';
import rinoceronte5 from '../../assets/mascotas/rinoceronte-5.png';
import tigre from '../../assets/mascotas/tigre.png';

/**
 * Los dibujos del animal de cada disciplina: el de presentación y uno por
 * tramo de esfuerzo, la misma acción con más compromiso en cada uno. Todas
 * tienen ya el de presentación, que sale en Apuntar; los de esfuerzo llegan
 * con su disciplina, y mientras falten, en su sitio no sale nada.
 *
 * Los de presentación miden 672 píxeles de lado mayor, lo que ocupan a 224
 * puntos en un móvil de 3 píxeles por punto, todos con el mismo margen debajo
 * de los pies, y van sin metadatos.
 */
const DIBUJOS: Record<Disciplina, { presentacion: ImageSourcePropType; tramos?: readonly ImageSourcePropType[] }> = {
  gimnasio: {
    presentacion: rinoceronte,
    tramos: [rinoceronte1, rinoceronte2, rinoceronte3, rinoceronte4, rinoceronte5],
  },
  hyrox: { presentacion: tigre },
  calistenia: { presentacion: gorila },
  carrera: { presentacion: galgo },
  natacion: { presentacion: foca },
};

/**
 * El tramo del dibujo para un esfuerzo, del 1 al 5. Son los de las palabras
 * del esfuerzo, para que el dibujo y la palabra no se contradigan, salvo el 9
 * y el 10, que comparten dibujo aunque no palabra: como en Quimera-web, el
 * dibujo es más grueso que la palabra.
 */
export function tramoDeLaMascota(esfuerzo: number): number {
  if (esfuerzo <= 2) return 1;
  if (esfuerzo <= 4) return 2;
  if (esfuerzo <= 6) return 3;
  if (esfuerzo <= 8) return 4;
  return 5;
}

/**
 * El animal de una disciplina: sin esfuerzo, el de presentación, y con él, el
 * de su tramo. El dibujo no valora: dibuja el número. Es decorativo, porque al
 * lado siempre están el nombre de la disciplina o el número del esfuerzo, así
 * que los lectores de pantalla lo saltan.
 *
 * Los de cada esfuerzo son más grandes que el sitio donde salen: en Android,
 * resizeMethod «resize» los decodifica ya reducidos, que gasta menos memoria y
 * deja los trazos más limpios. Los de presentación ya miden lo que ocupan:
 * reducirlos otra vez los dejaría borrosos, así que se decodifican enteros.
 * Sin fundido, cada dibujo sale al momento.
 */
export function Mascota({
  disciplina,
  esfuerzo = null,
  tamano,
  alto = tamano,
  style,
}: {
  disciplina: Disciplina;
  esfuerzo?: number | null;
  /** El ancho de la caja donde cabe el dibujo entero, en puntos; sin alto, es un cuadrado. */
  tamano: number;
  alto?: number;
  /** Dónde va la caja, por ejemplo encima de su escenario. */
  style?: StyleProp<ImageStyle>;
}) {
  const { presentacion, tramos } = DIBUJOS[disciplina];
  const dibujo = esfuerzo === null ? presentacion : tramos?.[tramoDeLaMascota(esfuerzo) - 1];
  if (dibujo === undefined) {
    return null;
  }
  return (
    <Image
      testID="mascota"
      source={dibujo}
      resizeMode="contain"
      resizeMethod={esfuerzo === null ? 'scale' : 'resize'}
      fadeDuration={0}
      accessibilityIgnoresInvertColors
      importantForAccessibility="no"
      style={[{ width: tamano, height: alto }, style]}
    />
  );
}

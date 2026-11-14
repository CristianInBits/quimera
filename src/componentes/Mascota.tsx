import { Image, type ImageSourcePropType } from 'react-native';

import type { Disciplina } from '@/datos/entrenos';

import rinoceronte from '../../assets/mascotas/rinoceronte.png';
import rinoceronte1 from '../../assets/mascotas/rinoceronte-1.png';
import rinoceronte2 from '../../assets/mascotas/rinoceronte-2.png';
import rinoceronte3 from '../../assets/mascotas/rinoceronte-3.png';
import rinoceronte4 from '../../assets/mascotas/rinoceronte-4.png';
import rinoceronte5 from '../../assets/mascotas/rinoceronte-5.png';

/**
 * Los dibujos del animal de cada disciplina: el de presentación y uno por
 * tramo de esfuerzo, la misma acción con más compromiso en cada uno. Por ahora
 * solo está el rinoceronte del gimnasio; los demás llegan con su disciplina, y
 * mientras falten, en su sitio no sale nada.
 */
const DIBUJOS: Partial<Record<Disciplina, { presentacion: ImageSourcePropType; tramos: readonly ImageSourcePropType[] }>> = {
  gimnasio: {
    presentacion: rinoceronte,
    tramos: [rinoceronte1, rinoceronte2, rinoceronte3, rinoceronte4, rinoceronte5],
  },
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
 * Los dibujos son mucho más grandes que el sitio donde salen: en Android,
 * resizeMethod «resize» los decodifica ya reducidos, que gasta menos memoria y
 * deja los trazos más limpios, y sin fundido cada tramo sale al momento.
 */
export function Mascota({
  disciplina,
  esfuerzo = null,
  tamano,
}: {
  disciplina: Disciplina;
  esfuerzo?: number | null;
  /** El lado del cuadrado donde cabe el dibujo entero, en puntos. */
  tamano: number;
}) {
  const dibujos = DIBUJOS[disciplina];
  if (dibujos === undefined) {
    return null;
  }
  return (
    <Image
      testID="mascota"
      source={esfuerzo === null ? dibujos.presentacion : dibujos.tramos[tramoDeLaMascota(esfuerzo) - 1]}
      resizeMode="contain"
      resizeMethod="resize"
      fadeDuration={0}
      accessibilityIgnoresInvertColors
      importantForAccessibility="no"
      style={{ width: tamano, height: tamano }}
    />
  );
}

import { StyleSheet, View } from 'react-native';

import { Mascota } from '@/componentes/Mascota';
import type { Disciplina } from '@/datos/entrenos';
import { usePaleta } from '@/tema/colores';

/** Las medidas del escenario como partes del lado del círculo de fuera. */
export type ProporcionesDelEscenario = {
  /** Lo que baja el círculo de fuera desde el borde de arriba de la caja. */
  arriba: number;
  /** El lado del círculo de dentro. */
  interior: number;
  /** El lado del dibujo de presentación, que es cuadrado. */
  dibujo: number;
  /** Lo que sube el dibujo por encima del borde de arriba de la caja. */
  alzado: number;
};

/** Las del escenario junto a la carga de Inicio, que valen para casi todo. */
export const PROPORCIONES: ProporcionesDelEscenario = { arriba: 0.125, interior: 0.74, dibujo: 1.15, alzado: 0.03 };

/**
 * Las del escenario de un esfuerzo, junto a su cifra, en la tarjeta del
 * esfuerzo del editor y en el resumen de un entreno: el dibujo asoma un poco
 * por encima de la caja.
 */
export const PROPORCIONES_DEL_ESFUERZO: ProporcionesDelEscenario = { arriba: 0.133, interior: 0.733, dibujo: 1.1, alzado: 0.033 };

/**
 * La mascota de una disciplina sobre su escenario: dos círculos de su color,
 * uno dentro de otro, con el dibujo encima, que asoma por arriba. Los dibujos
 * visten de oscuro y, sin escenario, en el modo oscuro se perderían.
 *
 * Todo se mide desde el círculo de fuera, de lado «tamano»: la caja mide eso
 * de ancho y un poco más de alto, y el dibujo sobresale de ella sin ocupar
 * sitio. Es decorativo: al lado van siempre el nombre de la disciplina o la
 * cifra del esfuerzo, así que el lector de pantalla lo salta.
 */
export function EscenarioDeLaMascota({
  disciplina,
  esfuerzo = null,
  tamano,
  colores,
  proporciones = PROPORCIONES,
}: {
  disciplina: Disciplina;
  /** Sin esfuerzo, el dibujo de presentación; con él, el de su tramo. */
  esfuerzo?: number | null;
  tamano: number;
  /** Los dos círculos, el de fuera y el de dentro, si no son los de la disciplina. */
  colores?: readonly [string, string];
  /** Otras proporciones, si la maqueta pide otras para ese sitio. */
  proporciones?: ProporcionesDelEscenario;
}) {
  const paleta = usePaleta();
  const [fuera, dentro] = colores ?? paleta.disciplina[disciplina].escenario;
  const arriba = Math.round(tamano * proporciones.arriba);
  const interior = Math.round(tamano * proporciones.interior);
  // El de presentación es cuadrado y algo mayor que el círculo; los de esfuerzo, más altos que anchos.
  const ancho = Math.round(tamano * (esfuerzo === null ? proporciones.dibujo : 0.9));
  const alto = Math.round(tamano * (esfuerzo === null ? proporciones.dibujo : 1.16));
  return (
    <View
      testID="escenario"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: tamano, height: arriba + tamano }}
    >
      <View
        style={[estilos.circulo, { top: arriba, left: 0, width: tamano, height: tamano, borderRadius: tamano / 2, backgroundColor: fuera }]}
      />
      <View
        style={[
          estilos.circulo,
          {
            top: arriba + (tamano - interior) / 2,
            left: (tamano - interior) / 2,
            width: interior,
            height: interior,
            borderRadius: interior / 2,
            backgroundColor: dentro,
          },
        ]}
      />
      <Mascota
        disciplina={disciplina}
        esfuerzo={esfuerzo}
        tamano={ancho}
        alto={alto}
        style={[estilos.dibujo, { left: (tamano - ancho) / 2, top: -Math.round(tamano * proporciones.alzado) }]}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  circulo: {
    position: 'absolute',
  },
  dibujo: {
    position: 'absolute',
  },
});

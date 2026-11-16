import { Pressable, StyleSheet, Text, type TextStyle } from 'react-native';

import { Icono, type NombreDeIcono } from '@/componentes/Icono';
import { sombraDelBotonPrincipal, usePaleta, type Paleta } from '@/tema/colores';
import { espacio, radio, toqueMinimo } from '@/tema/medidas';

/**
 * Las clases de botón, de más a menos peso:
 * - principal: relleno de rosa. La acción de la pantalla, como Guardar.
 * - secundario: con borde rosa. Otra acción que importa, como Añadir ejercicio.
 * - tonal: el rosa suave de fondo. Ajustes que no pesan, como Cambiar el día.
 * - contorno: con el borde de los controles. Rellena algo, como Igual que la anterior.
 * - enlace: solo el texto en rosa. Añade algo pequeño, como una serie.
 * - sutil: solo el texto tenue. Quita o cierra, como Quitar.
 * - error: solo el texto en el color de error. Lo que borra, como Borrar entreno.
 */
export type VarianteDeBoton = 'principal' | 'secundario' | 'tonal' | 'contorno' | 'enlace' | 'sutil' | 'error';

type Medidas = {
  alto: number;
  radio: number;
  letra: number;
  peso: TextStyle['fontWeight'];
  relleno: number;
  icono: number;
  /** El hueco entre el icono y el texto. */
  hueco: number;
};

const MEDIDAS: Record<VarianteDeBoton, Medidas> = {
  principal: { alto: 56, radio: radio.grande, letra: 17, peso: '700', relleno: espacio[5], icono: 22, hueco: 10 },
  secundario: { alto: 52, radio: radio.boton, letra: 16, peso: '700', relleno: espacio[4], icono: 20, hueco: espacio[2] },
  tonal: { alto: toqueMinimo, radio: radio.control, letra: 15, peso: '600', relleno: espacio[3], icono: 18, hueco: 6 },
  contorno: { alto: toqueMinimo, radio: radio.control, letra: 15, peso: '600', relleno: espacio[3], icono: 20, hueco: espacio[2] },
  enlace: { alto: toqueMinimo, radio: radio.pequeno, letra: 15, peso: '700', relleno: espacio[3], icono: 20, hueco: espacio[2] },
  sutil: { alto: toqueMinimo, radio: radio.pequeno, letra: 15, peso: '600', relleno: espacio[3], icono: 20, hueco: espacio[2] },
  error: { alto: toqueMinimo, radio: radio.control, letra: 16, peso: '600', relleno: espacio[4], icono: 20, hueco: espacio[2] },
};

/** El fondo, el borde y el color del texto de cada clase. */
function colores(variante: VarianteDeBoton, paleta: Paleta) {
  switch (variante) {
    case 'principal':
      return { fondo: paleta.primario, borde: paleta.primario, tinta: paleta.sobrePrimario };
    case 'secundario':
      return { fondo: 'transparent', borde: paleta.primario, tinta: paleta.primario };
    case 'tonal':
      return { fondo: paleta.tintePrimario, borde: paleta.tintePrimario, tinta: paleta.primarioTexto };
    case 'contorno':
      return { fondo: paleta.superficie, borde: paleta.bordeControl, tinta: paleta.texto };
    case 'enlace':
      return { fondo: 'transparent', borde: 'transparent', tinta: paleta.primario };
    case 'sutil':
      return { fondo: 'transparent', borde: 'transparent', tinta: paleta.textoTenue };
    case 'error':
      return { fondo: 'transparent', borde: 'transparent', tinta: paleta.error };
  }
}

/**
 * Un botón de Quimera: nunca mide menos de 48 puntos, y con la letra grande
 * crece en alto en vez de cortar el texto. El icono, si lo lleva, va delante
 * del texto y el lector de pantalla no lo lee.
 */
export function Boton({
  titulo,
  alPulsar,
  variante = 'secundario',
  icono,
  color,
  deshabilitado = false,
  etiqueta,
}: {
  titulo: string;
  alPulsar: () => void;
  variante?: VarianteDeBoton;
  icono?: NombreDeIcono;
  /** Otro color para el texto y el borde, para un botón sobre un fondo que no es el de siempre. */
  color?: string;
  deshabilitado?: boolean;
  /** Lo que lee el lector de pantalla, si el título no basta. */
  etiqueta?: string;
}) {
  const paleta = usePaleta();
  const medidas = MEDIDAS[variante];
  const { fondo, borde, tinta } = colores(variante, paleta);
  const conBorde = variante === 'secundario' || variante === 'contorno';
  const colorDeTinta = color ?? tinta;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta ?? titulo}
      accessibilityState={{ disabled: deshabilitado }}
      disabled={deshabilitado}
      onPress={alPulsar}
      style={({ pressed }) => [
        estilos.base,
        {
          minHeight: medidas.alto,
          borderRadius: medidas.radio,
          paddingHorizontal: medidas.relleno,
          gap: medidas.hueco,
          backgroundColor: fondo,
          borderColor: conBorde && color !== undefined ? color : borde,
          // El principal se levanta del fondo con una sombra de su rosa.
          boxShadow: variante === 'principal' && !deshabilitado ? sombraDelBotonPrincipal(paleta) : undefined,
        },
        pressed && estilos.pulsado,
        deshabilitado && estilos.deshabilitado,
      ]}
    >
      {icono !== undefined && <Icono nombre={icono} color={colorDeTinta} tamano={medidas.icono} />}
      <Text style={[estilos.titulo, { color: colorDeTinta, fontSize: medidas.letra, fontWeight: medidas.peso }]}>
        {titulo}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minWidth: toqueMinimo,
    // Todos llevan borde, transparente si no se ve, para que cambiar de clase no mueva nada.
    borderWidth: 2,
    paddingVertical: espacio[1],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    flexShrink: 1,
    textAlign: 'center',
  },
  pulsado: {
    opacity: 0.7,
  },
  deshabilitado: {
    opacity: 0.4,
  },
});

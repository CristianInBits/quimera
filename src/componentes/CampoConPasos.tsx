import { StyleSheet, Text, TextInput, View } from 'react-native';

import { usePaleta } from '@/tema/colores';
import { datos, espacio, radio, texto, toqueMinimo } from '@/tema/medidas';

import { Boton } from './Boton';

/**
 * Un número con un menos y un más a los lados, y el teclado en medio por si
 * hay que saltar lejos: se apunta de pie, con una mano.
 */
export function CampoConPasos({
  etiqueta,
  etiquetaAccesible = etiqueta,
  valor,
  decimales = false,
  ayuda = null,
  alCambiar,
  alDarUnPaso,
}: {
  etiqueta: string;
  /** Lo que dice el lector de pantalla, si la etiqueta sola no basta para saber de qué es. */
  etiquetaAccesible?: string;
  valor: string;
  /** Si lleva coma decimal, como el peso o los kilómetros. */
  decimales?: boolean;
  /** Una línea debajo, como «1:30» para unos segundos. */
  ayuda?: string | null;
  alCambiar: (valor: string) => void;
  alDarUnPaso: (sentido: 1 | -1) => void;
}) {
  const paleta = usePaleta();
  return (
    <View style={estilos.campo}>
      <Text style={[estilos.etiqueta, { color: paleta.textoTenue }]}>{etiqueta}</Text>
      <View style={estilos.conPasos}>
        <Boton titulo="−" etiqueta={`Bajar ${etiquetaAccesible}`} alPulsar={() => alDarUnPaso(-1)} />
        <TextInput
          accessibilityLabel={etiquetaAccesible}
          value={valor}
          onChangeText={alCambiar}
          keyboardType={decimales ? 'decimal-pad' : 'number-pad'}
          selectTextOnFocus
          style={[datos, estilos.entrada, { color: paleta.texto, borderColor: paleta.textoTenue }]}
        />
        <Boton titulo="+" etiqueta={`Subir ${etiquetaAccesible}`} alPulsar={() => alDarUnPaso(1)} />
      </View>
      {ayuda !== null && <Text style={[estilos.ayuda, { color: paleta.textoTenue }]}>{ayuda}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: {
    gap: espacio[1],
  },
  etiqueta: {
    fontSize: texto.s,
  },
  conPasos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[2],
  },
  entrada: {
    flex: 1,
    minHeight: toqueMinimo,
    borderWidth: 1.5,
    borderRadius: radio.control,
    fontSize: texto.xl,
    textAlign: 'center',
  },
  ayuda: {
    fontSize: texto.s,
    textAlign: 'center',
  },
});

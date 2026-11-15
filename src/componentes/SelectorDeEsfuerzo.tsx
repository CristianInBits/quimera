import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palabraDelEsfuerzo } from '@/gimnasio/editor';
import { usePaleta } from '@/tema/colores';
import { datos, espacio, radio, texto, toqueMinimo } from '@/tema/medidas';

/**
 * El esfuerzo del entreno, del 1 al 10, a toques. Debajo, la palabra de su
 * tramo, como en Quimera-web: entre un 6 y un 7 no hay una diferencia que se
 * pueda nombrar.
 */
export function SelectorDeEsfuerzo({
  valor,
  alCambiar,
  color,
}: {
  valor: number | null;
  alCambiar: (esfuerzo: number) => void;
  color: string;
}) {
  const paleta = usePaleta();
  return (
    <View style={estilos.contenedor}>
      <View style={estilos.rejilla} accessibilityRole="radiogroup" accessibilityLabel="Esfuerzo del 1 al 10">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
          const elegido = n === valor;
          return (
            <Pressable
              key={n}
              accessibilityRole="radio"
              accessibilityState={{ selected: elegido }}
              accessibilityLabel={`${n}, ${palabraDelEsfuerzo(n)}`}
              onPress={() => alCambiar(n)}
              style={({ pressed }) => [
                estilos.boton,
                { borderColor: elegido ? color : paleta.textoTenue, backgroundColor: elegido ? color : 'transparent' },
                pressed && estilos.pulsado,
              ]}
            >
              <Text style={[datos, estilos.numero, { color: elegido ? paleta.fondo : paleta.texto }]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[estilos.palabra, { color: valor === null ? paleta.textoTenue : paleta.texto }]}>
        {valor === null ? 'Elige cuánto te ha costado' : `${valor} · ${palabraDelEsfuerzo(valor)}`}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    gap: espacio[2],
  },
  rejilla: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacio[2],
  },
  boton: {
    width: toqueMinimo,
    height: toqueMinimo,
    borderRadius: radio.control,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numero: {
    fontSize: texto.l,
    fontWeight: '700',
  },
  palabra: {
    fontSize: texto.m,
  },
  pulsado: {
    opacity: 0.7,
  },
});

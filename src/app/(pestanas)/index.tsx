import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePaleta } from '@/tema/colores';
import { espacio, texto } from '@/tema/medidas';

// La pantalla de inicio. Por ahora dice qué es Quimera; la carga de la semana
// llega con el último commit del paso 3.
export default function Inicio() {
  const paleta = usePaleta();
  return (
    <SafeAreaView edges={['top']} style={[estilos.pantalla, { backgroundColor: paleta.fondo }]}>
      <View style={estilos.centro}>
        <Text style={[estilos.titulo, { color: paleta.texto }]}>Quimera</Text>
        <Text style={[estilos.lema, { color: paleta.textoTenue }]}>Tus entrenos, en tu móvil.</Text>
      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio[2],
    paddingHorizontal: espacio[6],
  },
  titulo: {
    fontSize: texto.datoXl,
    fontWeight: '700',
  },
  lema: {
    fontSize: texto.l,
  },
});

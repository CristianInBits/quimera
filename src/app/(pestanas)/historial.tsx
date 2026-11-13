import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePaleta } from '@/tema/colores';
import { espacio, texto } from '@/tema/medidas';

// El historial de entrenos. La lista llega con el tercer commit del paso 3;
// hasta entonces no hay nada que enseñar.
export default function Historial() {
  const paleta = usePaleta();
  return (
    <SafeAreaView edges={['top']} style={[estilos.pantalla, { backgroundColor: paleta.fondo }]}>
      <Text style={[estilos.titulo, { color: paleta.texto }]}>Historial</Text>
      <View style={estilos.vacio}>
        <Text style={[estilos.aviso, { color: paleta.textoTenue }]}>
          Aquí saldrán tus entrenos cuando apuntes el primero.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    paddingHorizontal: espacio[4],
  },
  titulo: {
    fontSize: texto.xl,
    fontWeight: '700',
    paddingTop: espacio[4],
  },
  vacio: {
    flex: 1,
    justifyContent: 'center',
  },
  aviso: {
    fontSize: texto.m,
    textAlign: 'center',
  },
});

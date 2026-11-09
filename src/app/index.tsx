import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colores } from '@/tema/colores';

// La pantalla de inicio. En este paso solo dice qué es Quimera: sirve para
// comprobar que la app abre en el móvil.
export default function Inicio() {
  const tema = colores[useColorScheme() === 'dark' ? 'oscuro' : 'claro'];
  return (
    <SafeAreaView style={[estilos.pantalla, { backgroundColor: tema.fondo }]}>
      <View style={estilos.centro}>
        <Text style={[estilos.titulo, { color: tema.texto }]}>Quimera</Text>
        <Text style={[estilos.lema, { color: tema.textoSecundario }]}>
          Tus entrenos, en tu móvil.
        </Text>
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
    gap: 8,
    paddingHorizontal: 24,
  },
  titulo: {
    fontSize: 40,
    fontWeight: '700',
  },
  lema: {
    fontSize: 18,
  },
});

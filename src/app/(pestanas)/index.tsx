import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Boton } from '@/componentes/Boton';
import { usePaleta } from '@/tema/colores';
import { espacio, texto } from '@/tema/medidas';

// La pantalla de inicio: qué es Quimera y el botón para apuntar un entreno.
// La carga de la semana llega con el último commit del paso 3. Va en un
// ScrollView para que en el iPhone la barra de pestañas no tape el botón.
export default function Inicio() {
  const paleta = usePaleta();
  return (
    <SafeAreaView edges={['top']} style={[estilos.pantalla, { backgroundColor: paleta.fondo }]}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <View style={estilos.centro}>
          <Text style={[estilos.titulo, { color: paleta.texto }]}>Quimera</Text>
          <Text style={[estilos.lema, { color: paleta.textoTenue }]}>Tus entrenos, en tu móvil.</Text>
        </View>
        <Boton titulo="Apuntar un entreno" variante="principal" alPulsar={() => router.navigate('/apuntar')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
  },
  contenido: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: espacio[8],
    paddingHorizontal: espacio[6],
    paddingVertical: espacio[8],
  },
  centro: {
    alignItems: 'center',
    gap: espacio[2],
  },
  titulo: {
    fontSize: texto.datoXl,
    fontWeight: '700',
  },
  lema: {
    fontSize: texto.l,
  },
});

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { prepararBaseDelMovil } from '@/datos/movil';
import { PALETAS } from '@/tema/colores';

// La raíz de toda la app. Abre la base del móvil y la prepara antes de enseñar
// ninguna pantalla. Debajo van las pestañas, y encima de ellas se abrirán las
// pantallas de apuntar y de ver un entreno.
export default function Raiz() {
  const oscuro = useColorScheme() === 'dark';
  const paleta = PALETAS[oscuro ? 'oscuro' : 'claro'];
  const base = oscuro ? DarkTheme : DefaultTheme;
  const tema = {
    ...base,
    colors: {
      ...base.colors,
      background: paleta.fondo,
      card: paleta.fondoElevado,
      text: paleta.texto,
      border: paleta.borde,
      primary: paleta.texto,
    },
  };
  return (
    <SQLiteProvider databaseName="quimera.db" onInit={prepararBaseDelMovil}>
      <ThemeProvider value={tema}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: paleta.fondo } }}>
          {/* Sin título, el botón atrás del iPhone diría «(pestanas)». */}
          <Stack.Screen name="(pestanas)" options={{ title: 'Inicio' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SQLiteProvider>
  );
}

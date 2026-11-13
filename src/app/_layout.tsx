import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { prepararBaseDelMovil } from '@/datos/movil';

// La raíz de toda la app. Abre la base del móvil y la prepara antes de enseñar
// ninguna pantalla. La navegación es de momento una sola pantalla, sin
// cabecera, que sigue el modo claro u oscuro del móvil.
export default function Raiz() {
  const esquema = useColorScheme();
  return (
    <SQLiteProvider databaseName="quimera.db" onInit={prepararBaseDelMovil}>
      <ThemeProvider value={esquema === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style="auto" />
      </ThemeProvider>
    </SQLiteProvider>
  );
}

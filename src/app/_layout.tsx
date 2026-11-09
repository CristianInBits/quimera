import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

// La navegación de toda la app. De momento es una sola pantalla, sin cabecera,
// que sigue el modo claro u oscuro del móvil.
export default function Raiz() {
  const esquema = useColorScheme();
  return (
    <ThemeProvider value={esquema === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

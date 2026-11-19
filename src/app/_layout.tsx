import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { prepararBaseDelMovil } from '@/datos/movil';
import { PALETAS } from '@/tema/colores';
import { NUNITO, titulos } from '@/tema/medidas';

// Las pestañas van siempre debajo: una pantalla abierta directamente, como el
// detalle de un entreno, tiene a dónde volver.
export const unstable_settings = { anchor: '(pestanas)' };

// La pantalla de carga se queda hasta que estén las fuentes de los títulos.
SplashScreen.preventAutoHideAsync();

// La raíz de toda la app. Carga las fuentes de los títulos y abre la base del
// móvil, y la prepara, antes de enseñar ninguna pantalla. Debajo van las
// pestañas, y encima de ellas se abren las pantallas de apuntar y de ver un
// entreno.
export default function Raiz() {
  // Solo los dos pesos que se usan: importar el paquete entero metería en la
  // app los dieciocho.
  const [fuentesCargadas, errorDeFuentes] = useFonts({
    [NUNITO.extraNegrita]: Nunito_800ExtraBold,
    [NUNITO.negra]: Nunito_900Black,
  });
  // Si las fuentes no cargan, la app sigue: los títulos salen en la letra del sistema.
  const listas = fuentesCargadas || errorDeFuentes !== null;
  useEffect(() => {
    if (listas) SplashScreen.hideAsync();
  }, [listas]);

  const oscuro = useColorScheme() === 'dark';
  const paleta = PALETAS[oscuro ? 'oscuro' : 'claro'];
  const base = oscuro ? DarkTheme : DefaultTheme;
  // Las cabeceras van sobre el fondo de la pantalla, sin raya debajo.
  const tema = {
    ...base,
    colors: {
      ...base.colors,
      background: paleta.fondo,
      card: paleta.fondo,
      text: paleta.texto,
      border: paleta.bordeSuave,
      primary: paleta.texto,
    },
  };

  if (!listas) return null;
  return (
    <SQLiteProvider databaseName="quimera.db" onInit={prepararBaseDelMovil}>
      <ThemeProvider value={tema}>
        <Stack
          screenOptions={{
            headerShown: false,
            // En el iPhone con iOS 26, una cabecera sin fondo sería de cristal (Liquid Glass) y el
            // principio de cada pantalla quedaría debajo de ella: va opaca, sobre el fondo.
            headerTransparent: false,
            headerShadowVisible: false,
            headerTitleStyle: titulos.cabecera,
            contentStyle: { backgroundColor: paleta.fondo },
          }}
        >
          {/* Sin título, el botón atrás del iPhone diría «(pestanas)». */}
          <Stack.Screen name="(pestanas)" options={{ title: 'Inicio' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SQLiteProvider>
  );
}

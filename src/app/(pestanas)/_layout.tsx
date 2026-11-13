import { NativeTabs } from 'expo-router/native-tabs';
import { Platform } from 'react-native';

import { coloresDeLaBarra, usePaleta } from '@/tema/colores';

// Las dos pestañas de abajo, con la barra de pestañas propia de cada sistema:
// la de Android en Android y la de iOS en el iPhone. Los iconos son SF Symbols
// en el iPhone y Material Symbols en Android.
//
// Cada fichero de esta carpeta necesita aquí su NativeTabs.Trigger: una
// pantalla sin él no se abre nunca, y expo-router vuelve a Inicio sin avisar.
// Por eso el editor y el detalle de un entreno van en la raíz de src/app, y se
// abren encima de las pestañas.
export default function Pestanas() {
  const barra = coloresDeLaBarra(usePaleta(), Platform.OS === 'android' ? 'android' : 'ios');
  return (
    <NativeTabs
      backgroundColor={barra.fondo}
      tintColor={barra.etiquetaElegida}
      iconColor={{ default: barra.icono, selected: barra.iconoElegido }}
      labelStyle={{
        default: { color: barra.etiqueta },
        selected: { color: barra.etiquetaElegida, fontWeight: '700' },
      }}
      indicatorColor={barra.indicador}
      rippleColor={barra.onda}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Inicio</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="historial">
        <NativeTabs.Trigger.Label>Historial</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'clock', selected: 'clock.fill' }} md="history" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

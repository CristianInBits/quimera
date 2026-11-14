import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { fechaLocal } from '@/datos/fechas';

/**
 * La fecha local de hoy, al día: cambia a medianoche y al volver la app a
 * primer plano. No se puede calcular al pintar, porque React Compiler guarda
 * ese valor y una pantalla abierta de noche seguiría diciendo que hoy es ayer.
 */
export function useHoy(): string {
  const [hoy, setHoy] = useState(() => fechaLocal(new Date()));
  useEffect(() => {
    const actualizar = () => setHoy(fechaLocal(new Date()));
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') actualizar();
    });
    const ahora = new Date();
    const manana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1);
    const temporizador = setTimeout(actualizar, manana.getTime() - ahora.getTime() + 1000);
    return () => {
      suscripcion.remove();
      clearTimeout(temporizador);
    };
  }, [hoy]);
  return hoy;
}

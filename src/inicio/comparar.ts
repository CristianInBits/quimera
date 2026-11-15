import type { Semana } from '@/datos/carga';

/**
 * Una cifra como se escribe en español: hasta 9999 seguida, y desde 10 000
 * con un espacio entre los millares que no se parte, como pide la Real
 * Academia Española.
 */
export function cifra(n: number): string {
  const texto = String(n);
  return Math.abs(n) < 10_000 ? texto : texto.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Cómo va la carga de esta semana respecto a la pasada, en una frase y con el
 * número de la pasada: «Un 28 % más que la semana pasada (980)». Sin valorar:
 * los datos, primero. La semana en curso todavía no ha acabado y se compara
 * igual, como en Quimera-web. El porcentaje sale de una sola división y se
 * redondea igual hacia arriba que hacia abajo, y el redondeo no cambia lo que
 * se dice: con carga esta semana nunca es «un 100 % menos», y con cargas
 * distintas nunca es «igual». Lleva un espacio que no se parte antes del %.
 */
export function compararConLaPasada(estaSemana: Semana, laPasada: Semana): string {
  const esta = estaSemana.carga;
  const pasada = laPasada.carga;
  if (esta === 0) {
    return pasada === 0
      ? 'Todavía sin entrenos esta semana.'
      : `Todavía sin entrenos esta semana. La pasada sumó ${cifra(pasada)} de carga.`;
  }
  if (pasada === 0) {
    return 'La semana pasada no hubo entrenos con los que comparar.';
  }
  if (esta === pasada) {
    return `Igual que la semana pasada (${cifra(pasada)}).`;
  }
  const exacta = ((esta - pasada) * 100) / pasada;
  const cuanto = exacta < 0 ? Math.min(Math.round(-exacta), 99) : Math.round(exacta);
  if (cuanto === 0) {
    return `Casi igual que la semana pasada (${cifra(pasada)}).`;
  }
  return `Un ${cuanto} % ${exacta > 0 ? 'más' : 'menos'} que la semana pasada (${cifra(pasada)}).`;
}

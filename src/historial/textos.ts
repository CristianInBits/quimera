import type { Serie } from '@/datos/entrenos';
import { gramosATexto, metrosATexto, msATexto } from '@/datos/unidades';
import { textoDeMinutos, textoDeSegundos, unirConY } from '@/gimnasio/editor';

// Cómo se dice lo guardado de un entreno en el historial y en su detalle.

/**
 * Lo que se hizo en un entreno, en una línea: «Press banca, Remo con barra y 3
 * más · 2,35 km». Null si no hay nada que decir.
 */
export function resumenDelContenido(ejercicios: string[], metros: number): string | null {
  const nombres =
    ejercicios.length <= 3 ? unirConY(ejercicios) : `${ejercicios.slice(0, 2).join(', ')} y ${ejercicios.length - 2} más`;
  const partes = [nombres, metros > 0 ? `${metrosATexto(metros)} km` : ''].filter((parte) => parte !== '');
  return partes.length === 0 ? null : partes.join(' · ');
}

/** Lo que dice una serie guardada: «62,5 kg × 8», «8 reps», «1:30», «20 cal» o «1 km · 4:22». */
export function resumenDeSerieGuardada(serie: Serie): string {
  const partes: string[] = [];
  const peso = serie.pesoG === null ? null : `${gramosATexto(serie.pesoG)} kg`;
  if (peso !== null && serie.repeticiones !== null) partes.push(`${peso} × ${serie.repeticiones}`);
  else if (peso !== null) partes.push(peso);
  else if (serie.repeticiones !== null) partes.push(`${serie.repeticiones} reps`);
  if (serie.distanciaM !== null) partes.push(`${metrosATexto(serie.distanciaM)} km`);
  if (serie.calorias !== null) partes.push(`${serie.calorias} cal`);
  if (serie.tiempoMs !== null) partes.push(msATexto(serie.tiempoMs));
  return partes.join(' · ');
}

/** Un descanso guardado: «sin parar», «1:30» o, si tiene décimas, «1:30,5». */
export function textoDelDescansoGuardado(ms: number): string {
  if (ms === 0) return 'sin parar';
  return ms % 1000 === 0 ? textoDeSegundos(ms / 1000) : msATexto(ms);
}

/** Un tiempo guardado en minutos, si son enteros, o como reloj: «12 minutos» o «12:30». */
export function textoDelTiempoGuardado(ms: number): string {
  return ms % 60_000 === 0 ? textoDeMinutos(ms / 60_000) : msATexto(ms);
}

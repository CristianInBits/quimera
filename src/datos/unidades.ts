// Las unidades de Quimera son enteras: el peso en gramos, la distancia en
// metros y el tiempo en milisegundos. Así 62,5 kg o un 100 m en 1:28,4 se
// guardan exactos.
//
// Los textos se convierten separando la parte entera de los decimales, nunca
// multiplicando un número con decimales: 4,35 * 1000 da 4349,999… en coma
// flotante, y la base rechazaría el valor.

/** Un número con coma o con punto y hasta tres decimales, en milésimas: «62,5» da 62500. */
function aMilesimas(texto: string): number | null {
  const r = /^\s*(\d{1,4})(?:[.,](\d{1,3}))?\s*$/.exec(texto);
  if (r === null) {
    return null;
  }
  return Number(r[1]) * 1000 + Number((r[2] ?? '').padEnd(3, '0'));
}

/** Unas milésimas como un número con coma decimal y sin ceros de más: 62500 da «62,5». */
function milesimasATexto(milesimas: number): string {
  const enteras = Math.floor(milesimas / 1000);
  const resto = milesimas % 1000;
  if (resto === 0) {
    return String(enteras);
  }
  return `${enteras},${String(resto).padStart(3, '0').replace(/0+$/, '')}`;
}

/**
 * Un peso escrito en kilos, con coma o con punto y hasta tres decimales,
 * en gramos. Da null si el texto no es un peso.
 */
export function textoAGramos(texto: string): number | null {
  return aMilesimas(texto);
}

/** Unos gramos como kilos con coma decimal y sin ceros de más: 62500 da «62,5». */
export function gramosATexto(gramos: number): string {
  return milesimasATexto(gramos);
}

/**
 * Una distancia escrita en kilómetros, con coma o con punto y hasta tres
 * decimales, en metros: «2,35» da 2350. Da null si el texto no es una distancia.
 */
export function textoAMetros(texto: string): number | null {
  return aMilesimas(texto);
}

/** Unos metros como kilómetros con coma decimal y sin ceros de más: 2350 da «2,35». */
export function metrosATexto(metros: number): string {
  return milesimasATexto(metros);
}

/**
 * Un tiempo escrito como m:ss, h:mm:ss o solo segundos, con décimas opcionales
 * tras una coma o un punto, en milisegundos. Da null si el texto no es un
 * tiempo.
 */
export function textoAMs(texto: string): number | null {
  const r = /^\s*(?:(\d+):(\d{2}):(\d{2})|(\d+):(\d{2})|(\d+))(?:[.,](\d))?\s*$/.exec(texto);
  if (r === null) {
    return null;
  }
  const n = (x: string | undefined) => Number(x ?? 0);
  let segundos: number;
  if (r[1] !== undefined) {
    if (n(r[2]) > 59 || n(r[3]) > 59) {
      return null;
    }
    segundos = (n(r[1]) * 60 + n(r[2])) * 60 + n(r[3]);
  } else if (r[4] !== undefined) {
    if (n(r[5]) > 59) {
      return null;
    }
    segundos = n(r[4]) * 60 + n(r[5]);
  } else {
    segundos = n(r[6]);
  }
  return segundos * 1000 + n(r[7]) * 100;
}

/**
 * Unos milisegundos como m:ss o h:mm:ss, con las décimas si las hay:
 * 88400 da «1:28,4» y 2700000 da «45:00». Redondea a la décima.
 */
export function msATexto(ms: number): string {
  const decimasTotales = Math.round(ms / 100);
  const decimas = decimasTotales % 10;
  const segundosTotales = Math.floor(decimasTotales / 10);
  const horas = Math.floor(segundosTotales / 3600);
  const minutos = Math.floor((segundosTotales % 3600) / 60);
  const segundos = segundosTotales % 60;
  const dos = (n: number) => String(n).padStart(2, '0');
  const base = horas > 0 ? `${horas}:${dos(minutos)}:${dos(segundos)}` : `${minutos}:${dos(segundos)}`;
  return decimas > 0 ? `${base},${decimas}` : base;
}

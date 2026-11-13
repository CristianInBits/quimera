// El sello de modificación de cada fila: milisegundos desde 1970 en UTC. Al
// importar gana la versión con el sello mayor, así que un sello nunca baja,
// aunque el reloj del móvil vaya hacia atrás.

/** El primer sello válido, en noviembre de 2023. La base rechaza los anteriores. */
export const SELLO_MINIMO = 1_700_000_000_000;

/** El sello de una escritura: la hora actual, pero siempre mayor que el sello anterior. */
export function nuevoSello(ahora: number, anterior?: number | null): number {
  return Math.max(Math.floor(ahora), (anterior ?? 0) + 1, SELLO_MINIMO);
}

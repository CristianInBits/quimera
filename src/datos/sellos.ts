// El sello de modificación de cada fila: milisegundos desde 1970 en UTC. Al
// importar una copia propia gana la versión con el sello mayor, así que un
// sello nunca baja, aunque el reloj del móvil vaya hacia atrás. Lo que entra
// con la copia de otra persona lleva SELLO_MINIMO, para que pierda siempre.

/** El primer sello válido, en noviembre de 2023. La base rechaza los anteriores. */
export const SELLO_MINIMO = 1_700_000_000_000;

/**
 * El mayor sello que cabe en una copia: el mayor entero que JavaScript guarda
 * exacto. Ningún reloj llega; solo una copia editada a mano.
 */
export const SELLO_MAXIMO = Number.MAX_SAFE_INTEGER;

/**
 * El sello de una escritura: la hora actual, pero siempre mayor que el sello
 * anterior, salvo en SELLO_MAXIMO, donde se queda: pasar de ahí dejaría la
 * fila sin poder exportarse. En el máximo, que solo llega con una copia
 * editada a mano, el sello ya no distingue versiones: esa fila gana en todos
 * los móviles que importen esa copia o las siguientes como suyas, y desde
 * entonces sus cambios, también borrarla, ya no viajan entre ellos; cada
 * móvil se queda con su versión, el resumen la cuenta sin cambios, un móvil
 * nuevo se queda con la primera que importe, y guardarEntrenoEn ya no nota con
 * el sello leído una corrección guardada entre medias.
 */
export function nuevoSello(ahora: number, anterior?: number | null): number {
  return Math.min(Math.max(Math.floor(ahora), (anterior ?? 0) + 1, SELLO_MINIMO), SELLO_MAXIMO);
}

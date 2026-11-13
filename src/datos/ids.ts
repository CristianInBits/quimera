// Los identificadores de las filas: UUID v7 (RFC 9562), en texto y en
// minúsculas. Llevan delante los milisegundos en que nacen, así que se ordenan
// por fecha, y el resto es azar, así que dos móviles nunca crean el mismo.
//
// Forma: 48 bits de milisegundos, la versión (7), 12 bits de contador, la
// variante (binario 10) y 62 bits de azar.

/** Da n bytes aleatorios. En el móvil, getRandomValues de expo-crypto. */
export type Azar = (n: number) => Uint8Array;

const FORMA = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Dice si un texto es un UUID v7 en minúsculas, como los que acepta la base. */
export function esUuidV7(texto: string): boolean {
  return FORMA.test(texto);
}

/**
 * Crea la función que da identificadores nuevos. Dentro del mismo milisegundo,
 * o si el reloj va hacia atrás, el contador sube, así que cada identificador
 * es mayor que el anterior.
 */
export function crearGeneradorDeIds(ahora: () => number, azar: Azar): () => string {
  let ultimoMs = -1;
  let contador = 0;
  return () => {
    const ms = Math.floor(ahora());
    if (ms > ultimoMs) {
      ultimoMs = ms;
      // Empieza por debajo de la mitad, para que quepan muchos más en el mismo milisegundo.
      const semilla = azar(2);
      contador = ((semilla[0] << 8) | semilla[1]) & 0x7ff;
    } else {
      contador++;
      if (contador > 0xfff) {
        ultimoMs++;
        contador = 0;
      }
    }
    const b = azar(8);
    const tiempo = ultimoMs.toString(16).padStart(12, '0');
    const hex = (n: number) => n.toString(16).padStart(2, '0');
    const resto = Array.from(b.subarray(2, 8), hex).join('');
    return (
      `${tiempo.slice(0, 8)}-${tiempo.slice(8, 12)}-` +
      `7${contador.toString(16).padStart(3, '0')}-` +
      `${hex((b[0] & 0x3f) | 0x80)}${hex(b[1])}-${resto}`
    );
  };
}

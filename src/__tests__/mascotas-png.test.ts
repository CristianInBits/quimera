import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// El repositorio es público: las imágenes que entran van sin metadatos. Los
// dibujos de las mascotas son PNG, y un PNG guarda los metadatos en sus
// trozos (chunks) de texto, de fecha o de EXIF. Esta prueba los lee.

const CARPETA = join(__dirname, '..', '..', 'assets', 'mascotas');
/** Los dibujos de presentación, preparados para la app: solo los trozos imprescindibles. */
const PRESENTACION = ['rinoceronte.png', 'tigre.png', 'gorila.png', 'galgo.png', 'foca.png'];
/** Los trozos que llevan metadatos: texto, texto comprimido, texto internacional, EXIF y fecha. */
const DE_METADATOS = ['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME'];

/** Los nombres de los trozos de un PNG, en orden, y su ancho y alto. */
function leerPng(fichero: string) {
  const datos = readFileSync(join(CARPETA, fichero));
  expect(datos.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const trozos: string[] = [];
  for (let o = 8; o < datos.length; ) {
    const largo = datos.readUInt32BE(o);
    trozos.push(datos.toString('ascii', o + 4, o + 8));
    o += 12 + largo;
  }
  return { trozos, ancho: datos.readUInt32BE(16), alto: datos.readUInt32BE(20) };
}

describe('Los dibujos de las mascotas', () => {
  it.each(readdirSync(CARPETA).filter((f) => f.endsWith('.png')))('%s no lleva metadatos', (fichero) => {
    const { trozos } = leerPng(fichero);
    expect(trozos.filter((t) => DE_METADATOS.includes(t))).toEqual([]);
  });

  it.each(PRESENTACION)('%s mide 672 de lado mayor y solo lleva la cabecera, los datos y el final', (fichero) => {
    const { trozos, ancho, alto } = leerPng(fichero);
    expect(Math.max(ancho, alto)).toBe(672);
    expect([...new Set(trozos)]).toEqual(['IHDR', 'IDAT', 'IEND']);
  });
});

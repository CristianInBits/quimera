import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// El repositorio es público: las imágenes que entran van sin metadatos. Los
// dibujos de las mascotas son PNG, y un PNG guarda los metadatos en sus
// trozos (chunks): de texto, de fecha, de EXIF o, como caBX, las credenciales
// de contenido (C2PA) que añaden las herramientas que generan imágenes, a
// veces con quién las hizo y con qué. Esta prueba los lee: un dibujo
// preparado para la app solo lleva la cabecera, los datos y el final.

const CARPETA = join(__dirname, '..', '..', 'assets', 'mascotas');
/**
 * Los dibujos de presentación, que miden 672 de alto y no más de ancho. Van en
 * una caja cuadrada sin deformarse: así se encajan por el alto, y el margen bajo
 * los pies los deja en su sitio. Uno apaisado se encajaría por el ancho y saldría
 * más pequeño y despegado de su escenario.
 */
const PRESENTACION = ['rinoceronte.png', 'tigre.png', 'gorila.png', 'galgo.png', 'foca.png'];
/**
 * Los dibujos del rinoceronte para cada tramo del esfuerzo, con su ancho y su
 * alto. La app los encaja en su caja sin deformarlos: si cambian sus
 * proporciones, el rinoceronte se mueve en las pantallas.
 */
const DEL_ESFUERZO: [string, number, number][] = [
  ['rinoceronte-1.png', 385, 578],
  ['rinoceronte-2.png', 342, 547],
  ['rinoceronte-3.png', 376, 528],
  ['rinoceronte-4.png', 410, 528],
  ['rinoceronte-5.png', 486, 525],
];

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
  it.each(readdirSync(CARPETA).filter((f) => f.endsWith('.png')))(
    '%s solo lleva la cabecera, los datos y el final: ningún metadato',
    (fichero) => {
      const { trozos } = leerPng(fichero);
      expect([...new Set(trozos)]).toEqual(['IHDR', 'IDAT', 'IEND']);
    },
  );

  it.each(PRESENTACION)('%s mide 672 de alto y no más de ancho: en su caja cuadrada se encaja por el alto', (fichero) => {
    const { ancho, alto } = leerPng(fichero);
    expect(alto).toBe(672);
    expect(ancho).toBeLessThanOrEqual(672);
  });

  it.each(DEL_ESFUERZO)('%s mide %i × %i: con otras proporciones, el rinoceronte se movería en su caja', (fichero, ancho, alto) => {
    expect(leerPng(fichero)).toMatchObject({ ancho, alto });
  });
});

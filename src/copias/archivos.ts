import { Directory, File, Paths } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';

// Lo que «Tus datos» hace con los archivos del móvil: preparar el de una
// copia para compartirlo y elegir el de una copia para importarlo.

/**
 * Lo más que puede medir el archivo de una copia, 50 MB: diez años de
 * entrenos diarios no llegan a la mitad. Uno más grande no se lee, porque no
 * es una copia de Quimera y leerlo entero podría cerrar la app.
 */
export const TAMANO_MAXIMO = 50 * 1024 * 1024;

/** La carpeta de la caché de la app donde se preparan las copias para compartirlas. */
const carpetaDeLasCopias = () => new Directory(Paths.cache, 'copias');

/**
 * Escribe el texto de una copia en la caché de la app, en un archivo con ese
 * nombre, y da su dirección para compartirlo. Antes borra lo que quede allí
 * de otros días: las copias de hoy se quedan, porque la app con la que se
 * compartió una puede estar leyéndola todavía.
 */
export async function prepararArchivo(nombre: string, texto: string): Promise<string> {
  const carpeta = carpetaDeLasCopias();
  carpeta.create({ intermediates: true, idempotent: true });
  // «quimera-2026-11-25-1830.json» es de «quimera-2026-11-25-».
  const deHoy = nombre.replace(/\d{4}\.json$/, '');
  for (const vieja of carpeta.list()) {
    if (!vieja.name.startsWith(deHoy)) {
      try {
        vieja.delete();
      } catch {
        // Si no se puede borrar, se queda en la caché, que el sistema vacía cuando le hace falta sitio.
      }
    }
  }
  const archivo = new File(carpeta, nombre);
  await archivo.write(texto);
  return archivo.uri;
}

/**
 * Abre la hoja de compartir del sistema con el archivo de una copia. Acaba al
 * cerrarse la hoja, se haya guardado el archivo o no: ni Android ni el iPhone
 * lo dicen. Sin título: Android no lo enseña al compartir.
 */
export async function compartir(uri: string): Promise<void> {
  await shareAsync(uri, { mimeType: 'application/json' });
}

/** Un archivo elegido para importarlo: lo que mide, en bytes, y cómo leer su texto. */
export type ArchivoElegido = {
  tamano: number;
  leer: () => Promise<string>;
};

/**
 * Abre el selector de archivos del sistema, sin filtrar por tipo: Drive puede
 * dar una copia como application/octet-stream. Da null si se cierra sin
 * elegir nada, y también si el selector falla: expo-file-system da lo mismo
 * en los dos casos.
 *
 * El texto se saca de los bytes, como UTF-8, igual en Android y en el iPhone:
 * lo que no es UTF-8, como una foto elegida por error, sale con caracteres de
 * sustitución y no se lee como una copia. text() de expo-file-system, en el
 * iPhone, adivina la codificación y falla con lo que no es texto, y diría
 * «No se pudo leer el archivo» en vez de que no es una copia.
 */
export async function elegirArchivo(): Promise<ArchivoElegido | null> {
  // Con un objeto, y no sin nada, para pedir siempre la forma nueva del resultado, con «canceled».
  const elegido = await File.pickFileAsync({ multipleFiles: false });
  if (elegido.canceled) {
    return null;
  }
  const archivo = elegido.result;
  return { tamano: archivo.size, leer: async () => new TextDecoder().decode(await archivo.bytes()) };
}

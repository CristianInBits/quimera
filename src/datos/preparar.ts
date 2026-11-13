import { leerAjuste, ponerAjusteEn } from './ajustes';
import { puertaDe, type Base, type Lectura, type Transaccion } from './base';
import { sincronizarCatalogoEn } from './catalogo';
import { huella } from './huella';
import { MIGRACIONES } from './migraciones';

export type OpcionesDePreparar = {
  ahora: () => number;
  /** Las migraciones de la app; las pruebas pasan otras. */
  migraciones?: readonly string[];
};

export type EstadoDeLaBase = { version: number; sqlite: string };

/**
 * Prepara la base cada vez que se abre: los ajustes de la conexión, las
 * migraciones pendientes y el catálogo de ejercicios. En el móvil es el onInit
 * del SQLiteProvider.
 *
 * Las migraciones pendientes van todas en una sola transacción: la base queda
 * en la versión vieja o en la nueva, nunca a medias. Si algo falla, la app no
 * arranca, y la base no se borra nunca para esquivar el error.
 */
export async function prepararBase(
  db: Base,
  { ahora, migraciones = MIGRACIONES }: OpcionesDePreparar,
): Promise<EstadoDeLaBase> {
  const puerta = puertaDe(db);

  // Fuera de cualquier transacción: dentro, PRAGMA foreign_keys no hace nada.
  // Con synchronous = NORMAL en modo WAL, un apagón puede perder la última
  // transacción, pero la base no se corrompe. El límite recorta el fichero
  // -wal después de una importación grande.
  await puerta.ajustar(async (base) => {
    await base.execAsync('PRAGMA journal_mode = WAL');
    await base.execAsync('PRAGMA synchronous = NORMAL');
    await base.execAsync('PRAGMA journal_size_limit = 4194304');
    await base.execAsync('PRAGMA foreign_keys = ON');
  });

  const version = await puerta.escribir(async (tx) => {
    // La versión se lee dentro de la transacción: si dos preparaciones se
    // solapan, la segunda ve lo que la primera ya aplicó.
    const actual = await leerVersion(tx);
    if (actual > migraciones.length) {
      throw new Error(
        `La base es de una Quimera más nueva que esta (versión ${actual} de la base y ` +
          `${migraciones.length} de la app). Actualiza Quimera.`,
      );
    }
    if (actual > 0) {
      await comprobarHuellas(tx, migraciones.slice(0, actual));
    }
    if (actual < migraciones.length) {
      for (const sql of migraciones.slice(actual)) {
        await tx.execAsync(sql);
      }
      await tx.execAsync(`PRAGMA user_version = ${migraciones.length}`);
      const rotas = await tx.getAllAsync('PRAGMA foreign_key_check', {});
      if (rotas.length > 0) {
        throw new Error('Las migraciones dejan claves foráneas rotas.');
      }
      await ponerAjusteEn(tx, 'local.migraciones', migraciones.map(huella), ahora());
    }
    await sincronizarCatalogoEn(tx, ahora());
    return migraciones.length;
  });

  const sqlite = await puerta.leer((l) => l.getFirstAsync<{ v: string }>('SELECT sqlite_version() AS v', {}));
  return { version, sqlite: sqlite?.v ?? '¿?' };
}

async function leerVersion(l: Lectura): Promise<number> {
  const fila = await l.getFirstAsync<{ user_version: number }>('PRAGMA user_version', {});
  return fila?.user_version ?? 0;
}

/**
 * Comprueba que las migraciones que ya tiene la base son las mismas que las
 * del código. Si no, alguien cambió una migración después de aplicarla (por
 * ejemplo, mientras el servidor de desarrollo recargaba la app), y la base no
 * tiene la forma que el código cree.
 */
async function comprobarHuellas(tx: Transaccion, aplicadas: readonly string[]): Promise<void> {
  const guardadas = await leerAjuste(tx, 'local.migraciones');
  const esperadas = aplicadas.map(huella);
  const coinciden =
    Array.isArray(guardadas) &&
    guardadas.length >= esperadas.length &&
    esperadas.every((h, i) => guardadas[i] === h);
  if (!coinciden) {
    throw new Error(
      'Las migraciones de la base no coinciden con las del código: una migración ya aplicada ha cambiado.',
    );
  }
}

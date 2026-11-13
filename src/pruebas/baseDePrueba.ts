/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { Base, Parametros } from '@/datos/base';

// Una base de node:sqlite (Node 26, SQLite 3.54) que se comporta como la de
// expo-sqlite en el móvil, para probar el SQL de verdad en Jest:
// - Se abre con las claves foráneas apagadas, como expo-sqlite: las enciende
//   prepararBase, igual que en el móvil.
// - No admite comillas dobles para los textos. expo-sqlite sí, así que el SQL
//   que pasa aquí vale en los dos.
// - Los parámetros con nombre de cada sentencia tienen que coincidir con las
//   claves que recibe, dos puntos incluidos. En el móvil, una clave que no
//   coincide se ignora sin avisar y su parámetro se queda en NULL; aquí es un
//   error. Los parámetros sin nombre (?) tampoco se admiten: Quimera no los
//   usa, y uno que faltara también se quedaría en NULL.
// - Cada llamada cede el turno antes de ejecutarse, como el puente asíncrono
//   entre JavaScript y el código nativo, para que se noten las carreras.
// - Los números se enlazan como REAL, como en el iPhone. Con enteros:
//   'integer', los números enteros se enlazan como INTEGER, como en Android.

export type OpcionesDeLaBaseDePrueba = {
  enteros?: 'real' | 'integer';
  /** Un fichero en lugar de la memoria, para probar lo que necesita disco (WAL). */
  fichero?: string;
};

export type BaseDePrueba = Base & {
  /** Consulta directa y síncrona, para mirar la base desde las pruebas. */
  mirar<T>(sql: string, parametros?: Record<string, SQLInputValue>): T[];
  cerrar(): void;
};

export function abrirBaseDePrueba({
  enteros = 'real',
  fichero = ':memory:',
}: OpcionesDeLaBaseDePrueba = {}): BaseDePrueba {
  const db = new DatabaseSync(fichero, {
    enableForeignKeyConstraints: false,
    enableDoubleQuotedStringLiterals: false,
    allowBareNamedParameters: false,
    allowUnknownNamedParameters: false,
  });

  const enlazar = (sql: string, parametros: Parametros): Record<string, SQLInputValue> => {
    comprobarParametros(sql, parametros);
    const enlazados: Record<string, SQLInputValue> = {};
    for (const [clave, valor] of Object.entries(parametros)) {
      enlazados[clave] =
        enteros === 'integer' && typeof valor === 'number' && Number.isInteger(valor) ? BigInt(valor) : valor;
    }
    return enlazados;
  };

  return {
    async execAsync(sql: string): Promise<void> {
      await cederElTurno();
      db.exec(sql);
    },
    async runAsync(sql: string, parametros: Parametros): Promise<{ changes: number }> {
      await cederElTurno();
      const resultado = db.prepare(sql).run(enlazar(sql, parametros));
      return { changes: Number(resultado.changes) };
    },
    async getFirstAsync<T>(sql: string, parametros: Parametros): Promise<T | null> {
      await cederElTurno();
      soloLectura(sql);
      const fila = db.prepare(sql).get(enlazar(sql, parametros));
      return fila === undefined ? null : ({ ...fila } as T);
    },
    async getAllAsync<T>(sql: string, parametros: Parametros): Promise<T[]> {
      await cederElTurno();
      soloLectura(sql);
      return db
        .prepare(sql)
        .all(enlazar(sql, parametros))
        .map((fila) => ({ ...fila }) as T);
    },
    mirar<T>(sql: string, parametros: Record<string, SQLInputValue> = {}): T[] {
      return db
        .prepare(sql)
        .all(parametros)
        .map((fila) => ({ ...fila }) as T);
    },
    cerrar(): void {
      db.close();
    },
  };
}

/**
 * getFirstAsync y getAllAsync solo leen. En el móvil, getFirstAsync vuelve a
 * ejecutar la sentencia cuando no da ninguna fila, así que una escritura hecha
 * con él se haría dos veces.
 */
function soloLectura(sql: string): void {
  if (!/^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql)) {
    throw new Error(`getFirstAsync y getAllAsync solo leen; para escribir está runAsync.\n${sql}`);
  }
}

function cederElTurno(): Promise<void> {
  return new Promise((resolver) => setImmediate(resolver));
}

/** Los :nombres de una sentencia, sin contar lo que va entre comillas simples. */
export function nombresDeParametros(sql: string): Set<string> {
  const sinTextos = sql.replace(/'(?:[^']|'')*'/g, "''");
  return new Set(sinTextos.match(/:[A-Za-z_][A-Za-z0-9_]*/g) ?? []);
}

function comprobarParametros(sql: string, parametros: Parametros): void {
  if (sql.replace(/'(?:[^']|'')*'/g, "''").includes('?')) {
    throw new Error(`La sentencia usa parámetros sin nombre (?), que Quimera no usa.\n${sql}`);
  }
  const enLaSentencia = nombresDeParametros(sql);
  const dados = new Set(Object.keys(parametros));
  const faltan = [...enLaSentencia].filter((nombre) => !dados.has(nombre));
  const sobran = [...dados].filter((nombre) => !enLaSentencia.has(nombre));
  if (faltan.length > 0 || sobran.length > 0) {
    throw new Error(
      `Los parámetros no coinciden con la sentencia: faltan ${faltan.join(', ') || 'ninguno'} ` +
        `y sobran ${sobran.join(', ') || 'ninguno'}.\n${sql}`,
    );
  }
}

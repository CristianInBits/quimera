/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { MIGRACIONES } from '@/datos/migraciones';

// Reglas que el código cumple siempre y que se comprueban leyéndolo, sin sus
// comentarios. Las pruebas y sus ayudas no cuentan.

const SRC = join(__dirname, '..');

function ficheros(carpeta: string): string[] {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(carpeta, entrada.name);
    if (entrada.isDirectory()) {
      return entrada.name === '__tests__' || entrada.name === 'pruebas' ? [] : ficheros(ruta);
    }
    return /\.tsx?$/.test(entrada.name) ? [ruta] : [];
  });
}

/** Quita los comentarios de TypeScript y los de SQL («-- …»). */
function sinComentarios(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/--\s[^\n]*/g, '');
}

const codigo = ficheros(SRC).map((ruta) => ({
  ruta: relative(SRC, ruta).split(sep).join('/'),
  texto: sinComentarios(readFileSync(ruta, 'utf8')),
}));

function incumplen(patron: RegExp, donde: (ruta: string) => boolean = () => true): string[] {
  return codigo.filter(({ ruta, texto }) => donde(ruta) && patron.test(texto)).map(({ ruta }) => ruta);
}

const fueraDeDatos = (ruta: string) => !ruta.startsWith('datos/');

describe('Las reglas del código', () => {
  it('hay código que revisar', () => {
    expect(codigo.map((f) => f.ruta)).toEqual(expect.arrayContaining(['datos/base.ts', 'app/_layout.tsx']));
  });

  it('las fechas guardadas no pasan por UTC, y se convierten solo en datos/fechas.ts', () => {
    expect(incumplen(/toISOString\(/)).toEqual([]);
    expect(incumplen(/new Date\(\s*['"`]/)).toEqual([]);
    expect(incumplen(/new Date\(\s*[\w$.]+\s*\)/, (ruta) => ruta !== 'datos/fechas.ts')).toEqual([]);
    expect(incumplen(/getUTC(FullYear|Month|Date|Day|Hours|Minutes)\(/, (ruta) => ruta !== 'datos/fechas.ts')).toEqual(
      [],
    );
  });

  it('el SQL no lee el reloj ni la zona del móvil: las fechas las pone la app', () => {
    expect(incumplen(/'now'|'localtime'|CURRENT_(DATE|TIME|TIMESTAMP)/i)).toEqual([]);
    // Sin argumentos, estas funciones de SQLite leen el reloj. En minúsculas,
    // para no confundirlas con Date() de JavaScript.
    expect(incumplen(/\b(date|time|datetime|julianday|unixepoch|strftime)\(\s*\)/)).toEqual([]);
  });

  it('nadie usa las transacciones de expo-sqlite ni las abre a mano: se escribe por la puerta', () => {
    expect(incumplen(/withTransactionAsync|withExclusiveTransactionAsync|withTransactionSync/)).toEqual([]);
    expect(
      incumplen(/execAsync\(\s*['"`]\s*(BEGIN|COMMIT|ROLLBACK|END)\b/i, (ruta) => ruta !== 'datos/base.ts'),
    ).toEqual([]);
  });

  it('las funciones de datos no abren la puerta: reciben la lectura o la transacción', () => {
    // La abren solo la preparación de la base y el gancho de las pantallas.
    const abren = ['datos/base.ts', 'datos/preparar.ts', 'datos/usarBase.ts'];
    expect(incumplen(/puertaDe\(/, (ruta) => ruta.startsWith('datos/') && !abren.includes(ruta))).toEqual([]);
  });

  it('fuera de datos/ nadie habla con la base directamente', () => {
    expect(incumplen(/\.(runAsync|execAsync|getAllAsync|getFirstAsync)\(/, fueraDeDatos)).toEqual([]);
    expect(incumplen(/useSQLiteContext|openDatabase(Async|Sync)/, fueraDeDatos)).toEqual([]);
  });

  it('el azar sale de getRandomValues: getRandomBytes usa Math.random en desarrollo', () => {
    expect(incumplen(/getRandomBytes/)).toEqual([]);
  });

  it('nadie usa INSERT OR REPLACE, que borra las filas hijas en cascada', () => {
    expect(incumplen(/INSERT\s+OR\s+REPLACE|REPLACE\s+INTO/i)).toEqual([]);
  });

  it('las migraciones solo añaden: sin comillas dobles, DROP, RENAME, transacciones ni PRAGMA', () => {
    for (const sql of MIGRACIONES.map(sinComentarios)) {
      expect(sql).not.toMatch(/"/);
      expect(sql).not.toMatch(/\b(DROP|RENAME)\b/i);
      expect(sql).not.toMatch(/\b(BEGIN\s+(TRANSACTION|IMMEDIATE|DEFERRED|EXCLUSIVE)|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|PRAGMA)\b/i);
      expect(sql).not.toMatch(/^\s*BEGIN\s*;/im);
      // strftime cambia entre versiones de SQLite: una hora se comprueba con GLOB.
      expect(sql).not.toMatch(/\bstrftime\(/i);
      // END suelto equivale a COMMIT: solo puede cerrar un disparador.
      const ends = sql.match(/\bEND\s*;/gi) ?? [];
      const disparadores = sql.match(/\bCREATE\s+TRIGGER\b/gi) ?? [];
      expect(ends.length).toBe(disparadores.length);
    }
  });
});

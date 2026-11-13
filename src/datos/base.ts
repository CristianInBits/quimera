// La conexión con la base del móvil y la única puerta para usarla.
//
// Los módulos de datos no usan expo-sqlite directamente, sino este tipo Base:
// la parte de su API que Quimera necesita. Así las pruebas les pueden dar una
// base de node:sqlite que se comporta igual que la del móvil.
//
// En el móvil hay una sola conexión con la base, y lo que se hace con ella
// mientras una escritura tiene su transacción abierta entra en esa
// transacción: una pantalla que leyera mientras se guarda un entreno lo vería
// a medias. Por eso todo pasa por la puerta, de una tarea en una.

export type Valor = string | number | null;
export type Parametros = Record<string, Valor>;

export interface Base {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, parametros: Parametros): Promise<{ changes: number }>;
  getFirstAsync<T>(sql: string, parametros: Parametros): Promise<T | null>;
  getAllAsync<T>(sql: string, parametros: Parametros): Promise<T[]>;
}

declare const enLaPuerta: unique symbol;
declare const escribiendo: unique symbol;

/** La base dentro de una tarea de la puerta, para leer. Las funciones que solo leen la piden. */
export type Lectura = Pick<Base, 'getFirstAsync' | 'getAllAsync'> & { readonly [enLaPuerta]: true };

/** La base dentro de una escritura. Las funciones que escriben la piden. */
export type Transaccion = Base & Lectura & { readonly [escribiendo]: true };

export type Puerta = {
  /** Ejecuta la tarea en su propia transacción: se guarda entera o no se guarda nada. */
  escribir<T>(tarea: (tx: Transaccion) => Promise<T>): Promise<T>;
  /** Ejecuta la tarea sin que nada escriba a la vez: ve la base antes o después de cada escritura, nunca en medio. */
  leer<T>(tarea: (lectura: Lectura) => Promise<T>): Promise<T>;
  /** Para los PRAGMA de la conexión, que no se pueden cambiar dentro de una transacción. */
  ajustar(tarea: (base: Base) => Promise<void>): Promise<void>;
};

/**
 * Los parámetros con nombre de expo-sqlite tienen que llevar los dos puntos:
 * el código nativo busca la clave tal cual y, si no la encuentra, la ignora
 * sin avisar y el parámetro se queda en NULL. Esta función se los pone.
 *
 * También rechaza lo que expo-sqlite guardaría mal sin decir nada: undefined y
 * los números que no son finitos (NaN, Infinity) acaban en NULL, y en el iPhone
 * un texto se corta en su primer carácter nulo.
 */
export function p(valores: Record<string, Valor | undefined>): Parametros {
  const parametros: Parametros = {};
  for (const [clave, valor] of Object.entries(valores)) {
    if (valor === undefined) {
      throw new Error(`Falta el valor del parámetro ${clave}.`);
    }
    if (typeof valor === 'number' && !Number.isFinite(valor)) {
      throw new Error(`El parámetro ${clave} no es un número válido: ${valor}.`);
    }
    if (typeof valor === 'string' && valor.includes('\u0000')) {
      throw new Error(`El parámetro ${clave} lleva un carácter nulo.`);
    }
    parametros[`:${clave}`] = valor;
  }
  return parametros;
}

const puertas = new WeakMap<Base, Puerta>();

/**
 * La puerta de una base. Las tareas esperan su turno en una sola cola, y cada
 * escritura va en su propia transacción.
 *
 * Las escrituras no usan withTransactionAsync de expo-sqlite, por dos motivos
 * que se ven en su código (src/SQLiteDatabase.ts de la versión 58.0.17):
 * - No es exclusiva: dos guardados a la vez mezclarían sus sentencias.
 * - Ejecuta su BEGIN dentro del try. Si ese BEGIN falla porque ya hay otra
 *   transacción abierta, su ROLLBACK deshace la transacción de la otra.
 */
export function puertaDe(db: Base): Puerta {
  let puerta = puertas.get(db);
  if (puerta === undefined) {
    puerta = crearPuerta(db);
    puertas.set(db, puerta);
  }
  return puerta;
}

function crearPuerta(db: Base): Puerta {
  let cola: Promise<unknown> = Promise.resolve();
  const enCola = <T>(trabajo: () => Promise<T>): Promise<T> => {
    const turno = cola.then(trabajo);
    cola = turno.catch(() => undefined);
    return turno;
  };

  return {
    escribir: <T>(tarea: (tx: Transaccion) => Promise<T>) =>
      enCola(async () => {
        // El BEGIN va fuera del try: si falla, no hay ninguna transacción
        // nuestra que deshacer, y un ROLLBACK desharía la de otro.
        await db.execAsync('BEGIN IMMEDIATE');
        try {
          const resultado = await ejecutar(db, true, tarea);
          await db.execAsync('COMMIT');
          return resultado;
        } catch (error) {
          // Si SQLite ya deshizo la transacción, el ROLLBACK falla; el error
          // que importa es el de la tarea.
          await db.execAsync('ROLLBACK').catch(() => undefined);
          throw error;
        }
      }),
    leer: <T>(tarea: (lectura: Lectura) => Promise<T>) => enCola(() => ejecutar(db, false, tarea)),
    ajustar: (tarea: (base: Base) => Promise<void>) => enCola(() => ejecutar(db, true, tarea)),
  };
}

/**
 * Ejecuta una tarea con un acceso propio a la base, que deja de servir cuando
 * la tarea acaba. Así:
 * - Una tarea que llama a la puerta dentro de otra falla al momento, en lugar
 *   de esperar para siempre su turno detrás de sí misma.
 * - Antes de dar la tarea por acabada se esperan las sentencias que dejó en
 *   marcha sin await, para que no caigan fuera de su transacción.
 * - Si alguna sentencia de la tarea falló, la tarea entera falla, aunque la
 *   tarea capturara el error.
 */
async function ejecutar<T, A>(db: Base, escritura: boolean, tarea: (acceso: A) => Promise<T>): Promise<T> {
  let abierta = true;
  const enMarcha = new Set<Promise<unknown>>();
  const fallos: unknown[] = [];

  const llamar = <R>(hacer: () => Promise<R>): Promise<R> => {
    if (!abierta) {
      return Promise.reject(
        new Error('Esa tarea de la base ya ha acabado: sus sentencias van dentro de ella, y con await.'),
      );
    }
    const promesa = hacer();
    enMarcha.add(promesa);
    promesa.then(
      () => enMarcha.delete(promesa),
      (error: unknown) => {
        enMarcha.delete(promesa);
        fallos.push(error);
      },
    );
    return promesa;
  };

  const lectura = {
    getFirstAsync: <F>(sql: string, parametros: Parametros) => llamar(() => db.getFirstAsync<F>(sql, parametros)),
    getAllAsync: <F>(sql: string, parametros: Parametros) => llamar(() => db.getAllAsync<F>(sql, parametros)),
  };
  const acceso = escritura
    ? {
        ...lectura,
        execAsync: (sql: string) => llamar(() => db.execAsync(sql)),
        runAsync: (sql: string, parametros: Parametros) => llamar(() => db.runAsync(sql, parametros)),
      }
    : lectura;

  try {
    const resultado = await tarea(acceso as unknown as A);
    abierta = false;
    await Promise.allSettled([...enMarcha]);
    if (fallos.length > 0) {
      throw fallos[0];
    }
    return resultado;
  } catch (error) {
    abierta = false;
    await Promise.allSettled([...enMarcha]);
    throw error;
  }
}

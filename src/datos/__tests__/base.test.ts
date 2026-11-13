import { p, puertaDe } from '@/datos/base';
import { abrirBaseDePrueba, nombresDeParametros, type BaseDePrueba } from '@/pruebas/baseDePrueba';

describe('Los parámetros', () => {
  it('p les pone los dos puntos que exige expo-sqlite', () => {
    expect(p({ id: 'a', ahora: 5, notas: null })).toEqual({ ':id': 'a', ':ahora': 5, ':notas': null });
  });

  it.each([
    ['undefined', undefined, /Falta el valor/],
    ['NaN', Number.NaN, /no es un número válido/],
    ['Infinity', Number.POSITIVE_INFINITY, /no es un número válido/],
    ['un texto con un carácter nulo', 'Pierna\u0000y glúteo', /carácter nulo/],
  ])('p rechaza %s, que expo-sqlite guardaría mal sin avisar', (_, valor, error) => {
    expect(() => p({ id: 'a', notas: valor as string })).toThrow(error);
  });

  it('la base de prueba rechaza claves sin dos puntos, claves que faltan y parámetros sin nombre', async () => {
    const db = abrirBaseDePrueba();
    await db.execAsync('CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER) STRICT');
    await expect(db.runAsync('INSERT INTO t (id, n) VALUES (:id, :n)', { id: 'a', n: 1 })).rejects.toThrow(
      /faltan :id, :n/,
    );
    await expect(db.runAsync('INSERT INTO t (id, n) VALUES (:id, :n)', { ':id': 'a' })).rejects.toThrow(/faltan :n/);
    await expect(db.runAsync('INSERT INTO t (id, n) VALUES (?, ?)', {})).rejects.toThrow(/sin nombre/);
    await expect(db.runAsync('INSERT INTO t (id, n) VALUES (:id, :n)', p({ id: 'a', n: 1 }))).resolves.toEqual({
      changes: 1,
    });
    db.cerrar();
  });

  it('los :nombres y los ? entre comillas no cuentan como parámetros', () => {
    expect([...nombresDeParametros("SELECT strftime('%H:%M', :hora) WHERE x = ':no?'")]).toEqual([':hora']);
  });

  it.each([
    ['real', 'real'],
    ['integer', 'integer'],
  ] as const)('con los números como en %s, un entero se enlaza como %s', async (enteros, tipo) => {
    const db = abrirBaseDePrueba({ enteros });
    expect(await db.getFirstAsync('SELECT typeof(:x) AS tipo', { ':x': 5 })).toEqual({ tipo });
    db.cerrar();
  });
});

describe('La puerta de la base', () => {
  let db: BaseDePrueba;
  beforeEach(async () => {
    db = abrirBaseDePrueba();
    await db.execAsync('CREATE TABLE t (n INTEGER NOT NULL CHECK (n >= 0)) STRICT');
  });
  afterEach(() => db.cerrar());

  const filas = () => db.mirar<{ n: number }>('SELECT n FROM t ORDER BY n').map((f) => f.n);

  it('es la misma para la misma base', () => {
    expect(puertaDe(db)).toBe(puertaDe(db));
  });

  it('si el BEGIN falla porque ya había una transacción abierta, no la deshace', async () => {
    // Alguien abrió una transacción por su cuenta, saltándose la puerta.
    await db.execAsync('BEGIN');
    await db.execAsync('INSERT INTO t VALUES (1)');
    await expect(puertaDe(db).escribir(async () => undefined)).rejects.toThrow(/transaction/);
    await db.execAsync('COMMIT');
    expect(filas()).toEqual([1]);
  });

  it('después de una tarea que falla, la siguiente escribe con normalidad', async () => {
    const puerta = puertaDe(db);
    await expect(
      puerta.escribir(async (tx) => {
        await tx.execAsync('INSERT INTO t VALUES (1)');
        throw new Error('falla');
      }),
    ).rejects.toThrow('falla');
    await puerta.escribir((tx) => tx.execAsync('INSERT INTO t VALUES (2)'));
    expect(filas()).toEqual([2]);
  });

  it('si SQLite ya deshizo la transacción, llega el error de la tarea y no el del ROLLBACK', async () => {
    await db.execAsync(
      "CREATE TRIGGER sin_negativos BEFORE INSERT ON t WHEN NEW.n = 99 BEGIN SELECT RAISE(ROLLBACK, 'el 99 no vale'); END",
    );
    await expect(puertaDe(db).escribir((tx) => tx.execAsync('INSERT INTO t VALUES (99)'))).rejects.toThrow(
      'el 99 no vale',
    );
    expect(filas()).toEqual([]);
  });

  it('una tarea que llama a la puerta dentro de otra falla al momento, sin colgar la cola', async () => {
    const puerta = puertaDe(db);
    await expect(
      puerta.escribir(async (tx) => {
        await tx.execAsync('INSERT INTO t VALUES (1)');
        await puertaDe(tx).escribir((otra) => otra.execAsync('INSERT INTO t VALUES (2)'));
      }),
    ).rejects.toThrow(/transaction/);
    await puerta.escribir((tx) => tx.execAsync('INSERT INTO t VALUES (3)'));
    expect(filas()).toEqual([3]);
  });

  it('espera las sentencias que la tarea dejó sin await, y si una falla, no guarda nada', async () => {
    const puerta = puertaDe(db);
    await expect(
      puerta.escribir(async (tx) => {
        void tx.execAsync('INSERT INTO t VALUES (1)');
        void tx.execAsync('INSERT INTO t VALUES (-1)');
      }),
    ).rejects.toThrow(/CHECK/);
    expect(filas()).toEqual([]);

    await puerta.escribir(async (tx) => {
      void tx.execAsync('INSERT INTO t VALUES (5)');
    });
    expect(filas()).toEqual([5]);
  });

  it('si una sentencia falla, la tarea falla aunque capture el error', async () => {
    await expect(
      puertaDe(db).escribir(async (tx) => {
        await tx.execAsync('INSERT INTO t VALUES (1)');
        await tx.execAsync('INSERT INTO t VALUES (-1)').catch(() => undefined);
      }),
    ).rejects.toThrow(/CHECK/);
    expect(filas()).toEqual([]);
  });

  it('el acceso de una tarea deja de servir cuando la tarea acaba', async () => {
    let guardado: { execAsync(sql: string): Promise<void> } | undefined;
    await puertaDe(db).escribir(async (tx) => {
      guardado = tx;
    });
    await expect(guardado!.execAsync('INSERT INTO t VALUES (1)')).rejects.toThrow(/ya ha acabado/);
    expect(filas()).toEqual([]);
  });

  it('una lectura espera a la escritura en marcha y la ve entera', async () => {
    const puerta = puertaDe(db);
    const escritura = puerta.escribir(async (tx) => {
      for (let n = 1; n <= 5; n++) {
        await tx.execAsync(`INSERT INTO t VALUES (${n})`);
      }
    });
    const vistas = await Promise.all(
      [1, 2, 3].map(() => puerta.leer((l) => l.getAllAsync<{ n: number }>('SELECT n FROM t', {}))),
    );
    await escritura;
    for (const vista of vistas) {
      expect(vista.map((f) => f.n)).toEqual([1, 2, 3, 4, 5]);
    }
  });
});

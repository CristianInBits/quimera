/// <reference types="node" />
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { leerAjuste } from '@/datos/ajustes';
import { p, puertaDe } from '@/datos/base';
import { guardarEntrenoEn, leerEntreno } from '@/datos/entrenos';
import { huella } from '@/datos/huella';
import { MIGRACIONES } from '@/datos/migraciones';
import { prepararBase } from '@/datos/preparar';
import { abrirBaseDePrueba, type BaseDePrueba } from '@/pruebas/baseDePrueba';
import { T0, abrirBasePreparada, generadorDeIds, gimnasioConCalentamiento, hyroxConDescansos } from '@/pruebas/datos';

const abiertas: BaseDePrueba[] = [];
const abrir = (...args: Parameters<typeof abrirBaseDePrueba>) => {
  const db = abrirBaseDePrueba(...args);
  abiertas.push(db);
  return db;
};
afterEach(() => {
  while (abiertas.length > 0) abiertas.pop()?.cerrar();
});

const version = (db: BaseDePrueba) => db.mirar<{ user_version: number }>('PRAGMA user_version')[0].user_version;
const tablas = (db: BaseDePrueba) =>
  db.mirar<{ name: string; strict: number }>(
    "SELECT name, strict FROM pragma_table_list WHERE schema = 'main' AND type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
const huellasGuardadas = (db: BaseDePrueba) => puertaDe(db).leer((l) => leerAjuste(l, 'local.migraciones'));

describe('Preparar la base', () => {
  it('crea una base vacía entera, con todas las tablas STRICT y los ajustes de la conexión', async () => {
    const db = abrir();
    const estado = await prepararBase(db, { ahora: () => T0 });

    expect(estado.version).toBe(MIGRACIONES.length);
    expect(version(db)).toBe(MIGRACIONES.length);
    expect(db.mirar('PRAGMA foreign_keys')).toEqual([{ foreign_keys: 1 }]);
    expect(db.mirar('PRAGMA synchronous')).toEqual([{ synchronous: 1 }]);
    expect(db.mirar('PRAGMA journal_size_limit')).toEqual([{ journal_size_limit: 4194304 }]);
    expect(tablas(db).map((t) => t.name)).toEqual(['ajuste', 'bloque', 'disciplina', 'ejercicio', 'entreno', 'serie']);
    expect(tablas(db).every((t) => t.strict === 1)).toBe(true);
    expect(db.mirar('PRAGMA integrity_check')).toEqual([{ integrity_check: 'ok' }]);
    expect(db.mirar('PRAGMA foreign_key_check')).toEqual([]);
    expect(await huellasGuardadas(db)).toEqual(MIGRACIONES.map(huella));
    expect(db.mirar("SELECT id FROM ejercicio WHERE id = 'correr'")).toEqual([{ id: 'correr' }]);
  });

  it('pone el diario WAL en una base guardada en disco', async () => {
    const carpeta = mkdtempSync(join(tmpdir(), 'quimera-'));
    const db = abrirBaseDePrueba({ fichero: join(carpeta, 'quimera.db') });
    try {
      await prepararBase(db, { ahora: () => T0 });
      expect(db.mirar('PRAGMA journal_mode')).toEqual([{ journal_mode: 'wal' }]);
    } finally {
      db.cerrar();
      rmSync(carpeta, { recursive: true, force: true });
    }
  });

  it('abrirla otra vez no cambia nada', async () => {
    const db = abrir();
    await prepararBase(db, { ahora: () => T0 });
    const ejercicios = db.mirar('SELECT * FROM ejercicio');
    const ajustes = db.mirar('SELECT * FROM ajuste');
    await prepararBase(db, { ahora: () => T0 + 86_400_000 });
    expect(db.mirar('SELECT * FROM ejercicio')).toEqual(ejercicios);
    expect(db.mirar('SELECT * FROM ajuste')).toEqual(ajustes);
    expect(version(db)).toBe(MIGRACIONES.length);
  });

  it('sube una base con entrenos a una migración nueva sin perder nada, y la vuelve a abrir', async () => {
    const db = abrir();
    await prepararBase(db, { ahora: () => T0 });
    await db.runAsync(
      "INSERT INTO ejercicio VALUES ('wall-balls', 'Wall balls', 'hyrox', 1, 1, 1, 0, 0, 0, :t, 0), ('skierg', 'SkiErg', 'hyrox', 0, 0, 1, 1, 1, 0, :t, 0), ('burpees', 'Burpees', 'hyrox', 1, 0, 1, 0, 0, 0, :t, 0), ('press-banca', 'Press banca', 'pecho', 1, 1, 0, 0, 0, 0, :t, 0)",
      p({ t: T0 }),
    );
    const nuevoId = generadorDeIds();
    const entrenos = [hyroxConDescansos(nuevoId), gimnasioConCalentamiento(nuevoId)];
    for (const entreno of entrenos) {
      await puertaDe(db).escribir((tx) => guardarEntrenoEn(tx, entreno, { ahora: T0 }));
    }
    const nueva = 'ALTER TABLE entreno ADD COLUMN prueba INTEGER CHECK (prueba IS NULL OR prueba BETWEEN 1 AND 9);';
    const conLaNueva = [...MIGRACIONES, nueva];

    await prepararBase(db, { ahora: () => T0 + 1000, migraciones: conLaNueva });
    await prepararBase(db, { ahora: () => T0 + 2000, migraciones: conLaNueva });

    expect(version(db)).toBe(conLaNueva.length);
    expect(await huellasGuardadas(db)).toEqual(conLaNueva.map(huella));
    for (const entreno of entrenos) {
      expect(await puertaDe(db).leer((l) => leerEntreno(l, entreno.id))).toEqual({ ...entreno, modificado: T0 });
    }
  });

  it('dos preparaciones a la vez aplican cada migración una sola vez', async () => {
    const db = abrir();
    const migraciones = [...MIGRACIONES, "INSERT INTO disciplina (id) VALUES ('prueba');"];
    await expect(
      Promise.all([prepararBase(db, { ahora: () => T0, migraciones }), prepararBase(db, { ahora: () => T0, migraciones })]),
    ).resolves.toHaveLength(2);
    expect(db.mirar("SELECT COUNT(*) AS n FROM disciplina WHERE id = 'prueba'")).toEqual([{ n: 1 }]);
    expect(version(db)).toBe(migraciones.length);
  });

  it('rechaza una base de una Quimera más nueva', async () => {
    const db = abrir();
    await db.execAsync('PRAGMA user_version = 99');
    await expect(prepararBase(db, { ahora: () => T0 })).rejects.toThrow(/más nueva/);
  });

  it('si una migración falla, no aplica ninguna de las pendientes', async () => {
    const rota = 'CREATE TABLE nueva (x INTEGER) STRICT; INSERT INTO no_existe VALUES (1);';
    const vacia = abrir();
    await expect(prepararBase(vacia, { ahora: () => T0, migraciones: [...MIGRACIONES, rota] })).rejects.toThrow(
      /no_existe/,
    );
    expect(version(vacia)).toBe(0);
    expect(tablas(vacia)).toEqual([]);

    const alDia = abrir();
    await prepararBase(alDia, { ahora: () => T0 });
    await expect(prepararBase(alDia, { ahora: () => T0, migraciones: [...MIGRACIONES, rota] })).rejects.toThrow(
      /no_existe/,
    );
    expect(version(alDia)).toBe(MIGRACIONES.length);
    expect(tablas(alDia).map((t) => t.name)).not.toContain('nueva');
  });

  it('no deja claves foráneas rotas al migrar', async () => {
    const db = abrir();
    const rota =
      "PRAGMA defer_foreign_keys = ON; INSERT INTO bloque (id, entreno_id, orden, modificado) VALUES ('019a6f00-0000-7000-8000-0000000000aa', '019a6f00-0000-7000-8000-0000000000bb', 1, 1794218400000);";
    await expect(prepararBase(db, { ahora: () => T0, migraciones: [...MIGRACIONES, rota] })).rejects.toThrow(
      /claves foráneas rotas/,
    );
    expect(version(db)).toBe(0);
  });

  it('no abre una base si una migración ya aplicada ha cambiado', async () => {
    const db = abrir();
    await prepararBase(db, { ahora: () => T0 });
    const cambiadas = MIGRACIONES.map((sql, i) => (i === 0 ? `${sql}\n-- un cambio` : sql));
    await expect(prepararBase(db, { ahora: () => T0, migraciones: cambiadas })).rejects.toThrow(/no coinciden/);
  });

  it('las migraciones publicadas no cambian nunca', () => {
    // Al añadir una migración, se añade aquí su huella. Las que ya están no se tocan.
    expect(MIGRACIONES.map(huella)).toEqual(['1f6883ae0848a9']);
  });
});

describe('La forma de la base', () => {
  let db: BaseDePrueba;
  beforeAll(async () => {
    db = await abrirBasePreparada();
  });
  afterAll(() => db.cerrar());

  it('ninguna clave foránea apunta a serie, y a bloque solo la de serie', () => {
    const claves = db.mirar<{ tabla: string; columna: string; destino: string }>(
      `SELECT m.name AS tabla, f."from" AS columna, f."table" AS destino
       FROM sqlite_schema AS m, pragma_foreign_key_list(m.name) AS f
       WHERE m.type = 'table' AND f."table" IN ('bloque', 'serie')`,
    );
    expect(claves).toEqual([{ tabla: 'serie', columna: 'bloque_id', destino: 'bloque' }]);
  });

  it('las vistas no repiten nombres de columna', () => {
    for (const vista of ['entreno_hecho', 'bloque_hecho', 'serie_hecha']) {
      const nombres = db.mirar<{ name: string }>(`SELECT name FROM pragma_table_info('${vista}')`).map((c) => c.name);
      expect(nombres.filter((n) => n.includes(':'))).toEqual([]);
      expect(new Set(nombres).size).toBe(nombres.length);
    }
  });

  it('tiene los índices de las consultas por fecha y por ejercicio', () => {
    const columnas = (indice: string) =>
      db.mirar<{ name: string }>(`SELECT name FROM pragma_index_info('${indice}')`).map((c) => c.name);
    expect(columnas('entreno_por_fecha')).toEqual(['fecha']);
    expect(columnas('serie_por_ejercicio')).toEqual(['ejercicio_id', 'bloque_id']);
  });
});

describe('Las reglas que la base hace cumplir', () => {
  let db: BaseDePrueba;
  const nuevoId = generadorDeIds();
  let entrenoId: string;
  let bloqueId: string;

  const insertar = (tabla: string, fila: Record<string, string | number | null>) =>
    db.runAsync(
      `INSERT INTO ${tabla} (${Object.keys(fila).join(', ')}) VALUES (${Object.keys(fila)
        .map((c) => `:${c}`)
        .join(', ')})`,
      p(fila),
    );

  const entreno = (cambios: Record<string, string | number | null> = {}) => ({
    id: nuevoId(),
    disciplina: 'gimnasio',
    fecha: '2026-11-15',
    hora: '18:30',
    duracion_ms: 3150000,
    esfuerzo: 7,
    notas: 'Pierna',
    modificado: T0,
    ...cambios,
  });
  const bloque = (cambios: Record<string, string | number | null> = {}) => ({
    id: nuevoId(),
    entreno_id: entrenoId,
    orden: 50,
    metros_corridos: 2000,
    tiempo_ms: 720000,
    descanso_ms: 120000,
    modificado: T0,
    ...cambios,
  });
  let rondaLibre = 1;
  const serie = (cambios: Record<string, string | number | null> = {}) => ({
    id: nuevoId(),
    bloque_id: bloqueId,
    ronda: rondaLibre++,
    orden: 1,
    ejercicio_id: 'press-banca',
    repeticiones: 8,
    peso_g: 62500,
    tiempo_ms: null,
    distancia_m: null,
    calorias: null,
    descanso_ms: 90000,
    modificado: T0,
    ...cambios,
  });
  const ejercicio = (cambios: Record<string, string | number | null> = {}) => ({
    id: nuevoId(),
    nombre: 'Hip thrust',
    grupo: 'pierna',
    usa_repeticiones: 1,
    usa_peso: 1,
    usa_tiempo: 0,
    usa_distancia: 0,
    usa_calorias: 0,
    propio: 1,
    modificado: T0,
    ...cambios,
  });

  beforeAll(async () => {
    db = await abrirBasePreparada();
    const e = entreno();
    entrenoId = e.id;
    await insertar('entreno', e);
    const b = bloque({ orden: 1 });
    bloqueId = b.id;
    await insertar('bloque', b);
  });
  afterAll(() => db.cerrar());

  it.each([
    ['sin hora ni notas', { hora: null, notas: null }],
    ['a las 00:00', { hora: '00:00' }],
    ['a las 23:59', { hora: '23:59' }],
    ['con la duración mínima, un minuto', { duracion_ms: 60000 }],
    ['con esfuerzo 1', { esfuerzo: 1 }],
    ['con esfuerzo 10', { esfuerzo: 10 }],
    ['de carrera', { disciplina: 'carrera' }],
  ])('acepta un entreno %s', async (_, cambios) => {
    await expect(insertar('entreno', entreno(cambios))).resolves.toEqual({ changes: 1 });
  });

  it.each([
    ['con un UUID v4', { id: '019a6f00-0000-4000-8000-000000000001' }],
    ['con el UUID en mayúsculas', { id: '019A6F00-0000-7000-8000-000000000001' }],
    ['con un guion de más en el UUID', { id: '019a6f00-0000-7000-8000-00000000-001' }],
    ['de una disciplina que no existe', { disciplina: 'yoga' }],
    ['con el 30 de febrero', { fecha: '2026-02-30' }],
    ['con el año 0026', { fecha: '0026-11-15' }],
    ['con la fecha sin ceros', { fecha: '2026-11-5' }],
    ['a las 24:00', { hora: '24:00' }],
    ['a las 24:30', { hora: '24:30' }],
    ['a las 19:60', { hora: '19:60' }],
    ['con la hora sin cero', { hora: '7:05' }],
    ['con la hora y los segundos', { hora: '07:05:00' }],
    ['con la duración en segundos', { duracion_ms: 2700 }],
    ['de menos de un minuto', { duracion_ms: 59999 }],
    ['de más de 48 horas', { duracion_ms: 172800001 }],
    ['con esfuerzo 0', { esfuerzo: 0 }],
    ['con esfuerzo 11', { esfuerzo: 11 }],
    ['con notas que solo tienen espacios, tabuladores y saltos de línea', { notas: ' \n\t\r ' }],
    ['con notas de más de 4000 caracteres', { notas: 'x'.repeat(4001) }],
    ['con el sello en segundos', { modificado: 1794218400 }],
    ['con una marca de borrado que no es 0 ni 1', { borrado: 2 }],
  ])('rechaza un entreno %s', async (_, cambios) => {
    await expect(insertar('entreno', entreno(cambios))).rejects.toThrow(/constraint/i);
  });

  it('acepta un bloque sin metros, sin tiempo y sin descanso', async () => {
    await expect(
      insertar('bloque', bloque({ orden: 2, metros_corridos: null, tiempo_ms: null, descanso_ms: null })),
    ).resolves.toEqual({ changes: 1 });
  });

  it.each([
    ['en un sitio ya ocupado', { orden: 1 }],
    ['en el sitio 0', { orden: 0 }],
    ['con 0 metros corridos', { orden: 3, metros_corridos: 0 }],
    ['con más de 1000 km corridos', { orden: 3, metros_corridos: 1000001 }],
    ['de menos de un segundo', { orden: 4, tiempo_ms: 999 }],
    ['con un descanso negativo', { orden: 5, descanso_ms: -1 }],
    ['con un descanso de más de un día', { orden: 5, descanso_ms: 86400001 }],
    ['de un entreno que no existe', { orden: 6, entreno_id: '019a6f00-0000-7000-8000-0000000000ff' }],
    ['con el sello en segundos', { orden: 7, modificado: 1794218400 }],
  ])('rechaza un bloque %s', async (_, cambios) => {
    await expect(insertar('bloque', bloque(cambios))).rejects.toThrow(/constraint/i);
  });

  it.each([
    ['con peso y repeticiones', {}],
    ['al fallo, sin peso', { peso_g: null }],
    ['solo con calorías', { repeticiones: null, peso_g: null, calorias: 20, ejercicio_id: 'skierg' }],
    ['solo con tiempo, como una plancha', { repeticiones: null, peso_g: null, tiempo_ms: 60000 }],
    ['solo con distancia', { repeticiones: null, peso_g: null, distancia_m: 1000, ejercicio_id: 'correr' }],
    ['sin descanso después', { descanso_ms: 0 }],
  ])('acepta una serie %s', async (_, cambios) => {
    await expect(insertar('serie', serie(cambios))).resolves.toEqual({ changes: 1 });
  });

  it('rechaza una serie en un sitio ya ocupado', async () => {
    await insertar('serie', serie({ ronda: 500, orden: 1 }));
    await expect(insertar('serie', serie({ ronda: 500, orden: 1 }))).rejects.toThrow(/UNIQUE/);
  });

  it.each([
    ['que solo tiene peso', { repeticiones: null }],
    ['que solo tiene descanso', { repeticiones: null, peso_g: null }],
    ['con 0 kg', { peso_g: 0 }],
    ['con más de 1000 kg', { peso_g: 1000001 }],
    ['con 0 repeticiones', { repeticiones: 0 }],
    ['con más de 10000 repeticiones', { repeticiones: 10001 }],
    ['con 0 calorías', { calorias: 0 }],
    ['con 0 metros', { distancia_m: 0 }],
    ['con un tiempo de 0', { tiempo_ms: 0 }],
    ['en la vuelta 0', { ronda: 0 }],
    ['en el sitio 0', { orden: 0 }],
    ['con un descanso negativo', { descanso_ms: -5000 }],
    ['de un ejercicio que no existe', { ejercicio_id: 'no-existe' }],
    ['de un bloque que no existe', { bloque_id: '019a6f00-0000-7000-8000-0000000000ff' }],
    ['con el sello en segundos', { modificado: 1794218400 }],
    ['con una marca de borrado que no es 0 ni 1', { borrado: 2 }],
  ])('rechaza una serie %s', async (_, cambios) => {
    await expect(insertar('serie', serie(cambios))).rejects.toThrow(/constraint/i);
  });

  it('acepta un ejercicio propio con UUID v7', async () => {
    await expect(insertar('ejercicio', ejercicio())).resolves.toEqual({ changes: 1 });
  });

  it.each([
    ['propio con una clave de catálogo', { id: 'hip-thrust' }],
    ['del catálogo con un UUID', { propio: 0 }],
    ['con la clave en mayúsculas', { id: 'Hip-Thrust', propio: 0 }],
    ['con un nombre de solo saltos de línea', { nombre: '\n\n' }],
    ['con un nombre de más de 80 caracteres', { nombre: 'x'.repeat(81) }],
    ['con un grupo en mayúsculas', { grupo: 'Pierna' }],
    ['que no mide nada', { usa_repeticiones: 0, usa_peso: 0 }],
    ['con el sello en segundos', { modificado: 1794218400 }],
    ['con una marca de borrado que no es 0 ni 1', { borrado: 2 }],
  ])('rechaza un ejercicio %s', async (_, cambios) => {
    await expect(insertar('ejercicio', ejercicio(cambios))).rejects.toThrow(/constraint/i);
  });

  it.each([
    ['con un valor que no es JSON', { clave: 'descanso.por_defecto', valor: 'noventa' }],
    ['con mayúsculas en la clave', { clave: 'Local.algo', valor: '1' }],
    ['con una clave de más de 64 caracteres', { clave: 'x'.repeat(65), valor: '1' }],
  ])('rechaza un ajuste %s', async (_, cambios) => {
    await expect(insertar('ajuste', { ...cambios, modificado: T0 })).rejects.toThrow(/constraint/i);
  });
});

describe('Las vistas y el disparador', () => {
  let db: BaseDePrueba;
  const nuevoId = generadorDeIds();
  beforeEach(async () => {
    db = await abrirBasePreparada();
  });
  afterEach(() => db.cerrar());

  const entreno = async (fecha: string, duracion: number, esfuerzo: number) => {
    const id = nuevoId();
    await db.runAsync(
      `INSERT INTO entreno (id, disciplina, fecha, duracion_ms, esfuerzo, modificado)
       VALUES (:id, 'gimnasio', :fecha, :duracion, :esfuerzo, :modificado)`,
      p({ id, fecha, duracion, esfuerzo, modificado: T0 }),
    );
    return id;
  };

  it('la carga es minutos redondeados por esfuerzo, y el domingo cuenta en su semana', async () => {
    await entreno('2026-11-15', 3150000, 7); // domingo, 52:30
    await entreno('2026-11-16', 3149999, 5); // lunes, 52:29,999
    expect(db.mirar('SELECT fecha, lunes, minutos, carga FROM entreno_hecho ORDER BY fecha')).toEqual([
      { fecha: '2026-11-15', lunes: '2026-11-09', minutos: 53, carga: 371 },
      { fecha: '2026-11-16', lunes: '2026-11-16', minutos: 52, carga: 260 },
    ]);
  });

  it('borrar un entreno marca sus bloques y sus series con su sello, y restaurarlo las desmarca', async () => {
    const id = await entreno('2026-11-15', 3150000, 7);
    const bloque = nuevoId();
    await db.runAsync(
      'INSERT INTO bloque (id, entreno_id, orden, metros_corridos, modificado) VALUES (:bloque, :id, 1, 2000, :t)',
      p({ bloque, id, t: T0 }),
    );
    await db.runAsync(
      `INSERT INTO serie (id, bloque_id, ronda, orden, ejercicio_id, tiempo_ms, distancia_m, modificado)
       VALUES (:serie, :bloque, 1, 1, 'correr', 600000, 2000, :t)`,
      p({ serie: nuevoId(), bloque, t: T0 }),
    );

    await db.runAsync('UPDATE entreno SET borrado = 1, modificado = :t WHERE id = :id', p({ id, t: T0 + 5 }));
    expect(db.mirar('SELECT borrado, modificado FROM bloque UNION ALL SELECT borrado, modificado FROM serie')).toEqual([
      { borrado: 1, modificado: T0 + 5 },
      { borrado: 1, modificado: T0 + 5 },
    ]);
    expect(db.mirar('SELECT COUNT(*) AS n FROM entreno_hecho')).toEqual([{ n: 0 }]);
    expect(db.mirar('SELECT COUNT(*) AS n FROM bloque_hecho UNION ALL SELECT COUNT(*) FROM serie_hecha')).toEqual([
      { n: 0 },
      { n: 0 },
    ]);

    await db.runAsync('UPDATE entreno SET borrado = 0, modificado = :t WHERE id = :id', p({ id, t: T0 + 9 }));
    expect(db.mirar('SELECT borrado, modificado FROM bloque UNION ALL SELECT borrado, modificado FROM serie')).toEqual([
      { borrado: 0, modificado: T0 + 9 },
      { borrado: 0, modificado: T0 + 9 },
    ]);
    expect(db.mirar('SELECT SUM(metros_corridos) AS metros FROM bloque_hecho')).toEqual([{ metros: 2000 }]);
  });
});

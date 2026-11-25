import { puertaDe } from '@/datos/base';
import {
  EntrenoCambiado,
  EntrenoNoValido,
  borrarEntrenoEn,
  guardarEntrenoEn,
  leerEntreno,
  restaurarEntrenoEn,
  type Entreno,
} from '@/datos/entrenos';
import type { BaseDePrueba } from '@/pruebas/baseDePrueba';
import { T0, abrirBasePreparada, generadorDeIds, gimnasioConCalentamiento, hyroxConDescansos } from '@/pruebas/datos';

// Cada prueba corre dos veces: con los números enlazados como REAL, como en el
// iPhone, y como INTEGER, como en Android.
describe.each(['real', 'integer'] as const)('Los entrenos, con los números como en %s', (enteros) => {
  let db: BaseDePrueba;
  const nuevoId = generadorDeIds();
  beforeEach(async () => {
    db = await abrirBasePreparada({ enteros });
  });
  afterEach(() => db.cerrar());

  const guardar = (entreno: Entreno, ahora: number, selloLeido?: number | null) =>
    puertaDe(db).escribir((tx) => guardarEntrenoEn(tx, entreno, { ahora, selloLeido }));
  const leer = (id: string) => puertaDe(db).leer((l) => leerEntreno(l, id));
  const borrar = (id: string, ahora: number) => puertaDe(db).escribir((tx) => borrarEntrenoEn(tx, id, ahora));
  const restaurar = (id: string, ahora: number) => puertaDe(db).escribir((tx) => restaurarEntrenoEn(tx, id, ahora));
  const filas = (tabla: string) => db.mirar<Record<string, unknown>>(`SELECT * FROM ${tabla} ORDER BY id`);
  const sellos = () =>
    db.mirar('SELECT DISTINCT modificado FROM entreno UNION SELECT modificado FROM bloque UNION SELECT modificado FROM serie');

  it('guarda un entreno nuevo y lo lee igual, con sus tiempos y sus descansos', async () => {
    const hyrox = hyroxConDescansos(nuevoId);
    const sello = await guardar(hyrox, T0, null);

    expect(sello).toBe(T0);
    expect(await leer(hyrox.id)).toEqual({ ...hyrox, modificado: T0 });
    expect(db.mirar('SELECT COUNT(*) AS n FROM serie')).toEqual([{ n: 14 }]);
  });

  it('cada columna de entreno, bloque y serie tiene su sitio en el código', () => {
    // Si una migración añade una columna, esta prueba falla: hay que llevarla a
    // guardarEntrenoEn, a leerEntreno y a hyroxConDescansos, y decidir si entra
    // en la copia (src/datos/copia.ts), que vigila su propia prueba.
    const columnas = (tabla: string) =>
      db.mirar<{ name: string }>(`SELECT name FROM pragma_table_info('${tabla}')`).map((c) => c.name);
    expect(columnas('entreno')).toEqual([
      'id', 'disciplina', 'fecha', 'hora', 'duracion_ms', 'esfuerzo', 'notas', 'modificado', 'borrado',
    ]);
    expect(columnas('bloque')).toEqual([
      'id', 'entreno_id', 'orden', 'metros_corridos', 'tiempo_ms', 'descanso_ms', 'modificado', 'borrado',
    ]);
    expect(columnas('serie')).toEqual([
      'id', 'bloque_id', 'ronda', 'orden', 'ejercicio_id', 'repeticiones', 'peso_g', 'tiempo_ms',
      'distancia_m', 'calorias', 'descanso_ms', 'modificado', 'borrado',
    ]);
  });

  it('corregir sin cambiar nada deja todas las filas igual, salvo el sello', async () => {
    const hyrox = hyroxConDescansos(nuevoId);
    await guardar(hyrox, T0, null);
    const sinSello = (tabla: string) => filas(tabla).map(({ modificado: _, ...resto }) => resto);
    const antes = ['entreno', 'bloque', 'serie'].map(sinSello);

    const { modificado, ...entreno } = (await leer(hyrox.id))!;
    await guardar(entreno, T0 + 1000, modificado);

    expect(['entreno', 'bloque', 'serie'].map(sinSello)).toEqual(antes);
    expect(sellos()).toEqual([{ modificado: T0 + 1000 }]);
  });

  it('corregir conserva los identificadores, quita las series quitadas y sube el sello', async () => {
    const gimnasio = gimnasioConCalentamiento(nuevoId);
    const sello = await guardar(gimnasio, T0, null);
    const quitada = gimnasio.bloques[1].series[2].id;
    const corregido: Entreno = {
      ...gimnasio,
      notas: 'La última serie no salió',
      bloques: [gimnasio.bloques[0], { ...gimnasio.bloques[1], series: gimnasio.bloques[1].series.slice(0, 2) }],
    };

    const nuevo = await guardar(corregido, T0 + 60_000, sello);

    expect(nuevo).toBe(T0 + 60_000);
    expect(await leer(gimnasio.id)).toEqual({ ...corregido, modificado: nuevo });
    expect(db.mirar('SELECT COUNT(*) AS n FROM serie WHERE id = :id', { ':id': quitada })).toEqual([{ n: 0 }]);
    expect(db.mirar('SELECT COUNT(*) AS n FROM serie')).toEqual([{ n: 2 }]);
  });

  it('el sello nunca baja, aunque el reloj vaya hacia atrás, al guardar, al borrar ni al restaurar', async () => {
    const gimnasio = gimnasioConCalentamiento(nuevoId);
    const sello = await guardar(gimnasio, T0, null);
    expect(await guardar(gimnasio, T0 - 3_600_000, sello)).toBe(T0 + 1);

    await borrar(gimnasio.id, T0 - 3_600_000);
    expect(sellos()).toEqual([{ modificado: T0 + 2 }]);
    await restaurar(gimnasio.id, T0 - 7_200_000);
    expect(sellos()).toEqual([{ modificado: T0 + 3 }]);
  });

  it('las notas vacías se guardan como nada', async () => {
    const gimnasio = { ...gimnasioConCalentamiento(nuevoId), notas: ' \n ' };
    await guardar(gimnasio, T0, null);
    expect((await leer(gimnasio.id))?.notas).toBeNull();
  });

  it('borrar lo quita de todas las sumas, y restaurar lo devuelve entero', async () => {
    const gimnasio = gimnasioConCalentamiento(nuevoId);
    await guardar(gimnasio, T0, null);

    await borrar(gimnasio.id, T0 + 10);
    expect(await leer(gimnasio.id)).toBeNull();
    expect(db.mirar('SELECT COUNT(*) AS n FROM entreno_hecho')).toEqual([{ n: 0 }]);
    expect(db.mirar('SELECT SUM(metros_corridos) AS m FROM bloque_hecho')).toEqual([{ m: null }]);
    expect(db.mirar('SELECT DISTINCT borrado FROM bloque UNION SELECT borrado FROM serie')).toEqual([{ borrado: 1 }]);

    await restaurar(gimnasio.id, T0 + 20);
    expect(await leer(gimnasio.id)).toEqual({ ...gimnasio, modificado: T0 + 20 });
    expect(db.mirar('SELECT SUM(metros_corridos) AS m FROM bloque_hecho')).toEqual([{ m: 2000 }]);
  });

  it('no borra un entreno ya borrado ni uno que no existe, ni restaura uno sin borrar', async () => {
    const gimnasio = gimnasioConCalentamiento(nuevoId);
    await guardar(gimnasio, T0, null);

    await expect(restaurar(gimnasio.id, T0)).rejects.toThrow(/borrado/);
    await borrar(gimnasio.id, T0);
    await expect(borrar(gimnasio.id, T0)).rejects.toThrow(/sin borrar/);
    await expect(borrar(nuevoId(), T0)).rejects.toThrow(/sin borrar/);
  });

  it('no pisa un entreno que cambió o se borró desde que se leyó', async () => {
    const gimnasio = gimnasioConCalentamiento(nuevoId);
    const primero = await guardar(gimnasio, T0, null);
    await guardar(gimnasio, T0 + 10, primero);

    // Otro guardado, con el sello viejo: se perdería la corrección de en medio.
    await expect(guardar(gimnasio, T0 + 20, primero)).rejects.toThrow(EntrenoCambiado);
    // Un entreno «nuevo» con un identificador que ya existe.
    await expect(guardar(gimnasio, T0 + 20, null)).rejects.toThrow(EntrenoCambiado);
    // Uno que se borró mientras estaba abierto.
    const actual = (await leer(gimnasio.id))!.modificado;
    await borrar(gimnasio.id, T0 + 30);
    await expect(guardar(gimnasio, T0 + 40, actual)).rejects.toThrow(EntrenoCambiado);
  });

  it('no guarda una serie con algo que su ejercicio no mide', async () => {
    const gimnasio = gimnasioConCalentamiento(nuevoId);
    const pressConSegundos: Entreno = {
      ...gimnasio,
      bloques: [{ ...gimnasio.bloques[1], series: [{ ...gimnasio.bloques[1].series[0], tiempoMs: 40_000 }] }],
    };
    await expect(guardar(pressConSegundos, T0, null)).rejects.toThrow(EntrenoNoValido);
    await expect(guardar(pressConSegundos, T0, null)).rejects.toThrow('Press banca no lleva tiempo.');

    const planchaConRepeticiones: Entreno = {
      ...gimnasio,
      bloques: [
        {
          ...gimnasio.bloques[1],
          series: [{ ...gimnasio.bloques[1].series[0], ejercicioId: 'plancha', repeticiones: 10, pesoG: 20_000 }],
        },
      ],
    };
    await expect(guardar(planchaConRepeticiones, T0, null)).rejects.toThrow(
      'Plancha no lleva repeticiones. Plancha no lleva peso.',
    );

    // La serie mala en segundo lugar, y con distancia y calorías.
    const [buena] = gimnasio.bloques[1].series;
    const segundaMala: Entreno = {
      ...gimnasio,
      bloques: [{ ...gimnasio.bloques[1], series: [buena, { ...buena, id: nuevoId(), ronda: 2, distanciaM: 100, calorias: 10 }] }],
    };
    await expect(guardar(segundaMala, T0, null)).rejects.toThrow(
      'Press banca no lleva distancia. Press banca no lleva calorías.',
    );
    expect(db.mirar('SELECT COUNT(*) AS n FROM entreno')).toEqual([{ n: 0 }]);
  });

  it('si algo falla al guardar, el entreno se queda como estaba', async () => {
    const gimnasio = gimnasioConCalentamiento(nuevoId);
    await guardar(gimnasio, T0, null);
    const antes = ['entreno', 'bloque', 'serie'].map(filas);
    const roto: Entreno = {
      ...gimnasio,
      notas: 'Esto no se guarda',
      bloques: [
        gimnasio.bloques[0],
        { ...gimnasio.bloques[1], series: [{ ...gimnasio.bloques[1].series[0], ejercicioId: 'no-existe' }] },
      ],
    };

    await expect(guardar(roto, T0 + 10)).rejects.toThrow(/FOREIGN KEY/);
    expect(['entreno', 'bloque', 'serie'].map(filas)).toEqual(antes);
  });

  it('dos escrituras a la vez esperan su turno, y si una falla no se lleva a la otra', async () => {
    const puerta = puertaDe(db);
    const uno = gimnasioConCalentamiento(nuevoId);
    const dos = hyroxConDescansos(nuevoId);
    const pasos: string[] = [];

    const resultados = await Promise.allSettled([
      puerta.escribir(async (tx) => {
        pasos.push('uno empieza');
        await guardarEntrenoEn(tx, uno, { ahora: T0 });
        pasos.push('uno falla');
        throw new Error('Fallo a propósito después de guardar');
      }),
      puerta.escribir(async (tx) => {
        pasos.push('dos empieza');
        await guardarEntrenoEn(tx, dos, { ahora: T0 });
        pasos.push('dos acaba');
      }),
    ]);

    expect(resultados.map((r) => r.status)).toEqual(['rejected', 'fulfilled']);
    expect(pasos).toEqual(['uno empieza', 'uno falla', 'dos empieza', 'dos acaba']);
    expect(await leer(uno.id)).toBeNull();
    expect(await leer(dos.id)).toEqual({ ...dos, modificado: T0 });
  });

  it('leer mientras se corrige un entreno da el entreno entero, de antes o de después', async () => {
    const hyrox = hyroxConDescansos(nuevoId);
    const sello = await guardar(hyrox, T0, null);
    const corregido = { ...hyrox, notas: 'Corregido' };

    const correccion = guardar(corregido, T0 + 1000, sello);
    const lecturas = await Promise.all([1, 2, 3, 4, 5].map(() => leer(hyrox.id)));
    await correccion;

    for (const leido of lecturas) {
      expect([
        { ...hyrox, modificado: T0 },
        { ...corregido, modificado: T0 + 1000 },
      ]).toContainEqual(leido);
    }
  });
});

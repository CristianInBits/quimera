/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { leerAjuste, ponerAjusteEn, type ValorDeAjuste } from '@/datos/ajustes';
import { p, puertaDe } from '@/datos/base';
import { CATALOGO_VERSION } from '@/datos/catalogo';
import {
  CopiaMasNueva,
  CopiaNoValida,
  crearCopiaEn,
  importarCopiaEn,
  leerCopia,
  nombreDeLaCopia,
  resumirImportacion,
  textoDeLaCopia,
  type Copia,
} from '@/datos/copia';
import { borrarEntrenoEn, guardarEntrenoEn, leerEntreno, restaurarEntrenoEn, type Entreno } from '@/datos/entrenos';
import { huella } from '@/datos/huella';
import { esUuidV7 } from '@/datos/ids';
import { MIGRACIONES } from '@/datos/migraciones';
import { SELLO_MINIMO } from '@/datos/sellos';
import type { BaseDePrueba } from '@/pruebas/baseDePrueba';
import { T0, abrirBasePreparada, generadorDeIds, gimnasioConCalentamiento, hyroxConDescansos } from '@/pruebas/datos';

const nuevoId = generadorDeIds();

/** Un entreno con una sola serie de un ejercicio, para los ejercicios propios. */
function conUnaSerie(ejercicioId: string): Entreno {
  return {
    id: nuevoId(),
    disciplina: 'gimnasio',
    fecha: '2026-11-10',
    hora: null,
    duracionMs: 3_600_000,
    esfuerzo: 6,
    notas: null,
    bloques: [
      {
        id: nuevoId(),
        metrosCorridos: null,
        tiempoMs: null,
        descansoMs: null,
        series: [
          {
            id: nuevoId(),
            ronda: 1,
            orden: 1,
            ejercicioId,
            repeticiones: 10,
            pesoG: 40_000,
            tiempoMs: null,
            distanciaM: null,
            calorias: null,
            descansoMs: null,
          },
        ],
      },
    ],
  };
}

/** Una copia que se puede cambiar sin tocar la original. */
const clon = (copia: Copia): Copia => JSON.parse(JSON.stringify(copia)) as Copia;

/** Un valor de ajuste con tantas listas, una dentro de otra, como niveles. */
function anidado(niveles: number): ValorDeAjuste {
  let valor: ValorDeAjuste = 1;
  for (let i = 0; i < niveles; i++) valor = [valor];
  return valor;
}

/** Lo mismo, con objetos. */
function anidadoEnObjetos(niveles: number): ValorDeAjuste {
  let valor: ValorDeAjuste = 1;
  for (let i = 0; i < niveles; i++) valor = { a: valor };
  return valor;
}

/** El error que lanza una función, para mirar su clase y su mensaje. */
function errorDe(hacer: () => unknown): Error {
  try {
    hacer();
  } catch (error) {
    return error as Error;
  }
  throw new Error('No lanzó ningún error.');
}

const guardar = (db: BaseDePrueba, entreno: Entreno, ahora: number) =>
  puertaDe(db).escribir((tx) => guardarEntrenoEn(tx, entreno, { ahora }));
const borrar = (db: BaseDePrueba, id: string, ahora: number) => puertaDe(db).escribir((tx) => borrarEntrenoEn(tx, id, ahora));
const copiar = (db: BaseDePrueba, ahora = T0 + 100_000) =>
  puertaDe(db).escribir((tx) => crearCopiaEn(tx, { ahora, app: '1.0.0', nuevoId }));
const importar = (db: BaseDePrueba, copia: Copia, { ahora = T0 + 200_000, esMia }: { ahora?: number; esMia?: boolean } = {}) =>
  puertaDe(db).escribir((tx) => importarCopiaEn(tx, copia, { ahora, nuevoId, esMia }));
const resumir = (db: BaseDePrueba, copia: Copia, esMia?: boolean) =>
  puertaDe(db).leer((l) => resumirImportacion(l, copia, { esMia }));
const ajuste = (db: BaseDePrueba, clave: string) => puertaDe(db).leer((l) => leerAjuste(l, clave));
const persona = (db: BaseDePrueba) => ajuste(db, 'persona');
const filas = (db: BaseDePrueba, tabla: string) =>
  db.mirar<Record<string, unknown>>(`SELECT * FROM ${tabla} ORDER BY ${tabla === 'ajuste' ? 'clave' : 'id'}`);
const foto = (db: BaseDePrueba) => ['entreno', 'bloque', 'serie', 'ejercicio', 'ajuste'].map((tabla) => filas(db, tabla));
/** Todo lo que viaja en una copia, sin la persona, que va en la cabecera. */
const loQueViaja = (db: BaseDePrueba) => [
  ...['entreno', 'bloque', 'serie', 'ejercicio'].map((tabla) => filas(db, tabla)),
  db.mirar("SELECT * FROM ajuste WHERE clave NOT GLOB 'local.*' AND clave <> 'persona' ORDER BY clave"),
];

type DelEjercicio = { nombre?: string; grupo?: string; mide?: [number, number, number, number, number]; borrado?: 0 | 1 };

/** Un ejercicio propio: por defecto, de espalda, con repeticiones y peso. */
function anadirEjercicioPropio(
  db: BaseDePrueba,
  id: string,
  modificado: number,
  { nombre = 'Remo en polea baja', grupo = 'espalda', mide = [1, 1, 0, 0, 0], borrado = 0 }: DelEjercicio = {},
) {
  const [repeticiones, peso, tiempo, distancia, calorias] = mide;
  return db.runAsync(
    `INSERT INTO ejercicio (id, nombre, grupo, usa_repeticiones, usa_peso, usa_tiempo, usa_distancia,
                            usa_calorias, propio, modificado, borrado)
     VALUES (:id, :nombre, :grupo, :repeticiones, :peso, :tiempo, :distancia, :calorias, 1, :modificado, :borrado)`,
    p({ id, nombre, grupo, repeticiones, peso, tiempo, distancia, calorias, modificado, borrado }),
  );
}

/** Un ejercicio del catálogo, con repeticiones y peso, que el catálogo de la app aún no trae. */
const anadirEjercicioDelCatalogo = (db: BaseDePrueba, id: string) =>
  db.runAsync(
    `INSERT INTO ejercicio (id, nombre, grupo, usa_repeticiones, usa_peso, usa_tiempo, usa_distancia,
                            usa_calorias, propio, modificado)
     VALUES (:id, 'Del catálogo', 'pecho', 1, 1, 0, 0, 0, 0, :modificado)`,
    p({ id, modificado: T0 }),
  );

// Cada prueba corre dos veces: con los números enlazados como REAL, como en el
// iPhone, y como INTEGER, como en Android.
describe.each(['real', 'integer'] as const)('La copia de los datos, con los números como en %s', (enteros) => {
  let origen: BaseDePrueba;
  let destino: BaseDePrueba;
  beforeEach(async () => {
    origen = await abrirBasePreparada({ enteros });
    destino = await abrirBasePreparada({ enteros });
  });
  afterEach(() => {
    origen.cerrar();
    destino.cerrar();
  });

  describe('al crearla', () => {
    it('la cabecera dice qué es, la versión de su formato, de qué Quimera viene, cuándo se hizo y de quién es', async () => {
      const copia = await copiar(origen, T0 + 5000);
      expect(copia).toMatchObject({
        formato: 'quimera',
        version: 1,
        app: '1.0.0',
        base: MIGRACIONES.length,
        catalogo: CATALOGO_VERSION,
        exportado: T0 + 5000,
        ejercicios: [],
        entrenos: [],
        ajustes: [],
      });
      expect(esUuidV7(copia.persona)).toBe(true);
    });

    it('la persona nace con la primera copia, se guarda en el móvil y es la misma en las siguientes', async () => {
      expect(await persona(origen)).toBeUndefined();
      const primera = await copiar(origen);
      const segunda = await copiar(origen, T0 + 900_000);
      expect(segunda.persona).toBe(primera.persona);
      expect(await persona(origen)).toBe(primera.persona);
    });

    it('lleva cada entreno con sus bloques en orden y sus series, con los nombres y las unidades enteras de la base', async () => {
      const hyrox = hyroxConDescansos(nuevoId);
      await guardar(origen, hyrox, T0);
      const { entrenos } = await copiar(origen);
      expect(entrenos).toHaveLength(1);
      const [entreno] = entrenos;
      expect(Object.keys(entreno)).toEqual([
        'id', 'disciplina', 'fecha', 'hora', 'duracion_ms', 'esfuerzo', 'notas', 'modificado', 'borrado', 'bloques',
      ]);
      expect(entreno).toMatchObject({
        id: hyrox.id,
        disciplina: hyrox.disciplina,
        fecha: hyrox.fecha,
        hora: hyrox.hora,
        duracion_ms: hyrox.duracionMs,
        esfuerzo: hyrox.esfuerzo,
        notas: hyrox.notas,
        modificado: T0,
        borrado: 0,
      });
      expect(entreno.bloques.map((b) => b.id)).toEqual(hyrox.bloques.map((b) => b.id));
      const [bloque] = entreno.bloques;
      expect(Object.keys(bloque)).toEqual(['id', 'metros_corridos', 'tiempo_ms', 'descanso_ms', 'series']);
      expect(bloque).toMatchObject({
        metros_corridos: hyrox.bloques[0].metrosCorridos,
        tiempo_ms: hyrox.bloques[0].tiempoMs,
        descanso_ms: hyrox.bloques[0].descansoMs,
      });
      expect(Object.keys(bloque.series[0])).toEqual([
        'id', 'ronda', 'orden', 'ejercicio_id', 'repeticiones', 'peso_g', 'tiempo_ms', 'distancia_m', 'calorias', 'descanso_ms',
      ]);
      // Las series, en el orden de la vuelta y de su sitio en ella, con todo lo apuntado.
      const comoEnLaCopia = [...hyrox.bloques[0].series]
        .sort((a, b) => a.ronda - b.ronda || a.orden - b.orden)
        .map((s) => ({
          id: s.id,
          ronda: s.ronda,
          orden: s.orden,
          ejercicio_id: s.ejercicioId,
          repeticiones: s.repeticiones,
          peso_g: s.pesoG,
          tiempo_ms: s.tiempoMs,
          distancia_m: s.distanciaM,
          calorias: s.calorias,
          descanso_ms: s.descansoMs,
        }));
      expect(bloque.series).toEqual(comoEnLaCopia);
    });

    it('lleva cada columna de la base que viaja: una columna nueva obliga a decidir si entra, con otra versión del formato', async () => {
      // Y, como dice copia.ts, a que importar una copia vieja conserve lo que esa copia no lleva.
      const propio = nuevoId();
      await anadirEjercicioPropio(origen, propio, T0);
      await guardar(origen, conUnaSerie(propio), T0);
      await puertaDe(origen).escribir((tx) => ponerAjusteEn(tx, 'unidades', 'kg', T0));
      const copia = await copiar(origen);
      const columnas = (tabla: string, sin: string[]) =>
        origen
          .mirar<{ name: string }>(`SELECT name FROM pragma_table_info('${tabla}')`)
          .map((c) => c.name)
          .filter((c) => !sin.includes(c));
      const [entreno] = copia.entrenos;
      // Los bloques y las series van dentro de su entreno, en orden, con su sello y su marca.
      expect(Object.keys(entreno).filter((c) => c !== 'bloques')).toEqual(columnas('entreno', []));
      expect(Object.keys(entreno.bloques[0]).filter((c) => c !== 'series')).toEqual(
        columnas('bloque', ['entreno_id', 'orden', 'modificado', 'borrado']),
      );
      expect(Object.keys(entreno.bloques[0].series[0])).toEqual(columnas('serie', ['bloque_id', 'modificado', 'borrado']));
      // Solo van los ejercicios propios, así que no hace falta decirlo en cada uno.
      expect(Object.keys(copia.ejercicios[0])).toEqual(columnas('ejercicio', ['propio']));
      expect(Object.keys(copia.ajustes[0])).toEqual(columnas('ajuste', []));
    });

    it('la base no tiene más tablas que las que conoce la copia: una tabla nueva obliga a decidir si entra, con otra versión del formato', () => {
      // Viajan entreno, bloque y serie, los ejercicios propios y los ajustes que
      // no son locales. disciplina no: la trae cada Quimera en sus migraciones.
      const tablas = origen
        .mirar<{ name: string }>(
          "SELECT name FROM pragma_table_list WHERE schema = 'main' AND type = 'table' AND name NOT GLOB 'sqlite_*' ORDER BY name",
        )
        .map((t) => t.name);
      expect(tablas).toEqual(['ajuste', 'bloque', 'disciplina', 'ejercicio', 'entreno', 'serie']);
    });

    it('los bloques y las series van en su orden, no en el de sus identificadores', async () => {
      const hyrox = hyroxConDescansos(nuevoId);
      // Identificadores nuevos al revés: el primer bloque, y la primera serie de cada uno, llevan el más nuevo.
      const alReves = <T extends { id: string }>(cosas: T[]): T[] => {
        const ids = cosas.map(() => nuevoId()).reverse();
        return cosas.map((cosa, i) => ({ ...cosa, id: ids[i] }));
      };
      const entreno: Entreno = {
        ...hyrox,
        bloques: alReves(hyrox.bloques).map((b) => ({
          ...b,
          series: alReves([...b.series].sort((x, y) => x.ronda - y.ronda || x.orden - y.orden)),
        })),
      };
      await guardar(origen, entreno, T0);
      const [enLaCopia] = (await copiar(origen)).entrenos;
      expect(enLaCopia.bloques.map((b) => b.id)).toEqual(entreno.bloques.map((b) => b.id));
      expect(enLaCopia.bloques.map((b) => b.series.map((s) => s.id))).toEqual(entreno.bloques.map((b) => b.series.map((s) => s.id)));
    });

    it('lleva también los entrenos borrados, con su marca, para que no reaparezcan en otro móvil', async () => {
      const hyrox = hyroxConDescansos(nuevoId);
      const gimnasio = gimnasioConCalentamiento(nuevoId);
      await guardar(origen, hyrox, T0);
      await guardar(origen, gimnasio, T0 + 1000);
      await borrar(origen, gimnasio.id, T0 + 2000);
      const { entrenos } = await copiar(origen);
      expect(entrenos.map((e) => [e.id, e.borrado, e.modificado])).toEqual(
        expect.arrayContaining([
          [hyrox.id, 0, T0],
          [gimnasio.id, 1, T0 + 2000],
        ]),
      );
      expect(entrenos.find((e) => e.id === gimnasio.id)?.bloques).toHaveLength(gimnasio.bloques.length);
    });

    it('lleva solo los ejercicios propios, no los del catálogo, y solo los ajustes que viajan', async () => {
      const propio = nuevoId();
      await anadirEjercicioPropio(origen, propio, T0);
      await puertaDe(origen).escribir(async (tx) => {
        await ponerAjusteEn(tx, 'local.algo', 'de este móvil', T0);
        await ponerAjusteEn(tx, 'unidades', { peso: 'kg' }, T0 + 7);
      });
      const copia = await copiar(origen);
      expect(copia.ejercicios).toEqual([
        {
          id: propio,
          nombre: 'Remo en polea baja',
          grupo: 'espalda',
          usa_repeticiones: 1,
          usa_peso: 1,
          usa_tiempo: 0,
          usa_distancia: 0,
          usa_calorias: 0,
          modificado: T0,
          borrado: 0,
        },
      ]);
      // La persona va en la cabecera, y los ajustes locales, como los borradores, se quedan.
      expect(copia.ajustes).toEqual([{ clave: 'unidades', valor: { peso: 'kg' }, modificado: T0 + 7 }]);
    });

    it('su texto se lee igual, con ejercicios propios y ajustes, y el fichero se llama por su fecha', async () => {
      const propio = nuevoId();
      await anadirEjercicioPropio(origen, propio, T0);
      await guardar(origen, hyroxConDescansos(nuevoId), T0);
      await guardar(origen, conUnaSerie(propio), T0 + 1000);
      await puertaDe(origen).escribir((tx) => ponerAjusteEn(tx, 'unidades', 'kg', T0));
      const copia = await copiar(origen);
      expect(leerCopia(textoDeLaCopia(copia))).toEqual(copia);
      expect(nombreDeLaCopia('2026-11-23')).toBe('quimera-2026-11-23.json');
    });

    it('con el reloj del móvil en 1970 y una versión de la app de 40 caracteres, la copia sale así y se puede leer', async () => {
      await guardar(origen, hyroxConDescansos(nuevoId), T0);
      const app = '1.0.0+'.padEnd(40, 'x');
      const copia = await puertaDe(origen).escribir((tx) => crearCopiaEn(tx, { ahora: 0, app, nuevoId }));
      expect(leerCopia(textoDeLaCopia(copia))).toMatchObject({ exportado: 0, app });
    });

    it('si algo no cupiera en el formato, falla al crearla, con el móvil delante, y no deja nada escrito', async () => {
      await expect(puertaDe(origen).escribir((tx) => crearCopiaEn(tx, { ahora: T0, app: '', nuevoId }))).rejects.toThrow(
        'No se pudo crear una copia válida. La copia está dañada: app no es válido.',
      );
      expect(await persona(origen)).toBeUndefined();
    });
  });

  describe('al leer un fichero', () => {
    it('lo que no es JSON, o es JSON de otra cosa, no es una copia de Quimera', () => {
      for (const texto of ['', 'hola', '[]', '{}', 'null', JSON.stringify({ formato: 'otra', version: 1 })]) {
        const error = errorDe(() => leerCopia(texto));
        expect(error).toBeInstanceOf(CopiaNoValida);
        expect(error.message).toBe('El fichero no es una copia de Quimera.');
      }
    });

    it('una copia de una versión del formato más nueva pide actualizar Quimera', async () => {
      const copia = { ...(await copiar(origen)), version: 2 };
      expect(errorDe(() => leerCopia(JSON.stringify(copia)))).toBeInstanceOf(CopiaMasNueva);
    });

    it('un fichero guardado con la marca de orden de bytes delante se lee igual', async () => {
      await guardar(origen, hyroxConDescansos(nuevoId), T0);
      const copia = await copiar(origen);
      // La marca va escrita con su código: escrita tal cual no se vería.
      const conMarca = String.fromCharCode(0xfeff) + textoDeLaCopia(copia);
      expect(conMarca.charCodeAt(0)).toBe(0xfeff);
      expect(leerCopia(conMarca)).toEqual(copia);
    });

    it('rechaza cualquier identificador repetido, y dos series en el mismo sitio de un bloque', async () => {
      const propio = nuevoId();
      await anadirEjercicioPropio(origen, propio, T0);
      await guardar(origen, hyroxConDescansos(nuevoId), T0);
      await guardar(origen, gimnasioConCalentamiento(nuevoId), T0);
      await puertaDe(origen).escribir((tx) => ponerAjusteEn(tx, 'unidades', 'kg', T0));
      const copia = await copiar(origen);
      const conCambio = (cambiar: (c: Copia) => void) => {
        const otra = clon(copia);
        cambiar(otra);
        return errorDe(() => leerCopia(JSON.stringify(otra)));
      };
      const [primero, segundo] = copia.entrenos;
      const casos: [(c: Copia) => void, string][] = [
        [(c) => c.entrenos.push(clon(copia).entrenos[0]), `el entreno ${primero.id} sale dos veces`],
        [(c) => (c.entrenos[1].bloques[0].id = primero.bloques[0].id), `el bloque ${primero.bloques[0].id} sale dos veces`],
        [(c) => (c.entrenos[1].bloques[1].series[0].id = primero.bloques[0].series[0].id), `la serie ${primero.bloques[0].series[0].id} sale dos veces`],
        [(c) => c.ejercicios.push({ ...c.ejercicios[0], nombre: 'Otro' }), `el ejercicio ${propio} sale dos veces`],
        [(c) => c.ajustes.push({ ...c.ajustes[0], valor: 'lb' }), 'el ajuste unidades sale dos veces'],
        [
          (c) => {
            const series = c.entrenos[1].bloques[1].series;
            series[1].ronda = series[0].ronda;
            series[1].orden = series[0].orden;
          },
          `el bloque ${segundo.bloques[1].id} tiene dos series en el mismo sitio`,
        ],
      ];
      for (const [cambiar, que] of casos) {
        const error = conCambio(cambiar);
        expect(error).toBeInstanceOf(CopiaNoValida);
        expect(error.message).toBe(`La copia está dañada: ${que}.`);
      }
    });
  });

  describe('al importar', () => {
    it('en un móvil vacío trae todos los entrenos tal cual, con sus sellos y sus marcas', async () => {
      const gimnasio = gimnasioConCalentamiento(nuevoId);
      await guardar(origen, hyroxConDescansos(nuevoId), T0);
      await guardar(origen, gimnasio, T0 + 1000);
      await borrar(origen, gimnasio.id, T0 + 2000);
      const copia = leerCopia(textoDeLaCopia(await copiar(origen)));

      const resumen = await importar(destino, copia, { esMia: true });

      for (const tabla of ['entreno', 'bloque', 'serie']) {
        expect(filas(destino, tabla)).toEqual(filas(origen, tabla));
      }
      expect(resumen.entrenos).toEqual({ nuevos: 1, actualizados: 0, borrados: 0, sinCambios: 1 });
    });

    it('el resumen cuenta, antes de importar y sin escribir nada, lo que la importación cambia de verdad', async () => {
      const [nuevo, masReciente, borradoDespues, igual, masViejo] = Array.from({ length: 5 }, () => gimnasioConCalentamiento(nuevoId));
      await guardar(origen, nuevo, T0 + 10);
      await guardar(origen, masReciente, T0 + 20);
      await guardar(origen, borradoDespues, T0 + 10);
      await borrar(origen, borradoDespues.id, T0 + 30);
      await guardar(origen, igual, T0 + 10);
      await guardar(origen, masViejo, T0 + 10);
      await guardar(destino, { ...masReciente, notas: 'De antes' }, T0 + 10);
      await guardar(destino, borradoDespues, T0 + 10);
      await guardar(destino, igual, T0 + 10);
      await guardar(destino, { ...masViejo, notas: 'De aquí, más reciente' }, T0 + 40);
      // Y un ejercicio propio que el móvil no tiene, y un ajuste más reciente en la copia.
      await anadirEjercicioPropio(origen, nuevoId(), T0);
      await puertaDe(origen).escribir((tx) => ponerAjusteEn(tx, 'unidades', 'kg', T0 + 20));
      await puertaDe(destino).escribir((tx) => ponerAjusteEn(tx, 'unidades', 'lb', T0 + 10));
      const copia = await copiar(origen);
      const antes = foto(destino);

      const resumen = await resumir(destino, copia);

      expect(foto(destino)).toEqual(antes);
      expect(resumen.entrenos).toEqual({ nuevos: 1, actualizados: 1, borrados: 1, sinCambios: 2 });
      expect(resumen.ejercicios).toEqual({ nuevos: 1, actualizados: 0, borrados: 0, sinCambios: 0 });
      expect(resumen.ajustes).toEqual({ nuevos: 0, actualizados: 1, borrados: 0, sinCambios: 0 });
      // El móvil tiene datos pero aún no tiene persona: también pregunta.
      expect(resumen).toMatchObject({ persona: 'desconocida', preguntar: true });
      expect(await importar(destino, copia, { esMia: true })).toEqual(resumen);
      expect(await ajuste(destino, 'unidades')).toBe('kg');
      const leer = (id: string) => puertaDe(destino).leer((l) => leerEntreno(l, id));
      expect((await leer(nuevo.id))?.notas).toBe(nuevo.notas);
      expect((await leer(masReciente.id))?.notas).toBe(masReciente.notas);
      expect(await leer(borradoDespues.id)).toBeNull();
      expect((await leer(igual.id))?.modificado).toBe(T0 + 10);
      expect((await leer(masViejo.id))?.notas).toBe('De aquí, más reciente');
    });

    it('gana la versión con el sello mayor, entera, sin mezclar nada de los dos móviles', async () => {
      const hyrox = hyroxConDescansos(nuevoId);
      // En el móvil, una versión más vieja del mismo entreno, distinta en cada columna, con otras series y otro bloque.
      const viejo: Entreno = {
        ...hyrox,
        disciplina: 'gimnasio',
        fecha: '2026-10-01',
        hora: null,
        duracionMs: 3_000_000,
        esfuerzo: 5,
        notas: 'La de antes',
        bloques: [{ ...hyrox.bloques[1], series: hyrox.bloques[1].series.slice(0, 1) }, gimnasioConCalentamiento(nuevoId).bloques[0]],
      };
      await guardar(destino, viejo, T0 + 10);
      await guardar(origen, hyrox, T0 + 20);

      const resumen = await importar(destino, await copiar(origen), { esMia: true });

      expect(resumen.entrenos).toEqual({ nuevos: 0, actualizados: 1, borrados: 0, sinCambios: 0 });
      for (const tabla of ['entreno', 'bloque', 'serie']) {
        expect(filas(destino, tabla)).toEqual(filas(origen, tabla));
      }
    });

    it('si el móvil tiene una versión igual o más reciente, la deja como está', async () => {
      const hyrox = hyroxConDescansos(nuevoId);
      const gimnasio = gimnasioConCalentamiento(nuevoId);
      await guardar(origen, hyrox, T0 + 20);
      await guardar(origen, gimnasio, T0 + 20);
      await guardar(destino, { ...hyrox, notas: 'Más reciente aquí' }, T0 + 30);
      await guardar(destino, gimnasio, T0 + 20);
      const antes = foto(destino);

      const resumen = await importar(destino, await copiar(origen), { esMia: true });

      expect(resumen.entrenos).toEqual({ nuevos: 0, actualizados: 0, borrados: 0, sinCambios: 2 });
      expect(foto(destino).slice(0, 3)).toEqual(antes.slice(0, 3));
    });

    it('nada se borra porque falte en la copia', async () => {
      const soloAqui = gimnasioConCalentamiento(nuevoId);
      await guardar(destino, soloAqui, T0);
      await guardar(origen, hyroxConDescansos(nuevoId), T0);
      await importar(destino, await copiar(origen), { esMia: true });
      expect(await puertaDe(destino).leer((l) => leerEntreno(l, soloAqui.id))).not.toBeNull();
    });

    it('un borrado más reciente en la copia borra el del móvil, con sus bloques y sus series', async () => {
      const hyrox = hyroxConDescansos(nuevoId);
      await guardar(destino, hyrox, T0 + 10);
      await guardar(origen, hyrox, T0 + 10);
      await borrar(origen, hyrox.id, T0 + 20);

      const resumen = await importar(destino, await copiar(origen), { esMia: true });

      expect(resumen.entrenos).toEqual({ nuevos: 0, actualizados: 0, borrados: 1, sinCambios: 0 });
      expect(await puertaDe(destino).leer((l) => leerEntreno(l, hyrox.id))).toBeNull();
      expect(destino.mirar('SELECT DISTINCT borrado, modificado FROM bloque UNION SELECT DISTINCT borrado, modificado FROM serie')).toEqual([
        { borrado: 1, modificado: T0 + 20 },
      ]);
    });

    it('un entreno restaurado después en el otro móvil vuelve a aparecer', async () => {
      const hyrox = hyroxConDescansos(nuevoId);
      await guardar(destino, hyrox, T0 + 10);
      await borrar(destino, hyrox.id, T0 + 15);
      await guardar(origen, hyrox, T0 + 10);
      await borrar(origen, hyrox.id, T0 + 12);
      await puertaDe(origen).escribir((tx) => restaurarEntrenoEn(tx, hyrox.id, T0 + 20));

      const resumen = await importar(destino, await copiar(origen), { esMia: true });

      expect(resumen.entrenos).toEqual({ nuevos: 1, actualizados: 0, borrados: 0, sinCambios: 0 });
      expect(await puertaDe(destino).leer((l) => leerEntreno(l, hyrox.id))).toEqual({ ...hyrox, modificado: T0 + 20 });
    });

    it('un entreno borrado que el móvil no tenía entra borrado, sin aparecer', async () => {
      const hyrox = hyroxConDescansos(nuevoId);
      await guardar(origen, hyrox, T0);
      await borrar(origen, hyrox.id, T0 + 5);

      const resumen = await importar(destino, await copiar(origen), { esMia: true });

      expect(resumen.entrenos).toEqual({ nuevos: 0, actualizados: 0, borrados: 0, sinCambios: 1 });
      expect(destino.mirar('SELECT borrado, modificado FROM entreno')).toEqual([{ borrado: 1, modificado: T0 + 5 }]);
    });

    it('los ejercicios propios entran, cambian enteros si son más recientes y se quedan si no, y sus series entran con ellos', async () => {
      const [nuevo, masReciente, masViejo] = [nuevoId(), nuevoId(), nuevoId()];
      await anadirEjercicioPropio(origen, nuevo, T0);
      await anadirEjercicioPropio(origen, masReciente, T0 + 20, { nombre: 'Remo nuevo', grupo: 'brazos', mide: [0, 0, 1, 1, 1] });
      await anadirEjercicioPropio(origen, masViejo, T0 + 10, { nombre: 'Remo viejo' });
      await anadirEjercicioPropio(destino, masReciente, T0 + 10, { nombre: 'Remo de antes' });
      await anadirEjercicioPropio(destino, masViejo, T0 + 20, { nombre: 'Remo de aquí', grupo: 'pierna', mide: [1, 0, 0, 0, 0] });
      const conPropio = conUnaSerie(nuevo);
      await guardar(origen, conPropio, T0 + 30);

      const resumen = await importar(destino, await copiar(origen), { esMia: true });

      expect(resumen.ejercicios).toEqual({ nuevos: 1, actualizados: 1, borrados: 0, sinCambios: 1 });
      const propios = (db: BaseDePrueba) => db.mirar('SELECT * FROM ejercicio WHERE propio = 1 ORDER BY id');
      expect(propios(destino)).toEqual([
        propios(origen)[0],
        propios(origen)[1],
        expect.objectContaining({ id: masViejo, nombre: 'Remo de aquí', grupo: 'pierna', usa_peso: 0, modificado: T0 + 20 }),
      ]);
      expect(await puertaDe(destino).leer((l) => leerEntreno(l, conPropio.id))).toEqual({ ...conPropio, modificado: T0 + 30 });
    });

    it('los ejercicios propios borrados viajan con su marca: entran borrados, borran los del móvil y vuelven', async () => {
      const [borradoNuevo, seBorra, vuelve] = [nuevoId(), nuevoId(), nuevoId()];
      await anadirEjercicioPropio(origen, borradoNuevo, T0 + 5, { borrado: 1 });
      await anadirEjercicioPropio(origen, seBorra, T0 + 5, { borrado: 1 });
      await anadirEjercicioPropio(origen, vuelve, T0 + 9);
      await anadirEjercicioPropio(destino, seBorra, T0);
      await anadirEjercicioPropio(destino, vuelve, T0 + 5, { borrado: 1 });
      const copia = leerCopia(textoDeLaCopia(await copiar(origen)));
      expect(copia.ejercicios.map((e) => [e.id, e.borrado])).toEqual([
        [borradoNuevo, 1],
        [seBorra, 1],
        [vuelve, 0],
      ]);

      const resumen = await importar(destino, copia, { esMia: true });

      expect(resumen.ejercicios).toEqual({ nuevos: 1, actualizados: 0, borrados: 1, sinCambios: 1 });
      expect(filas(destino, 'ejercicio')).toEqual(filas(origen, 'ejercicio'));
    });

    it('los ajustes que viajan entran con su sello si son más recientes, y los locales del móvil no se tocan', async () => {
      await puertaDe(origen).escribir(async (tx) => {
        await ponerAjusteEn(tx, 'unidades', 'kg', T0 + 20);
        await ponerAjusteEn(tx, 'semana', 'lunes', T0 + 10);
        await ponerAjusteEn(tx, 'tema', 'oscuro', T0 + 10);
      });
      await puertaDe(destino).escribir(async (tx) => {
        await ponerAjusteEn(tx, 'unidades', 'lb', T0 + 10);
        await ponerAjusteEn(tx, 'semana', 'domingo', T0 + 20);
        await ponerAjusteEn(tx, 'local.borrador', { algo: 1 }, T0);
      });

      const resumen = await importar(destino, await copiar(origen), { esMia: true });

      expect(resumen.ajustes).toEqual({ nuevos: 1, actualizados: 1, borrados: 0, sinCambios: 1 });
      expect(destino.mirar("SELECT clave, valor, modificado FROM ajuste WHERE clave NOT IN ('local.migraciones', 'local.catalogo', 'local.personas', 'persona') ORDER BY clave")).toEqual([
        { clave: 'local.borrador', valor: '{"algo":1}', modificado: T0 },
        { clave: 'semana', valor: '"domingo"', modificado: T0 + 20 },
        { clave: 'tema', valor: '"oscuro"', modificado: T0 + 10 },
        { clave: 'unidades', valor: '"kg"', modificado: T0 + 20 },
      ]);
    });

    it('importar dos veces la misma copia no cambia nada la segunda, ni vuelve a preguntar', async () => {
      await guardar(origen, hyroxConDescansos(nuevoId), T0);
      const copia = await copiar(origen);
      await importar(destino, copia, { esMia: true });
      const despues = foto(destino);
      // Sin respuesta: la persona ya es la misma.
      const resumen = await importar(destino, copia, { ahora: T0 + 300_000 });
      expect(resumen.entrenos).toEqual({ nuevos: 0, actualizados: 0, borrados: 0, sinCambios: 1 });
      expect(foto(destino)).toEqual(despues);
    });

    it('escribe por tandas: las sentencias no crecen con los bloques ni con las series', async () => {
      // 210 hyrox de 14 series: en tres tandas, de 100, 100 y 10.
      await puertaDe(origen).escribir(async (tx) => {
        for (let i = 0; i < 210; i++) await guardarEntrenoEn(tx, hyroxConDescansos(nuevoId), { ahora: T0 + i });
      });
      const copia = await copiar(origen);
      const escrituras = jest.spyOn(destino, 'runAsync');
      try {
        await importar(destino, copia, { esMia: true });
        // Cuatro sentencias por tanda, la persona que estrena el móvil y la de la copia, que recuerda.
        expect(escrituras).toHaveBeenCalledTimes(3 * 4 + 2);
      } finally {
        escrituras.mockRestore();
      }
      for (const tabla of ['entreno', 'bloque', 'serie']) {
        expect(filas(destino, tabla)).toEqual(filas(origen, tabla));
      }
    });

    it('si algo falla a medias, no entra nada: ni entrenos, ni ejercicios', async () => {
      const primero = hyroxConDescansos(nuevoId);
      const segundo = gimnasioConCalentamiento(nuevoId);
      await guardar(origen, primero, T0);
      await guardar(origen, segundo, T0);
      await anadirEjercicioPropio(origen, nuevoId(), T0);
      // En el móvil ya hay un bloque con el mismo identificador que uno de la copia, en otro entreno.
      const ajeno = gimnasioConCalentamiento(nuevoId);
      ajeno.bloques[0].id = segundo.bloques[1].id;
      await guardar(destino, ajeno, T0);
      const antes = foto(destino);

      // El fallo llega al meter ese bloque, después de escribir el ejercicio y los entrenos.
      await expect(importar(destino, await copiar(origen), { esMia: true })).rejects.toThrow('UNIQUE constraint failed: bloque.id');

      expect(await persona(destino)).toBeUndefined();
      expect(foto(destino)).toEqual(antes);
    });

    it('si algo falla después de estrenar la persona, tampoco se queda la persona', async () => {
      await guardar(origen, hyroxConDescansos(nuevoId), T0);
      await anadirEjercicioPropio(origen, nuevoId(), T0);
      // Una copia que no ha pasado por leerCopia, con un ajuste que la base no
      // guarda: los ajustes se escriben después de estrenar la persona.
      const mala: Copia = { ...(await copiar(origen)), ajustes: [{ clave: 'Unidades', valor: 'kg', modificado: T0 }] };
      const antes = foto(destino);

      await expect(importar(destino, mala, { esMia: true })).rejects.toThrow('CHECK constraint failed');

      expect(await persona(destino)).toBeUndefined();
      expect(foto(destino)).toEqual(antes);
    });
  });

  describe('de quién es la copia', () => {
    describe('en un móvil nuevo, que aún no sabe de quién es', () => {
      let copia: Copia;
      beforeEach(async () => {
        await guardar(origen, hyroxConDescansos(nuevoId), T0);
        await puertaDe(origen).escribir((tx) => ponerAjusteEn(tx, 'unidades', 'kg', T0));
        copia = await copiar(origen);
      });

      it('también hay que preguntar, aunque no tenga datos, y sin respuesta no se importa nada', async () => {
        expect(await resumir(destino, copia)).toMatchObject({ persona: 'desconocida', preguntar: true });
        const antes = foto(destino);
        await expect(importar(destino, copia)).rejects.toThrow(
          'Antes de importar hay que preguntar si la copia es de la persona de este móvil.',
        );
        expect(foto(destino)).toEqual(antes);
      });

      it('si la copia es suya, toma sus ajustes, estrena su persona y recuerda la de la copia: es la copia propia al estrenar móvil', async () => {
        await importar(destino, copia, { esMia: true });
        const suya = await persona(destino);
        expect(typeof suya === 'string' && esUuidV7(suya)).toBe(true);
        expect(suya).not.toBe(copia.persona);
        expect(await ajuste(destino, 'local.personas')).toEqual([copia.persona]);
        expect(await ajuste(destino, 'unidades')).toBe('kg');
        // Las copias siguientes del otro móvil ya no preguntan, y las de este llevan su persona.
        expect(await resumir(destino, await copiar(origen, T0 + 300_000))).toMatchObject({ persona: 'misma', preguntar: false });
        expect((await copiar(destino, T0 + 400_000)).persona).toBe(suya);
      });

      it('si no es suya, entran sus entrenos, pero estrena su persona, no toma ningún ajuste y no la recuerda: un amigo que estrena Quimera', async () => {
        const resumen = await importar(destino, copia, { esMia: false });
        expect(resumen.entrenos.nuevos).toBe(1);
        const suya = await persona(destino);
        expect(typeof suya === 'string' && esUuidV7(suya)).toBe(true);
        expect(suya).not.toBe(copia.persona);
        expect(await ajuste(destino, 'unidades')).toBeUndefined();
        // No recuerda la persona de la copia: las siguientes del otro móvil le siguen preguntando.
        expect(await ajuste(destino, 'local.personas')).toBeUndefined();
        expect(await resumir(destino, await copiar(origen, T0 + 300_000))).toMatchObject({ persona: 'otra', preguntar: true });
        // Sus copias siguientes dicen que son suyas: al importarlas en el
        // móvil de la otra persona, también hay que preguntar.
        const deVuelta = await copiar(destino, T0 + 400_000);
        expect(deVuelta.persona).toBe(suya);
        expect(await resumir(origen, deVuelta)).toMatchObject({ persona: 'otra', preguntar: true });
      });
    });

    it('un móvil nuevo en el que se probó a exportar pregunta, y si la copia es suya se queda con su persona y recuerda la de la copia', async () => {
      // La copia de siempre, del móvil viejo, cuya persona nació antes.
      const copia = await copiar(origen);
      const suya = (await copiar(destino)).persona;
      expect(await resumir(destino, copia)).toMatchObject({ persona: 'otra', preguntar: true });
      await importar(destino, copia, { esMia: true });
      expect(await persona(destino)).toBe(suya);
      expect(await ajuste(destino, 'local.personas')).toEqual([copia.persona]);
    });

    it('la misma persona no pregunta', async () => {
      await guardar(destino, hyroxConDescansos(nuevoId), T0);
      const copia = await copiar(destino);
      expect(await resumir(destino, copia)).toMatchObject({ persona: 'misma', preguntar: false });
    });

    it('dos móviles de la misma persona que se importan la copia del otro se quedan cada uno con la suya, y desde entonces no preguntan en ningún sentido', async () => {
      await guardar(origen, hyroxConDescansos(nuevoId), T0);
      await guardar(destino, gimnasioConCalentamiento(nuevoId), T0);
      // Las dos copias se hacen antes de importar ninguna.
      const deOrigen = await copiar(origen);
      const deDestino = await copiar(destino);

      await importar(destino, deOrigen, { esMia: true });
      await importar(origen, deDestino, { esMia: true });

      expect(await persona(origen)).toBe(deOrigen.persona);
      expect(await persona(destino)).toBe(deDestino.persona);
      // Cada uno recuerda como suya la del otro.
      expect(await ajuste(origen, 'local.personas')).toEqual([deDestino.persona]);
      expect(await ajuste(destino, 'local.personas')).toEqual([deOrigen.persona]);
      expect(await resumir(origen, await copiar(destino, T0 + 300_000))).toMatchObject({ persona: 'misma', preguntar: false });
      expect(await resumir(destino, await copiar(origen, T0 + 300_000))).toMatchObject({ persona: 'misma', preguntar: false });
    });

    it('con dos móviles ya juntados no pregunta, toma los ajustes más recientes de la copia y se queda con los suyos más recientes', async () => {
      await puertaDe(origen).escribir(async (tx) => {
        await ponerAjusteEn(tx, 'unidades', 'kg', T0);
        await ponerAjusteEn(tx, 'semana', 'lunes', T0);
      });
      await importar(destino, await copiar(origen), { esMia: true });
      // Después, unidades cambia en el otro móvil, y semana, en este.
      await puertaDe(origen).escribir((tx) => ponerAjusteEn(tx, 'unidades', 'lb', T0 + 500));
      await puertaDe(destino).escribir((tx) => ponerAjusteEn(tx, 'semana', 'domingo', T0 + 600));
      const copia = await copiar(origen, T0 + 300_000);

      const resumen = await resumir(destino, copia);

      expect(resumen).toMatchObject({ persona: 'misma', preguntar: false });
      expect(resumen.ajustes).toEqual({ nuevos: 0, actualizados: 1, borrados: 0, sinCambios: 1 });
      expect(await importar(destino, copia, { ahora: T0 + 400_000 })).toEqual(resumen);
      expect(await ajuste(destino, 'unidades')).toBe('lb');
      expect(await ajuste(destino, 'semana')).toBe('domingo');
    });

    it('si la copia es suya, el móvil se queda con su persona, toma los ajustes más recientes de la copia y se queda con los suyos más recientes', async () => {
      await puertaDe(origen).escribir(async (tx) => {
        await ponerAjusteEn(tx, 'unidades', 'kg', T0);
        await ponerAjusteEn(tx, 'semana', 'domingo', T0 + 60);
      });
      const deOrigen = await copiar(origen);
      await puertaDe(destino).escribir(async (tx) => {
        await ponerAjusteEn(tx, 'unidades', 'lb', T0 + 50);
        await ponerAjusteEn(tx, 'semana', 'lunes', T0 + 1);
      });
      const deDestino = await copiar(destino);

      const resumen = await importar(origen, deDestino, { esMia: true });

      expect(resumen.ajustes).toEqual({ nuevos: 0, actualizados: 1, borrados: 0, sinCambios: 1 });
      expect(await persona(origen)).toBe(deOrigen.persona);
      expect(await ajuste(origen, 'unidades')).toBe('lb');
      expect(await ajuste(origen, 'semana')).toBe('domingo');
      expect(await ajuste(origen, 'local.personas')).toEqual([deDestino.persona]);
    });

    it('con las copias siempre en el mismo sentido, solo pregunta la primera vez, y después trae los entrenos y los ajustes más recientes', async () => {
      // destino exportó una vez, para probar, y después recibe las copias de origen, donde se apunta.
      const suya = (await copiar(destino)).persona;
      await guardar(origen, hyroxConDescansos(nuevoId), T0);
      await puertaDe(origen).escribir(async (tx) => {
        await ponerAjusteEn(tx, 'unidades', 'kg', T0);
        await ponerAjusteEn(tx, 'semana', 'lunes', T0);
      });
      const primera = await copiar(origen);
      expect(await resumir(destino, primera)).toMatchObject({ persona: 'otra', preguntar: true });
      await importar(destino, primera, { esMia: true });
      expect(await persona(destino)).toBe(suya);
      expect(await ajuste(destino, 'local.personas')).toEqual([primera.persona]);

      // La misma copia otra vez ya no pregunta.
      expect(await resumir(destino, primera)).toMatchObject({ persona: 'misma', preguntar: false });
      // La siguiente de origen tampoco: trae su entreno nuevo y sus ajustes más recientes.
      await guardar(origen, gimnasioConCalentamiento(nuevoId), T0 + 1000);
      await puertaDe(origen).escribir((tx) => ponerAjusteEn(tx, 'unidades', 'lb', T0 + 500));
      await puertaDe(destino).escribir((tx) => ponerAjusteEn(tx, 'semana', 'domingo', T0 + 600));
      const siguiente = await copiar(origen, T0 + 300_000);
      const resumen = await resumir(destino, siguiente);
      expect(resumen).toMatchObject({ persona: 'misma', preguntar: false });
      expect(resumen.entrenos.nuevos).toBe(1);
      expect(resumen.ajustes).toEqual({ nuevos: 0, actualizados: 1, borrados: 0, sinCambios: 1 });
      expect(await importar(destino, siguiente, { ahora: T0 + 400_000 })).toEqual(resumen);
      expect(await ajuste(destino, 'unidades')).toBe('lb');
      expect(await ajuste(destino, 'semana')).toBe('domingo');
      expect(await persona(destino)).toBe(suya);
      // Lo que recuerda es de este móvil: no viaja en sus copias, que siguen llevando su persona.
      const deVuelta = await copiar(destino, T0 + 500_000);
      expect(deVuelta.persona).toBe(suya);
      expect(deVuelta.ajustes.map((a) => a.clave)).toEqual(['semana', 'unidades']);
    });

    it('recuerda las personas de varios móviles, y las copias de todos dejan de preguntar', async () => {
      const tercero = await abrirBasePreparada({ enteros });
      try {
        const suya = (await copiar(destino)).persona;
        await guardar(origen, hyroxConDescansos(nuevoId), T0);
        await guardar(tercero, gimnasioConCalentamiento(nuevoId), T0);
        const deOrigen = await copiar(origen);
        const deTercero = await copiar(tercero);

        await importar(destino, deOrigen, { esMia: true });
        await importar(destino, deTercero, { esMia: true });

        expect(await persona(destino)).toBe(suya);
        expect(await ajuste(destino, 'local.personas')).toEqual([deOrigen.persona, deTercero.persona].sort());
        expect(await resumir(destino, await copiar(origen, T0 + 300_000))).toMatchObject({ persona: 'misma', preguntar: false });
        expect(await resumir(destino, await copiar(tercero, T0 + 300_000))).toMatchObject({ persona: 'misma', preguntar: false });
      } finally {
        tercero.cerrar();
      }
    });

    it('con una persona repetida en lo que recuerda, una nueva también se recuerda, y la lista queda sin repetidas', async () => {
      const suya = (await copiar(destino)).persona;
      const otra = nuevoId();
      await puertaDe(destino).escribir((tx) => ponerAjusteEn(tx, 'local.personas', [otra, otra], T0));
      const copia = await copiar(origen);
      await importar(destino, copia, { esMia: true });
      expect(await persona(destino)).toBe(suya);
      expect(await ajuste(destino, 'local.personas')).toEqual([otra, copia.persona].sort());
      expect(await resumir(destino, copia)).toMatchObject({ persona: 'misma', preguntar: false });
    });

    it.each<[string, (otra: string) => ValorDeAjuste]>([
      ['un objeto', (otra) => ({ [otra]: true })],
      ['un texto solo', (otra) => otra],
      ['una lista sin textos', (otra) => [42, null, [otra]]],
    ])('de lo que recuerda solo cuentan los textos de una lista: con %s pregunta, y con «sí» queda una lista limpia', async (_, estropeado) => {
      const suya = (await copiar(destino)).persona;
      const copia = await copiar(origen);
      await puertaDe(destino).escribir((tx) => ponerAjusteEn(tx, 'local.personas', estropeado(copia.persona), T0));
      expect(await resumir(destino, copia)).toMatchObject({ persona: 'otra', preguntar: true });
      await importar(destino, copia, { esMia: true });
      expect(await persona(destino)).toBe(suya);
      expect(await ajuste(destino, 'local.personas')).toEqual([copia.persona]);
    });

    it('de una lista con textos y otras cosas, los textos cuentan', async () => {
      await copiar(destino);
      const copia = await copiar(origen);
      await puertaDe(destino).escribir((tx) => ponerAjusteEn(tx, 'local.personas', [42, copia.persona], T0));
      expect(await resumir(destino, copia)).toMatchObject({ persona: 'misma', preguntar: false });
    });

    it('la copia de otra persona no cambia ni borra los entrenos que el móvil ya tiene: solo trae los nuevos', async () => {
      const hyrox = hyroxConDescansos(nuevoId);
      const gimnasio = gimnasioConCalentamiento(nuevoId);
      await guardar(origen, hyrox, T0);
      await guardar(origen, gimnasio, T0);
      // Un amigo importa mi copia con «no», borra uno de mis entrenos, corrige otro y apunta uno suyo.
      await importar(destino, await copiar(origen, T0 + 100), { esMia: false, ahora: T0 + 200 });
      await borrar(destino, hyrox.id, T0 + 1000);
      await guardar(destino, { ...gimnasio, notas: 'Esto no es mío' }, T0 + 2000);
      const suyo = hyroxConDescansos(nuevoId);
      await guardar(destino, suyo, T0 + 3000);
      const delAmigo = await copiar(destino, T0 + 4000);

      const resumen = await resumir(origen, delAmigo, false);

      expect(resumen.entrenos).toEqual({ nuevos: 1, actualizados: 0, borrados: 0, sinCambios: 2 });
      expect(await importar(origen, delAmigo, { esMia: false, ahora: T0 + 5000 })).toEqual(resumen);
      const leer = (id: string) => puertaDe(origen).leer((l) => leerEntreno(l, id));
      expect(await leer(hyrox.id)).toEqual({ ...hyrox, modificado: T0 });
      expect(await leer(gimnasio.id)).toEqual({ ...gimnasio, modificado: T0 });
      expect(await leer(suyo.id)).not.toBeNull();
    });

    it('borrar en mi móvil los entrenos de un amigo no los borra en el suyo cuando importa mi copia con «no»', async () => {
      const suyos = [hyroxConDescansos(nuevoId), gimnasioConCalentamiento(nuevoId)];
      for (const entreno of suyos) await guardar(destino, entreno, T0);
      await importar(origen, await copiar(destino, T0 + 100), { esMia: false, ahora: T0 + 200 });
      for (const entreno of suyos) await borrar(origen, entreno.id, T0 + 1000);
      const mia = await copiar(origen, T0 + 2000);

      expect((await resumir(destino, mia, false)).entrenos).toEqual({ nuevos: 0, actualizados: 0, borrados: 0, sinCambios: 2 });
      await importar(destino, mia, { esMia: false, ahora: T0 + 3000 });

      for (const entreno of suyos) expect(await puertaDe(destino).leer((l) => leerEntreno(l, entreno.id))).not.toBeNull();
    });

    it('la copia de otra persona tampoco cambia ni borra los ejercicios propios que el móvil ya tiene, y trae los nuevos', async () => {
      const [borradoAlli, cambiadoAlli, nuevo] = [nuevoId(), nuevoId(), nuevoId()];
      await anadirEjercicioPropio(destino, borradoAlli, T0, { nombre: 'Remo de aquí' });
      await anadirEjercicioPropio(destino, cambiadoAlli, T0, { nombre: 'Press de aquí' });
      await copiar(destino);
      await anadirEjercicioPropio(origen, borradoAlli, T0 + 50, { nombre: 'Remo de allí', borrado: 1 });
      await anadirEjercicioPropio(origen, cambiadoAlli, T0 + 50, { nombre: 'Press de allí' });
      await anadirEjercicioPropio(origen, nuevo, T0 + 50);
      const copia = await copiar(origen);

      const resumen = await resumir(destino, copia, false);

      expect(resumen.ejercicios).toEqual({ nuevos: 1, actualizados: 0, borrados: 0, sinCambios: 2 });
      expect(await importar(destino, copia, { esMia: false })).toEqual(resumen);
      expect(destino.mirar('SELECT id, nombre, borrado FROM ejercicio WHERE propio = 1 ORDER BY id')).toEqual([
        { id: borradoAlli, nombre: 'Remo de aquí', borrado: 0 },
        { id: cambiadoAlli, nombre: 'Press de aquí', borrado: 0 },
        { id: nuevo, nombre: 'Remo en polea baja', borrado: 0 },
      ]);
    });

    it('la copia de otra persona tampoco devuelve lo que el móvil tiene borrado, aunque lo traiga corregido después', async () => {
      // El móvil de un amigo tiene un entreno y un ejercicio propio de este, y
      // los corrige después de que este los borre.
      const hyrox = hyroxConDescansos(nuevoId);
      const propio = nuevoId();
      await guardar(origen, hyrox, T0);
      await borrar(origen, hyrox.id, T0 + 1000);
      await anadirEjercicioPropio(origen, propio, T0 + 1000, { borrado: 1 });
      await guardar(destino, { ...hyrox, notas: 'Corregido por el amigo' }, T0 + 2000);
      await anadirEjercicioPropio(destino, propio, T0 + 2000, { nombre: 'Remo del amigo' });
      // Con su persona ya estrenada, importar con «no» no tiene nada que escribir en este móvil.
      await copiar(origen);
      const delAmigo = await copiar(destino, T0 + 3000);
      const antes = foto(origen);

      const resumen = await resumir(origen, delAmigo, false);

      const igual = { nuevos: 0, actualizados: 0, borrados: 0, sinCambios: 1 };
      expect(resumen).toMatchObject({ entrenos: igual, ejercicios: igual });
      expect(await importar(origen, delAmigo, { esMia: false, ahora: T0 + 4000 })).toEqual(resumen);
      expect(foto(origen)).toEqual(antes);
    });

    it('con «no», lo que el móvil no tiene entra con su marca de borrado y el sello mínimo, y lo borrado no cuenta como nuevo', async () => {
      const hyrox = hyroxConDescansos(nuevoId);
      const gimnasio = gimnasioConCalentamiento(nuevoId);
      const propio = nuevoId();
      await guardar(origen, hyrox, T0 + 10);
      await guardar(origen, gimnasio, T0 + 20);
      await borrar(origen, gimnasio.id, T0 + 30);
      await anadirEjercicioPropio(origen, propio, T0 + 40, { borrado: 1 });
      await copiar(destino);
      const copia = await copiar(origen);

      const resumen = await resumir(destino, copia, false);

      expect(resumen.entrenos).toEqual({ nuevos: 1, actualizados: 0, borrados: 0, sinCambios: 1 });
      expect(resumen.ejercicios).toEqual({ nuevos: 0, actualizados: 0, borrados: 0, sinCambios: 1 });
      expect(await importar(destino, copia, { esMia: false })).toEqual(resumen);
      // Las mismas filas que en el otro móvil, con su marca, pero con el sello mínimo.
      for (const tabla of ['entreno', 'bloque', 'serie']) {
        expect(filas(destino, tabla)).toEqual(filas(origen, tabla).map((fila) => ({ ...fila, modificado: SELLO_MINIMO })));
      }
      expect(destino.mirar('SELECT id, borrado, modificado FROM ejercicio WHERE propio = 1')).toEqual([
        { id: propio, borrado: 1, modificado: SELLO_MINIMO },
      ]);
    });

    it('lo que otra persona hizo con mis entrenos tampoco vuelve por otro móvil mío que aún no los tenía, porque entra con el sello mínimo', async () => {
      const tableta = await abrirBasePreparada({ enteros });
      try {
        // Mi tableta y mi móvil (origen) ya se reconocen.
        await importar(tableta, await copiar(origen, T0 + 10), { esMia: true, ahora: T0 + 20 });
        await importar(origen, await copiar(tableta, T0 + 30), { esMia: true, ahora: T0 + 40 });
        // Apunto dos entrenos que la tableta aún no tiene; un amigo (destino)
        // los importa con «no», borra uno y corrige el otro.
        const hyrox = hyroxConDescansos(nuevoId);
        const gimnasio = gimnasioConCalentamiento(nuevoId);
        await guardar(origen, hyrox, T0 + 100);
        await guardar(origen, gimnasio, T0 + 100);
        await importar(destino, await copiar(origen, T0 + 200), { esMia: false, ahora: T0 + 300 });
        await borrar(destino, hyrox.id, T0 + 1000);
        await guardar(destino, { ...gimnasio, notas: 'Esto no es mío' }, T0 + 2000);
        // La tableta importa la copia del amigo con «no», y después se junta con el móvil, sin preguntar.
        await importar(tableta, await copiar(destino, T0 + 3000), { esMia: false, ahora: T0 + 3100 });
        await importar(tableta, await copiar(origen, T0 + 4000), { ahora: T0 + 4100 });
        await importar(origen, await copiar(tableta, T0 + 5000), { ahora: T0 + 5100 });

        for (const db of [origen, tableta]) {
          const leer = (id: string) => puertaDe(db).leer((l) => leerEntreno(l, id));
          expect(await leer(hyrox.id)).toEqual({ ...hyrox, modificado: T0 + 100 });
          expect(await leer(gimnasio.id)).toEqual({ ...gimnasio, modificado: T0 + 100 });
        }
      } finally {
        tableta.cerrar();
      }
    });

    it('contestar que la copia no es suya no se recuerda: la siguiente copia de esa persona vuelve a preguntar', async () => {
      await copiar(destino);
      await guardar(origen, hyroxConDescansos(nuevoId), T0);
      await importar(destino, await copiar(origen), { esMia: false });
      expect(await ajuste(destino, 'local.personas')).toBeUndefined();
      expect(await resumir(destino, await copiar(origen, T0 + 300_000))).toMatchObject({ persona: 'otra', preguntar: true });
    });

    describe('en un móvil con datos y su persona, y la copia de otra', () => {
      let suya: string;
      let copia: Copia;
      beforeEach(async () => {
        await guardar(origen, hyroxConDescansos(nuevoId), T0);
        await puertaDe(origen).escribir(async (tx) => {
          await ponerAjusteEn(tx, 'unidades', 'kg', T0 + 50);
          await ponerAjusteEn(tx, 'semana', 'lunes', T0 + 1);
        });
        copia = await copiar(origen);
        await guardar(destino, gimnasioConCalentamiento(nuevoId), T0);
        // unidades es más reciente en la copia, y semana, en el móvil.
        await puertaDe(destino).escribir(async (tx) => {
          await ponerAjusteEn(tx, 'unidades', 'lb', T0);
          await ponerAjusteEn(tx, 'semana', 'domingo', T0 + 60);
        });
        suya = (await copiar(destino)).persona;
      });

      it('hay que preguntar, y sin respuesta no se importa nada', async () => {
        expect(await resumir(destino, copia)).toMatchObject({ persona: 'otra', preguntar: true });
        const antes = foto(destino);
        await expect(importar(destino, copia)).rejects.toThrow(
          'Antes de importar hay que preguntar si la copia es de la persona de este móvil.',
        );
        expect(foto(destino)).toEqual(antes);
      });

      it('si es suya, el móvil toma sus ajustes más recientes, se queda con su persona y recuerda la de la copia', async () => {
        const resumen = await importar(destino, copia, { esMia: true });
        expect(resumen.ajustes).toEqual({ nuevos: 0, actualizados: 1, borrados: 0, sinCambios: 1 });
        expect(await persona(destino)).toBe(suya);
        expect(await ajuste(destino, 'local.personas')).toEqual([copia.persona]);
        expect(await ajuste(destino, 'unidades')).toBe('kg');
        expect(await ajuste(destino, 'semana')).toBe('domingo');
      });

      it('si no es suya, entran sus entrenos, pero el móvil se queda con su persona y sus ajustes', async () => {
        const igual = { nuevos: 0, actualizados: 0, borrados: 0, sinCambios: 2 };
        expect((await resumir(destino, copia, false)).ajustes).toEqual(igual);
        const resumen = await importar(destino, copia, { esMia: false });
        expect(resumen.entrenos.nuevos).toBe(1);
        expect(resumen.ajustes).toEqual(igual);
        expect(await persona(destino)).toBe(suya);
        expect(await ajuste(destino, 'unidades')).toBe('lb');
        expect(await ajuste(destino, 'semana')).toBe('domingo');
      });
    });
  });

  describe('lo que el móvil no conoce', () => {
    const conEjercicio = (copia: Copia, ejercicioId: string): Copia => {
      const otra = clon(copia);
      otra.entrenos[0].bloques[0].series[0].ejercicio_id = ejercicioId;
      return otra;
    };

    it('un ejercicio que no existe es de una Quimera con un catálogo más nuevo, o la copia está dañada', async () => {
      await guardar(origen, hyroxConDescansos(nuevoId), T0);
      const copia = conEjercicio(await copiar(origen), 'remo-nuevo');
      await expect(resumir(destino, { ...copia, catalogo: CATALOGO_VERSION + 1 })).rejects.toBeInstanceOf(CopiaMasNueva);
      await expect(importar(destino, { ...copia, catalogo: CATALOGO_VERSION + 1 })).rejects.toBeInstanceOf(CopiaMasNueva);
      await expect(importar(destino, copia)).rejects.toThrow(new CopiaNoValida('La copia está dañada: el ejercicio remo-nuevo no existe.'));
    });

    it('una disciplina que no existe es de una Quimera con una base más nueva, o la copia está dañada', async () => {
      await guardar(origen, hyroxConDescansos(nuevoId), T0);
      const copia = clon(await copiar(origen));
      copia.entrenos[0].disciplina = 'remo';
      await expect(importar(destino, { ...copia, base: MIGRACIONES.length + 1 })).rejects.toBeInstanceOf(CopiaMasNueva);
      await expect(importar(destino, copia)).rejects.toThrow(new CopiaNoValida('La copia está dañada: la disciplina remo no existe.'));
    });
  });
});

// Leer un fichero no toca la base: estas pruebas corren una sola vez, con una
// copia que se crea una vez para todas.
describe('Una copia dañada se rechaza, y el error dice dónde está', () => {
  let copia: Copia;
  beforeAll(async () => {
    const db = await abrirBasePreparada();
    try {
      await anadirEjercicioPropio(db, nuevoId(), T0);
      await guardar(db, hyroxConDescansos(nuevoId), T0);
      await puertaDe(db).escribir((tx) => ponerAjusteEn(tx, 'unidades', 'kg', T0));
      copia = await copiar(db);
    } finally {
      db.cerrar();
    }
  });

  const bloque = (c: Copia) => c.entrenos[0].bloques[0];
  const serie = (c: Copia) => c.entrenos[0].bloques[0].series[0];

  // Lo que la base no guardaría, con el valor justo fuera de cada límite, y lo
  // que el formato rechaza por su cuenta.
  it.each<[string, (copia: Copia) => void, string]>([
    ['una fecha que no existe', (c) => (c.entrenos[0].fecha = '2026-02-30'), 'entrenos[0].fecha'],
    ['una fecha de 1999', (c) => (c.entrenos[0].fecha = '1999-12-31'), 'entrenos[0].fecha'],
    ['una fecha de 2100', (c) => (c.entrenos[0].fecha = '2100-01-01'), 'entrenos[0].fecha'],
    ['una hora de 24:00', (c) => (c.entrenos[0].hora = '24:00'), 'entrenos[0].hora'],
    ['una hora con el minuto 60', (c) => (c.entrenos[0].hora = '10:60'), 'entrenos[0].hora'],
    ['una hora sin el cero delante', (c) => (c.entrenos[0].hora = '7:30'), 'entrenos[0].hora'],
    ['un identificador que no es un UUID', (c) => (c.entrenos[0].id = 'press-banca'), 'entrenos[0].id'],
    ['un UUID de otra versión que la 7', (c) => (c.entrenos[0].id = '0190a000-0000-4000-8000-000000000000'), 'entrenos[0].id'],
    ['un UUID de otra variante', (c) => (c.entrenos[0].id = '0190a000-0000-7000-c000-000000000000'), 'entrenos[0].id'],
    ['un UUID en mayúsculas', (c) => (c.entrenos[0].id = '0190A000-0000-7000-8000-00000000000A'), 'entrenos[0].id'],
    ['una duración de un minuto menos un milisegundo', (c) => (c.entrenos[0].duracion_ms = 59_999), 'entrenos[0].duracion_ms'],
    ['una duración de 48 horas y un milisegundo', (c) => (c.entrenos[0].duracion_ms = 172_800_001), 'entrenos[0].duracion_ms'],
    ['un esfuerzo de 0', (c) => (c.entrenos[0].esfuerzo = 0), 'entrenos[0].esfuerzo'],
    ['un esfuerzo de 11', (c) => (c.entrenos[0].esfuerzo = 11), 'entrenos[0].esfuerzo'],
    ['unas notas en blanco', (c) => (c.entrenos[0].notas = ' \n\t'), 'entrenos[0].notas'],
    ['unas notas de 4001 caracteres', (c) => (c.entrenos[0].notas = 'a'.repeat(4001)), 'entrenos[0].notas'],
    ['unas notas con un carácter nulo', (c) => (c.entrenos[0].notas = 'a\u0000b'), 'entrenos[0].notas'],
    // Un sustituto suelto de UTF-16: la mitad de un carácter que ocupa dos unidades, sin la otra.
    ['unas notas con la primera mitad de un carácter, suelta', (c) => (c.entrenos[0].notas = 'a\uD83Db'), 'entrenos[0].notas'],
    ['unas notas que acaban en la primera mitad de un carácter', (c) => (c.entrenos[0].notas = 'ab\uD83D'), 'entrenos[0].notas'],
    ['unas notas con la segunda mitad de un carácter, suelta', (c) => (c.entrenos[0].notas = '\uDCAAab'), 'entrenos[0].notas'],
    ['unas notas con dos primeras mitades seguidas, sin segunda', (c) => (c.entrenos[0].notas = 'a\uD83D\uD83Db'), 'entrenos[0].notas'],
    ['una marca de borrado de 2', (c) => Object.assign(c.entrenos[0], { borrado: 2 }), 'entrenos[0].borrado'],
    ['un sello de un milisegundo antes del mínimo', (c) => (c.entrenos[0].modificado = 1_699_999_999_999), 'entrenos[0].modificado'],
    ['un sello con decimales', (c) => (c.entrenos[0].modificado = 1_763_900_000_000.5), 'entrenos[0].modificado'],
    ['un sello que JavaScript no guarda exacto', (c) => (c.entrenos[0].modificado = Number.MAX_SAFE_INTEGER + 1), 'entrenos[0].modificado'],
    ['1001 bloques', (c) => c.entrenos[0].bloques.push(...Array.from({ length: 1001 - c.entrenos[0].bloques.length }, () => ({ ...bloque(c), id: nuevoId(), series: [] }))), 'entrenos[0].bloques'],
    ['un bloque de 999 ms', (c) => (bloque(c).tiempo_ms = 999), 'entrenos[0].bloques[0].tiempo_ms'],
    ['un bloque de 48 horas y un milisegundo', (c) => (bloque(c).tiempo_ms = 172_800_001), 'entrenos[0].bloques[0].tiempo_ms'],
    ['un bloque de 0 metros', (c) => (bloque(c).metros_corridos = 0), 'entrenos[0].bloques[0].metros_corridos'],
    ['un bloque de 1.000.001 metros', (c) => (bloque(c).metros_corridos = 1_000_001), 'entrenos[0].bloques[0].metros_corridos'],
    ['un descanso negativo después de un bloque', (c) => (bloque(c).descanso_ms = -1), 'entrenos[0].bloques[0].descanso_ms'],
    ['un descanso de un día y un milisegundo después de un bloque', (c) => (bloque(c).descanso_ms = 86_400_001), 'entrenos[0].bloques[0].descanso_ms'],
    ['una ronda 0', (c) => (serie(c).ronda = 0), 'entrenos[0].bloques[0].series[0].ronda'],
    ['una ronda 1001', (c) => (serie(c).ronda = 1001), 'entrenos[0].bloques[0].series[0].ronda'],
    ['un orden 0', (c) => (serie(c).orden = 0), 'entrenos[0].bloques[0].series[0].orden'],
    ['un orden 1001', (c) => (serie(c).orden = 1001), 'entrenos[0].bloques[0].series[0].orden'],
    ['0 repeticiones', (c) => (serie(c).repeticiones = 0), 'entrenos[0].bloques[0].series[0].repeticiones'],
    ['10.001 repeticiones', (c) => (serie(c).repeticiones = 10_001), 'entrenos[0].bloques[0].series[0].repeticiones'],
    ['unas repeticiones con decimales', (c) => (serie(c).repeticiones = 1.5), 'entrenos[0].bloques[0].series[0].repeticiones'],
    ['un peso de 0 g', (c) => (serie(c).peso_g = 0), 'entrenos[0].bloques[0].series[0].peso_g'],
    ['un peso de 1.000.001 g', (c) => (serie(c).peso_g = 1_000_001), 'entrenos[0].bloques[0].series[0].peso_g'],
    ['una serie de 0 ms', (c) => (serie(c).tiempo_ms = 0), 'entrenos[0].bloques[0].series[0].tiempo_ms'],
    ['una serie de un día y un milisegundo', (c) => (serie(c).tiempo_ms = 86_400_001), 'entrenos[0].bloques[0].series[0].tiempo_ms'],
    ['una distancia de 0 m', (c) => (serie(c).distancia_m = 0), 'entrenos[0].bloques[0].series[0].distancia_m'],
    ['una distancia de 1.000.001 m', (c) => (serie(c).distancia_m = 1_000_001), 'entrenos[0].bloques[0].series[0].distancia_m'],
    ['0 calorías', (c) => (serie(c).calorias = 0), 'entrenos[0].bloques[0].series[0].calorias'],
    ['10.001 calorías', (c) => (serie(c).calorias = 10_001), 'entrenos[0].bloques[0].series[0].calorias'],
    ['un descanso negativo después de una serie', (c) => (serie(c).descanso_ms = -1), 'entrenos[0].bloques[0].series[0].descanso_ms'],
    ['un descanso de un día y un milisegundo después de una serie', (c) => (serie(c).descanso_ms = 86_400_001), 'entrenos[0].bloques[0].series[0].descanso_ms'],
    ['una serie sin nada medido', (c) => Object.assign(serie(c), { repeticiones: null, tiempo_ms: null, distancia_m: null, calorias: null }), 'entrenos[0].bloques[0].series[0]'],
    ['un ejercicio que no mide nada', (c) => Object.assign(c.ejercicios[0], { usa_repeticiones: 0, usa_peso: 0 }), 'ejercicios[0]'],
    ['un ejercicio de nombre en blanco', (c) => (c.ejercicios[0].nombre = ' \t'), 'ejercicios[0].nombre'],
    ['un nombre de ejercicio de 81 letras', (c) => (c.ejercicios[0].nombre = 'a'.repeat(81)), 'ejercicios[0].nombre'],
    // La base solo recorta espacios, tabuladores y saltos de línea: el espacio duro cuenta.
    ['un nombre de 80 letras y un espacio duro al final', (c) => (c.ejercicios[0].nombre = 'a'.repeat(80) + String.fromCharCode(0xa0)), 'ejercicios[0].nombre'],
    ['un nombre de ejercicio con la mitad de un carácter, suelta', (c) => (c.ejercicios[0].nombre = 'Remo \uD83D'), 'ejercicios[0].nombre'],
    ['un grupo con mayúsculas', (c) => (c.ejercicios[0].grupo = 'Espalda'), 'ejercicios[0].grupo'],
    ['un grupo que empieza por guion bajo', (c) => (c.ejercicios[0].grupo = '_espalda'), 'ejercicios[0].grupo'],
    ['un grupo con cifras', (c) => (c.ejercicios[0].grupo = 'espalda2'), 'ejercicios[0].grupo'],
    ['un grupo de 31 letras', (c) => (c.ejercicios[0].grupo = 'a'.repeat(31)), 'ejercicios[0].grupo'],
    ['una clave de ajuste con mayúsculas', (c) => (c.ajustes[0].clave = 'Unidades'), 'ajustes[0].clave'],
    ['una clave de ajuste que empieza por una cifra', (c) => (c.ajustes[0].clave = '1unidades'), 'ajustes[0].clave'],
    ['una clave de ajuste con guion', (c) => (c.ajustes[0].clave = 'uni-dades'), 'ajustes[0].clave'],
    ['una clave de ajuste de 65 caracteres', (c) => (c.ajustes[0].clave = 'u'.repeat(65)), 'ajustes[0].clave'],
    ['un ajuste local', (c) => c.ajustes.push({ clave: 'local.borrador', valor: 1, modificado: T0 }), 'ajustes[1].clave'],
    ['la persona como ajuste', (c) => c.ajustes.push({ clave: 'persona', valor: 'x', modificado: T0 }), 'ajustes[1].clave'],
    ['un ajuste de 33 listas, una dentro de otra', (c) => (c.ajustes[0].valor = anidado(33)), 'ajustes[0].valor'],
    ['un ajuste de 3000 listas, una dentro de otra', (c) => (c.ajustes[0].valor = anidado(3000)), 'ajustes[0].valor'],
    ['un ajuste de 33 objetos, uno dentro de otro', (c) => (c.ajustes[0].valor = anidadoEnObjetos(33)), 'ajustes[0].valor'],
    ['un ajuste de 3000 objetos, uno dentro de otro', (c) => (c.ajustes[0].valor = anidadoEnObjetos(3000)), 'ajustes[0].valor'],
    ['una versión de la app con la mitad de un carácter, suelta', (c) => (c.app = '1.0.0\uDCAA'), 'app'],
    ['una versión que no es un número', (c) => Object.assign(c, { version: '1' }), 'version'],
    ['una persona que no es un UUID', (c) => (c.persona = 'yo'), 'persona'],
    ['sin entrenos', (c) => Object.assign(c, { entrenos: undefined }), 'entrenos'],
    // Ningún sitio acepta campos que no conoce: se tirarían sin avisar.
    ['un campo que no conoce en la cabecera', (c) => Object.assign(c, { zapatillas: [] }), 'su cabecera'],
    ['un campo que no conoce en un entreno', (c) => Object.assign(c.entrenos[0], { zapatilla: 'x' }), 'entrenos[0]'],
    ['un campo que no conoce en un bloque', (c) => Object.assign(bloque(c), { zapatilla: 'x' }), 'entrenos[0].bloques[0]'],
    ['un campo que no conoce en una serie', (c) => Object.assign(serie(c), { lado: 'izquierdo' }), 'entrenos[0].bloques[0].series[0]'],
    ['un campo que no conoce en un ejercicio', (c) => Object.assign(c.ejercicios[0], { por_mancuerna: 1 }), 'ejercicios[0]'],
    ['un campo que no conoce en un ajuste', (c) => Object.assign(c.ajustes[0], { borrado: 0 }), 'ajustes[0]'],
  ])('%s', (_, estropear, donde) => {
    const estropeada = clon(copia);
    estropear(estropeada);
    const error = errorDe(() => leerCopia(JSON.stringify(estropeada)));
    expect(error).toBeInstanceOf(CopiaNoValida);
    expect(error.message).toBe(`La copia está dañada: ${donde} no es válido.`);
  });

  it('un número que no cabe en un ajuste, también dentro de un objeto o de una lista', () => {
    // JSON lo lee como infinito, y al guardarlo pasaría a ser null.
    for (const valor of ['1e999', '{"peso":-1e999}', '[1,[2,1e999]]']) {
      const texto = JSON.stringify(copia).replace('"valor":"kg"', `"valor":${valor}`);
      expect(texto).toContain(valor);
      const error = errorDe(() => leerCopia(texto));
      expect(error).toBeInstanceOf(CopiaNoValida);
      expect(error.message).toBe('La copia está dañada: ajustes[0].valor no es válido.');
    }
  });

  it('una tira larga de espacios en medio de unas notas o de un nombre se rechaza enseguida', () => {
    const espacios = ' '.repeat(100_000);
    const casos: [(c: Copia) => void, string][] = [
      [(c) => (c.entrenos[0].notas = `a${espacios}b`), 'entrenos[0].notas'],
      [(c) => (c.ejercicios[0].nombre = `a${espacios}b`), 'ejercicios[0].nombre'],
    ];
    for (const [estropear, donde] of casos) {
      const estropeada = clon(copia);
      estropear(estropeada);
      const texto = JSON.stringify(estropeada);
      const antes = performance.now();
      const error = errorDe(() => leerCopia(texto));
      // Recorriendo el texto una vez son milisegundos. Una expresión regular
      // que tardara con el cuadrado de la tira tardaría varios segundos.
      expect(performance.now() - antes).toBeLessThan(1000);
      expect(error.message).toBe(`La copia está dañada: ${donde} no es válido.`);
    }
  });

  it('una lista enorme de cosas que no valen se rechaza enseguida, en su primer problema, sin mirar las demás', () => {
    // zod comprobaría cada elemento y juntaría todos sus problemas, aunque solo
    // se dice el primero: con 100.000 objetos vacíos gastaría cientos de megas,
    // y con 20.000 series vacías en un bloque lanzaría un RangeError. Además
    // del tiempo, que depende de la máquina, se cuentan los problemas a los
    // que zod pone mensaje: con una lista enorme tienen que ser los mismos que
    // con una lista de una sola cosa.
    let problemas = 0;
    z.config({
      customError: () => {
        problemas++;
        return undefined;
      },
    });
    try {
      const vacios = (n: number) => Array.from({ length: n }, () => ({}));
      const casos: [(c: Copia, n: number) => void, number, string][] = [
        [(c, n) => Object.assign(c, { entrenos: vacios(n) }), 100_000, 'entrenos[0].id'],
        [(c, n) => Object.assign(c.entrenos[0].bloques[0], { series: vacios(n) }), 20_000, 'entrenos[0].bloques[0].series[0].id'],
        [(c, n) => Object.assign(c, { ejercicios: vacios(n) }), 100_000, 'ejercicios[0].id'],
        [(c, n) => Object.assign(c, { ajustes: vacios(n) }), 100_000, 'ajustes[0].clave'],
      ];
      for (const [estropear, cuantos, donde] of casos) {
        const problemasCon = (n: number) => {
          const estropeada = clon(copia);
          estropear(estropeada, n);
          const texto = JSON.stringify(estropeada);
          problemas = 0;
          const antes = performance.now();
          const error = errorDe(() => leerCopia(texto));
          expect(performance.now() - antes).toBeLessThan(1000);
          expect(error).toBeInstanceOf(CopiaNoValida);
          expect(error.message).toBe(`La copia está dañada: ${donde} no es válido.`);
          return problemas;
        };
        const conUna = problemasCon(1);
        // Si una versión nueva de zod dejara de llamar a customError, esta cuenta no probaría nada.
        expect(conUna).toBeGreaterThan(0);
        expect(problemasCon(cuantos)).toBe(conUna);
      }
    } finally {
      z.config({ customError: undefined });
    }
  });
});

describe.each(['real', 'integer'] as const)('Los sellos en el máximo que cabe en una copia, con los números como en %s', (enteros) => {
  it('una copia con un entreno y un ajuste en el máximo se importa, y el móvil los sigue cambiando y exportando', async () => {
    // Solo una copia editada a mano llega ahí: ningún reloj da un sello así.
    const origen = await abrirBasePreparada({ enteros });
    const destino = await abrirBasePreparada({ enteros });
    try {
      const hyrox = hyroxConDescansos(nuevoId);
      await guardar(origen, hyrox, T0);
      await puertaDe(origen).escribir((tx) => ponerAjusteEn(tx, 'unidades', 'kg', T0));
      const copia = clon(await copiar(origen));
      copia.entrenos[0].modificado = Number.MAX_SAFE_INTEGER;
      copia.ajustes[0].modificado = Number.MAX_SAFE_INTEGER;
      await importar(destino, leerCopia(textoDeLaCopia(copia)), { esMia: true });

      // El móvil corrige el entreno y cambia el ajuste: el sello se queda en el máximo.
      await guardar(destino, { ...hyrox, notas: 'Corregido' }, T0 + 1000);
      await puertaDe(destino).escribir((tx) => ponerAjusteEn(tx, 'unidades', 'lb', T0 + 1000));
      const otra = leerCopia(textoDeLaCopia(await copiar(destino, T0 + 2000)));

      expect(otra.entrenos[0]).toMatchObject({ notas: 'Corregido', modificado: Number.MAX_SAFE_INTEGER });
      expect(otra.ajustes).toEqual([{ clave: 'unidades', valor: 'lb', modificado: Number.MAX_SAFE_INTEGER }]);
    } finally {
      origen.cerrar();
      destino.cerrar();
    }
  });
});

describe.each(['real', 'integer'] as const)('La copia fijada de la versión 1, con los números como en %s', (enteros) => {
  // copia-v1.json no se cambia nunca, como las huellas de las migraciones: es
  // una copia de la versión 1 como las que la gente ya tendrá guardadas, y
  // toda Quimera tiene que poder leerla e importarla tal cual. Si una
  // migración añade una columna, aquí solo se añade a las filas esperadas.
  // Lleva un entreno de cada disciplina, uno sin bloques, otro con 1000
  // bloques de carrera sin series, una cinta sin minutos, unas notas de varias
  // líneas y otras de 4000 caracteres, tres series de un ejercicio en el mismo
  // sitio y una superserie de dos vueltas, series de una sola medida y cada
  // medida en su mínimo y en su máximo, ejercicios propios de una letra y de
  // 80 fuera del plano básico de Unicode, un entreno y un ejercicio borrados,
  // ajustes de varios tipos, identificadores como los de verdad y la hora de
  // un reloj en 1970.
  const TEXTO = readFileSync(join(__dirname, 'copia-v1.json'), 'utf8');
  const id = (n: number) => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
  const PERSONA = '019ab3f2-7c1d-7e4a-b5c6-d7e8f9a0b1c2';
  const NATACION = '019ab3f2-8a3e-7f01-9d2c-4b5a6c7d8e9f';

  it('no ha cambiado, y en un móvil vacío deja exactamente estas filas', async () => {
    // La huella del fichero entero: también nota un cambio en la cabecera, que no se guarda en la base.
    expect(huella(TEXTO)).toBe('19361fbda02064');
    const db = await abrirBasePreparada({ enteros });
    try {
      const copia = leerCopia(TEXTO);
      expect(copia).toMatchObject({ app: '1.0.0', base: 1, catalogo: 2, exportado: 0, persona: PERSONA });
      const resumen = await importar(db, copia, { ahora: T0, esMia: true });

      expect(resumen).toEqual({
        entrenos: { nuevos: 5, actualizados: 0, borrados: 0, sinCambios: 1 },
        ejercicios: { nuevos: 2, actualizados: 0, borrados: 0, sinCambios: 1 },
        ajustes: { nuevos: 7, actualizados: 0, borrados: 0, sinCambios: 0 },
        persona: 'desconocida',
        preguntar: true,
      });
      expect(db.mirar('SELECT * FROM entreno ORDER BY id')).toEqual([
        { id: id(101), disciplina: 'gimnasio', fecha: '2099-12-31', hora: '23:59', duracion_ms: 172_800_000, esfuerzo: 10, notas: '  Con espacios alrededor, comillas " y un emoji \u{1F4AA}  ', modificado: 1_763_900_000_001, borrado: 0 },
        { id: id(102), disciplina: 'gimnasio', fecha: '2000-01-01', hora: '00:00', duracion_ms: 60_000, esfuerzo: 1, notas: null, modificado: 1_700_000_000_000, borrado: 0 },
        { id: id(103), disciplina: 'hyrox', fecha: '2024-02-29', hora: null, duracion_ms: 3_600_000, esfuerzo: 5, notas: 'Borrado', modificado: 1_763_900_000_002, borrado: 1 },
        { id: id(104), disciplina: 'calistenia', fecha: '2026-11-20', hora: '07:30', duracion_ms: 2_700_000, esfuerzo: 7, notas: `${'a'.repeat(3000)}${'\u{1F4AA}'.repeat(1000)}`, modificado: 1_763_900_000_009, borrado: 0 },
        { id: id(105), disciplina: 'carrera', fecha: '2026-11-21', hora: null, duracion_ms: 60_000_000, esfuerzo: 9, notas: null, modificado: 1_763_900_000_010, borrado: 0 },
        { id: NATACION, disciplina: 'natacion', fecha: '2026-11-21', hora: '19:00', duracion_ms: 2_400_000, esfuerzo: 4, notas: 'Piscina de 25 m\n\t10 × 100 m', modificado: 1_763_900_000_011, borrado: 0 },
      ]);
      expect(db.mirar('SELECT * FROM bloque ORDER BY id')).toEqual([
        { id: id(201), entreno_id: id(101), orden: 1, metros_corridos: 1_000_000, tiempo_ms: 172_800_000, descanso_ms: 86_400_000, modificado: 1_763_900_000_001, borrado: 0 },
        { id: id(202), entreno_id: id(101), orden: 2, metros_corridos: null, tiempo_ms: null, descanso_ms: 0, modificado: 1_763_900_000_001, borrado: 0 },
        { id: id(203), entreno_id: id(102), orden: 1, metros_corridos: 1, tiempo_ms: 1000, descanso_ms: null, modificado: 1_700_000_000_000, borrado: 0 },
        { id: id(204), entreno_id: id(103), orden: 1, metros_corridos: null, tiempo_ms: null, descanso_ms: 60_000, modificado: 1_763_900_000_002, borrado: 1 },
        { id: id(205), entreno_id: id(104), orden: 1, metros_corridos: null, tiempo_ms: null, descanso_ms: null, modificado: 1_763_900_000_009, borrado: 0 },
        { id: id(206), entreno_id: id(101), orden: 3, metros_corridos: 2000, tiempo_ms: null, descanso_ms: null, modificado: 1_763_900_000_001, borrado: 0 },
        // Los 1000 bloques de carrera: el último, sin descanso después.
        ...Array.from({ length: 1000 }, (_, n) => ({ id: id(1001 + n), entreno_id: id(105), orden: n + 1, metros_corridos: 200, tiempo_ms: 40_000, descanso_ms: n === 999 ? null : 20_000, modificado: 1_763_900_000_010, borrado: 0 })),
      ]);
      expect(db.mirar('SELECT * FROM serie ORDER BY id')).toEqual([
        { id: id(301), bloque_id: id(201), ronda: 1000, orden: 1000, ejercicio_id: id(401), repeticiones: 10_000, peso_g: 1_000_000, tiempo_ms: 86_400_000, distancia_m: 1_000_000, calorias: 10_000, descanso_ms: 86_400_000, modificado: 1_763_900_000_001, borrado: 0 },
        { id: id(302), bloque_id: id(202), ronda: 1, orden: 1, ejercicio_id: 'press-banca', repeticiones: 12, peso_g: 62_500, tiempo_ms: null, distancia_m: null, calorias: null, descanso_ms: 0, modificado: 1_763_900_000_001, borrado: 0 },
        { id: id(303), bloque_id: id(203), ronda: 1, orden: 1, ejercicio_id: id(401), repeticiones: 1, peso_g: 1, tiempo_ms: 1, distancia_m: 1, calorias: 1, descanso_ms: null, modificado: 1_700_000_000_000, borrado: 0 },
        { id: id(304), bloque_id: id(204), ronda: 1, orden: 1, ejercicio_id: id(402), repeticiones: null, peso_g: null, tiempo_ms: 45_000, distancia_m: null, calorias: null, descanso_ms: 30_000, modificado: 1_763_900_000_002, borrado: 1 },
        { id: id(305), bloque_id: id(205), ronda: 1, orden: 1, ejercicio_id: id(403), repeticiones: 25, peso_g: null, tiempo_ms: null, distancia_m: null, calorias: null, descanso_ms: 0, modificado: 1_763_900_000_009, borrado: 0 },
        { id: id(306), bloque_id: id(205), ronda: 1, orden: 2, ejercicio_id: 'dominadas', repeticiones: 8, peso_g: 10_000, tiempo_ms: null, distancia_m: null, calorias: null, descanso_ms: 90_000, modificado: 1_763_900_000_009, borrado: 0 },
        { id: id(307), bloque_id: id(202), ronda: 2, orden: 1, ejercicio_id: 'press-banca', repeticiones: 10, peso_g: 62_500, tiempo_ms: null, distancia_m: null, calorias: null, descanso_ms: 120_000, modificado: 1_763_900_000_001, borrado: 0 },
        { id: id(308), bloque_id: id(202), ronda: 3, orden: 1, ejercicio_id: 'press-banca', repeticiones: 8, peso_g: 65_000, tiempo_ms: null, distancia_m: null, calorias: null, descanso_ms: null, modificado: 1_763_900_000_001, borrado: 0 },
        { id: id(309), bloque_id: id(205), ronda: 2, orden: 1, ejercicio_id: id(403), repeticiones: 20, peso_g: null, tiempo_ms: null, distancia_m: null, calorias: null, descanso_ms: 0, modificado: 1_763_900_000_009, borrado: 0 },
        { id: id(310), bloque_id: id(205), ronda: 2, orden: 2, ejercicio_id: 'dominadas', repeticiones: 6, peso_g: 10_000, tiempo_ms: null, distancia_m: null, calorias: null, descanso_ms: null, modificado: 1_763_900_000_009, borrado: 0 },
        { id: id(311), bloque_id: id(201), ronda: 1, orden: 1, ejercicio_id: id(401), repeticiones: null, peso_g: null, tiempo_ms: null, distancia_m: 5000, calorias: null, descanso_ms: 60_000, modificado: 1_763_900_000_001, borrado: 0 },
        { id: id(312), bloque_id: id(201), ronda: 1, orden: 2, ejercicio_id: id(401), repeticiones: null, peso_g: null, tiempo_ms: null, distancia_m: null, calorias: 50, descanso_ms: null, modificado: 1_763_900_000_001, borrado: 0 },
      ]);
      expect(db.mirar('SELECT * FROM ejercicio WHERE propio = 1 ORDER BY id')).toEqual([
        { id: id(401), nombre: ` \t${'\u{1D538}'.repeat(80)}\r\n`, grupo: `a_${'b'.repeat(28)}`, usa_repeticiones: 1, usa_peso: 1, usa_tiempo: 1, usa_distancia: 1, usa_calorias: 1, propio: 1, modificado: 1_763_900_000_003, borrado: 0 },
        { id: id(402), nombre: 'Plancha lateral', grupo: 'core', usa_repeticiones: 0, usa_peso: 0, usa_tiempo: 1, usa_distancia: 0, usa_calorias: 0, propio: 1, modificado: 1_763_900_000_004, borrado: 1 },
        { id: id(403), nombre: 'X', grupo: 'a', usa_repeticiones: 1, usa_peso: 0, usa_tiempo: 0, usa_distancia: 0, usa_calorias: 0, propio: 1, modificado: 1_763_900_000_008, borrado: 0 },
      ]);
      // El móvil estrena su persona y recuerda la de la copia.
      const suya = await persona(db);
      expect(typeof suya === 'string' && esUuidV7(suya)).toBe(true);
      expect(suya).not.toBe(PERSONA);
      expect(await ajuste(db, 'local.personas')).toEqual([PERSONA]);
      expect(db.mirar("SELECT clave, valor, modificado FROM ajuste WHERE clave NOT GLOB 'local.*' AND clave <> 'persona' ORDER BY clave")).toEqual([
        { clave: 'avisos', valor: 'true', modificado: 1_763_900_000_014 },
        { clave: 'descanso.por_defecto_ms', valor: '90000', modificado: 1_763_900_000_005 },
        { clave: 'disciplinas.orden', valor: '["gimnasio","hyrox","calistenia"]', modificado: 1_763_900_000_015 },
        { clave: 'nulo', valor: 'null', modificado: 1_763_900_000_006 },
        { clave: 'semana.dia1', valor: '"lunes"', modificado: 1_763_900_000_012 },
        { clave: 'unidades', valor: '{"peso":"kg","lista":[1,-1.5,true,null,"ñ"]}', modificado: 1_763_900_000_007 },
        { clave: 'x', valor: '""', modificado: 1_763_900_000_013 },
      ]);
    } finally {
      db.cerrar();
    }
  });
});

describe.each(['real', 'integer'] as const)('La copia de la versión 1 tal como la escribe hoy la app, con los números como en %s', (enteros) => {
  // copia-v1-de-la-app.json tampoco se cambia nunca. La escribieron las
  // funciones de la app, sin espacios y con identificadores de verdad: un
  // entreno del gimnasio con el calentamiento en la cinta, sin los minutos, y
  // sin ejercicios propios ni ajustes que viajen, que es como salen hoy todas
  // las copias, porque la app aún no los crea.
  const TEXTO = readFileSync(join(__dirname, 'copia-v1-de-la-app.json'), 'utf8');
  const PERSONA = '01a209ac-0c46-7349-8f03-6874589d0597';
  const ENTRENO = '01a209ac-0c40-7544-98f4-5bafa11b743c';
  const [CINTA, PRESS] = ['01a209ac-0c41-730b-ba85-cacd3814151b', '01a209ac-0c42-7166-81fc-1d2b67a77cf7'];
  const SERIES = ['01a209ac-0c43-7201-8702-85ea0dfbd8a7', '01a209ac-0c44-779f-bc33-aa223ecc2ad2', '01a209ac-0c45-75bc-a428-fbb4f74e8152'];
  const MODIFICADO = 1_795_462_812_503;

  it('no ha cambiado, y en un móvil vacío deja exactamente estas filas', async () => {
    expect(huella(TEXTO)).toBe('15e01d13b59c50');
    const db = await abrirBasePreparada({ enteros });
    try {
      const copia = leerCopia(TEXTO);
      expect(copia).toMatchObject({ app: '1.0.0', base: 1, catalogo: 2, exportado: 1_795_464_317_342, persona: PERSONA, ejercicios: [], ajustes: [] });
      const resumen = await importar(db, copia, { ahora: T0, esMia: true });

      const nada = { nuevos: 0, actualizados: 0, borrados: 0, sinCambios: 0 };
      expect(resumen).toEqual({
        entrenos: { ...nada, nuevos: 1 },
        ejercicios: nada,
        ajustes: nada,
        persona: 'desconocida',
        preguntar: true,
      });
      expect(db.mirar('SELECT * FROM entreno ORDER BY id')).toEqual([
        { id: ENTRENO, disciplina: 'gimnasio', fecha: '2026-11-23', hora: '18:30', duracion_ms: 3_900_000, esfuerzo: 7, notas: null, modificado: MODIFICADO, borrado: 0 },
      ]);
      expect(db.mirar('SELECT * FROM bloque ORDER BY id')).toEqual([
        { id: CINTA, entreno_id: ENTRENO, orden: 1, metros_corridos: 2000, tiempo_ms: null, descanso_ms: null, modificado: MODIFICADO, borrado: 0 },
        { id: PRESS, entreno_id: ENTRENO, orden: 2, metros_corridos: null, tiempo_ms: null, descanso_ms: null, modificado: MODIFICADO, borrado: 0 },
      ]);
      expect(db.mirar('SELECT * FROM serie ORDER BY id')).toEqual([
        { id: SERIES[0], bloque_id: PRESS, ronda: 1, orden: 1, ejercicio_id: 'press-banca', repeticiones: 10, peso_g: 60_000, tiempo_ms: null, distancia_m: null, calorias: null, descanso_ms: 120_000, modificado: MODIFICADO, borrado: 0 },
        { id: SERIES[1], bloque_id: PRESS, ronda: 2, orden: 1, ejercicio_id: 'press-banca', repeticiones: 8, peso_g: 62_500, tiempo_ms: null, distancia_m: null, calorias: null, descanso_ms: 120_000, modificado: MODIFICADO, borrado: 0 },
        { id: SERIES[2], bloque_id: PRESS, ronda: 3, orden: 1, ejercicio_id: 'press-banca', repeticiones: 6, peso_g: 65_000, tiempo_ms: null, distancia_m: null, calorias: null, descanso_ms: null, modificado: MODIFICADO, borrado: 0 },
      ]);
      expect(db.mirar('SELECT * FROM ejercicio WHERE propio = 1')).toEqual([]);
      // El móvil estrena su persona y recuerda la de la copia; no hay más ajustes.
      const suya = await persona(db);
      expect(typeof suya === 'string' && esUuidV7(suya)).toBe(true);
      expect(suya).not.toBe(PERSONA);
      expect(await ajuste(db, 'local.personas')).toEqual([PERSONA]);
      expect(db.mirar("SELECT clave FROM ajuste WHERE clave NOT GLOB 'local.*' AND clave <> 'persona'")).toEqual([]);
    } finally {
      db.cerrar();
    }
  });
});

describe.each(['real', 'integer'] as const)('La copia de la versión 1 de un móvil sin entrenos, con los números como en %s', (enteros) => {
  // copia-v1-sin-entrenos.json tampoco se cambia nunca. La escribió
  // crearCopiaEn en un móvil recién instalado en el que se probó a exportar
  // antes de apuntar nada: la cabecera y las tres listas vacías.
  const TEXTO = readFileSync(join(__dirname, 'copia-v1-sin-entrenos.json'), 'utf8');
  const PERSONA = '01a20a39-8365-745a-9735-8f93641c754c';

  it('no ha cambiado, y en un móvil vacío no trae nada más que su persona, que el móvil recuerda', async () => {
    expect(huella(TEXTO)).toBe('1870ed684a6a7f');
    const db = await abrirBasePreparada({ enteros });
    try {
      const copia = leerCopia(TEXTO);
      expect(copia).toMatchObject({ app: '1.0.0', base: 1, catalogo: 2, exportado: 1_795_467_871_077, persona: PERSONA, ejercicios: [], entrenos: [], ajustes: [] });
      const nada = { nuevos: 0, actualizados: 0, borrados: 0, sinCambios: 0 };
      expect(await importar(db, copia, { ahora: T0, esMia: true })).toEqual({
        entrenos: nada,
        ejercicios: nada,
        ajustes: nada,
        persona: 'desconocida',
        preguntar: true,
      });
      expect(foto(db).slice(0, 3)).toEqual([[], [], []]);
      const suya = await persona(db);
      expect(typeof suya === 'string' && esUuidV7(suya)).toBe(true);
      expect(suya).not.toBe(PERSONA);
      expect(await ajuste(db, 'local.personas')).toEqual([PERSONA]);
    } finally {
      db.cerrar();
    }
  });
});

/** Lo más grande que acepta la base en cada columna, con 1000 bloques. */
function maximo(propio: string): Entreno {
  return {
    id: nuevoId(),
    disciplina: 'gimnasio',
    fecha: '2099-12-31',
    hora: '23:59',
    duracionMs: 172_800_000,
    esfuerzo: 10,
    notas: '\u{1F4AA}'.repeat(4000),
    bloques: [
      {
        id: nuevoId(),
        metrosCorridos: 1_000_000,
        tiempoMs: 172_800_000,
        descansoMs: 86_400_000,
        series: [
          { id: nuevoId(), ronda: 1000, orden: 1000, ejercicioId: propio, repeticiones: 10_000, pesoG: 1_000_000, tiempoMs: 86_400_000, distanciaM: 1_000_000, calorias: 10_000, descansoMs: 86_400_000 },
        ],
      },
      ...Array.from({ length: 999 }, () => ({ id: nuevoId(), metrosCorridos: null, tiempoMs: null, descansoMs: null, series: [] })),
    ],
  };
}

/** Lo más pequeño que acepta la base en cada columna. */
function minimo(propio: string): Entreno {
  return {
    id: nuevoId(),
    disciplina: 'gimnasio',
    fecha: '2000-01-01',
    hora: '00:00',
    duracionMs: 60_000,
    esfuerzo: 1,
    // Una sola letra entre espacios, tabuladores y saltos de línea.
    notas: ' \t\nx\r\n ',
    bloques: [
      {
        id: nuevoId(),
        metrosCorridos: 1,
        tiempoMs: 1000,
        descansoMs: 0,
        series: [
          { id: nuevoId(), ronda: 1, orden: 1, ejercicioId: propio, repeticiones: 1, pesoG: 1, tiempoMs: 1, distanciaM: 1, calorias: 1, descansoMs: 0 },
          // Una serie de cada medida sola.
          { id: nuevoId(), ronda: 2, orden: 1, ejercicioId: propio, repeticiones: 1, pesoG: null, tiempoMs: null, distanciaM: null, calorias: null, descansoMs: null },
          { id: nuevoId(), ronda: 2, orden: 2, ejercicioId: propio, repeticiones: null, pesoG: null, tiempoMs: 1, distanciaM: null, calorias: null, descansoMs: null },
          { id: nuevoId(), ronda: 2, orden: 3, ejercicioId: propio, repeticiones: null, pesoG: null, tiempoMs: null, distanciaM: 1, calorias: null, descansoMs: null },
          { id: nuevoId(), ronda: 2, orden: 4, ejercicioId: propio, repeticiones: null, pesoG: null, tiempoMs: null, distanciaM: null, calorias: 1, descansoMs: null },
        ],
      },
      // Una carrera con los metros y sin el tiempo, como la cinta sin minutos del editor.
      { id: nuevoId(), metrosCorridos: 1, tiempoMs: null, descansoMs: null, series: [] },
    ],
  };
}

/** Un ajuste de cada tipo de valor JSON, también los vacíos. */
const AJUSTES: [string, ValorDeAjuste][] = [
  ['nulo', null],
  ['entero', 90_000],
  ['decimal', 1.5],
  ['negativo', -3],
  ['si', true],
  ['no', false],
  ['lista', [1, 'a', null, [true], { b: 2 }]],
  ['objeto', { a: { b: [1, 2] }, c: null, d: '' }],
  ['vacio', ''],
  ['texto', 'ñ\u{1F4AA}"\\\n'],
  ['objeto.vacio', {}],
  ['lista_vacia', []],
  ['hondo', anidado(32)],
  ['hondo.en.objetos', anidadoEnObjetos(32)],
  // Las claves más corta y más larga, con cifras.
  ['x', 'una letra'],
  [`k64.${'0123456789'.repeat(6)}`, 64],
];

describe.each([
  ['real', 'real'],
  ['integer', 'integer'],
  ['real', 'integer'],
  ['integer', 'real'],
] as const)('Los límites de la base, de un móvil con los números como en %s a otro como en %s', (enOrigen, enDestino) => {
  it('viajan y se importan igual: cada columna en su máximo y en su mínimo, 1000 bloques, cada disciplina y ajustes de cada tipo', async () => {
    const origen = await abrirBasePreparada({ enteros: enOrigen });
    const destino = await abrirBasePreparada({ enteros: enDestino });
    try {
      const propio = nuevoId();
      await anadirEjercicioPropio(origen, propio, T0, {
        nombre: ` \t${'\u{1D538}'.repeat(80)}\r\n`,
        grupo: `a${'b'.repeat(29)}`,
        mide: [1, 1, 1, 1, 1],
      });
      await anadirEjercicioPropio(origen, nuevoId(), T0 + 3, { nombre: 'X', grupo: 'a', borrado: 1, mide: [0, 0, 1, 0, 0] });
      // La clave de catálogo más larga que admite la base, en los dos móviles.
      const larga = `ejercicio-${'a'.repeat(54)}`;
      await anadirEjercicioDelCatalogo(origen, larga);
      await anadirEjercicioDelCatalogo(destino, larga);
      await guardar(origen, maximo(propio), T0 + 10);
      await guardar(origen, minimo(propio), T0 + 11);
      await guardar(origen, hyroxConDescansos(nuevoId), T0 + 12);
      await guardar(origen, conUnaSerie(larga), T0 + 13);
      // Un entreno de cada disciplina de la base: una nueva entra sola en la prueba.
      const disciplinas = origen.mirar<{ id: string }>('SELECT id FROM disciplina ORDER BY id');
      for (const [n, { id }] of disciplinas.entries()) {
        await guardar(origen, { ...gimnasioConCalentamiento(nuevoId), disciplina: id as Entreno['disciplina'] }, T0 + 20 + n);
      }
      await puertaDe(origen).escribir(async (tx) => {
        for (const [clave, valor] of AJUSTES) await ponerAjusteEn(tx, clave, valor, T0 + 20);
      });

      const copia = await copiar(origen);
      const leida = leerCopia(textoDeLaCopia(copia));
      expect(leida).toEqual(copia);
      const resumen = await importar(destino, leida, { esMia: true });

      expect(resumen.ejercicios).toEqual({ nuevos: 1, actualizados: 0, borrados: 0, sinCambios: 1 });
      expect(resumen.ajustes).toEqual({ nuevos: AJUSTES.length, actualizados: 0, borrados: 0, sinCambios: 0 });
      expect(loQueViaja(destino)).toEqual(loQueViaja(origen));
      for (const [clave, valor] of AJUSTES) {
        expect(await ajuste(destino, clave)).toEqual(valor);
      }
      // La copia del destino dice lo mismo que la del origen.
      const otra = await copiar(destino, T0 + 300_000);
      expect(otra.persona).not.toBe(copia.persona);
      expect({ ...otra, exportado: 0, persona: '' }).toEqual({ ...copia, exportado: 0, persona: '' });
    } finally {
      origen.cerrar();
      destino.cerrar();
    }
  });
});

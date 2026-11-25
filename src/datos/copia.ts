import { z } from 'zod';

import { leerAjuste, ponerAjusteEn, type ValorDeAjuste } from './ajustes';
import { p, type Lectura, type Transaccion } from './base';
import { CATALOGO_VERSION } from './catalogo';
import { esFecha } from './fechas';
import { MIGRACIONES } from './migraciones';
import { SELLO_MAXIMO, SELLO_MINIMO } from './sellos';

// La copia de los datos: un fichero JSON que se exporta y se importa, la única
// vía entre un iPhone y un Android y la única protección si se borra la app
// del iPhone, que se lleva sus datos.
//
// El formato, versión 1, lo aprobó Cristian el 23 de noviembre de 2026.
// Cambiarlo cuesta mucho, porque habrá copias guardadas: cualquier campo nuevo
// o distinto sube la versión, y una Quimera no importa una copia de una
// versión más nueva que la que conoce.
// - Una cabecera: el formato, su versión, las versiones de la app, de la base
//   y del catálogo que la crearon, cuándo se exportó y de quién es (persona).
// - Los entrenos, también los borrados, con su marca, para que no reaparezcan
//   al importar en otro móvil. Cada uno lleva dentro sus bloques, en orden, y
//   sus series. Los nombres y las unidades enteras son los de la base:
//   gramos, metros y milisegundos. Los bloques y las series llevan el sello y
//   la marca de su entreno, como en la base, así que no los repiten.
// - Los ejercicios que creó la persona, también los borrados, con su marca.
//   Los del catálogo van solo por su clave, que es la misma en todos los
//   móviles.
// - Los ajustes que viajan: los «local.*» son de cada móvil y no van.
//
// Importar junta entreno a entreno: gana la versión con el sello mayor, y un
// entreno nunca queda mezcla de dos móviles. Nada se borra porque falte en la
// copia, y todo va en una sola transacción.
//
// La persona dice de quién son los datos. Cada móvil estrena la suya la
// primera vez que la necesita, al exportar o al importar, y no cambia nunca:
// un móvil nunca toma la persona de una copia, así que lo que se conteste en
// un móvil no cambia de quién son las copias de ningún otro. Por eso, en
// realidad, la persona identifica una instalación de la app: el móvil, la
// tableta y cada reinstalación de una misma persona tienen una distinta, y
// comparar con amigos necesitará otro dato, con otra versión del formato.
// Si la copia no es de la persona del móvil, ni de otra que el móvil ya
// aceptó como suya, hay que preguntar si la copia es suya antes de
// importarla, también al estrenar móvil. Así, los entrenos de la copia de una
// persona no entran en el móvil de otra sin que alguien lo diga en ese móvil;
// una vez dentro, son datos de ese móvil y viajan en sus copias como los
// suyos.
// - Si es suya, el móvil toma sus ajustes más recientes y recuerda la persona
//   de la copia en un ajuste local, que no viaja: las copias que la llevan ya
//   no preguntan, aunque vayan siempre en el mismo sentido. No se olvida:
//   después de un «sí» por error, las copias de esa persona entran en este
//   móvil sin preguntar, con sus ajustes más recientes. El error se queda en
//   este móvil: los demás siguen preguntando por las copias de esa persona,
//   aunque lo que este móvil ya tomó de ellas, sus entrenos y sus ajustes,
//   viaja en sus copias como cualquier cambio suyo.
// - Si no es suya, solo entran los entrenos y los ejercicios propios que este
//   móvil no tiene, y viajan después en sus copias; lo que ya tiene, también
//   lo borrado, no cambia ni se borra, y no toma ningún ajuste. Lo que entra
//   lleva el sello mínimo, así que pierde frente a cualquier versión de los
//   móviles de esta persona, también si entra en uno que aún no tenía esos
//   entrenos: lo que otra persona haga en su móvil con entrenos de esta no
//   gana nunca a los suyos. A cambio, las correcciones y los borrados que
//   haga en sus propios entrenos, ya importados, tampoco llegan; si dos
//   móviles de esta persona importan con «no» copias distintas de la otra,
//   sus entrenos se quedan distintos en cada uno; sus sellos ya no dicen
//   cuándo cambiaron; y si un ejercicio propio de la otra persona cambia lo
//   que mide, sus entrenos nuevos entran con medidas que el de aquí no mide,
//   y no se pueden corregir tal cual.
// Un móvil que se estrena, o se reinstala, y restaura una copia tiene una
// persona nueva, y los demás móviles preguntan una vez por sus copias.
//
// Cuando el formato suba de versión:
// - Esta Quimera tiene que seguir leyendo las copias de la versión 1 que ya
//   estén guardadas: los ficheros de las copias fijadas (copia-v1.json,
//   copia-v1-de-la-app.json y copia-v1-sin-entrenos.json) no cambian nunca;
//   sus pruebas solo añaden a las filas esperadas lo que pongan las
//   migraciones nuevas.
// - Una copia de una versión anterior nunca borra lo que no conoce: si una
//   columna nueva viaja, como la zapatilla de un bloque, importar una copia
//   vieja conserva el valor que tiene el móvil.

/** Lo que dice la cabecera de cada copia: que es de Quimera. */
export const FORMATO_DE_COPIA = 'quimera';
/** La versión del formato que crea y entiende esta Quimera. */
export const VERSION_DE_COPIA = 1;
/** El ajuste que dice de quién son los datos de este móvil. */
const PERSONA = 'persona';
/**
 * Las otras personas que este móvil aceptó como suyas al contestar que la
 * copia era suya: las copias que las llevan ya no preguntan. Es local, así que
 * no viaja, y no se olvida.
 */
const OTRAS_SUYAS = 'local.personas';
/** Los entrenos que se escriben en cada sentencia al importar. */
const TANDA = 100;

/** El fichero no es una copia de Quimera, o está dañado. */
export class CopiaNoValida extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'CopiaNoValida';
  }
}

/** La copia es de una Quimera más nueva, que guarda cosas que esta no conoce. */
export class CopiaMasNueva extends Error {
  constructor() {
    super('La copia es de una Quimera más nueva que esta. Actualiza Quimera para importarla.');
    this.name = 'CopiaMasNueva';
  }
}

// El esquema de la versión 1. Repite las comprobaciones de la base
// (src/datos/migraciones.ts) para dar un error claro antes de escribir nada, y
// no acepta campos que no conoce. Además, rechaza lo que la base guardaría
// pero el móvil no leería igual, o no podría ni leer: los caracteres nulos,
// los sustitutos sueltos de UTF-16, los números que no caben en un ajuste
// (JSON los lee como infinito, y se guardarían como null), los sellos que
// JavaScript no guarda exactos y los ajustes con demasiados niveles. Tampoco
// acepta los ajustes que no viajan: los «local.*» y la persona, que va en la
// cabecera.

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const entero = (minimo: number, maximo: number) => z.int().min(minimo).max(maximo);
const sello = z.int().min(SELLO_MINIMO).max(SELLO_MAXIMO);
const marca = z.union([z.literal(0), z.literal(1)]);
// Los textos se recorren con bucles, sin expresiones regulares ni listas de
// caracteres: con un fichero editado a mano, una tira larga de espacios en
// medio haría que una expresión tardara con su cuadrado, y un texto enorme
// gastaría cientos de megas en una lista.

/** Lo que la base cuenta como espacio al recortar: espacio, tabulador y saltos de línea. */
const esEspacio = (unidad: number) => unidad === 0x20 || unidad === 0x09 || unidad === 0x0a || unidad === 0x0d;

/** El texto sin los espacios de los extremos, como lo recorta la base. */
function recortar(texto: string): string {
  let desde = 0;
  let hasta = texto.length;
  while (desde < hasta && esEspacio(texto.charCodeAt(desde))) desde++;
  while (hasta > desde && esEspacio(texto.charCodeAt(hasta - 1))) hasta--;
  return texto.slice(desde, hasta);
}

/** La longitud que cuenta SQLite: caracteres, no unidades de UTF-16. */
function largo(texto: string): number {
  let caracteres = 0;
  for (let i = 0; i < texto.length; i++) {
    const unidad = texto.charCodeAt(i);
    // Un carácter de dos unidades cuenta una vez.
    if (unidad >= 0xd800 && unidad <= 0xdbff) {
      const siguiente = texto.charCodeAt(i + 1);
      if (siguiente >= 0xdc00 && siguiente <= 0xdfff) i++;
    }
    caracteres++;
  }
  return caracteres;
}

/**
 * Un texto que el móvil guarda y lee igual. Sin caracteres nulos, porque en el
 * iPhone expo-sqlite corta el texto en el primero. Y sin sustitutos sueltos de
 * UTF-16, la mitad de un carácter que ocupa dos unidades sin la otra mitad:
 * no caben en UTF-8, así que el móvil los leería cambiados, con el texto más
 * largo, y ya no podría exportar.
 */
function bienEscrito(texto: string): boolean {
  for (let i = 0; i < texto.length; i++) {
    const unidad = texto.charCodeAt(i);
    if (unidad === 0 || (unidad >= 0xdc00 && unidad <= 0xdfff)) return false;
    if (unidad >= 0xd800 && unidad <= 0xdbff) {
      const siguiente = texto.charCodeAt(i + 1);
      if (!(siguiente >= 0xdc00 && siguiente <= 0xdfff)) return false;
      i++;
    }
  }
  return true;
}

/** Las listas u objetos que puede llevar un ajuste uno dentro de otro. Los de Quimera llevan dos o tres. */
const NIVELES_DE_UN_AJUSTE = 32;

/**
 * Un valor JSON como los que guarda la base, con números finitos y hasta
 * NIVELES_DE_UN_AJUSTE listas u objetos uno dentro de otro. Lo recorre sin
 * recursión, para que un fichero editado a mano con miles de niveles no agote
 * la pila, y con una sola entrada por nivel abierto, para que una lista
 * enorme, también de listas o de objetos, no gaste memoria de más.
 */
function esValorDeAjuste(valor: unknown): boolean {
  // Las listas y los objetos abiertos, del primero al más hondo: lo que llevan dentro y por dónde se va.
  const abiertos: { dentro: unknown[]; siguiente: number }[] = [];
  let cosa: unknown = valor;
  for (;;) {
    if (typeof cosa === 'number') {
      if (!Number.isFinite(cosa)) return false;
    } else if (typeof cosa === 'object' && cosa !== null) {
      if (abiertos.length === NIVELES_DE_UN_AJUSTE) return false;
      abiertos.push({ dentro: Array.isArray(cosa) ? cosa : Object.values(cosa), siguiente: 0 });
    } else if (cosa !== null && typeof cosa !== 'string' && typeof cosa !== 'boolean') {
      return false;
    }
    // Lo siguiente que mirar está en el abierto más hondo que aún tiene algo; los acabados se cierran.
    let ultimo = abiertos[abiertos.length - 1];
    while (ultimo !== undefined && ultimo.siguiente === ultimo.dentro.length) {
      abiertos.pop();
      ultimo = abiertos[abiertos.length - 1];
    }
    if (ultimo === undefined) return true;
    cosa = ultimo.dentro[ultimo.siguiente++];
  }
}

/**
 * Una lista que se comprueba elemento a elemento y para en el primero que no
 * vale. zod, por su cuenta, los comprueba todos y junta cada problema, aunque
 * comprobar solo dice el primero: con un fichero editado a mano con miles de
 * objetos vacíos gastaría cientos de megas, y con miles de series vacías en un
 * bloque lanzaría un RangeError, porque junta los problemas de cada elemento
 * con push(...problemas).
 */
function listaDe<T extends z.ZodType>(lista: z.ZodArray<z.ZodUnknown>, elemento: T) {
  return lista.transform((cosas, ctx) => {
    const leidas: z.output<T>[] = [];
    for (let i = 0; i < cosas.length; i++) {
      const leida = elemento.safeParse(cosas[i]);
      if (!leida.success) {
        const [problema] = leida.error.issues;
        ctx.addIssue({ code: 'custom', message: problema.message, path: [i, ...problema.path], input: cosas[i] });
        return z.NEVER;
      }
      leidas.push(leida.data);
    }
    return leidas;
  });
}

const esquemaDeSerie = z
  .strictObject({
    id: uuid,
    ronda: entero(1, 1000),
    orden: entero(1, 1000),
    ejercicio_id: z.string().regex(/^[a-z0-9-]{2,64}$/),
    repeticiones: entero(1, 10000).nullable(),
    peso_g: entero(1, 1000000).nullable(),
    tiempo_ms: entero(1, 86400000).nullable(),
    distancia_m: entero(1, 1000000).nullable(),
    calorias: entero(1, 10000).nullable(),
    descanso_ms: entero(0, 86400000).nullable(),
  })
  .refine((s) => s.repeticiones !== null || s.tiempo_ms !== null || s.distancia_m !== null || s.calorias !== null, {
    message: 'una serie sin repeticiones, tiempo, distancia ni calorías',
  });

const esquemaDeBloque = z.strictObject({
  id: uuid,
  metros_corridos: entero(1, 1000000).nullable(),
  tiempo_ms: entero(1000, 172800000).nullable(),
  descanso_ms: entero(0, 86400000).nullable(),
  series: listaDe(z.array(z.unknown()), esquemaDeSerie),
});

const esquemaDeEntreno = z.strictObject({
  id: uuid,
  disciplina: z.string().regex(/^[a-z]{1,20}$/),
  fecha: z.string().refine((f) => esFecha(f) && f >= '2000-01-01' && f <= '2099-12-31', { message: 'una fecha que no existe' }),
  hora: z
    .string()
    .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
    .nullable(),
  duracion_ms: entero(60000, 172800000),
  esfuerzo: entero(1, 10),
  notas: z
    .string()
    // largo nunca pasa de length: solo se cuenta si hay más unidades que el límite.
    .refine((n) => recortar(n) !== '' && (n.length <= 4000 || largo(n) <= 4000) && bienEscrito(n), {
      message: 'unas notas vacías o demasiado largas',
    })
    .nullable(),
  modificado: sello,
  borrado: marca,
  bloques: listaDe(z.array(z.unknown()).max(1000), esquemaDeBloque),
});

const esquemaDeEjercicio = z
  .strictObject({
    id: uuid,
    nombre: z.string().refine(
      (n) => {
        const recortado = recortar(n);
        return recortado !== '' && (recortado.length <= 80 || largo(recortado) <= 80) && bienEscrito(n);
      },
      { message: 'un nombre vacío o de más de 80 letras' },
    ),
    grupo: z.string().regex(/^[a-z][a-z_]{0,29}$/),
    usa_repeticiones: marca,
    usa_peso: marca,
    usa_tiempo: marca,
    usa_distancia: marca,
    usa_calorias: marca,
    modificado: sello,
    borrado: marca,
  })
  .refine((e) => e.usa_repeticiones + e.usa_peso + e.usa_tiempo + e.usa_distancia + e.usa_calorias >= 1, {
    message: 'un ejercicio que no mide nada',
  });

const esquemaDeAjuste = z.strictObject({
  clave: z
    .string()
    .regex(/^[a-z][a-z0-9._]{0,63}$/)
    .refine((c) => !c.startsWith('local.') && c !== PERSONA, { message: 'un ajuste que no viaja' }),
  valor: z.custom<ValorDeAjuste>(esValorDeAjuste),
  modificado: sello,
});

const esquemaDeCopia = z.strictObject({
  formato: z.literal(FORMATO_DE_COPIA),
  version: z.literal(VERSION_DE_COPIA),
  app: z.string().min(1).max(40).refine(bienEscrito),
  base: z.int().min(1).max(10000),
  catalogo: z.int().min(1).max(10000),
  // La hora del reloj del móvil al exportar. No es un sello: no decide nada al
  // importar, y un reloj atrasado no debe dejar la copia sin poder leerse.
  exportado: z.int().min(0).max(Number.MAX_SAFE_INTEGER),
  persona: uuid,
  ejercicios: listaDe(z.array(z.unknown()), esquemaDeEjercicio),
  entrenos: listaDe(z.array(z.unknown()), esquemaDeEntreno),
  ajustes: listaDe(z.array(z.unknown()), esquemaDeAjuste),
});

/** Una copia de los datos, versión 1. */
export type Copia = z.infer<typeof esquemaDeCopia>;
export type EntrenoDeCopia = Copia['entrenos'][number];
export type EjercicioDeCopia = Copia['ejercicios'][number];

/** El nombre del fichero de una copia hecha en esa fecha local, AAAA-MM-DD. */
export function nombreDeLaCopia(fecha: string): string {
  return `quimera-${fecha}.json`;
}

/** Dónde está el primer problema de una copia, como «entrenos[3].fecha». */
function ruta(camino: readonly PropertyKey[]): string {
  return camino.reduce<string>(
    (hecho, paso) => (typeof paso === 'number' ? `${hecho}[${paso}]` : hecho === '' ? String(paso) : `${hecho}.${String(paso)}`),
    '',
  );
}

/** Pasa una copia por el esquema y por la comprobación de repetidos, y lanza CopiaNoValida si algo falla. */
function comprobar(datos: unknown): Copia {
  const leida = esquemaDeCopia.safeParse(datos);
  if (!leida.success) {
    const [problema] = leida.error.issues;
    throw new CopiaNoValida(`La copia está dañada: ${ruta(problema.path) || 'su cabecera'} no es válido.`);
  }
  comprobarRepetidos(leida.data);
  return leida.data;
}

/** Lanza CopiaNoValida si algún identificador, o el sitio de alguna serie, sale dos veces. */
function comprobarRepetidos(copia: Copia): void {
  const vistos = new Set<string>();
  const una = (id: string, que: string) => {
    if (vistos.has(id)) {
      throw new CopiaNoValida(`La copia está dañada: ${que} ${id} sale dos veces.`);
    }
    vistos.add(id);
  };
  for (const ejercicio of copia.ejercicios) una(ejercicio.id, 'el ejercicio');
  for (const entreno of copia.entrenos) {
    una(entreno.id, 'el entreno');
    for (const bloque of entreno.bloques) {
      una(bloque.id, 'el bloque');
      const sitios = new Set<string>();
      for (const serie of bloque.series) {
        una(serie.id, 'la serie');
        const sitio = `${serie.ronda}.${serie.orden}`;
        if (sitios.has(sitio)) {
          throw new CopiaNoValida(`La copia está dañada: el bloque ${bloque.id} tiene dos series en el mismo sitio.`);
        }
        sitios.add(sitio);
      }
    }
  }
  const claves = new Set<string>();
  for (const ajuste of copia.ajustes) {
    if (claves.has(ajuste.clave)) {
      throw new CopiaNoValida(`La copia está dañada: el ajuste ${ajuste.clave} sale dos veces.`);
    }
    claves.add(ajuste.clave);
  }
}

export type OpcionesDeCopiar = {
  ahora: number;
  /** La versión de la app que exporta, como «1.0.0». */
  app: string;
  /** Para la persona del móvil, si aún no tiene. */
  nuevoId: () => string;
};

/**
 * La persona de este móvil: la que dice de quién son sus datos. Nace la
 * primera vez que hace falta, al exportar o al importar, y viaja en cada
 * copia.
 */
async function personaEn(tx: Transaccion, { ahora, nuevoId }: Pick<OpcionesDeCopiar, 'ahora' | 'nuevoId'>): Promise<string> {
  const actual = await leerAjuste(tx, PERSONA);
  if (typeof actual === 'string') {
    return actual;
  }
  const nueva = nuevoId();
  await ponerAjusteEn(tx, PERSONA, nueva, ahora);
  return nueva;
}

type FilaDeEntreno = Omit<EntrenoDeCopia, 'bloques' | 'borrado'> & { borrado: number };
type FilaDeBloque = Omit<EntrenoDeCopia['bloques'][number], 'series'> & { entreno_id: string };
type FilaDeSerie = EntrenoDeCopia['bloques'][number]['series'][number] & { bloque_id: string };
type FilaDeEjercicio = Omit<EjercicioDeCopia, 'borrado' | `usa_${string}`> & Record<`usa_${string}` | 'borrado', number>;

/** 0 o 1, como lo guarda la base, para el tipo de la copia. */
const comoMarca = (n: number): 0 | 1 => (n === 0 ? 0 : 1);

/**
 * La copia de todos los datos que viajan, con la persona del móvil, que nace
 * aquí si aún no tiene. Escribe solo eso: la copia sale tal cual está la base.
 *
 * Antes de devolverla, la pasa por las mismas comprobaciones que al leerla: si
 * algo de la base no cupiera en el formato, falla al exportar, con el móvil
 * delante, y no al restaurar, cuando quizá ya no está.
 */
export async function crearCopiaEn(tx: Transaccion, { ahora, app, nuevoId }: OpcionesDeCopiar): Promise<Copia> {
  const persona = await personaEn(tx, { ahora, nuevoId });
  const version = await tx.getFirstAsync<{ user_version: number }>('PRAGMA user_version', {});

  const ejercicios = await tx.getAllAsync<FilaDeEjercicio>(
    `SELECT id, nombre, grupo, usa_repeticiones, usa_peso, usa_tiempo, usa_distancia, usa_calorias, modificado, borrado
     FROM ejercicio WHERE propio = 1 ORDER BY id`,
    {},
  );
  const entrenos = await tx.getAllAsync<FilaDeEntreno>(
    `SELECT id, disciplina, fecha, hora, duracion_ms, esfuerzo, notas, modificado, borrado
     FROM entreno ORDER BY fecha, hora, id`,
    {},
  );
  const bloques = await tx.getAllAsync<FilaDeBloque>(
    'SELECT entreno_id, id, metros_corridos, tiempo_ms, descanso_ms FROM bloque ORDER BY entreno_id, orden',
    {},
  );
  const series = await tx.getAllAsync<FilaDeSerie>(
    `SELECT bloque_id, id, ronda, orden, ejercicio_id, repeticiones, peso_g, tiempo_ms, distancia_m, calorias, descanso_ms
     FROM serie ORDER BY bloque_id, ronda, orden`,
    {},
  );
  const ajustes = await tx.getAllAsync<{ clave: string; valor: string; modificado: number }>(
    `SELECT clave, valor, modificado FROM ajuste
     WHERE clave NOT GLOB 'local.*' AND clave <> :persona ORDER BY clave`,
    p({ persona: PERSONA }),
  );

  const seriesDe = new Map<string, EntrenoDeCopia['bloques'][number]['series']>();
  for (const { bloque_id, ...serie } of series) {
    const lista = seriesDe.get(bloque_id);
    if (lista === undefined) seriesDe.set(bloque_id, [serie]);
    else lista.push(serie);
  }
  const bloquesDe = new Map<string, EntrenoDeCopia['bloques']>();
  for (const { entreno_id, ...fila } of bloques) {
    const bloque = { ...fila, series: seriesDe.get(fila.id) ?? [] };
    const lista = bloquesDe.get(entreno_id);
    if (lista === undefined) bloquesDe.set(entreno_id, [bloque]);
    else lista.push(bloque);
  }

  const copia: Copia = {
    formato: FORMATO_DE_COPIA,
    version: VERSION_DE_COPIA,
    app,
    base: version?.user_version ?? MIGRACIONES.length,
    catalogo: CATALOGO_VERSION,
    exportado: Math.floor(ahora),
    persona,
    ejercicios: ejercicios.map((e) => ({
      ...e,
      usa_repeticiones: comoMarca(e.usa_repeticiones),
      usa_peso: comoMarca(e.usa_peso),
      usa_tiempo: comoMarca(e.usa_tiempo),
      usa_distancia: comoMarca(e.usa_distancia),
      usa_calorias: comoMarca(e.usa_calorias),
      borrado: comoMarca(e.borrado),
    })),
    entrenos: entrenos.map((e) => ({ ...e, borrado: comoMarca(e.borrado), bloques: bloquesDe.get(e.id) ?? [] })),
    ajustes: ajustes.map((a) => ({
      clave: a.clave,
      valor: JSON.parse(a.valor) as ValorDeAjuste,
      modificado: a.modificado,
    })),
  };
  try {
    comprobar(copia);
  } catch (error) {
    throw new Error(`No se pudo crear una copia válida. ${(error as Error).message}`);
  }
  return copia;
}

/** El texto del fichero de una copia. */
export function textoDeLaCopia(copia: Copia): string {
  return JSON.stringify(copia);
}

/**
 * Lee el texto de un fichero de copia y lo comprueba entero antes de tocar la
 * base. Lanza CopiaNoValida si no es una copia de Quimera o está dañada, y
 * CopiaMasNueva si es de una versión del formato que esta Quimera no conoce.
 */
export function leerCopia(texto: string): Copia {
  let datos: unknown;
  try {
    // Un editor de texto puede haber guardado el fichero con la marca de orden de bytes (U+FEFF) delante.
    datos = JSON.parse(texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto);
  } catch {
    throw new CopiaNoValida('El fichero no es una copia de Quimera.');
  }
  if (typeof datos !== 'object' || datos === null || (datos as { formato?: unknown }).formato !== FORMATO_DE_COPIA) {
    throw new CopiaNoValida('El fichero no es una copia de Quimera.');
  }
  const { version } = datos as { version?: unknown };
  if (typeof version === 'number' && Number.isInteger(version) && version > VERSION_DE_COPIA) {
    throw new CopiaMasNueva();
  }
  return comprobar(datos);
}

/** Lo que cambia en una clase de datos al importar. */
export type Cuenta = {
  /** Los que no estaban, o estaban borrados, y aparecen. */
  nuevos: number;
  /** Los que estaban y cambian por una versión más reciente. */
  actualizados: number;
  /** Los que estaban y desaparecen, porque se borraron en el otro móvil después. */
  borrados: number;
  /**
   * Los que no cambian nada a la vista: este móvil tiene una versión igual o
   * más reciente, llegan borrados y aquí no estaban o ya estaban borrados, o,
   * con la copia de otra persona, los que este móvil ya tiene y sus ajustes,
   * que no se tocan.
   */
  sinCambios: number;
};

export type ResumenDeImportacion = {
  entrenos: Cuenta;
  ejercicios: Cuenta;
  ajustes: Cuenta;
  /**
   * De quién es la copia, comparada con este móvil: «misma» si es su persona
   * o una que ya aceptó como suya, y «desconocida» si este móvil aún no tiene
   * persona.
   */
  persona: 'misma' | 'otra' | 'desconocida';
  /**
   * Hay que preguntar si la copia es de la persona de este móvil antes de
   * importarla: no es «misma». También en un móvil sin datos o sin persona:
   * si no preguntara, recordaría como suya la persona de la copia de un amigo
   * y tomaría sus ajustes, y las copias siguientes del amigo entrarían en este
   * móvil sin preguntar.
   */
  preguntar: boolean;
};

type Sellada = { modificado: number; borrado: number };
type Decision = { escribir: boolean; efecto: keyof Cuenta };

/** Qué pasa con una fila de la copia frente a la del móvil: gana el sello mayor. */
function decidir(local: Sellada | undefined, enCopia: Sellada): Decision {
  if (local !== undefined && enCopia.modificado <= local.modificado) {
    return { escribir: false, efecto: 'sinCambios' };
  }
  const antes = local !== undefined && local.borrado === 0;
  const despues = enCopia.borrado === 0;
  const efecto = antes ? (despues ? 'actualizados' : 'borrados') : despues ? 'nuevos' : 'sinCambios';
  return { escribir: true, efecto };
}

const cuentaVacia = (): Cuenta => ({ nuevos: 0, actualizados: 0, borrados: 0, sinCambios: 0 });

type Plan = {
  /** El resumen si la copia es de la persona del móvil, con sus ajustes. */
  resumen: ResumenDeImportacion;
  /** Lo que cambia si la copia no es suya: solo entra lo que el móvil no tiene, y ningún ajuste. */
  cuentasSiNo: Pick<ResumenDeImportacion, 'entrenos' | 'ejercicios' | 'ajustes'>;
  ejercicios: { ejercicio: EjercicioDeCopia; existe: boolean }[];
  entrenos: { entreno: EntrenoDeCopia; existe: boolean }[];
  ajustes: Copia['ajustes'];
  personaDelMovil: string | undefined;
  /** Las otras personas que este móvil ya aceptó como suyas. */
  otrasSuyas: string[];
};

/**
 * Qué haría la importación, sin escribir nada. Comprueba también que la
 * copia solo use disciplinas y ejercicios que existen en este móvil o en la
 * propia copia: si no, es de una Quimera más nueva o está dañada.
 */
async function planear(l: Lectura, copia: Copia): Promise<Plan> {
  const disciplinas = new Set((await l.getAllAsync<{ id: string }>('SELECT id FROM disciplina', {})).map((d) => d.id));
  const ejerciciosDelMovil = new Map(
    (await l.getAllAsync<Sellada & { id: string; propio: number }>('SELECT id, propio, modificado, borrado FROM ejercicio', {})).map(
      (e) => [e.id, e],
    ),
  );
  const conocidos = new Set([...ejerciciosDelMovil.keys(), ...copia.ejercicios.map((e) => e.id)]);
  const mas = copia.base > MIGRACIONES.length || copia.catalogo > CATALOGO_VERSION;
  for (const entreno of copia.entrenos) {
    if (!disciplinas.has(entreno.disciplina)) {
      if (mas) throw new CopiaMasNueva();
      throw new CopiaNoValida(`La copia está dañada: la disciplina ${entreno.disciplina} no existe.`);
    }
    for (const serie of entreno.bloques.flatMap((b) => b.series)) {
      if (!conocidos.has(serie.ejercicio_id)) {
        if (mas) throw new CopiaMasNueva();
        throw new CopiaNoValida(`La copia está dañada: el ejercicio ${serie.ejercicio_id} no existe.`);
      }
    }
  }

  const resumen: ResumenDeImportacion = {
    entrenos: cuentaVacia(),
    ejercicios: cuentaVacia(),
    ajustes: cuentaVacia(),
    persona: 'desconocida',
    preguntar: false,
  };

  const ejercicios: Plan['ejercicios'] = [];
  // Con la copia de otra persona, lo que el móvil ya tiene, también lo borrado, no cambia.
  const cuentasSiNo: Plan['cuentasSiNo'] = { entrenos: cuentaVacia(), ejercicios: cuentaVacia(), ajustes: cuentaVacia() };
  for (const ejercicio of copia.ejercicios) {
    const local = ejerciciosDelMovil.get(ejercicio.id);
    if (local !== undefined && local.propio === 0) {
      throw new CopiaNoValida(`La copia está dañada: el ejercicio ${ejercicio.id} es del catálogo.`);
    }
    const { escribir, efecto } = decidir(local, ejercicio);
    resumen.ejercicios[efecto]++;
    cuentasSiNo.ejercicios[local === undefined ? efecto : 'sinCambios']++;
    if (escribir) ejercicios.push({ ejercicio, existe: local !== undefined });
  }

  const entrenosDelMovil = new Map(
    (await l.getAllAsync<Sellada & { id: string }>('SELECT id, modificado, borrado FROM entreno', {})).map((e) => [e.id, e]),
  );
  const entrenos: Plan['entrenos'] = [];
  for (const entreno of copia.entrenos) {
    const local = entrenosDelMovil.get(entreno.id);
    const { escribir, efecto } = decidir(local, entreno);
    resumen.entrenos[efecto]++;
    cuentasSiNo.entrenos[local === undefined ? efecto : 'sinCambios']++;
    if (escribir) entrenos.push({ entreno, existe: local !== undefined });
  }

  const ajustesDelMovil = new Map(
    (await l.getAllAsync<{ clave: string; modificado: number }>("SELECT clave, modificado FROM ajuste WHERE clave NOT GLOB 'local.*'", {})).map(
      (a) => [a.clave, a],
    ),
  );
  const ajustes: Plan['ajustes'] = [];
  for (const ajuste of copia.ajustes) {
    const local = ajustesDelMovil.get(ajuste.clave);
    const { escribir, efecto } = decidir(local === undefined ? undefined : { ...local, borrado: 0 }, { ...ajuste, borrado: 0 });
    resumen.ajustes[efecto]++;
    if (escribir) ajustes.push(ajuste);
  }

  const leida = await leerAjuste(l, PERSONA);
  const personaDelMovil = typeof leida === 'string' ? leida : undefined;
  const guardadas = await leerAjuste(l, OTRAS_SUYAS);
  const otrasSuyas = Array.isArray(guardadas) ? guardadas.filter((una): una is string => typeof una === 'string') : [];
  const esLaMisma = copia.persona === personaDelMovil || otrasSuyas.includes(copia.persona);
  resumen.persona = personaDelMovil === undefined ? 'desconocida' : esLaMisma ? 'misma' : 'otra';
  resumen.preguntar = resumen.persona !== 'misma';

  cuentasSiNo.ajustes.sinCambios = copia.ajustes.length;

  return { resumen, cuentasSiNo, ejercicios, entrenos, ajustes, personaDelMovil, otrasSuyas };
}

/**
 * Si la copia es de la persona de este móvil: lo que se contestó, o sí, si es
 * la misma persona. Lanza un error si había que preguntar y no se hizo.
 */
function esDeLaPersona(plan: Plan, esMia: boolean | undefined): boolean {
  if (esMia !== undefined) return esMia;
  if (plan.resumen.preguntar) {
    throw new Error('Antes de importar hay que preguntar si la copia es de la persona de este móvil.');
  }
  return true;
}

/**
 * El resumen según lo contestado: con la copia de otra persona, solo entra lo
 * que el móvil no tiene, y ningún ajuste.
 */
function resumenSegun(plan: Plan, esMia: boolean): ResumenDeImportacion {
  if (esMia) return plan.resumen;
  return { ...plan.resumen, ...plan.cuentasSiNo };
}

/**
 * Lo que cambiaría al importar la copia, sin escribir nada, para enseñarlo
 * antes de confirmar. Con esMia: false, cuenta solo lo que entraría de la
 * copia de otra persona: lo que el móvil no tiene, y ningún ajuste; sin
 * decirlo, cuenta como si la copia fuera de la persona del móvil.
 */
export async function resumirImportacion(l: Lectura, copia: Copia, { esMia }: { esMia?: boolean } = {}): Promise<ResumenDeImportacion> {
  const plan = await planear(l, copia);
  return resumenSegun(plan, esMia ?? true);
}

export type OpcionesDeImportar = {
  ahora: number;
  /** Para la persona del móvil, si aún no tiene. */
  nuevoId: () => string;
  /**
   * Si la copia es de la persona de este móvil, cuando el resumen pide
   * preguntarlo. Si lo es, el móvil toma sus ajustes más recientes y recuerda
   * la persona de la copia como suya; si no, solo entran los entrenos y los
   * ejercicios propios que el móvil no tiene, y ningún ajuste. En los dos
   * casos, si el móvil aún no tenía persona, estrena la suya.
   */
  esMia?: boolean;
};

/**
 * Importa una copia ya leída con leerCopia, dentro de una sola transacción, y
 * devuelve lo que ha cambiado. Si la copia es de la persona del móvil, cada
 * entreno de la copia con un sello mayor que el del móvil sustituye entero al
 * del móvil, con sus bloques y sus series, y conserva su sello y su marca de
 * borrado. Si no, solo entran los que el móvil no tiene, con su marca de
 * borrado y el sello mínimo.
 *
 * Los entrenos se escriben por tandas, con json_each: cuatro sentencias por
 * cada cien, en lugar de una por cada serie, que en el móvil serían decenas de
 * miles de viajes al código nativo.
 *
 * No comprueba que cada serie lleve solo lo que mide su ejercicio, como hace
 * guardarEntrenoEn: la copia viene de otra Quimera que ya lo comprobó, y si un
 * ejercicio propio cambió entre medias, es mejor recuperar los entrenos que
 * no poder importar ninguno.
 */
export async function importarCopiaEn(
  tx: Transaccion,
  copia: Copia,
  { ahora, nuevoId, esMia }: OpcionesDeImportar,
): Promise<ResumenDeImportacion> {
  const plan = await planear(tx, copia);
  const suya = esDeLaPersona(plan, esMia);
  // Con la copia de otra persona, lo que el móvil ya tiene no se toca, y lo
  // que entra lleva el sello mínimo: así pierde frente a cualquier versión de
  // los móviles de esta persona, también de uno que aún no lo tenga.
  const ejercicios = plan.ejercicios.filter(({ existe }) => suya || !existe);
  const entrenosAEscribir = plan.entrenos
    .filter(({ existe }) => suya || !existe)
    .map(({ entreno }) => (suya ? entreno : { ...entreno, modificado: SELLO_MINIMO }));

  for (const { ejercicio, existe } of ejercicios) {
    const valores = p({
      id: ejercicio.id,
      nombre: ejercicio.nombre,
      grupo: ejercicio.grupo,
      repeticiones: ejercicio.usa_repeticiones,
      peso: ejercicio.usa_peso,
      tiempo: ejercicio.usa_tiempo,
      distancia: ejercicio.usa_distancia,
      calorias: ejercicio.usa_calorias,
      modificado: suya ? ejercicio.modificado : SELLO_MINIMO,
      borrado: ejercicio.borrado,
    });
    await tx.runAsync(
      existe
        ? `UPDATE ejercicio SET nombre = :nombre, grupo = :grupo, usa_repeticiones = :repeticiones, usa_peso = :peso,
             usa_tiempo = :tiempo, usa_distancia = :distancia, usa_calorias = :calorias,
             modificado = :modificado, borrado = :borrado
           WHERE id = :id AND propio = 1`
        : `INSERT INTO ejercicio (id, nombre, grupo, usa_repeticiones, usa_peso, usa_tiempo, usa_distancia,
                                  usa_calorias, propio, modificado, borrado)
           VALUES (:id, :nombre, :grupo, :repeticiones, :peso, :tiempo, :distancia, :calorias, 1, :modificado, :borrado)`,
      valores,
    );
  }

  for (let i = 0; i < entrenosAEscribir.length; i += TANDA) {
    // Una lista plana por tabla, con un solo json_each en cada sentencia. Si
    // los bloques y las series se sacaran de los entrenos enteros, SQLite
    // volvería a leer el entreno entero en cada fila, y el tiempo crecería con
    // el cuadrado de sus series.
    const tanda = entrenosAEscribir.slice(i, i + TANDA);
    const entrenos = tanda.map(({ bloques: _, ...entreno }) => entreno);
    const bloques = tanda.flatMap((e) =>
      e.bloques.map(({ series: _, ...b }, n) => ({ ...b, entreno_id: e.id, orden: n + 1, modificado: e.modificado, borrado: e.borrado })),
    );
    const series = tanda.flatMap((e) =>
      e.bloques.flatMap((b) => b.series.map((s) => ({ ...s, bloque_id: b.id, modificado: e.modificado, borrado: e.borrado }))),
    );
    const valores = p({ entrenos: JSON.stringify(entrenos) });
    // Primero fuera los bloques de los que ya estaban, con la cascada a sus
    // series: así el disparador de la marca de borrado no tiene hijas que
    // marcar, y las de la copia entran después con su propio sello.
    await tx.runAsync(
      "DELETE FROM bloque WHERE entreno_id IN (SELECT e.value ->> '$.id' FROM json_each(:entrenos) AS e)",
      valores,
    );
    await tx.runAsync(
      `INSERT INTO entreno (id, disciplina, fecha, hora, duracion_ms, esfuerzo, notas, modificado, borrado)
       SELECT e.value ->> '$.id', e.value ->> '$.disciplina', e.value ->> '$.fecha', e.value ->> '$.hora',
              e.value ->> '$.duracion_ms', e.value ->> '$.esfuerzo', e.value ->> '$.notas',
              e.value ->> '$.modificado', e.value ->> '$.borrado'
       FROM json_each(:entrenos) AS e WHERE true
       ON CONFLICT (id) DO UPDATE SET
         disciplina = excluded.disciplina, fecha = excluded.fecha, hora = excluded.hora,
         duracion_ms = excluded.duracion_ms, esfuerzo = excluded.esfuerzo, notas = excluded.notas,
         modificado = excluded.modificado, borrado = excluded.borrado`,
      valores,
    );
    await tx.runAsync(
      `INSERT INTO bloque (id, entreno_id, orden, metros_corridos, tiempo_ms, descanso_ms, modificado, borrado)
       SELECT b.value ->> '$.id', b.value ->> '$.entreno_id', b.value ->> '$.orden', b.value ->> '$.metros_corridos',
              b.value ->> '$.tiempo_ms', b.value ->> '$.descanso_ms', b.value ->> '$.modificado', b.value ->> '$.borrado'
       FROM json_each(:bloques) AS b`,
      p({ bloques: JSON.stringify(bloques) }),
    );
    await tx.runAsync(
      `INSERT INTO serie (id, bloque_id, ronda, orden, ejercicio_id, repeticiones, peso_g, tiempo_ms,
                          distancia_m, calorias, descanso_ms, modificado, borrado)
       SELECT s.value ->> '$.id', s.value ->> '$.bloque_id', s.value ->> '$.ronda', s.value ->> '$.orden',
              s.value ->> '$.ejercicio_id', s.value ->> '$.repeticiones', s.value ->> '$.peso_g',
              s.value ->> '$.tiempo_ms', s.value ->> '$.distancia_m', s.value ->> '$.calorias',
              s.value ->> '$.descanso_ms', s.value ->> '$.modificado', s.value ->> '$.borrado'
       FROM json_each(:series) AS s`,
      p({ series: JSON.stringify(series) }),
    );
  }

  // Un móvil sin persona estrena la suya, sea la copia suya o no: nunca toma la de una copia.
  if (plan.personaDelMovil === undefined) {
    await ponerAjusteEn(tx, PERSONA, nuevoId(), ahora);
  }
  if (suya) {
    for (const ajuste of plan.ajustes) {
      await tx.runAsync(
        `INSERT INTO ajuste (clave, valor, modificado) VALUES (:clave, :valor, :modificado)
         ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor, modificado = excluded.modificado`,
        p({ clave: ajuste.clave, valor: JSON.stringify(ajuste.valor), modificado: ajuste.modificado }),
      );
    }
    // Recuerda la persona de la copia como suya, sin repetidas: sus copias ya no preguntarán.
    if (copia.persona !== plan.personaDelMovil && !plan.otrasSuyas.includes(copia.persona)) {
      await ponerAjusteEn(tx, OTRAS_SUYAS, [...new Set([...plan.otrasSuyas, copia.persona])].sort(), ahora);
    }
  }
  return resumenSegun(plan, suya);
}

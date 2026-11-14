import type { Medida } from '@/datos/catalogo';
import type { Ejercicio } from '@/datos/ejercicios';
import type { Bloque, Entreno, Serie } from '@/datos/entrenos';
import { esFecha, fechaLocal, horaLocal } from '@/datos/fechas';
import { gramosATexto, textoAGramos } from '@/datos/unidades';

// El entreno de gimnasio mientras se apunta. Los números van como texto
// mientras se escriben, tal cual los teclea la persona, y solo se convierten
// al guardar: así un «62,» a medio escribir no se pierde ni se redondea.
//
// Todo lo de aquí son funciones sin efectos: reciben el entreno y devuelven
// otro. La pantalla las usa y guarda el resultado como borrador.

export type SerieEnEdicion = {
  id: string;
  repeticiones: string;
  peso: string;
  segundos: string;
  /**
   * Cuándo se marcó como hecha, en milisegundos, o null. Entre la primera y la
   * última marca se mide la duración de un entreno apuntado en directo.
   */
  hecha: number | null;
};

export type BloqueEnEdicion = { id: string; ejercicioId: string; series: SerieEnEdicion[] };

export type EntrenoEnEdicion = {
  /** La forma del borrador. Si cambia, los borradores viejos se descartan. */
  formato: 1;
  id: string;
  /** El sello del entreno guardado que se corrige, o null si es nuevo. */
  selloLeido: number | null;
  fecha: string;
  hora: string | null;
  bloques: BloqueEnEdicion[];
  /** Los minutos tecleados, o '' si no se han tecleado. */
  minutos: string;
  esfuerzo: number | null;
  notas: string;
};

export type CampoDeSerie = 'repeticiones' | 'peso' | 'segundos';

/** Dónde se guarda el entreno de gimnasio a medias, en este móvil. */
export const CLAVE_DEL_BORRADOR = 'local.borrador.gimnasio';

/** Si hay algo que guardar como borrador; uno recién abierto no lo tiene. */
export function tieneAlgo(e: EntrenoEnEdicion): boolean {
  return e.bloques.length > 0 || e.esfuerzo !== null || e.minutos.trim() !== '' || e.notas.trim() !== '';
}

/** El paso de los botones: un disco por lado, una repetición, cinco segundos. */
export const PASOS: Record<CampoDeSerie, number> = { peso: 2.5, repeticiones: 1, segundos: 5 };

/** Hasta dónde llegan los botones, que son los límites de la base: 1000 kg, 10000 repeticiones y un día. */
const MAXIMOS: Record<CampoDeSerie, number> = { peso: 1000, repeticiones: 10_000, segundos: 86_400 };

/** El peso más alto que admite la base, en gramos. */
const PESO_MAXIMO_G = MAXIMOS.peso * 1000;

/** Más de esto entre la primera serie hecha y la última no es un entreno, es un borrador retomado otro día. */
const MAXIMO_MEDIDO_MS = 4 * 3_600_000;

export function entrenoNuevo(nuevoId: () => string, ahora: Date): EntrenoEnEdicion {
  return {
    formato: 1,
    id: nuevoId(),
    selloLeido: null,
    fecha: fechaLocal(ahora),
    hora: horaLocal(ahora),
    bloques: [],
    minutos: '',
    esfuerzo: null,
    notas: '',
  };
}

const serieVacia = (id: string): SerieEnEdicion => ({ id, repeticiones: '', peso: '', segundos: '', hecha: null });

/**
 * Si todavía no se ha apuntado nada, el entreno empieza ahora: un editor que
 * se abrió ayer y se quedó vacío no apunta el entreno de hoy con la fecha de
 * ayer.
 */
export function empezarAhoraSiVacio(e: EntrenoEnEdicion, ahora: Date): EntrenoEnEdicion {
  return tieneAlgo(e) ? e : { ...e, fecha: fechaLocal(ahora), hora: horaLocal(ahora) };
}

/** Añade un ejercicio al final, con una serie vacía para empezar a apuntar. */
export function anadirEjercicio(
  e: EntrenoEnEdicion,
  ejercicioId: string,
  idDelBloque: string,
  idDeLaSerie: string,
): EntrenoEnEdicion {
  return { ...e, bloques: [...e.bloques, { id: idDelBloque, ejercicioId, series: [serieVacia(idDeLaSerie)] }] };
}

function cambiarBloque(
  e: EntrenoEnEdicion,
  bloqueId: string,
  cambio: (bloque: BloqueEnEdicion) => BloqueEnEdicion,
): EntrenoEnEdicion {
  return { ...e, bloques: e.bloques.map((bloque) => (bloque.id === bloqueId ? cambio(bloque) : bloque)) };
}

function cambiarLaSerie(
  e: EntrenoEnEdicion,
  bloqueId: string,
  serieId: string,
  cambio: (serie: SerieEnEdicion, anterior: SerieEnEdicion | undefined) => SerieEnEdicion,
): EntrenoEnEdicion {
  return cambiarBloque(e, bloqueId, (bloque) => ({
    ...bloque,
    series: bloque.series.map((serie, i) => (serie.id === serieId ? cambio(serie, bloque.series[i - 1]) : serie)),
  }));
}

export function anadirSerie(e: EntrenoEnEdicion, bloqueId: string, idDeLaSerie: string): EntrenoEnEdicion {
  return cambiarBloque(e, bloqueId, (bloque) => ({ ...bloque, series: [...bloque.series, serieVacia(idDeLaSerie)] }));
}

export function cambiarSerie(
  e: EntrenoEnEdicion,
  bloqueId: string,
  serieId: string,
  cambios: Partial<Record<CampoDeSerie, string>>,
): EntrenoEnEdicion {
  return cambiarLaSerie(e, bloqueId, serieId, (serie) => ({ ...serie, ...cambios }));
}

/** Copia en una serie los números de la anterior del mismo ejercicio: lo que se repite casi siempre. */
export function igualQueLaAnterior(e: EntrenoEnEdicion, bloqueId: string, serieId: string): EntrenoEnEdicion {
  return cambiarLaSerie(e, bloqueId, serieId, (serie, anterior) =>
    anterior === undefined
      ? serie
      : { ...serie, repeticiones: anterior.repeticiones, peso: anterior.peso, segundos: anterior.segundos },
  );
}

/**
 * Sube o baja un campo un paso, sin bajar de cero. Desde un campo vacío, el
 * primer toque de «más» pone el paso.
 */
export function pasoDeSerie(
  e: EntrenoEnEdicion,
  bloqueId: string,
  serieId: string,
  campo: CampoDeSerie,
  sentido: 1 | -1,
): EntrenoEnEdicion {
  return cambiarLaSerie(e, bloqueId, serieId, (serie) => {
    const nuevo = darUnPaso(serie[campo], campo, sentido);
    return nuevo === null ? serie : { ...serie, [campo]: nuevo };
  });
}

function darUnPaso(texto: string, campo: CampoDeSerie, sentido: 1 | -1): string | null {
  if (campo === 'peso') {
    const gramos = texto.trim() === '' ? 0 : textoAGramos(texto);
    if (gramos === null) {
      return null;
    }
    const nuevo = Math.min(PESO_MAXIMO_G, Math.max(0, gramos + sentido * PASOS.peso * 1000));
    return nuevo === 0 ? '' : gramosATexto(nuevo);
  }
  const actual = texto.trim() === '' ? 0 : Number(texto);
  if (!Number.isInteger(actual)) {
    return null;
  }
  const nuevo = Math.min(MAXIMOS[campo], Math.max(0, actual + sentido * PASOS[campo]));
  return nuevo === 0 ? '' : String(nuevo);
}

export function marcarHecha(e: EntrenoEnEdicion, bloqueId: string, serieId: string, cuando: number | null): EntrenoEnEdicion {
  return cambiarLaSerie(e, bloqueId, serieId, (serie) => ({ ...serie, hecha: cuando }));
}

export function quitarSerie(e: EntrenoEnEdicion, bloqueId: string, serieId: string): EntrenoEnEdicion {
  return cambiarBloque(e, bloqueId, (bloque) => ({ ...bloque, series: bloque.series.filter((s) => s.id !== serieId) }));
}

export function quitarBloque(e: EntrenoEnEdicion, bloqueId: string): EntrenoEnEdicion {
  return { ...e, bloques: e.bloques.filter((bloque) => bloque.id !== bloqueId) };
}

export function cambiarEntreno(
  e: EntrenoEnEdicion,
  cambios: Partial<Pick<EntrenoEnEdicion, 'fecha' | 'hora' | 'minutos' | 'esfuerzo' | 'notas'>>,
): EntrenoEnEdicion {
  return { ...e, ...cambios };
}

/**
 * Los minutos entre la primera serie marcada como hecha y la última, si hay
 * dos o más y no pasan de cuatro horas. Es un suelo: no cuenta el calentamiento
 * ni la primera serie, que ya estaban hechos al marcarla.
 */
export function minutosMedidos(e: EntrenoEnEdicion): number | null {
  const marcas = e.bloques
    .flatMap((bloque) => bloque.series.map((serie) => serie.hecha))
    .filter((hecha): hecha is number => hecha !== null)
    .sort((a, b) => a - b);
  if (marcas.length < 2) {
    return null;
  }
  const ms = marcas[marcas.length - 1] - marcas[0];
  return ms > MAXIMO_MEDIDO_MS ? null : Math.max(1, Math.round(ms / 60_000));
}

/** Una serie sin nada escrito: no se guarda, porque un ejercicio saltado no es una serie de 0 kg. */
export function serieVaciaDeDatos(serie: SerieEnEdicion): boolean {
  return serie.repeticiones.trim() === '' && serie.peso.trim() === '' && serie.segundos.trim() === '';
}

/**
 * Menos minutos que estos entre la primera serie hecha y la última no se dan
 * por buenos como duración: es lo que pasa al apuntar después y marcar las
 * series seguidas. Entonces se pide escribirla.
 */
export const MINUTOS_MEDIDOS_MINIMOS = 10;

/** «1 minuto» o «N minutos». */
export function textoDeMinutos(minutos: number): string {
  return minutos === 1 ? '1 minuto' : `${minutos} minutos`;
}

export type ResultadoDeValidar = { entreno: Entreno; errores?: undefined } | { entreno?: undefined; errores: string[] };

/**
 * El entreno listo para guardar, o la lista de lo que falta para poder
 * guardarlo, dicho para la persona. Las series vacías y los ejercicios sin
 * ninguna serie escrita se quedan fuera. Los avisos numeran las series como
 * la pantalla, contando también las vacías, y comprueban los mismos límites
 * que la base, para que nunca llegue a ella un dato que vaya a rechazar.
 */
export function validar(
  e: EntrenoEnEdicion,
  ejercicios: ReadonlyMap<string, Ejercicio>,
  hoy: string,
): ResultadoDeValidar {
  const errores: string[] = [];
  const bloques: Bloque[] = [];
  const veces = new Map<string, number>();
  for (const bloque of e.bloques) veces.set(bloque.ejercicioId, (veces.get(bloque.ejercicioId) ?? 0) + 1);
  const vistos = new Map<string, number>();

  for (const bloque of e.bloques) {
    const ejercicio = ejercicios.get(bloque.ejercicioId);
    const visto = (vistos.get(bloque.ejercicioId) ?? 0) + 1;
    vistos.set(bloque.ejercicioId, visto);
    const nombre = ejercicio?.nombre ?? bloque.ejercicioId;
    // Si el mismo ejercicio sale dos veces, el aviso dice cuál.
    const cual = (veces.get(bloque.ejercicioId) ?? 1) > 1 ? `${nombre} (el ${visto}.º)` : nombre;
    const mide = (medida: Medida) => ejercicio?.mide.includes(medida) ?? false;
    const series: Serie[] = [];
    bloque.series.forEach((serie, i) => {
      if (serieVaciaDeDatos(serie)) return;
      const donde = `${cual}, serie ${i + 1}`;
      const repeticiones = leerEntero(serie.repeticiones, 1, 10_000);
      const segundos = leerEntero(serie.segundos, 1, 86_400);
      const pesoG = serie.peso.trim() === '' ? null : textoAGramos(serie.peso);
      if (repeticiones === 'no se entiende') errores.push(`${donde}: las repeticiones «${serie.repeticiones}» no se entienden.`);
      if (repeticiones === 'fuera') errores.push(`${donde}: las repeticiones van de 1 a 10000.`);
      if (segundos === 'no se entiende') errores.push(`${donde}: los segundos «${serie.segundos}» no se entienden.`);
      if (segundos === 'fuera') errores.push(`${donde}: los segundos van de 1 a 86400.`);
      if (pesoG === null && serie.peso.trim() !== '') errores.push(`${donde}: el peso «${serie.peso}» no se entiende.`);
      if (pesoG === 0) errores.push(`${donde}: un peso de 0 se deja vacío.`);
      if (pesoG !== null && pesoG > PESO_MAXIMO_G) errores.push(`${donde}: el peso «${serie.peso}» pasa de 1000 kg.`);
      const reps = typeof repeticiones === 'number' ? repeticiones : null;
      const segs = typeof segundos === 'number' ? segundos : null;
      if (reps !== null && !mide('repeticiones')) errores.push(`${donde}: ${nombre} no lleva repeticiones.`);
      if (pesoG && !mide('peso')) errores.push(`${donde}: ${nombre} no lleva peso.`);
      if (segs !== null && !mide('tiempo')) errores.push(`${donde}: ${nombre} no lleva segundos.`);
      if (repeticiones === null && segundos === null) {
        errores.push(mide('tiempo') ? `${donde}: faltan los segundos.` : `${donde}: faltan las repeticiones.`);
      }
      series.push({
        id: serie.id,
        ronda: series.length + 1,
        orden: 1,
        ejercicioId: bloque.ejercicioId,
        repeticiones: reps,
        pesoG: pesoG || null,
        tiempoMs: segs === null ? null : segs * 1000,
        distanciaM: null,
        calorias: null,
        descansoMs: null,
      });
    });
    if (series.length > 0) {
      bloques.push({ id: bloque.id, metrosCorridos: null, tiempoMs: null, descansoMs: null, series });
    }
  }

  if (bloques.length === 0) errores.push('Apunta al menos una serie.');
  if (e.fecha < '2000-01-01') errores.push('La fecha es anterior al año 2000.');
  if (e.fecha > hoy) errores.push('La fecha es de un día que todavía no ha llegado.');
  if (e.esfuerzo === null) errores.push('Falta el esfuerzo, del 1 al 10.');
  if (e.esfuerzo !== null && !(Number.isInteger(e.esfuerzo) && e.esfuerzo >= 1 && e.esfuerzo <= 10)) {
    errores.push('El esfuerzo va del 1 al 10.');
  }

  let minutos: number | null = null;
  if (e.minutos.trim() === '') {
    const medidos = minutosMedidos(e);
    if (medidos !== null && medidos >= MINUTOS_MEDIDOS_MINIMOS) {
      minutos = medidos;
    } else {
      errores.push(
        medidos === null
          ? 'Falta la duración, en minutos.'
          : `Falta la duración: las series marcadas como hechas solo cubren ${textoDeMinutos(medidos)}. Escríbela.`,
      );
    }
  } else {
    const escritos = leerEntero(e.minutos, 1, 2880);
    if (escritos === 'no se entiende') errores.push(`La duración «${e.minutos}» no se entiende: van minutos enteros.`);
    else if (escritos === 'fuera') errores.push('La duración va de 1 minuto a 48 horas (2880 minutos).');
    else minutos = escritos;
  }

  if (errores.length > 0 || e.esfuerzo === null || minutos === null) {
    return { errores };
  }
  return {
    entreno: {
      id: e.id,
      disciplina: 'gimnasio',
      fecha: e.fecha,
      hora: e.hora,
      duracionMs: minutos * 60_000,
      esfuerzo: e.esfuerzo,
      notas: e.notas.trim() === '' ? null : e.notas,
      bloques,
    },
  };
}

/**
 * Un entero escrito entre dos límites: null si está vacío, «no se entiende» si
 * no es un entero y «fuera» si se sale de los límites.
 */
function leerEntero(texto: string, minimo: number, maximo: number): number | null | 'no se entiende' | 'fuera' {
  const limpio = texto.trim();
  if (limpio === '') {
    return null;
  }
  if (!/^[0-9]+$/.test(limpio)) {
    return 'no se entiende';
  }
  const n = Number(limpio);
  return n >= minimo && n <= maximo ? n : 'fuera';
}

/**
 * Un borrador guardado, si tiene la forma de ahora. Se reconstruye campo a
 * campo en vez de fiarse del JSON: lo que no casa lo descarta entero, para no
 * abrir el editor con un entreno a medio leer.
 */
export function leerBorrador(valor: unknown): EntrenoEnEdicion | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const b = valor as Record<string, unknown>;
  const texto = (x: unknown): x is string => typeof x === 'string';
  const numeroONulo = (x: unknown): x is number | null => x === null || (typeof x === 'number' && Number.isFinite(x));
  if (b.formato !== 1 || !texto(b.id) || !numeroONulo(b.selloLeido) || !texto(b.fecha) || !esFecha(b.fecha)) return null;
  if (!(b.hora === null || (texto(b.hora) && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(b.hora)))) return null;
  if (!texto(b.minutos) || !texto(b.notas) || !numeroONulo(b.esfuerzo)) return null;
  if (!Array.isArray(b.bloques)) return null;
  const bloques: BloqueEnEdicion[] = [];
  for (const crudo of b.bloques) {
    const bloque = crudo as Record<string, unknown>;
    if (typeof bloque !== 'object' || bloque === null || !texto(bloque.id) || !texto(bloque.ejercicioId)) return null;
    if (!Array.isArray(bloque.series)) return null;
    const series: SerieEnEdicion[] = [];
    for (const cruda of bloque.series) {
      const serie = cruda as Record<string, unknown>;
      if (typeof serie !== 'object' || serie === null || !texto(serie.id)) return null;
      if (!texto(serie.repeticiones) || !texto(serie.peso) || !texto(serie.segundos) || !numeroONulo(serie.hecha)) return null;
      series.push({
        id: serie.id,
        repeticiones: serie.repeticiones,
        peso: serie.peso,
        segundos: serie.segundos,
        hecha: serie.hecha,
      });
    }
    bloques.push({ id: bloque.id, ejercicioId: bloque.ejercicioId, series });
  }
  return {
    formato: 1,
    id: b.id,
    selloLeido: b.selloLeido,
    fecha: b.fecha,
    hora: b.hora,
    bloques,
    minutos: b.minutos,
    esfuerzo: b.esfuerzo,
    notas: b.notas,
  };
}

/** Las palabras del esfuerzo, por tramos, como en Quimera-web. */
export function palabraDelEsfuerzo(esfuerzo: number): string {
  if (esfuerzo <= 2) return 'muy suave';
  if (esfuerzo <= 4) return 'suave';
  if (esfuerzo <= 6) return 'moderado';
  if (esfuerzo <= 8) return 'duro';
  if (esfuerzo === 9) return 'muy duro';
  return 'máximo';
}

import type { Medida } from '@/datos/catalogo';
import type { Ejercicio } from '@/datos/ejercicios';
import { huellaDelEntreno, type Bloque, type Entreno, type EntrenoGuardado, type Serie } from '@/datos/entrenos';
import { esFecha, fechaLocal, horaLocal } from '@/datos/fechas';
import { gramosATexto, metrosATexto, textoAGramos, textoAMetros } from '@/datos/unidades';

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

/**
 * Uno o más ejercicios con sus vueltas. Con uno, cada vuelta es una serie. Con
 * dos o más es una superserie: cada vuelta lleva una serie de cada ejercicio,
 * en el orden de ejercicioIds, hechas seguidas y sin descanso entre ellas.
 */
export type BloqueDeEjercicios = {
  tipo: 'ejercicios';
  id: string;
  ejercicioIds: string[];
  /** vueltas[v][c] es la serie del ejercicio c en la vuelta v. */
  vueltas: SerieEnEdicion[][];
  /** Los segundos de descanso entre series, o entre vueltas en una superserie, o '' si no se apuntan. */
  descansoEntreSeries: string;
  /** Los segundos de descanso hasta el bloque siguiente, o ''. */
  descansoDespues: string;
};

/**
 * Un bloque de carrera, como el calentamiento en cinta. Lo corrido se guarda
 * en el bloque, sin series, y contará para las zapatillas.
 */
export type BloqueDeCarrera = {
  tipo: 'carrera';
  id: string;
  /** La distancia en kilómetros, como se escribe: «2,5». */
  kilometros: string;
  /** Los minutos enteros que duró. */
  minutos: string;
  /** Los segundos de descanso hasta el bloque siguiente, o ''. */
  descansoDespues: string;
};

export type BloqueEnEdicion = BloqueDeEjercicios | BloqueDeCarrera;

export type EntrenoEnEdicion = {
  /**
   * La forma del borrador. Los de la forma 1, de antes de las superseries, se
   * convierten al leerlos; uno de una forma desconocida se aparta.
   */
  formato: 2;
  id: string;
  /** El sello del entreno guardado que se corrige, o null si es nuevo. */
  selloLeido: number | null;
  fecha: string;
  hora: string | null;
  bloques: BloqueEnEdicion[];
  /** Los minutos tecleados, o '' si no se han tecleado. */
  minutos: string;
  /**
   * Al corregir, la duración guardada y los minutos con que se enseña. Si los
   * minutos no se tocan, se guarda la de antes con sus milisegundos, porque el
   * editor solo escribe minutos enteros. Null en un entreno nuevo.
   */
  duracionLeida: { minutos: string; ms: number } | null;
  /**
   * Al corregir, la huella del entreno tal como se leyó. Si al guardar su sello
   * ha cambiado pero lo apuntado sigue igual, como después de borrarlo y
   * deshacer el borrado, la corrección se guarda encima. Null en uno nuevo.
   */
  huellaLeida: string | null;
  esfuerzo: number | null;
  notas: string;
};

export type CampoDeSerie = 'repeticiones' | 'peso' | 'segundos';
export type CampoDeDescanso = 'descansoEntreSeries' | 'descansoDespues';
export type CampoDeCarrera = 'kilometros' | 'minutos';

/** Dónde se guarda el entreno de gimnasio a medias, en este móvil. */
export const CLAVE_DEL_BORRADOR = 'local.borrador.gimnasio';

/**
 * Dónde se guarda, en este móvil, la corrección a medias de un entreno ya
 * guardado: una por entreno, aparte del entreno nuevo a medias. Sin guiones,
 * para que quepa en la clave de un ajuste con «.ilegible» detrás.
 */
export function claveDeCorreccion(id: string): string {
  return `local.correccion.${id.replace(/-/g, '')}`;
}

/** Si hay algo que guardar como borrador; uno recién abierto no lo tiene. */
export function tieneAlgo(e: EntrenoEnEdicion): boolean {
  return e.bloques.length > 0 || e.esfuerzo !== null || e.minutos.trim() !== '' || e.notas.trim() !== '';
}

/** El paso de los botones: un disco por lado, una repetición, cinco segundos. */
export const PASOS: Record<CampoDeSerie, number> = { peso: 2.5, repeticiones: 1, segundos: 5 };

/** El paso de los botones del descanso, en segundos. */
export const PASO_DEL_DESCANSO = 15;

/** El paso de los botones de la carrera: medio kilómetro, en metros, y un minuto. */
const PASOS_DE_CARRERA: Record<CampoDeCarrera, number> = { kilometros: 500, minutos: 1 };

/** Hasta dónde llegan los botones, que son los límites de la base: 1000 kg, 10000 repeticiones y un día. */
const MAXIMOS: Record<CampoDeSerie, number> = { peso: 1000, repeticiones: 10_000, segundos: 86_400 };

/** El peso más alto que admite la base, en gramos. */
const PESO_MAXIMO_G = MAXIMOS.peso * 1000;

/** El descanso más largo que admite la base: un día, en segundos. */
const DESCANSO_MAXIMO_S = 86_400;

/**
 * La carrera más larga que se admite: 100 km, en metros, y 48 horas, en
 * minutos. La base admite hasta 1000 km, pero más de 100 dentro de un entreno
 * de gimnasio es casi siempre una distancia escrita en metros.
 */
const MAXIMOS_DE_CARRERA: Record<CampoDeCarrera, number> = { kilometros: 100_000, minutos: 2880 };

/** Ni en cinta ni fuera se corre durante minutos a más de esto: una carrera más rápida es una distancia escrita en metros. */
const VELOCIDAD_MAXIMA_KMH = 30;

/** Más de esto entre la primera serie hecha y la última no es un entreno, es un borrador retomado otro día. */
const MAXIMO_MEDIDO_MS = 4 * 3_600_000;

export function entrenoNuevo(nuevoId: () => string, ahora: Date): EntrenoEnEdicion {
  return {
    formato: 2,
    id: nuevoId(),
    selloLeido: null,
    fecha: fechaLocal(ahora),
    hora: horaLocal(ahora),
    bloques: [],
    minutos: '',
    duracionLeida: null,
    huellaLeida: null,
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
  const bloque: BloqueDeEjercicios = {
    tipo: 'ejercicios',
    id: idDelBloque,
    ejercicioIds: [ejercicioId],
    vueltas: [[serieVacia(idDeLaSerie)]],
    descansoEntreSeries: '',
    descansoDespues: '',
  };
  return { ...e, bloques: [...e.bloques, bloque] };
}

/** Añade al final una carrera, como el calentamiento en cinta, vacía. */
export function anadirCarrera(e: EntrenoEnEdicion, idDelBloque: string): EntrenoEnEdicion {
  const bloque: BloqueDeCarrera = { tipo: 'carrera', id: idDelBloque, kilometros: '', minutos: '', descansoDespues: '' };
  return { ...e, bloques: [...e.bloques, bloque] };
}

function cambiarBloque(
  e: EntrenoEnEdicion,
  bloqueId: string,
  cambio: (bloque: BloqueEnEdicion) => BloqueEnEdicion,
): EntrenoEnEdicion {
  return { ...e, bloques: e.bloques.map((bloque) => (bloque.id === bloqueId ? cambio(bloque) : bloque)) };
}

function cambiarEjercicios(
  e: EntrenoEnEdicion,
  bloqueId: string,
  cambio: (bloque: BloqueDeEjercicios) => BloqueDeEjercicios,
): EntrenoEnEdicion {
  return cambiarBloque(e, bloqueId, (bloque) => (bloque.tipo === 'ejercicios' ? cambio(bloque) : bloque));
}

/** Cambia una serie. Su anterior es la del mismo ejercicio en la vuelta de antes. */
function cambiarLaSerie(
  e: EntrenoEnEdicion,
  bloqueId: string,
  serieId: string,
  cambio: (serie: SerieEnEdicion, anterior: SerieEnEdicion | undefined) => SerieEnEdicion,
): EntrenoEnEdicion {
  return cambiarEjercicios(e, bloqueId, (bloque) => ({
    ...bloque,
    vueltas: bloque.vueltas.map((vuelta, v) =>
      vuelta.map((serie, c) => (serie.id === serieId ? cambio(serie, bloque.vueltas[v - 1]?.[c]) : serie)),
    ),
  }));
}

/**
 * Añade una vuelta al final, con una serie vacía de cada ejercicio: en un
 * ejercicio suelto, una serie más. Lleva un identificador por ejercicio, en su
 * orden; si no son tantos como ejercicios, no hace nada.
 */
export function anadirVuelta(e: EntrenoEnEdicion, bloqueId: string, ids: string[]): EntrenoEnEdicion {
  return cambiarEjercicios(e, bloqueId, (bloque) =>
    ids.length === bloque.ejercicioIds.length ? { ...bloque, vueltas: [...bloque.vueltas, ids.map((id) => serieVacia(id))] } : bloque,
  );
}

export function cambiarSerie(
  e: EntrenoEnEdicion,
  bloqueId: string,
  serieId: string,
  cambios: Partial<Record<CampoDeSerie, string>>,
): EntrenoEnEdicion {
  return cambiarLaSerie(e, bloqueId, serieId, (serie) => ({ ...serie, ...cambios }));
}

/**
 * Copia en una serie los números de la anterior del mismo ejercicio, que en
 * una superserie es la de la vuelta de antes: lo que se repite casi siempre.
 */
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
    const nuevo =
      campo === 'peso'
        ? pasoConDecimales(serie.peso, PASOS.peso * 1000, PESO_MAXIMO_G, sentido, textoAGramos, gramosATexto)
        : pasoEntero(serie[campo], PASOS[campo], MAXIMOS[campo], sentido);
    return nuevo === null ? serie : { ...serie, [campo]: nuevo };
  });
}

/** Un entero un paso arriba o abajo, entre 0 y el máximo; el 0 se deja vacío. Null si el texto no es un entero. */
function pasoEntero(texto: string, paso: number, maximo: number, sentido: 1 | -1): string | null {
  const actual = texto.trim() === '' ? 0 : Number(texto);
  if (!Number.isInteger(actual)) {
    return null;
  }
  const nuevo = Math.min(maximo, Math.max(0, actual + sentido * paso));
  return nuevo === 0 ? '' : String(nuevo);
}

/** Lo mismo con un número con decimales, que se lee y se escribe en milésimas. */
function pasoConDecimales(
  texto: string,
  paso: number,
  maximo: number,
  sentido: 1 | -1,
  leer: (texto: string) => number | null,
  escribir: (milesimas: number) => string,
): string | null {
  const actual = texto.trim() === '' ? 0 : leer(texto);
  if (actual === null) {
    return null;
  }
  const nuevo = Math.min(maximo, Math.max(0, actual + sentido * paso));
  return nuevo === 0 ? '' : escribir(nuevo);
}

export function marcarHecha(e: EntrenoEnEdicion, bloqueId: string, serieId: string, cuando: number | null): EntrenoEnEdicion {
  return cambiarLaSerie(e, bloqueId, serieId, (serie) => ({ ...serie, hecha: cuando }));
}

/** Quita la vuelta de una serie: en un ejercicio suelto, la serie; en una superserie, la vuelta entera. */
export function quitarVuelta(e: EntrenoEnEdicion, bloqueId: string, serieId: string): EntrenoEnEdicion {
  return cambiarEjercicios(e, bloqueId, (bloque) => ({
    ...bloque,
    vueltas: bloque.vueltas.filter((vuelta) => !vuelta.some((serie) => serie.id === serieId)),
  }));
}

export function quitarBloque(e: EntrenoEnEdicion, bloqueId: string): EntrenoEnEdicion {
  return { ...e, bloques: e.bloques.filter((bloque) => bloque.id !== bloqueId) };
}

/**
 * Une un bloque de ejercicios con el siguiente en una superserie. Las vueltas
 * se emparejan por posición, con series vacías donde falten: enlazar no pierde
 * nada de lo escrito, y dos ejercicios que se van a encadenar rara vez llevan
 * las mismas series apuntadas. El descanso entre vueltas es el del primero, y
 * el de después, el del segundo, que es el que lleva al bloque siguiente.
 */
export function enlazar(e: EntrenoEnEdicion, bloqueId: string, nuevoId: () => string): EntrenoEnEdicion {
  const i = e.bloques.findIndex((bloque) => bloque.id === bloqueId);
  const primero = e.bloques[i];
  const segundo = e.bloques[i + 1];
  if (primero?.tipo !== 'ejercicios' || segundo?.tipo !== 'ejercicios') {
    return e;
  }
  const vacias = (bloque: BloqueDeEjercicios) => bloque.ejercicioIds.map(() => serieVacia(nuevoId()));
  const cuantas = Math.max(primero.vueltas.length, segundo.vueltas.length);
  const superserie: BloqueDeEjercicios = {
    tipo: 'ejercicios',
    id: primero.id,
    ejercicioIds: [...primero.ejercicioIds, ...segundo.ejercicioIds],
    vueltas: Array.from({ length: cuantas }, (_, v) => [
      ...(primero.vueltas[v] ?? vacias(primero)),
      ...(segundo.vueltas[v] ?? vacias(segundo)),
    ]),
    descansoEntreSeries: primero.descansoEntreSeries.trim() === '' ? segundo.descansoEntreSeries : primero.descansoEntreSeries,
    descansoDespues: segundo.descansoDespues,
  };
  return { ...e, bloques: [...e.bloques.slice(0, i), superserie, ...e.bloques.slice(i + 2)] };
}

/**
 * Deshace una superserie en un bloque por ejercicio, cada uno con sus series y
 * sus identificadores: no se pierde nada de lo escrito. Las series vacías y sin
 * marcar del final de cada ejercicio se quitan, que suelen ser los huecos que
 * puso el enlace, pero cada uno conserva al menos una. Todos se quedan con el
 * descanso entre vueltas de la superserie, y el último, con el de después:
 * los descansos que había antes de enlazar no se recuerdan, y por eso enlazar
 * y separar se pueden deshacer desde el aviso.
 */
export function separar(e: EntrenoEnEdicion, bloqueId: string, nuevoId: () => string): EntrenoEnEdicion {
  const i = e.bloques.findIndex((bloque) => bloque.id === bloqueId);
  const superserie = e.bloques[i];
  if (superserie?.tipo !== 'ejercicios' || superserie.ejercicioIds.length < 2) {
    return e;
  }
  const ultimo = superserie.ejercicioIds.length - 1;
  const partes = superserie.ejercicioIds.map((ejercicioId, c): BloqueDeEjercicios => {
    const series = superserie.vueltas.map((vuelta) => vuelta[c]);
    let cuantas = series.length;
    while (cuantas > 1 && serieVaciaDeDatos(series[cuantas - 1]) && series[cuantas - 1].hecha === null) cuantas -= 1;
    return {
      tipo: 'ejercicios',
      id: c === 0 ? superserie.id : nuevoId(),
      ejercicioIds: [ejercicioId],
      vueltas: series.slice(0, cuantas).map((serie) => [serie]),
      descansoEntreSeries: superserie.descansoEntreSeries,
      descansoDespues: c === ultimo ? superserie.descansoDespues : '',
    };
  });
  return { ...e, bloques: [...e.bloques.slice(0, i), ...partes, ...e.bloques.slice(i + 1)] };
}

/** Escribe un descanso. Un bloque de carrera solo tiene el de después. */
export function cambiarDescanso(
  e: EntrenoEnEdicion,
  bloqueId: string,
  campo: CampoDeDescanso,
  texto: string,
): EntrenoEnEdicion {
  return cambiarBloque(e, bloqueId, (bloque) => {
    if (campo === 'descansoDespues') {
      return { ...bloque, descansoDespues: texto };
    }
    return bloque.tipo === 'ejercicios' ? { ...bloque, descansoEntreSeries: texto } : bloque;
  });
}

/** Sube o baja un descanso quince segundos, sin bajar de cero. */
export function pasoDeDescanso(
  e: EntrenoEnEdicion,
  bloqueId: string,
  campo: CampoDeDescanso,
  sentido: 1 | -1,
): EntrenoEnEdicion {
  const bloque = e.bloques.find((b) => b.id === bloqueId);
  const actual =
    bloque === undefined
      ? null
      : campo === 'descansoDespues'
        ? bloque.descansoDespues
        : bloque.tipo === 'ejercicios'
          ? bloque.descansoEntreSeries
          : null;
  const nuevo = actual === null ? null : pasoEntero(actual, PASO_DEL_DESCANSO, DESCANSO_MAXIMO_S, sentido);
  return nuevo === null ? e : cambiarDescanso(e, bloqueId, campo, nuevo);
}

export function cambiarCarrera(
  e: EntrenoEnEdicion,
  bloqueId: string,
  cambios: Partial<Record<CampoDeCarrera, string>>,
): EntrenoEnEdicion {
  return cambiarBloque(e, bloqueId, (bloque) => (bloque.tipo === 'carrera' ? { ...bloque, ...cambios } : bloque));
}

/** Sube o baja la distancia medio kilómetro, o el tiempo un minuto, sin bajar de cero. */
export function pasoDeCarrera(
  e: EntrenoEnEdicion,
  bloqueId: string,
  campo: CampoDeCarrera,
  sentido: 1 | -1,
): EntrenoEnEdicion {
  return cambiarBloque(e, bloqueId, (bloque) => {
    if (bloque.tipo !== 'carrera') {
      return bloque;
    }
    const nuevo =
      campo === 'kilometros'
        ? pasoConDecimales(bloque.kilometros, PASOS_DE_CARRERA.kilometros, MAXIMOS_DE_CARRERA.kilometros, sentido, textoAMetros, metrosATexto)
        : pasoEntero(bloque.minutos, PASOS_DE_CARRERA.minutos, MAXIMOS_DE_CARRERA.minutos, sentido);
    return nuevo === null ? bloque : { ...bloque, [campo]: nuevo };
  });
}

export function cambiarEntreno(
  e: EntrenoEnEdicion,
  cambios: Partial<Pick<EntrenoEnEdicion, 'fecha' | 'hora' | 'minutos' | 'esfuerzo' | 'notas'>>,
): EntrenoEnEdicion {
  return { ...e, ...cambios };
}

/**
 * Los minutos entre la primera serie marcada como hecha y la última, si hay
 * dos o más y no pasan de cuatro horas. Es un suelo: no cuenta la primera
 * serie, que ya estaba hecha al marcarla, ni las carreras que quedan fuera,
 * como el calentamiento; esas las suma carrerasFueraDeLoMedido.
 */
export function minutosMedidos(e: EntrenoEnEdicion): number | null {
  const marcas = e.bloques
    .flatMap((bloque) => (bloque.tipo === 'ejercicios' ? bloque.vueltas.flat() : []))
    .map((serie) => serie.hecha)
    .filter((hecha): hecha is number => hecha !== null)
    .sort((a, b) => a - b);
  if (marcas.length < 2) {
    return null;
  }
  const ms = marcas[marcas.length - 1] - marcas[0];
  return ms > MAXIMO_MEDIDO_MS ? null : Math.max(1, Math.round(ms / 60_000));
}

/** Los minutos de una carrera, si se han escrito bien, o 0. */
function minutosDeCarrera(bloque: BloqueDeCarrera): number {
  const minutos = leerEntero(bloque.minutos, 1, MAXIMOS_DE_CARRERA.minutos);
  return typeof minutos === 'number' ? minutos : 0;
}

/**
 * Los minutos de las carreras que van antes del primer ejercicio con una serie
 * marcada como hecha, como el calentamiento en cinta, o después del último.
 * minutosMedidos no los ve, porque pasaron antes de la primera marca o después
 * de la última; los de las carreras de en medio ya están dentro. Sin marcas,
 * 0.
 */
export function carrerasFueraDeLoMedido(e: EntrenoEnEdicion): number {
  const conMarca = e.bloques.map(
    (bloque) => bloque.tipo === 'ejercicios' && bloque.vueltas.some((vuelta) => vuelta.some((serie) => serie.hecha !== null)),
  );
  const primero = conMarca.indexOf(true);
  const ultimo = conMarca.lastIndexOf(true);
  if (primero === -1) {
    return 0;
  }
  return e.bloques.reduce(
    (suma, bloque, i) => (bloque.tipo === 'carrera' && (i < primero || i > ultimo) ? suma + minutosDeCarrera(bloque) : suma),
    0,
  );
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

/** Unos segundos como minutos y segundos: 90 da «1:30». */
export function textoDeSegundos(segundos: number): string {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

/** «A», «A y B», «A, B y C». */
export function unirConY(nombres: string[]): string {
  return nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

export type NombreDeBloque = {
  /** Para meterlo en una frase: «Press banca», «la superserie de Press banca y Remo con barra», «la carrera en cinta». */
  enFrase: string;
  /** Para empezar un aviso: «Press banca», «La superserie de…», «Carrera en cinta». */
  alEmpezar: string;
  /** Los ejercicios del bloque, en su orden; ninguno en una carrera. */
  ejercicios: string[];
};

/**
 * Cómo se nombra cada bloque en los avisos y para el lector de pantalla. Si un
 * ejercicio sale más de una vez, o hay más de una carrera, llevan su ordinal
 * para que se sepa cuál es: «Press banca (el 2.º)», «la carrera en cinta (la
 * 2.ª)».
 */
export function nombresDeLosBloques(e: EntrenoEnEdicion, ejercicios: ReadonlyMap<string, Ejercicio>): NombreDeBloque[] {
  const veces = new Map<string, number>();
  for (const bloque of e.bloques) {
    if (bloque.tipo === 'ejercicios') for (const id of bloque.ejercicioIds) veces.set(id, (veces.get(id) ?? 0) + 1);
  }
  const carreras = e.bloques.filter((bloque) => bloque.tipo === 'carrera').length;
  const vistos = new Map<string, number>();
  let carrera = 0;
  return e.bloques.map((bloque) => {
    if (bloque.tipo === 'carrera') {
      carrera += 1;
      const cual = carreras > 1 ? ` (la ${carrera}.ª)` : '';
      return { enFrase: `la carrera en cinta${cual}`, alEmpezar: `Carrera en cinta${cual}`, ejercicios: [] };
    }
    const cuales = bloque.ejercicioIds.map((id) => {
      const nombre = ejercicios.get(id)?.nombre ?? id;
      const visto = (vistos.get(id) ?? 0) + 1;
      vistos.set(id, visto);
      return (veces.get(id) ?? 1) > 1 ? `${nombre} (el ${visto}.º)` : nombre;
    });
    if (cuales.length === 1) {
      return { enFrase: cuales[0], alEmpezar: cuales[0], ejercicios: cuales };
    }
    const superserie = `superserie de ${unirConY(cuales)}`;
    return { enFrase: `la ${superserie}`, alEmpezar: `La ${superserie}`, ejercicios: cuales };
  });
}

export type ResultadoDeValidar = { entreno: Entreno; errores?: undefined } | { entreno?: undefined; errores: string[] };

/**
 * El entreno listo para guardar, o la lista de lo que falta para poder
 * guardarlo, dicho para la persona. Las series vacías, las vueltas sin nada y
 * los bloques sin nada escrito se quedan fuera. Los avisos numeran las series
 * y las vueltas como la pantalla, contando también las vacías, y comprueban
 * los mismos límites que la base, para que nunca llegue a ella un dato que
 * vaya a rechazar.
 *
 * Los descansos van en la serie que los tiene detrás: entre los ejercicios de
 * una vuelta de una superserie no se para (0), detrás de cada vuelta va el
 * descanso entre series, y detrás de la última, ninguno, porque el que lleva
 * al bloque siguiente es del bloque. El último bloque no tiene descanso de
 * después: la pantalla no lo enseña.
 */
export function validar(
  e: EntrenoEnEdicion,
  ejercicios: ReadonlyMap<string, Ejercicio>,
  hoy: string,
): ResultadoDeValidar {
  const errores: string[] = [];
  const bloques: Bloque[] = [];
  const nombresDeBloques = nombresDeLosBloques(e, ejercicios);

  e.bloques.forEach((bloque, b) => {
    const ultimo = b === e.bloques.length - 1;
    if (bloque.tipo === 'carrera') {
      const leido = leerCarrera(bloque, nombresDeBloques[b].alEmpezar, ultimo, errores);
      if (leido !== null) bloques.push(leido);
      return;
    }

    const nombres = bloque.ejercicioIds.map((id) => ejercicios.get(id)?.nombre ?? id);
    const cuales = nombresDeBloques[b].ejercicios;
    const superserie = bloque.ejercicioIds.length > 1;
    const delBloque = nombresDeBloques[b].alEmpezar;
    const entre = leerDescanso(
      bloque.descansoEntreSeries,
      `${delBloque}: el descanso entre ${superserie ? 'vueltas' : 'series'}`,
      errores,
    );
    const despues = ultimo ? null : leerDescanso(bloque.descansoDespues, `${delBloque}: el descanso antes del siguiente`, errores);

    // El orden es el sitio del ejercicio en la vuelta, aunque en una vuelta falte
    // la serie de antes. Un ejercicio sin nada en todo el bloque no ocupa sitio,
    // igual que una vuelta vacía no cuenta: así, al corregir, vuelve igual.
    const conAlgo = bloque.ejercicioIds.map((_, c) => bloque.vueltas.some((vuelta) => !serieVaciaDeDatos(vuelta[c])));
    const ordenDe = (c: number) => conAlgo.slice(0, c + 1).filter(Boolean).length;
    const series: Serie[] = [];
    let ronda = 0;
    bloque.vueltas.forEach((vuelta, v) => {
      if (vuelta.every(serieVaciaDeDatos)) return;
      ronda += 1;
      vuelta.forEach((serie, c) => {
        if (serieVaciaDeDatos(serie)) return;
        const donde = `${cuales[c]}, ${superserie ? 'vuelta' : 'serie'} ${v + 1}`;
        const medido = leerSerie(serie, ejercicios.get(bloque.ejercicioIds[c]), nombres[c], donde, errores);
        series.push({
          id: serie.id,
          ronda,
          orden: ordenDe(c),
          ejercicioId: bloque.ejercicioIds[c],
          ...medido,
          distanciaM: null,
          calorias: null,
          descansoMs: null,
        });
      });
    });
    if (ronda > 1000) errores.push(`${delBloque}: no caben más de 1000 ${superserie ? 'vueltas' : 'series'}.`);
    if (series.length > 0) {
      bloques.push({
        id: bloque.id,
        metrosCorridos: null,
        tiempoMs: null,
        descansoMs: despues,
        series: series.map((serie, i) => ({
          ...serie,
          descansoMs: series[i + 1]?.ronda === serie.ronda ? 0 : serie.ronda < ronda ? entre : null,
        })),
      });
    }
  });

  // Detrás del último bloque que se guarda no hay bloque siguiente.
  const ultimoGuardado = bloques[bloques.length - 1];
  if (ultimoGuardado !== undefined) bloques[bloques.length - 1] = { ...ultimoGuardado, descansoMs: null };

  if (bloques.length === 0) errores.push('Apunta al menos una serie o una carrera.');
  if (bloques.length > 1000) errores.push('No caben más de 1000 ejercicios y carreras en un entreno.');
  if (e.fecha < '2000-01-01') errores.push('La fecha es anterior al año 2000.');
  if (e.fecha > hoy) errores.push('La fecha es de un día que todavía no ha llegado.');
  if (e.esfuerzo === null) errores.push('Falta el esfuerzo, del 1 al 10.');
  if (e.esfuerzo !== null && !(Number.isInteger(e.esfuerzo) && e.esfuerzo >= 1 && e.esfuerzo <= 10)) {
    errores.push('El esfuerzo va del 1 al 10.');
  }

  let duracionMs: number | null = null;
  if (e.duracionLeida !== null && e.minutos === e.duracionLeida.minutos) {
    // Al corregir, la duración que no se toca se queda como estaba, con sus milisegundos.
    duracionMs = e.duracionLeida.ms;
  } else if (e.minutos.trim() === '') {
    const medidos = minutosMedidos(e);
    if (medidos !== null && medidos >= MINUTOS_MEDIDOS_MINIMOS) {
      const total = medidos + carrerasFueraDeLoMedido(e);
      if (total > 2880) errores.push('La duración va de 1 minuto a 48 horas (2880 minutos).');
      else duracionMs = total * 60_000;
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
    else if (escritos !== null) duracionMs = escritos * 60_000;
  }

  // Un entreno no dura menos que lo que se corrió en él.
  const carreras = e.bloques.flatMap((bloque) => (bloque.tipo === 'carrera' ? [minutosDeCarrera(bloque)] : []));
  const corridos = carreras.reduce((suma, n) => suma + n, 0);
  if (duracionMs !== null && duracionMs < corridos * 60_000) {
    errores.push(
      `La duración (${textoDeMinutos(Math.round(duracionMs / 60_000))}) es menor que ${carreras.length > 1 ? 'las carreras en cinta' : 'la carrera en cinta'} (${textoDeMinutos(corridos)}).`,
    );
  }

  if (errores.length > 0 || e.esfuerzo === null || duracionMs === null) {
    return { errores };
  }
  return {
    entreno: {
      id: e.id,
      disciplina: 'gimnasio',
      fecha: e.fecha,
      hora: e.hora,
      duracionMs,
      esfuerzo: e.esfuerzo,
      notas: e.notas.trim() === '' ? null : e.notas,
      bloques,
    },
  };
}

/** Lo medido en una serie con algo escrito, con sus avisos. «donde» dice qué serie es. */
function leerSerie(
  serie: SerieEnEdicion,
  ejercicio: Ejercicio | undefined,
  nombre: string,
  donde: string,
  errores: string[],
): Pick<Serie, 'repeticiones' | 'pesoG' | 'tiempoMs'> {
  const mide = (medida: Medida) => ejercicio?.mide.includes(medida) ?? false;
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
  return { repeticiones: reps, pesoG: pesoG || null, tiempoMs: segs === null ? null : segs * 1000 };
}

/**
 * Una carrera lista para guardar, con sus avisos, o null si está vacía. La
 * distancia es obligatoria, porque es lo que cuenta para las zapatillas; los
 * minutos, no. Una distancia de más de 100 km, o una carrera a más de 30 km/h,
 * es casi siempre una distancia escrita en metros, y contaría entera para las
 * zapatillas: se pide revisarla.
 */
function leerCarrera(bloque: BloqueDeCarrera, nombre: string, ultimo: boolean, errores: string[]): Bloque | null {
  const kilometros = bloque.kilometros.trim();
  if (kilometros === '' && bloque.minutos.trim() === '') {
    return null;
  }
  const metros = kilometros === '' ? null : textoAMetros(kilometros);
  // Un entero de 100 o más seguramente eran metros: se dice cuántos kilómetros son.
  const pista =
    /^[0-9]+$/.test(kilometros) && Number(kilometros) >= 100 ? `, y ${kilometros} m son ${metrosATexto(Number(kilometros))} km` : '';
  if (kilometros === '') errores.push(`${nombre}: falta la distancia.`);
  else if (metros === null) errores.push(`${nombre}: la distancia «${bloque.kilometros}» no se entiende.`);
  else if (metros === 0) errores.push(`${nombre}: la distancia tiene que ser mayor que 0.`);
  else if (metros > MAXIMOS_DE_CARRERA.kilometros) errores.push(`${nombre}: ${kilometros} km no puede ser: la distancia va en kilómetros${pista}.`);
  const minutos = leerEntero(bloque.minutos, 1, MAXIMOS_DE_CARRERA.minutos);
  if (minutos === 'no se entiende') errores.push(`${nombre}: los minutos «${bloque.minutos}» no se entienden: van minutos enteros.`);
  if (minutos === 'fuera') errores.push(`${nombre}: los minutos van de 1 a 2880.`);
  if (typeof minutos === 'number' && metros !== null && metros > 0 && metros <= MAXIMOS_DE_CARRERA.kilometros) {
    const kmh = metros / 1000 / (minutos / 60);
    if (kmh > VELOCIDAD_MAXIMA_KMH) {
      errores.push(
        `${nombre}: ${metrosATexto(metros)} km en ${textoDeMinutos(minutos)} son ${Math.round(kmh)} km/h: revisa la distancia, que va en kilómetros${pista}, o los minutos.`,
      );
    }
  }
  const despues = ultimo ? null : leerDescanso(bloque.descansoDespues, `${nombre}: el descanso antes del siguiente`, errores);
  return {
    id: bloque.id,
    metrosCorridos: metros,
    tiempoMs: typeof minutos === 'number' ? minutos * 60_000 : null,
    descansoMs: despues,
    series: [],
  };
}

/** Un descanso escrito en segundos, en milisegundos, o null si no se apuntó. «que» dice cuál es. */
function leerDescanso(texto: string, que: string, errores: string[]): number | null {
  const segundos = leerEntero(texto, 0, DESCANSO_MAXIMO_S);
  if (segundos === 'no se entiende') errores.push(`${que} «${texto}» no se entiende: van segundos.`);
  if (segundos === 'fuera') errores.push(`${que} pasa de un día (86400 segundos).`);
  return typeof segundos === 'number' ? segundos * 1000 : null;
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

const esTexto = (x: unknown): x is string => typeof x === 'string';
const esNumeroONulo = (x: unknown): x is number | null => x === null || (typeof x === 'number' && Number.isFinite(x));
const esObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Un borrador guardado, de la forma de ahora o de la 1, que se convierte. Se
 * reconstruye campo a campo en vez de fiarse del JSON: lo que no casa lo
 * descarta entero, para no abrir el editor con un entreno a medio leer.
 */
export function leerBorrador(valor: unknown): EntrenoEnEdicion | null {
  if (!esObjeto(valor)) return null;
  const b = valor;
  if (b.formato !== 1 && b.formato !== 2) return null;
  if (!esTexto(b.id) || !esNumeroONulo(b.selloLeido) || !esTexto(b.fecha) || !esFecha(b.fecha)) return null;
  if (!(b.hora === null || (esTexto(b.hora) && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(b.hora)))) return null;
  if (!esTexto(b.minutos) || !esTexto(b.notas) || !esNumeroONulo(b.esfuerzo)) return null;
  if (!Array.isArray(b.bloques)) return null;
  // Los borradores de antes de corregir no llevan ni la duración ni la huella leídas.
  let duracionLeida: EntrenoEnEdicion['duracionLeida'] = null;
  if (b.duracionLeida !== undefined && b.duracionLeida !== null) {
    const d = b.duracionLeida;
    if (!esObjeto(d) || !esTexto(d.minutos) || typeof d.ms !== 'number' || !Number.isInteger(d.ms) || d.ms <= 0) return null;
    duracionLeida = { minutos: d.minutos, ms: d.ms };
  }
  if (b.huellaLeida !== undefined && b.huellaLeida !== null && !esTexto(b.huellaLeida)) return null;
  const huellaLeida = esTexto(b.huellaLeida) ? b.huellaLeida : null;
  const bloques: BloqueEnEdicion[] = [];
  for (const crudo of b.bloques) {
    const bloque = b.formato === 1 ? bloqueDeLaForma1(crudo) : bloqueDeLaForma2(crudo);
    if (bloque === null) return null;
    bloques.push(bloque);
  }
  return {
    formato: 2,
    id: b.id,
    selloLeido: b.selloLeido,
    fecha: b.fecha,
    hora: b.hora,
    bloques,
    minutos: b.minutos,
    duracionLeida,
    huellaLeida,
    esfuerzo: b.esfuerzo,
    notas: b.notas,
  };
}

/**
 * El mismo entreno, para guardarlo aparte, como uno nuevo: con identificadores
 * nuevos, el suyo y los de todos sus bloques y series, porque los de antes
 * siguen siendo del otro en la base, aunque esté borrado.
 */
export function comoEntrenoNuevo(e: EntrenoEnEdicion, nuevoId: () => string): EntrenoEnEdicion {
  return {
    ...e,
    id: nuevoId(),
    selloLeido: null,
    huellaLeida: null,
    bloques: e.bloques.map((bloque): BloqueEnEdicion =>
      bloque.tipo === 'carrera'
        ? { ...bloque, id: nuevoId() }
        : { ...bloque, id: nuevoId(), vueltas: bloque.vueltas.map((vuelta) => vuelta.map((serie) => ({ ...serie, id: nuevoId() }))) },
    ),
  };
}

/** Unos milisegundos como segundos escritos, '' si no hay, o null si no son segundos enteros. */
function segundosExactos(ms: number | null): string | null {
  if (ms === null) return '';
  return ms % 1000 === 0 ? String(ms / 1000) : null;
}

/**
 * Un entreno de gimnasio guardado, en el editor para corregirlo, o null si
 * tiene algo que el editor no sabe enseñar sin perderlo al guardar: otra
 * disciplina, medidas que el gimnasio no apunta (distancia o calorías en una
 * serie), tiempos con fracciones de segundo, o de minuto en una carrera, o
 * descansos que no siguen la forma del editor (el mismo descanso detrás de
 * cada vuelta, sin parar dentro de ella y ninguno detrás de la última), o
 * vueltas que no van seguidas desde la 1. Todo lo que guarda este editor se
 * puede corregir. Las series no llevan su marca de hecha, que no se guarda, y
 * los huecos de una superserie salen vacíos. Si un sitio de la vuelta no tiene
 * ninguna serie en todo el bloque, como lo guardaba el editor del commit 2b
 * con un ejercicio vacío en una superserie, ese ejercicio no vuelve y los
 * órdenes de los demás se cierran: lo apuntado es lo mismo.
 */
export function paraCorregir(guardado: EntrenoGuardado, nuevoId: () => string): EntrenoEnEdicion | null {
  if (guardado.disciplina !== 'gimnasio') {
    return null;
  }
  const bloques: BloqueEnEdicion[] = [];
  for (const [i, bloque] of guardado.bloques.entries()) {
    const despues = segundosExactos(bloque.descansoMs);
    // El editor no enseña el descanso de después del último bloque, y no lo guarda.
    if (despues === null || (i === guardado.bloques.length - 1 && bloque.descansoMs !== null)) {
      return null;
    }
    if (bloque.metrosCorridos !== null) {
      if (bloque.series.length > 0 || (bloque.tiempoMs !== null && bloque.tiempoMs % 60_000 !== 0)) {
        return null;
      }
      bloques.push({
        tipo: 'carrera',
        id: bloque.id,
        kilometros: metrosATexto(bloque.metrosCorridos),
        minutos: bloque.tiempoMs === null ? '' : String(bloque.tiempoMs / 60_000),
        descansoDespues: despues,
      });
      continue;
    }
    const deEjercicios = ejerciciosParaCorregir(bloque, despues, nuevoId);
    if (deEjercicios === null) {
      return null;
    }
    bloques.push(deEjercicios);
  }
  const minutos = String(Math.max(1, Math.round(guardado.duracionMs / 60_000)));
  return {
    formato: 2,
    id: guardado.id,
    selloLeido: guardado.modificado,
    fecha: guardado.fecha,
    hora: guardado.hora,
    bloques,
    minutos,
    duracionLeida: { minutos, ms: guardado.duracionMs },
    huellaLeida: huellaDelEntreno(guardado),
    esfuerzo: guardado.esfuerzo,
    notas: guardado.notas ?? '',
  };
}

function ejerciciosParaCorregir(bloque: Bloque, despues: string, nuevoId: () => string): BloqueDeEjercicios | null {
  if (bloque.tiempoMs !== null || bloque.series.length === 0) {
    return null;
  }
  // Cada sitio de la vuelta es un ejercicio. Si en un sitio hay dos, no lo escribió el editor.
  const columnas: { orden: number; ejercicioId: string }[] = [];
  for (const serie of bloque.series) {
    const columna = columnas.find((c) => c.orden === serie.orden);
    if (columna === undefined) columnas.push({ orden: serie.orden, ejercicioId: serie.ejercicioId });
    else if (columna.ejercicioId !== serie.ejercicioId) return null;
  }
  columnas.sort((a, b) => a.orden - b.orden);
  const ordenadas = [...bloque.series].sort((a, b) => a.ronda - b.ronda || a.orden - b.orden);
  const rondas = [...new Set(ordenadas.map((serie) => serie.ronda))];
  // El editor numera las vueltas guardadas 1, 2, 3 y así, sin huecos.
  if (!rondas.every((ronda, i) => ronda === i + 1)) {
    return null;
  }
  const vueltas: SerieEnEdicion[][] = [];
  for (const ronda of rondas) {
    const vuelta: SerieEnEdicion[] = [];
    for (const columna of columnas) {
      const serie = ordenadas.find((s) => s.ronda === ronda && s.orden === columna.orden);
      if (serie === undefined) {
        vuelta.push(serieVacia(nuevoId()));
        continue;
      }
      if (serie.distanciaM !== null || serie.calorias !== null || (serie.tiempoMs !== null && serie.tiempoMs % 1000 !== 0)) {
        return null;
      }
      vuelta.push({
        id: serie.id,
        repeticiones: serie.repeticiones === null ? '' : String(serie.repeticiones),
        peso: serie.pesoG === null ? '' : gramosATexto(serie.pesoG),
        segundos: serie.tiempoMs === null ? '' : String(serie.tiempoMs / 1000),
        hecha: null,
      });
    }
    vueltas.push(vuelta);
  }
  // Los descansos tienen que ser los que escribe validar: el mismo detrás de cada vuelta salvo
  // la última, 0 entre los ejercicios de una vuelta y ninguno detrás de la última.
  const ultimaRonda = rondas[rondas.length - 1];
  const finDeVuelta = ordenadas.find((serie, i) => serie.ronda < ultimaRonda && ordenadas[i + 1]?.ronda !== serie.ronda);
  const entreMs = finDeVuelta?.descansoMs ?? null;
  const entre = segundosExactos(entreMs);
  const comoElEditor = ordenadas.every((serie, i) => {
    const esperado = ordenadas[i + 1]?.ronda === serie.ronda ? 0 : serie.ronda < ultimaRonda ? entreMs : null;
    return serie.descansoMs === esperado;
  });
  if (entre === null || !comoElEditor) {
    return null;
  }
  return {
    tipo: 'ejercicios',
    id: bloque.id,
    ejercicioIds: columnas.map((columna) => columna.ejercicioId),
    vueltas,
    descansoEntreSeries: entre,
    descansoDespues: despues,
  };
}

/** Las series de un borrador, o null si alguna no tiene su forma. */
function seriesGuardadas(crudas: unknown[]): SerieEnEdicion[] | null {
  const series: SerieEnEdicion[] = [];
  for (const cruda of crudas) {
    if (!esObjeto(cruda) || !esTexto(cruda.id)) return null;
    if (!esTexto(cruda.repeticiones) || !esTexto(cruda.peso) || !esTexto(cruda.segundos) || !esNumeroONulo(cruda.hecha)) return null;
    series.push({ id: cruda.id, repeticiones: cruda.repeticiones, peso: cruda.peso, segundos: cruda.segundos, hecha: cruda.hecha });
  }
  return series;
}

/** Un bloque de la forma 1, que era siempre un ejercicio suelto con sus series. */
function bloqueDeLaForma1(crudo: unknown): BloqueDeEjercicios | null {
  if (!esObjeto(crudo) || !esTexto(crudo.id) || !esTexto(crudo.ejercicioId) || !Array.isArray(crudo.series)) return null;
  const series = seriesGuardadas(crudo.series);
  if (series === null) return null;
  return {
    tipo: 'ejercicios',
    id: crudo.id,
    ejercicioIds: [crudo.ejercicioId],
    vueltas: series.map((serie) => [serie]),
    descansoEntreSeries: '',
    descansoDespues: '',
  };
}

function bloqueDeLaForma2(crudo: unknown): BloqueEnEdicion | null {
  if (!esObjeto(crudo) || !esTexto(crudo.id) || !esTexto(crudo.descansoDespues)) return null;
  if (crudo.tipo === 'carrera') {
    if (!esTexto(crudo.kilometros) || !esTexto(crudo.minutos)) return null;
    return { tipo: 'carrera', id: crudo.id, kilometros: crudo.kilometros, minutos: crudo.minutos, descansoDespues: crudo.descansoDespues };
  }
  if (crudo.tipo !== 'ejercicios' || !esTexto(crudo.descansoEntreSeries)) return null;
  if (!Array.isArray(crudo.ejercicioIds) || !Array.isArray(crudo.vueltas)) return null;
  const ejercicioIds = crudo.ejercicioIds.filter(esTexto);
  if (ejercicioIds.length === 0 || ejercicioIds.length !== crudo.ejercicioIds.length) return null;
  const vueltas: SerieEnEdicion[][] = [];
  for (const cruda of crudo.vueltas) {
    // Cada vuelta lleva una serie de cada ejercicio, ni una más ni una menos.
    if (!Array.isArray(cruda) || cruda.length !== ejercicioIds.length) return null;
    const vuelta = seriesGuardadas(cruda);
    if (vuelta === null) return null;
    vueltas.push(vuelta);
  }
  return {
    tipo: 'ejercicios',
    id: crudo.id,
    ejercicioIds,
    vueltas,
    descansoEntreSeries: crudo.descansoEntreSeries,
    descansoDespues: crudo.descansoDespues,
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

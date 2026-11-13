import { leerAjuste, ponerAjusteEn } from './ajustes';
import { p, type Transaccion } from './base';
import { huella } from './huella';
import { nuevoSello } from './sellos';

// El catálogo de ejercicios que trae la app. Cada entrada tiene una clave
// legible y fija, como «press-banca», que es la misma en todos los móviles y en
// los ficheros exportados. Una clave publicada no se cambia ni se quita nunca:
// para retirar un ejercicio se marca como retirado, y el historial lo sigue
// nombrando. El nombre sí puede cambiar.
//
// La app copia el catálogo en la tabla ejercicio cuando cambia. Al publicar un
// catálogo nuevo se sube CATALOGO_VERSION, para que una app más vieja no
// deshaga sus cambios; las pruebas fijan la huella de cada versión publicada.
// Cada disciplina añade sus ejercicios en su paso.

export type Medida = 'repeticiones' | 'peso' | 'tiempo' | 'distancia' | 'calorias';

/**
 * Los grupos del catálogo, con el nombre que se enseña, en el orden en que se
 * enseñan. «carrera» no es un grupo del gimnasio: el calentamiento corriendo
 * es un bloque de carrera, con sus metros, y no una serie de «Correr».
 */
export const GRUPOS = {
  pecho: 'Pecho',
  espalda: 'Espalda',
  pierna: 'Pierna',
  hombro: 'Hombro',
  brazo: 'Brazo',
  core: 'Core',
  carrera: 'Carrera',
} as const;

export type Grupo = keyof typeof GRUPOS;

/** Los grupos que se eligen en el gimnasio, en orden. */
export const GRUPOS_DEL_GIMNASIO: readonly Grupo[] = ['pecho', 'espalda', 'pierna', 'hombro', 'brazo', 'core'];

export type EntradaDelCatalogo = {
  id: string;
  nombre: string;
  grupo: Grupo;
  mide: readonly Medida[];
  /**
   * El peso que se apunta es el de cada mancuerna, no el total. En una clave
   * publicada no cambia nunca, porque cambiaría lo que significa el peso de
   * todas las series ya guardadas; una variante con otra carga es otra clave.
   */
  porMancuerna?: true;
  retirado?: true;
};

export type Catalogo = readonly EntradaDelCatalogo[];

export const CATALOGO_VERSION = 2;

/** Un ejercicio de gimnasio: por defecto se mide en repeticiones y peso. */
function gimnasio(
  id: string,
  nombre: string,
  grupo: Grupo,
  { mide = ['repeticiones', 'peso'], porMancuerna }: { mide?: readonly Medida[]; porMancuerna?: true } = {},
): EntradaDelCatalogo {
  return porMancuerna ? { id, nombre, grupo, mide, porMancuerna } : { id, nombre, grupo, mide };
}

const conMancuernas = { porMancuerna: true } as const;
const enSegundos = { mide: ['tiempo'] } as const;

export const CATALOGO: Catalogo = [
  { id: 'correr', nombre: 'Correr', grupo: 'carrera', mide: ['tiempo', 'distancia'] },

  // Gimnasio (paso 3): los 80 ejercicios de Quimera-web. En los de peso
  // corporal, el peso es el lastre, y se deja vacío si no se lleva. Los que se
  // miden en segundos (las planchas y el hollow hold) no llevan peso.
  gimnasio('press-banca', 'Press banca', 'pecho'),
  gimnasio('press-banca-inclinado', 'Press banca inclinado', 'pecho'),
  gimnasio('press-banca-declinado', 'Press banca declinado', 'pecho'),
  gimnasio('press-banca-multipower', 'Press banca en multipower', 'pecho'),
  gimnasio('press-mancuernas', 'Press con mancuernas', 'pecho', conMancuernas),
  gimnasio('press-inclinado-mancuernas', 'Press inclinado con mancuernas', 'pecho', conMancuernas),
  gimnasio('press-pecho-maquina', 'Press de pecho en máquina', 'pecho'),
  gimnasio('aperturas-mancuernas', 'Aperturas con mancuernas', 'pecho', conMancuernas),
  gimnasio('aperturas-polea', 'Aperturas en polea', 'pecho'),
  gimnasio('contractor-pecho', 'Contractor de pecho (pec deck)', 'pecho'),
  gimnasio('fondos-paralelas', 'Fondos en paralelas', 'pecho'),
  gimnasio('flexiones', 'Flexiones', 'pecho'),

  gimnasio('dominadas', 'Dominadas', 'espalda'),
  gimnasio('jalon-pecho', 'Jalón al pecho', 'espalda'),
  gimnasio('remo-barra', 'Remo con barra', 'espalda'),
  gimnasio('remo-mancuerna', 'Remo con mancuerna', 'espalda', conMancuernas),
  gimnasio('remo-polea-baja', 'Remo en polea baja', 'espalda'),
  gimnasio('remo-t', 'Remo en T', 'espalda'),
  gimnasio('remo-apoyo-pecho', 'Remo con apoyo en pecho', 'espalda'),
  gimnasio('pull-over', 'Pull over', 'espalda'),
  gimnasio('pullover-polea', 'Pullover en polea', 'espalda'),
  gimnasio('encogimientos-barra', 'Encogimientos con barra', 'espalda'),
  gimnasio('encogimientos-mancuernas', 'Encogimientos con mancuernas', 'espalda', conMancuernas),
  gimnasio('hiperextensiones', 'Hiperextensiones', 'espalda'),

  gimnasio('sentadilla-trasera', 'Sentadilla trasera', 'pierna'),
  gimnasio('sentadilla-frontal', 'Sentadilla frontal', 'pierna'),
  gimnasio('sentadilla-bulgara', 'Sentadilla búlgara', 'pierna', conMancuernas),
  gimnasio('sentadilla-hack', 'Sentadilla hack', 'pierna'),
  gimnasio('sentadilla-multipower', 'Sentadilla en multipower', 'pierna'),
  gimnasio('sentadilla-goblet', 'Sentadilla goblet', 'pierna'),
  gimnasio('peso-muerto', 'Peso muerto', 'pierna'),
  gimnasio('peso-muerto-rumano', 'Peso muerto rumano', 'pierna'),
  gimnasio('peso-muerto-sumo', 'Peso muerto sumo', 'pierna'),
  gimnasio('prensa-piernas', 'Prensa de piernas', 'pierna'),
  gimnasio('zancadas', 'Zancadas', 'pierna', conMancuernas),
  gimnasio('subida-cajon', 'Subida al cajón', 'pierna', conMancuernas),
  gimnasio('hip-thrust', 'Hip thrust', 'pierna'),
  gimnasio('puente-gluteo', 'Puente de glúteo', 'pierna'),
  gimnasio('buenos-dias', 'Buenos días (good morning)', 'pierna'),
  gimnasio('curl-femoral', 'Curl femoral', 'pierna'),
  gimnasio('extension-cuadriceps', 'Extensión de cuádriceps', 'pierna'),
  gimnasio('elevacion-gemelos', 'Elevación de gemelos', 'pierna'),
  gimnasio('elevacion-gemelos-sentado', 'Elevación de gemelos sentado', 'pierna'),
  gimnasio('aductores-maquina', 'Aductores en máquina', 'pierna'),
  gimnasio('abductores-maquina', 'Abductores en máquina', 'pierna'),

  gimnasio('press-militar', 'Press militar', 'hombro'),
  gimnasio('press-hombros-mancuernas', 'Press de hombros con mancuernas', 'hombro', conMancuernas),
  gimnasio('press-hombros-maquina', 'Press de hombros en máquina', 'hombro'),
  gimnasio('press-tras-nuca', 'Press tras nuca', 'hombro'),
  gimnasio('press-arnold', 'Press Arnold', 'hombro', conMancuernas),
  gimnasio('elevaciones-laterales', 'Elevaciones laterales', 'hombro', conMancuernas),
  gimnasio('elevaciones-frontales', 'Elevaciones frontales', 'hombro', conMancuernas),
  gimnasio('pajaros', 'Pájaros', 'hombro', conMancuernas),
  gimnasio('face-pull', 'Face pull', 'hombro'),
  gimnasio('remo-menton', 'Remo al mentón', 'hombro'),

  gimnasio('curl-barra', 'Curl con barra', 'brazo'),
  gimnasio('curl-barra-z', 'Curl con barra Z', 'brazo'),
  gimnasio('curl-mancuernas', 'Curl con mancuernas', 'brazo', conMancuernas),
  gimnasio('curl-inclinado-mancuernas', 'Curl inclinado con mancuernas', 'brazo', conMancuernas),
  gimnasio('curl-martillo', 'Curl martillo', 'brazo', conMancuernas),
  gimnasio('curl-concentrado', 'Curl concentrado', 'brazo', conMancuernas),
  gimnasio('curl-banco-scott', 'Curl en banco Scott', 'brazo'),
  gimnasio('curl-muneca', 'Curl de muñeca', 'brazo'),
  gimnasio('extension-triceps-polea', 'Extensión de tríceps en polea', 'brazo'),
  gimnasio('extension-triceps-cabeza', 'Extensión de tríceps sobre la cabeza', 'brazo'),
  gimnasio('press-frances', 'Press francés', 'brazo'),
  gimnasio('press-banca-agarre-cerrado', 'Press banca con agarre cerrado', 'brazo'),
  gimnasio('patada-triceps', 'Patada de tríceps', 'brazo', conMancuernas),
  gimnasio('fondos-banco', 'Fondos en banco', 'brazo'),

  gimnasio('plancha', 'Plancha', 'core', enSegundos),
  gimnasio('plancha-lateral', 'Plancha lateral', 'core', enSegundos),
  gimnasio('hollow-hold', 'Hollow hold', 'core', enSegundos),
  gimnasio('elevacion-piernas-colgado', 'Elevación de piernas colgado', 'core'),
  gimnasio('rueda-abdominal', 'Rueda abdominal', 'core'),
  gimnasio('giro-ruso', 'Giro ruso', 'core'),
  gimnasio('crunch', 'Crunch', 'core'),
  gimnasio('crunch-maquina', 'Crunch en máquina', 'core'),
  gimnasio('press-pallof', 'Press Pallof', 'core'),
  gimnasio('lenador-polea', 'Leñador en polea (woodchopper)', 'core'),
  gimnasio('inclinaciones-laterales', 'Inclinaciones laterales con mancuerna', 'core', conMancuernas),
];

/** La huella de un catálogo: cambia con cualquier cambio de sus entradas. */
export function huellaDelCatalogo(catalogo: Catalogo): string {
  return huella(JSON.stringify(catalogo));
}

type CatalogoCopiado = { version: number; huella: string };

function esCatalogoCopiado(valor: unknown): valor is CatalogoCopiado {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    typeof (valor as CatalogoCopiado).version === 'number' &&
    typeof (valor as CatalogoCopiado).huella === 'string'
  );
}

/**
 * Copia el catálogo en la tabla ejercicio si ha cambiado desde la última vez,
 * aunque no se haya subido la versión. Solo reescribe las entradas que han
 * cambiado, y su sello nunca baja. Los ejercicios propios no se tocan nunca,
 * porque sus claves son UUID y las del catálogo no (lo exige la base). Una app
 * más vieja que el catálogo copiado no lo toca.
 */
export async function sincronizarCatalogoEn(
  tx: Transaccion,
  ahora: number,
  catalogo: Catalogo = CATALOGO,
  version: number = CATALOGO_VERSION,
): Promise<boolean> {
  const copiado = await leerAjuste(tx, 'local.catalogo');
  const actual: CatalogoCopiado = { version, huella: huellaDelCatalogo(catalogo) };
  if (esCatalogoCopiado(copiado)) {
    if (copiado.version > actual.version) {
      return false;
    }
    if (copiado.version === actual.version && copiado.huella === actual.huella) {
      return false;
    }
  }
  for (const entrada of catalogo) {
    const mide = (medida: Medida) => (entrada.mide.includes(medida) ? 1 : 0);
    await tx.runAsync(
      `INSERT INTO ejercicio (id, nombre, grupo, usa_repeticiones, usa_peso, usa_tiempo, usa_distancia,
                              usa_calorias, propio, modificado, borrado)
       VALUES (:id, :nombre, :grupo, :repeticiones, :peso, :tiempo, :distancia, :calorias, 0, :modificado, :borrado)
       ON CONFLICT (id) DO UPDATE SET
         nombre = excluded.nombre, grupo = excluded.grupo,
         usa_repeticiones = excluded.usa_repeticiones, usa_peso = excluded.usa_peso,
         usa_tiempo = excluded.usa_tiempo, usa_distancia = excluded.usa_distancia,
         usa_calorias = excluded.usa_calorias, borrado = excluded.borrado,
         modificado = max(excluded.modificado, ejercicio.modificado + 1)
       WHERE ejercicio.nombre IS NOT excluded.nombre OR ejercicio.grupo IS NOT excluded.grupo
         OR ejercicio.usa_repeticiones IS NOT excluded.usa_repeticiones OR ejercicio.usa_peso IS NOT excluded.usa_peso
         OR ejercicio.usa_tiempo IS NOT excluded.usa_tiempo OR ejercicio.usa_distancia IS NOT excluded.usa_distancia
         OR ejercicio.usa_calorias IS NOT excluded.usa_calorias OR ejercicio.borrado IS NOT excluded.borrado`,
      p({
        id: entrada.id,
        nombre: entrada.nombre,
        grupo: entrada.grupo,
        repeticiones: mide('repeticiones'),
        peso: mide('peso'),
        tiempo: mide('tiempo'),
        distancia: mide('distancia'),
        calorias: mide('calorias'),
        modificado: nuevoSello(ahora),
        borrado: entrada.retirado ? 1 : 0,
      }),
    );
  }
  await ponerAjusteEn(tx, 'local.catalogo', actual, ahora);
  return true;
}

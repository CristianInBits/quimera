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

export type EntradaDelCatalogo = {
  id: string;
  nombre: string;
  grupo: string;
  mide: readonly Medida[];
  retirado?: true;
};

export type Catalogo = readonly EntradaDelCatalogo[];

export const CATALOGO_VERSION = 1;

export const CATALOGO: Catalogo = [
  { id: 'correr', nombre: 'Correr', grupo: 'carrera', mide: ['tiempo', 'distancia'] },
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

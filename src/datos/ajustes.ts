import { p, type Lectura, type Transaccion } from './base';
import { nuevoSello } from './sellos';

// Los ajustes de la app, en la tabla ajuste, con su valor en JSON. Las claves
// que empiezan por «local.» son de este móvil y no viajan al exportar; las
// demás sí. Un ajuste que viaja no se borra nunca: volver al valor por defecto
// es guardar null, para que el valor viejo no vuelva con una importación.
//
// El valor se pasa a la base siempre como texto JSON: en iPhone, expo-sqlite
// enlaza los números de JavaScript como REAL, y 90000 se guardaría como
// 90000.0.

export type ValorDeAjuste =
  | string
  | number
  | boolean
  | null
  | ValorDeAjuste[]
  | { [clave: string]: ValorDeAjuste };

/** El valor de un ajuste, o undefined si nunca se guardó. */
export async function leerAjuste(l: Lectura, clave: string): Promise<ValorDeAjuste | undefined> {
  const fila = await l.getFirstAsync<{ valor: string }>(
    'SELECT valor FROM ajuste WHERE clave = :clave',
    p({ clave }),
  );
  return fila === null ? undefined : (JSON.parse(fila.valor) as ValorDeAjuste);
}

export async function ponerAjusteEn(
  tx: Transaccion,
  clave: string,
  valor: ValorDeAjuste,
  ahora: number,
): Promise<void> {
  const fila = await tx.getFirstAsync<{ modificado: number }>(
    'SELECT modificado FROM ajuste WHERE clave = :clave',
    p({ clave }),
  );
  await tx.runAsync(
    `INSERT INTO ajuste (clave, valor, modificado) VALUES (:clave, :valor, :modificado)
     ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor, modificado = excluded.modificado`,
    p({ clave, valor: JSON.stringify(valor), modificado: nuevoSello(ahora, fila?.modificado) }),
  );
}

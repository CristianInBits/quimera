import type { ValorDeAjuste } from '@/datos/ajustes';

// El último entreno borrado desde su detalle. El detalle se cierra al borrar,
// así que el aviso para deshacerlo sale en el historial, en la lista de donde
// acaba de desaparecer. Se recoge una sola vez: al volver otra vez al
// historial ya no sale.

export type Borrado = {
  id: string;
  aviso: string;
  /**
   * La corrección a medias que tenía el entreno, tal como estaba guardada. Se
   * quita al borrarlo, para que no se quede en el móvil si el borrado no se
   * deshace, y vuelve a su sitio al deshacerlo.
   */
  correccion?: ValorDeAjuste;
};

let pendiente: Borrado | null = null;

export function avisarDelBorrado(borrado: Borrado): void {
  pendiente = borrado;
}

export function recogerElBorrado(): Borrado | null {
  const borrado = pendiente;
  pendiente = null;
  return borrado;
}

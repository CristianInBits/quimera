import type { NombreDeIcono } from '@/componentes/Icono';
import { CopiaMasNueva, CopiaNoValida, DatoQueNoCabe, type Cuenta, type ResumenDeImportacion } from '@/datos/copia';
import { diasEntre, fechaDeInstante, fechaEnFrase } from '@/datos/fechas';
import { cifra } from '@/inicio/comparar';

// Los textos de la pantalla «Tus datos» que dependen de los datos, los que
// aprobó Cristian el 25 de noviembre de 2026. Los fijos van en la pantalla.

/** «1 entreno», «12 entrenos». */
const cuantos = (n: number, singular: string, plural: string) => (n === 1 ? `1 ${singular}` : `${cifra(n)} ${plural}`);

/**
 * La última copia guardada, para la tarjeta «Hacer una copia», partida en lo
 * que va delante y lo que destaca: «Última copia: » y «hace 12 días.». Una
 * apuntada hasta un día por delante del reloj, que leerUltimaCopia da por
 * buena, se dice como de hoy.
 */
export function textoDeLaUltimaCopia(ultima: number | null, hoy: string): { antes: string; destacado: string } {
  if (ultima === null) {
    return { antes: '', destacado: 'Todavía no has hecho ninguna copia en este móvil.' };
  }
  const dias = diasEntre(fechaDeInstante(ultima), hoy);
  const cuando = dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${cifra(dias)} días`;
  return { antes: 'Última copia: ', destacado: `${cuando}.` };
}

/**
 * La línea que deja reconocer una copia antes de importarla: «Copia hecha el
 * viernes 20 de noviembre, con 52 entrenos.». Sin la fecha si la copia no la
 * da, como la de un reloj atrasado.
 */
export function lineaDeLaCopia({ hecha, entrenos }: { hecha: number | null; entrenos: number }, hoy: string): string {
  const con = entrenos === 0 ? 'sin entrenos' : `con ${cuantos(entrenos, 'entreno', 'entrenos')}`;
  if (hecha === null) {
    return `Copia ${con}.`;
  }
  const cuando = fechaEnFrase(fechaDeInstante(hecha), hoy);
  return `Copia hecha ${cuando === 'hoy' || cuando === 'ayer' ? cuando : `el ${cuando}`}, ${con}.`;
}

/** Una fila de «Esto es lo que va a cambiar», con su icono y la cifra que destaca. */
export type FilaDelResumen = {
  icono: NombreDeIcono;
  antes: string;
  destacado: string;
  despues: string;
};

/** El texto entero de una fila, como lo lee el lector de pantalla. */
export const textoDeLaFila = ({ antes, destacado, despues }: FilaDelResumen) => `${antes}${destacado}${despues}`;

/** Las filas de una clase de datos: primero lo que se borra, para que no pase sin verse. */
function filasDe(cuenta: Cuenta, singular: string, plural: string, nuevos: { uno: string; varios: string }): FilaDelResumen[] {
  const filas: FilaDelResumen[] = [];
  const { borrados, actualizados } = cuenta;
  if (borrados > 0) {
    filas.push({
      icono: 'circuloMenos',
      antes: borrados === 1 ? 'Se borra ' : 'Se borran ',
      destacado: cuantos(borrados, singular, plural),
      despues: borrados === 1 ? ' que se borró después en el otro móvil.' : ' que se borraron después en el otro móvil.',
    });
  }
  if (cuenta.nuevos > 0) {
    filas.push({
      icono: 'circuloMas',
      antes: cuenta.nuevos === 1 ? 'Entra ' : 'Entran ',
      destacado: cuantos(cuenta.nuevos, singular, plural),
      despues: cuenta.nuevos === 1 ? nuevos.uno : nuevos.varios,
    });
  }
  if (actualizados > 0) {
    filas.push({
      icono: 'actualizar',
      antes: actualizados === 1 ? 'Se actualiza ' : 'Se actualizan ',
      destacado: cuantos(actualizados, singular, plural),
      despues: actualizados === 1 ? ' que se cambió después en el otro móvil.' : ' que se cambiaron después en el otro móvil.',
    });
  }
  return filas;
}

/**
 * Lo que cambia a la vista al importar, en filas: los entrenos, los
 * ejercicios propios y los ajustes, solo lo que no es cero. Sin ninguna
 * fila, la copia no cambia nada de lo que se ve. Un ajuste no se borra nunca,
 * y uno que no estaba cuenta como actualizado: para la persona, cambia.
 */
export function filasDelResumen(resumen: Pick<ResumenDeImportacion, 'entrenos' | 'ejercicios' | 'ajustes'>): FilaDelResumen[] {
  const { ajustes } = resumen;
  return [
    ...filasDe(resumen.entrenos, 'entreno', 'entrenos', { uno: ' en tu historial.', varios: ' en tu historial.' }),
    ...filasDe(resumen.ejercicios, 'ejercicio', 'ejercicios', {
      uno: ' creado en el otro móvil.',
      varios: ' creados en el otro móvil.',
    }),
    ...filasDe({ ...ajustes, nuevos: 0, actualizados: ajustes.nuevos + ajustes.actualizados, borrados: 0 }, 'ajuste', 'ajustes', {
      uno: '',
      varios: '',
    }),
  ];
}

/** Junta frases sueltas como se dicen: «a, b y c». */
function juntar(partes: string[]): string {
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

/** Lo que ha cambiado en una clase de datos, en frases sueltas; solo la primera lleva el nombre. */
function cambiosDe(cuenta: Pick<Cuenta, 'nuevos' | 'actualizados' | 'borrados'>, singular: string, plural: string): string[] {
  const partes: string[] = [];
  const decir = (n: number, uno: string, varios: string) => {
    if (n === 0) return;
    const cifraDicha = partes.length === 0 ? cuantos(n, singular, plural) : cifra(n);
    partes.push(`${n === 1 ? uno : varios} ${cifraDicha}`);
  };
  decir(cuenta.nuevos, 'ha entrado', 'han entrado');
  decir(cuenta.actualizados, 'se ha actualizado', 'se han actualizado');
  decir(cuenta.borrados, 'se ha borrado', 'se han borrado');
  return partes;
}

/**
 * Lo que dice la tarjeta al acabar de importar: «Copia importada. Han
 * entrado 12 entrenos, se han actualizado 3 y se ha borrado 1.», solo con lo
 * que no es cero.
 */
export function textoDeLoImportado(resumen: Pick<ResumenDeImportacion, 'entrenos' | 'ejercicios' | 'ajustes'>): string {
  const { ajustes } = resumen;
  const partes = [
    ...cambiosDe(resumen.entrenos, 'entreno', 'entrenos'),
    ...cambiosDe(resumen.ejercicios, 'ejercicio', 'ejercicios'),
    ...cambiosDe({ nuevos: 0, actualizados: ajustes.nuevos + ajustes.actualizados, borrados: 0 }, 'ajuste', 'ajustes'),
  ];
  if (partes.length === 0) {
    return 'Copia importada. No ha cambiado nada de lo que ves.';
  }
  const frase = juntar(partes);
  return `Copia importada. ${frase.charAt(0).toUpperCase()}${frase.slice(1)}.`;
}

/**
 * Por qué no se puede importar un archivo, al leerlo o al ver qué cambiaría:
 * no es una copia, está dañada, es de una Quimera más nueva o no se pudo
 * leer.
 */
export function mensajeAlLeer(error: unknown): string {
  if (error instanceof CopiaNoValida) {
    if (error.tipo === 'noEsCopia') {
      return 'Este archivo no es una copia de Quimera, o está dañado. Prueba con otro.';
    }
    const donde = error.detalle === undefined ? '' : ` (${error.detalle})`;
    return `La copia está dañada y no se puede importar. Prueba con otra.${donde}`;
  }
  if (error instanceof CopiaMasNueva) {
    return 'La copia es de una Quimera más nueva que esta. Actualiza Quimera para importarla.';
  }
  return `No se pudo leer el archivo. Prueba otra vez. (${String(error)})`;
}

/** Por qué no se pudo hacer la copia: algo del móvil no cabe en el formato, o cualquier otro fallo. */
export function mensajeAlCopiar(error: unknown): string {
  return error instanceof DatoQueNoCabe
    ? `No se pudo hacer la copia: algo guardado no cabe en ella. (${error.detalle})`
    : `No se pudo hacer la copia. Prueba otra vez. (${String(error)})`;
}

/** Por qué no se pudo importar la copia: la transacción se deshace entera. */
export const mensajeAlImportar = (error: unknown) =>
  `No se pudo importar la copia. No ha cambiado nada: prueba otra vez. (${String(error)})`;

/** Por qué no se pudo apuntar que la copia está guardada. */
export const mensajeAlApuntar = (error: unknown) => `No se pudo apuntar que la has guardado. Prueba otra vez. (${String(error)})`;

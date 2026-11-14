// Las fechas de Quimera son fechas locales del móvil, sin zona horaria: un
// entreno es del día en que se hizo, también de viaje y con el cambio de hora.
// Se guardan como texto AAAA-MM-DD, y la hora como HH:MM. La semana va de
// lunes a domingo.
//
// Nunca se usa toISOString para una fecha guardada, porque da la fecha en UTC
// y, cerca de medianoche, el día equivocado. Tampoco se pasa el texto
// AAAA-MM-DD al constructor de Date, que lo lee como medianoche en UTC: para
// enseñar una fecha guardada está deFecha.

const dos = (n: number) => String(n).padStart(2, '0');

/** La fecha local de un instante, como AAAA-MM-DD. */
export function fechaLocal(instante: Date): string {
  return `${instante.getFullYear()}-${dos(instante.getMonth() + 1)}-${dos(instante.getDate())}`;
}

/** La hora local de un instante, como HH:MM. */
export function horaLocal(instante: Date): string {
  return `${dos(instante.getHours())}:${dos(instante.getMinutes())}`;
}

function partes(fecha: string): [number, number, number] {
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (r === null) {
    throw new Error(`La fecha ${fecha} no tiene la forma AAAA-MM-DD.`);
  }
  const [a, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  const comprobada = new Date(Date.UTC(a, m - 1, d));
  if (comprobada.getUTCMonth() !== m - 1 || comprobada.getUTCDate() !== d) {
    throw new Error(`La fecha ${fecha} no existe.`);
  }
  return [a, m, d];
}

/** Si un texto es una fecha AAAA-MM-DD que existe. */
export function esFecha(texto: string): boolean {
  try {
    partes(texto);
    return true;
  } catch {
    return false;
  }
}

/**
 * El lunes de la semana de una fecha. Cuenta días en el calendario, sin zona
 * horaria, y da lo mismo que la vista entreno_hecho en SQL:
 * date(fecha, '-6 days', 'weekday 1').
 */
export function lunesDe(fecha: string): string {
  const [a, m, d] = partes(fecha);
  const dia = new Date(Date.UTC(a, m - 1, d));
  const atras = (dia.getUTCDay() + 6) % 7;
  dia.setUTCDate(dia.getUTCDate() - atras);
  return `${dia.getUTCFullYear()}-${dos(dia.getUTCMonth() + 1)}-${dos(dia.getUTCDate())}`;
}

/** La hora local, HH:MM, de un instante en milisegundos. */
export function horaDeInstante(ms: number): string {
  return horaLocal(new Date(ms));
}

/** Una fecha guardada como el Date de su medianoche local, para enseñarla. */
export function deFecha(fecha: string): Date {
  const [a, m, d] = partes(fecha);
  return new Date(a, m - 1, d);
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** La fecha anterior a otra, contando días en el calendario. */
export function diaAnterior(fecha: string): string {
  const [a, m, d] = partes(fecha);
  const dia = new Date(Date.UTC(a, m - 1, d - 1));
  return `${dia.getUTCFullYear()}-${dos(dia.getUTCMonth() + 1)}-${dos(dia.getUTCDate())}`;
}

/**
 * Una fecha guardada dicha para la persona: «Hoy», «Ayer», «jue 12 nov» o, si
 * es de otro año, «jue 12 nov 2025». Sin Intl, para que salga igual en todos
 * los móviles.
 */
export function textoDeFecha(fecha: string, hoy: string): string {
  if (fecha === hoy) return 'Hoy';
  if (fecha === diaAnterior(hoy)) return 'Ayer';
  const [a, m, d] = partes(fecha);
  const dia = DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
  const texto = `${dia} ${d} ${MESES[m - 1]}`;
  return a === partes(hoy)[0] ? texto : `${texto} ${a}`;
}

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

/** La fecha local, AAAA-MM-DD, de un instante en milisegundos. */
export function fechaDeInstante(ms: number): string {
  return fechaLocal(new Date(ms));
}

/**
 * Cuántos días van de una fecha a otra, contando días en el calendario: de
 * ayer a hoy, 1, también con el cambio de hora; negativo si la segunda es
 * anterior.
 */
export function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = partes(desde);
  const [a2, m2, d2] = partes(hasta);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

/** Una fecha guardada como el Date de su medianoche local, para enseñarla. */
export function deFecha(fecha: string): Date {
  const [a, m, d] = partes(fecha);
  return new Date(a, m - 1, d);
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_ENTEROS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** La fecha n días después de otra, o antes con n negativo, contando días en el calendario. */
export function sumarDias(fecha: string, n: number): string {
  const [a, m, d] = partes(fecha);
  const dia = new Date(Date.UTC(a, m - 1, d + n));
  return `${dia.getUTCFullYear()}-${dos(dia.getUTCMonth() + 1)}-${dos(dia.getUTCDate())}`;
}

/** La fecha anterior a otra, contando días en el calendario. */
export function diaAnterior(fecha: string): string {
  return sumarDias(fecha, -1);
}

/**
 * Una semana dicha para la persona, por su lunes: «Esta semana», «La semana
 * pasada», «Del 2 al 8 de noviembre» o «Del 27 de octubre al 2 de
 * noviembre». Si no es del año de hoy, lleva el año: «Del 29 de diciembre de
 * 2025 al 4 de enero de 2026».
 */
export function textoDeSemana(lunes: string, hoy: string): string {
  const esta = lunesDe(hoy);
  if (lunes === esta) return 'Esta semana';
  if (lunes === sumarDias(esta, -7)) return 'La semana pasada';
  const [a1, m1, d1] = partes(lunes);
  const [a2, m2, d2] = partes(sumarDias(lunes, 6));
  const anoDeHoy = partes(hoy)[0];
  if (a1 !== a2) {
    return `Del ${d1} de ${MESES_ENTEROS[m1 - 1]} de ${a1} al ${d2} de ${MESES_ENTEROS[m2 - 1]} de ${a2}`;
  }
  const fin = `${d2} de ${MESES_ENTEROS[m2 - 1]}${a2 === anoDeHoy ? '' : ` de ${a2}`}`;
  return m1 === m2 ? `Del ${d1} al ${fin}` : `Del ${d1} de ${MESES_ENTEROS[m1 - 1]} al ${fin}`;
}

const DIAS_ENTEROS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * Una fecha guardada para decirla entera dentro de una frase, como la lee bien
 * un lector de pantalla: «hoy», «ayer», «sábado 7 de noviembre» o, si es de
 * otro año, «sábado 7 de noviembre de 2025».
 */
export function fechaEnFrase(fecha: string, hoy: string): string {
  if (fecha === hoy) return 'hoy';
  if (fecha === diaAnterior(hoy)) return 'ayer';
  const [a, m, d] = partes(fecha);
  const texto = `${DIAS_ENTEROS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]} ${d} de ${MESES_ENTEROS[m - 1]}`;
  return a === partes(hoy)[0] ? texto : `${texto} de ${a}`;
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

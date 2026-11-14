import {
  deFecha,
  diaAnterior,
  fechaEnFrase,
  fechaLocal,
  horaDeInstante,
  horaLocal,
  lunesDe,
  sumarDias,
  textoDeFecha,
  textoDeSemana,
} from '@/datos/fechas';
import { abrirBaseDePrueba } from '@/pruebas/baseDePrueba';

describe('Las fechas locales', () => {
  it('las pruebas corren en una zona horaria distinta de UTC, para notar las fechas en UTC', () => {
    // La fija src/pruebas/zonaHoraria.ts antes de todas las pruebas.
    expect(new Date(Date.UTC(2026, 0, 15, 12, 0)).getHours()).not.toBe(12);
  });

  it('fechaLocal da el día local también cerca de medianoche', () => {
    // Con toISOString, a las 00:30 en España saldría el día anterior, y a las
    // 23:30 al oeste de UTC, el siguiente.
    expect(fechaLocal(new Date(2026, 10, 15, 0, 30))).toBe('2026-11-15');
    expect(fechaLocal(new Date(2026, 10, 15, 23, 30))).toBe('2026-11-15');
    expect(fechaLocal(new Date(2027, 0, 1, 0, 5))).toBe('2027-01-01');
  });

  it('horaLocal da HH:MM', () => {
    expect(horaLocal(new Date(2026, 10, 15, 7, 5))).toBe('07:05');
    expect(horaLocal(new Date(2026, 10, 15, 23, 59))).toBe('23:59');
  });

  it('lunesDe da el lunes de la semana, de lunes a domingo', () => {
    expect(lunesDe('2026-11-09')).toBe('2026-11-09');
    expect(lunesDe('2026-11-15')).toBe('2026-11-09');
    expect(lunesDe('2027-01-03')).toBe('2026-12-28');
    // Los domingos del cambio de hora de 2026 en España.
    expect(lunesDe('2026-03-29')).toBe('2026-03-23');
    expect(lunesDe('2026-10-25')).toBe('2026-10-19');
  });

  it('lunesDe da lo mismo que la vista de la base, día a día de 2024 a 2027', () => {
    const db = abrirBaseDePrueba();
    const dias = db.mirar<{ fecha: string; lunes: string }>(
      `WITH RECURSIVE dia (fecha) AS (
         SELECT '2024-01-01' UNION ALL SELECT date(fecha, '+1 day') FROM dia WHERE fecha < '2027-12-31'
       )
       SELECT fecha, date(fecha, '-6 days', 'weekday 1') AS lunes FROM dia`,
    );
    db.cerrar();
    expect(dias).toHaveLength(1461);
    for (const { fecha, lunes } of dias) {
      expect(lunesDe(fecha)).toBe(lunes);
    }
  });

  it('rechaza las fechas mal escritas o que no existen', () => {
    expect(() => lunesDe('2026-02-30')).toThrow(/no existe/);
    expect(() => lunesDe('2026-11-5')).toThrow(/AAAA-MM-DD/);
    expect(() => lunesDe('')).toThrow(/AAAA-MM-DD/);
  });

  it('textoDeFecha dice Hoy, Ayer o el día, y el año solo si no es el de hoy', () => {
    expect(textoDeFecha('2026-11-15', '2026-11-15')).toBe('Hoy');
    expect(textoDeFecha('2026-11-14', '2026-11-15')).toBe('Ayer');
    expect(textoDeFecha('2026-11-12', '2026-11-15')).toBe('jue 12 nov');
    expect(textoDeFecha('2026-12-31', '2027-01-01')).toBe('Ayer');
    expect(textoDeFecha('2025-11-12', '2026-11-15')).toBe('mié 12 nov 2025');
    expect(diaAnterior('2027-03-01')).toBe('2027-02-28');
  });

  it('sumarDias cuenta días en el calendario, hacia delante y hacia atrás', () => {
    expect(sumarDias('2026-11-15', 1)).toBe('2026-11-16');
    expect(sumarDias('2026-12-28', 6)).toBe('2027-01-03');
    expect(sumarDias('2028-03-01', -1)).toBe('2028-02-29');
    // Los cambios de hora de la zona de las pruebas, America/Los_Angeles, que
    // son el 8 de marzo y el 1 de noviembre de 2026, no mueven el día.
    expect(sumarDias('2026-10-31', 7)).toBe('2026-11-07');
    expect(sumarDias('2026-03-09', -1)).toBe('2026-03-08');
    expect(diaAnterior('2026-11-02')).toBe('2026-11-01');
  });

  it('fechaEnFrase dice la fecha entera, para leerla dentro de una frase', () => {
    const hoy = '2026-11-15';
    expect(fechaEnFrase('2026-11-15', hoy)).toBe('hoy');
    expect(fechaEnFrase('2026-11-14', hoy)).toBe('ayer');
    expect(fechaEnFrase('2026-11-07', hoy)).toBe('sábado 7 de noviembre');
    expect(fechaEnFrase('2026-11-11', hoy)).toBe('miércoles 11 de noviembre');
    expect(fechaEnFrase('2025-12-31', hoy)).toBe('miércoles 31 de diciembre de 2025');
  });

  it('textoDeSemana dice esta semana, la pasada o los días, y el año solo si no es el de hoy', () => {
    const hoy = '2026-11-15';
    expect(textoDeSemana('2026-11-09', hoy)).toBe('Esta semana');
    expect(textoDeSemana('2026-11-02', hoy)).toBe('La semana pasada');
    expect(textoDeSemana('2026-10-12', hoy)).toBe('Del 12 al 18 de octubre');
    expect(textoDeSemana('2026-10-26', hoy)).toBe('Del 26 de octubre al 1 de noviembre');
    expect(textoDeSemana('2025-11-10', hoy)).toBe('Del 10 al 16 de noviembre de 2025');
    expect(textoDeSemana('2025-12-29', '2026-02-01')).toBe('Del 29 de diciembre de 2025 al 4 de enero de 2026');
    // El domingo es aún de esta semana; el lunes siguiente, la anterior pasa a ser la pasada.
    expect(textoDeSemana('2026-11-09', '2026-11-16')).toBe('La semana pasada');
  });

  it('horaDeInstante da la hora local de un instante', () => {
    expect(horaDeInstante(new Date(2026, 10, 15, 7, 5).getTime())).toBe('07:05');
  });

  it('deFecha da la medianoche local de una fecha guardada', () => {
    const fecha = deFecha('2026-11-15');
    expect([fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), fecha.getHours()]).toEqual([2026, 10, 15, 0]);
  });
});

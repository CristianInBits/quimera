import {
  filasDelResumen,
  lineaDeLaCopia,
  mensajeAlApuntar,
  mensajeAlCopiar,
  mensajeAlImportar,
  mensajeAlLeer,
  textoDeLaFila,
  textoDeLaUltimaCopia,
  textoDeLoImportado,
} from '@/copias/textos';
import { CopiaMasNueva, CopiaNoValida, DatoQueNoCabe, type Cuenta } from '@/datos/copia';
import { cifra } from '@/inicio/comparar';

/** Las cuentas de una importación, con lo que no se diga a cero. */
const cuentas = (
  entrenos: Partial<Cuenta> = {},
  ejercicios: Partial<Cuenta> = {},
  ajustes: Partial<Cuenta> = {},
): { entrenos: Cuenta; ejercicios: Cuenta; ajustes: Cuenta } => {
  const cero: Cuenta = { nuevos: 0, actualizados: 0, borrados: 0, sinCambios: 0 };
  return { entrenos: { ...cero, ...entrenos }, ejercicios: { ...cero, ...ejercicios }, ajustes: { ...cero, ...ajustes } };
};

/** Un instante en la hora local del móvil. */
const local = (ano: number, mes: number, dia: number, hora = 12, minuto = 0) => new Date(ano, mes - 1, dia, hora, minuto).getTime();

describe('Los textos de «Tus datos»', () => {
  describe('la última copia guardada', () => {
    it('sin ninguna, lo dice entero', () => {
      expect(textoDeLaUltimaCopia(null, '2026-11-25')).toEqual({
        antes: '',
        destacado: 'Todavía no has hecho ninguna copia en este móvil.',
      });
    });

    it('dice hoy, ayer o hace cuántos días, por las fechas locales y no por las horas', () => {
      const hoy = '2026-11-25';
      expect(textoDeLaUltimaCopia(local(2026, 11, 25, 0, 5), hoy)).toEqual({ antes: 'Última copia: ', destacado: 'hoy.' });
      expect(textoDeLaUltimaCopia(local(2026, 11, 24, 23, 55), hoy)).toEqual({ antes: 'Última copia: ', destacado: 'ayer.' });
      expect(textoDeLaUltimaCopia(local(2026, 11, 24, 0, 5), hoy).destacado).toBe('ayer.');
      expect(textoDeLaUltimaCopia(local(2026, 11, 23, 23, 55), hoy).destacado).toBe('hace 2 días.');
      expect(textoDeLaUltimaCopia(local(2026, 11, 13), hoy).destacado).toBe('hace 12 días.');
      expect(textoDeLaUltimaCopia(local(2025, 11, 25), hoy).destacado).toBe('hace 365 días.');
      expect(textoDeLaUltimaCopia(local(1999, 1, 1), hoy).destacado).toBe(`hace ${cifra(10_190)} días.`);
      // A través del cambio de hora de la zona de las pruebas, America/Los_Angeles, el 8 de marzo de 2026.
      expect(textoDeLaUltimaCopia(local(2026, 3, 7, 0, 5), '2026-03-09').destacado).toBe('hace 2 días.');
      expect(textoDeLaUltimaCopia(local(2026, 3, 8, 23, 55), '2026-03-09').destacado).toBe('ayer.');
    });

    it('una que va hasta un día por delante del reloj, que todavía cuenta, se dice como de hoy', () => {
      expect(textoDeLaUltimaCopia(local(2026, 11, 26, 9), '2026-11-25').destacado).toBe('hoy.');
    });
  });

  describe('la línea de la copia que se va a importar', () => {
    const hoy = '2026-11-25';

    it('dice cuándo se hizo y cuántos entrenos trae', () => {
      expect(lineaDeLaCopia({ hecha: local(2026, 11, 20, 18, 30), entrenos: 52 }, hoy)).toBe(
        'Copia hecha el viernes 20 de noviembre, con 52 entrenos.',
      );
      expect(lineaDeLaCopia({ hecha: local(2026, 11, 25, 0, 5), entrenos: 1 }, hoy)).toBe('Copia hecha hoy, con 1 entreno.');
      expect(lineaDeLaCopia({ hecha: local(2026, 11, 24, 23, 55), entrenos: 0 }, hoy)).toBe('Copia hecha ayer, sin entrenos.');
      expect(lineaDeLaCopia({ hecha: local(2025, 11, 7), entrenos: 12_345 }, hoy)).toBe(
        `Copia hecha el viernes 7 de noviembre de 2025, con ${cifra(12_345)} entrenos.`,
      );
    });

    it('sin la fecha si la copia no la da', () => {
      expect(lineaDeLaCopia({ hecha: null, entrenos: 52 }, hoy)).toBe('Copia con 52 entrenos.');
      expect(lineaDeLaCopia({ hecha: null, entrenos: 0 }, hoy)).toBe('Copia sin entrenos.');
    });
  });

  describe('lo que va a cambiar', () => {
    it('sin nada que cambie a la vista, no hay filas, aunque haya cosas sin cambios', () => {
      expect(filasDelResumen(cuentas({ sinCambios: 3 }, { sinCambios: 1 }, { sinCambios: 2 }))).toEqual([]);
    });

    it('de los entrenos, primero lo que se borra, después lo que entra y lo que se actualiza, con la cifra aparte', () => {
      expect(filasDelResumen(cuentas({ nuevos: 12, actualizados: 3, borrados: 1, sinCambios: 40 }))).toEqual([
        {
          icono: 'circuloMenos',
          antes: 'Se borra ',
          destacado: '1 entreno',
          despues: ' que se borró después en el otro móvil.',
        },
        { icono: 'circuloMas', antes: 'Entran ', destacado: '12 entrenos', despues: ' en tu historial.' },
        {
          icono: 'actualizar',
          antes: 'Se actualizan ',
          destacado: '3 entrenos',
          despues: ' que se cambiaron después en el otro móvil.',
        },
      ]);
      expect(filasDelResumen(cuentas({ nuevos: 1, actualizados: 1, borrados: 2 })).map(textoDeLaFila)).toEqual([
        'Se borran 2 entrenos que se borraron después en el otro móvil.',
        'Entra 1 entreno en tu historial.',
        'Se actualiza 1 entreno que se cambió después en el otro móvil.',
      ]);
      expect(filasDelResumen(cuentas({ nuevos: 12_345 })).map(textoDeLaFila)).toEqual([
        `Entran ${cifra(12_345)} entrenos en tu historial.`,
      ]);
    });

    it('igual con los ejercicios propios, y los ajustes que llegan o cambian se actualizan', () => {
      expect(filasDelResumen(cuentas({}, { nuevos: 2, actualizados: 1, borrados: 1 }, { nuevos: 1, actualizados: 1 })).map(textoDeLaFila)).toEqual([
        'Se borra 1 ejercicio que se borró después en el otro móvil.',
        'Entran 2 ejercicios creados en el otro móvil.',
        'Se actualiza 1 ejercicio que se cambió después en el otro móvil.',
        'Se actualizan 2 ajustes que se cambiaron después en el otro móvil.',
      ]);
      expect(filasDelResumen(cuentas({}, { nuevos: 1, actualizados: 2, borrados: 3 }, { nuevos: 1 })).map(textoDeLaFila)).toEqual([
        'Se borran 3 ejercicios que se borraron después en el otro móvil.',
        'Entra 1 ejercicio creado en el otro móvil.',
        'Se actualizan 2 ejercicios que se cambiaron después en el otro móvil.',
        'Se actualiza 1 ajuste que se cambió después en el otro móvil.',
      ]);
    });

    it('primero los entrenos, después los ejercicios y al final los ajustes', () => {
      const filas = filasDelResumen(cuentas({ nuevos: 1 }, { nuevos: 1 }, { actualizados: 1 }));
      expect(filas.map((fila) => fila.destacado)).toEqual(['1 entreno', '1 ejercicio', '1 ajuste']);
    });
  });

  describe('lo que dice al acabar de importar', () => {
    it('solo lo que no es cero, con el nombre en lo primero que se dice', () => {
      expect(textoDeLoImportado(cuentas({ nuevos: 12, actualizados: 3, borrados: 1, sinCambios: 7 }))).toBe(
        'Copia importada. Han entrado 12 entrenos, se han actualizado 3 y se ha borrado 1.',
      );
      expect(textoDeLoImportado(cuentas({ nuevos: 1 }))).toBe('Copia importada. Ha entrado 1 entreno.');
      expect(textoDeLoImportado(cuentas({ actualizados: 1, borrados: 2 }))).toBe(
        'Copia importada. Se ha actualizado 1 entreno y se han borrado 2.',
      );
      expect(textoDeLoImportado(cuentas({ borrados: 2 }))).toBe('Copia importada. Se han borrado 2 entrenos.');
    });

    it('también los ejercicios propios y los ajustes, después de los entrenos', () => {
      expect(textoDeLoImportado(cuentas({ nuevos: 2 }, { nuevos: 1, borrados: 3 }, { nuevos: 1, actualizados: 1 }))).toBe(
        'Copia importada. Han entrado 2 entrenos, ha entrado 1 ejercicio, se han borrado 3 y se han actualizado 2 ajustes.',
      );
      expect(textoDeLoImportado(cuentas({}, {}, { nuevos: 1 }))).toBe('Copia importada. Se ha actualizado 1 ajuste.');
    });

    it('si no ha cambiado nada a la vista, lo dice', () => {
      expect(textoDeLoImportado(cuentas({ sinCambios: 52 }, { sinCambios: 1 }, { sinCambios: 2 }))).toBe(
        'Copia importada. No ha cambiado nada de lo que ves.',
      );
    });
  });

  describe('los mensajes de error', () => {
    it('al leer: no es una copia, está dañada, es más nueva o no se pudo leer', () => {
      expect(mensajeAlLeer(new CopiaNoValida('noEsCopia'))).toBe(
        'Este archivo no es una copia de Quimera, o está dañado. Prueba con otro.',
      );
      expect(mensajeAlLeer(new CopiaNoValida('danada', 'entrenos[3].fecha no es válido'))).toBe(
        'La copia está dañada y no se puede importar. Prueba con otra. (entrenos[3].fecha no es válido)',
      );
      expect(mensajeAlLeer(new CopiaNoValida('danada'))).toBe('La copia está dañada y no se puede importar. Prueba con otra.');
      expect(mensajeAlLeer(new CopiaMasNueva())).toBe(
        'La copia es de una Quimera más nueva que esta. Actualiza Quimera para importarla.',
      );
      expect(mensajeAlLeer(new Error('sin permiso'))).toBe('No se pudo leer el archivo. Prueba otra vez. (Error: sin permiso)');
    });

    it('al copiar: algo que no cabe en la copia, con dónde, o cualquier otro fallo', () => {
      expect(mensajeAlCopiar(new DatoQueNoCabe('entrenos[0].notas no es válido'))).toBe(
        'No se pudo hacer la copia: algo guardado no cabe en ella. (entrenos[0].notas no es válido)',
      );
      expect(mensajeAlCopiar(new Error('disco lleno'))).toBe('No se pudo hacer la copia. Prueba otra vez. (Error: disco lleno)');
    });

    it('al importar y al apuntar la copia guardada', () => {
      expect(mensajeAlImportar(new Error('disco lleno'))).toBe(
        'No se pudo importar la copia. No ha cambiado nada: prueba otra vez. (Error: disco lleno)',
      );
      expect(mensajeAlApuntar(new Error('disco lleno'))).toBe(
        'No se pudo apuntar que la has guardado. Prueba otra vez. (Error: disco lleno)',
      );
    });
  });
});

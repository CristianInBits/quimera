import { puertaDe } from '@/datos/base';
import { leerCargaDeInicio } from '@/datos/carga';
import { borrarEntrenoEn, guardarEntrenoEn, type Entreno } from '@/datos/entrenos';
import type { BaseDePrueba } from '@/pruebas/baseDePrueba';
import { T0, abrirBasePreparada, generadorDeIds, gimnasioConCalentamiento, hyroxConDescansos } from '@/pruebas/datos';

describe('La carga de Inicio', () => {
  let db: BaseDePrueba;
  const nuevoId = generadorDeIds();
  beforeEach(async () => {
    db = await abrirBasePreparada();
  });
  afterEach(() => db.cerrar());

  const guardar = (entreno: Entreno) => puertaDe(db).escribir((tx) => guardarEntrenoEn(tx, entreno, { ahora: T0 }));
  const leer = (lunes: string) => puertaDe(db).leer((l) => leerCargaDeInicio(l, lunes));

  // Los lunes de las ocho semanas de la gráfica, si esta empieza el lunes 9 de noviembre.
  const LUNES = ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'];
  const graficaCon = (cargas: number[]) => LUNES.map((lunes, i) => ({ lunes, carga: cargas[i] }));

  it('sin entrenos, todas las semanas a cero y nada guardado', async () => {
    expect(await leer('2026-11-09')).toEqual({
      estaSemana: { lunes: '2026-11-09', carga: 0, minutos: 0, entrenos: 0, porDisciplina: [] },
      laPasada: { lunes: '2026-11-02', carga: 0, minutos: 0, entrenos: 0, porDisciplina: [] },
      ultimasSemanas: graficaCon([0, 0, 0, 0, 0, 0, 0, 0]),
      hayEntrenos: false,
    });
  });

  it('la gráfica lleva las ocho últimas semanas, de la más antigua a esta: la de antes y la siguiente no cuentan', async () => {
    // El domingo 20 de septiembre es de la semana anterior a la primera; el lunes 21 abre la primera.
    await guardar(gimnasioConCalentamiento(nuevoId, '2026-09-20'));
    await guardar({ ...gimnasioConCalentamiento(nuevoId, '2026-09-21'), esfuerzo: 5 });
    await guardar({ ...gimnasioConCalentamiento(nuevoId, '2026-10-14'), esfuerzo: 6 });
    await guardar(gimnasioConCalentamiento(nuevoId, '2026-11-15'));
    await guardar(gimnasioConCalentamiento(nuevoId, '2026-11-16'));
    expect((await leer('2026-11-09')).ultimasSemanas).toEqual(graficaCon([53 * 5, 0, 0, 53 * 6, 0, 0, 0, 371]));
  });

  it('suma cada semana de lunes a domingo, con los minutos de cada disciplina, sin los borrados', async () => {
    // Cada gimnasio dura 52 minutos y medio, que en las sumas son 53, con esfuerzo 7: 371 de carga.
    await guardar(gimnasioConCalentamiento(nuevoId, '2026-11-09'));
    await guardar(gimnasioConCalentamiento(nuevoId, '2026-11-15'));
    // El hyrox es del jueves 12: 45 minutos con esfuerzo 8, 360 de carga.
    await guardar(hyroxConDescansos(nuevoId));
    await guardar(gimnasioConCalentamiento(nuevoId, '2026-11-08'));
    await guardar(gimnasioConCalentamiento(nuevoId, '2026-11-01'));
    const borrado = gimnasioConCalentamiento(nuevoId, '2026-11-10');
    await guardar(borrado);
    await puertaDe(db).escribir((tx) => borrarEntrenoEn(tx, borrado.id, T0 + 1));

    expect(await leer('2026-11-09')).toEqual({
      estaSemana: {
        lunes: '2026-11-09',
        carga: 371 * 2 + 360,
        minutos: 53 * 2 + 45,
        entrenos: 3,
        porDisciplina: [
          { disciplina: 'gimnasio', minutos: 106 },
          { disciplina: 'hyrox', minutos: 45 },
        ],
      },
      // El domingo 8 es de la semana pasada; el domingo 1, de la anterior, que solo sale en la gráfica.
      laPasada: { lunes: '2026-11-02', carga: 371, minutos: 53, entrenos: 1, porDisciplina: [{ disciplina: 'gimnasio', minutos: 53 }] },
      ultimasSemanas: graficaCon([0, 0, 0, 0, 0, 371, 371, 371 * 2 + 360]),
      hayEntrenos: true,
    });
  });

  it('los cuatro bordes: el lunes de la pasada y el domingo de esta cuentan; el domingo de antes y el lunes siguiente, no', async () => {
    await guardar(gimnasioConCalentamiento(nuevoId, '2026-11-01'));
    await guardar({ ...gimnasioConCalentamiento(nuevoId, '2026-11-02'), esfuerzo: 5 });
    await guardar({ ...gimnasioConCalentamiento(nuevoId, '2026-11-15'), esfuerzo: 6 });
    await guardar(gimnasioConCalentamiento(nuevoId, '2026-11-16'));
    const { estaSemana, laPasada } = await leer('2026-11-09');
    expect([estaSemana.carga, laPasada.carga]).toEqual([53 * 6, 53 * 5]);
  });

  it('si los únicos entrenos están borrados, no hay entrenos', async () => {
    const borrado = gimnasioConCalentamiento(nuevoId, '2026-11-10');
    await guardar(borrado);
    await puertaDe(db).escribir((tx) => borrarEntrenoEn(tx, borrado.id, T0 + 1));
    expect((await leer('2026-11-09')).hayEntrenos).toBe(false);
  });

  it('una semana sin entrenos sale a cero aunque haya otros guardados', async () => {
    await guardar(gimnasioConCalentamiento(nuevoId, '2026-10-01'));
    const { estaSemana, laPasada, ultimasSemanas, hayEntrenos } = await leer('2026-11-09');
    expect([estaSemana.carga, laPasada.carga, hayEntrenos]).toEqual([0, 0, true]);
    // El jueves 1 de octubre es de la semana del lunes 28 de septiembre, la segunda de la gráfica.
    expect(ultimasSemanas).toEqual(graficaCon([0, 371, 0, 0, 0, 0, 0, 0]));
  });
});

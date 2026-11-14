import { puertaDe } from '@/datos/base';
import { borrarEntrenoEn, guardarEntrenoEn, type Entreno } from '@/datos/entrenos';
import { leerHistorial } from '@/datos/historial';
import type { BaseDePrueba } from '@/pruebas/baseDePrueba';
import { T0, abrirBasePreparada, generadorDeIds, gimnasioConCalentamiento, hyroxConDescansos } from '@/pruebas/datos';

describe('El historial', () => {
  let db: BaseDePrueba;
  const nuevoId = generadorDeIds();
  beforeEach(async () => {
    db = await abrirBasePreparada();
  });
  afterEach(() => db.cerrar());

  const guardar = (entreno: Entreno) => puertaDe(db).escribir((tx) => guardarEntrenoEn(tx, entreno, { ahora: T0 }));
  const historial = () => puertaDe(db).leer(leerHistorial);

  /** Un entreno de gimnasio con una superserie de press banca y remo, y una plancha. */
  const conSuperserie = (fecha: string, hora: string | null): Entreno => ({
    id: nuevoId(),
    disciplina: 'gimnasio',
    fecha,
    hora,
    duracionMs: 45 * 60_000 + 20_000,
    esfuerzo: 8,
    notas: null,
    bloques: [
      {
        id: nuevoId(),
        metrosCorridos: null,
        tiempoMs: null,
        descansoMs: 60_000,
        series: [1, 2].flatMap((ronda) =>
          (['press-banca', 'remo-barra'] as const).map((ejercicioId, i) => ({
            id: nuevoId(),
            ronda,
            orden: i + 1,
            ejercicioId,
            repeticiones: 8,
            pesoG: 60_000,
            tiempoMs: null,
            distanciaM: null,
            calorias: null,
            descansoMs: i === 0 ? 0 : ronda < 2 ? 90_000 : null,
          })),
        ),
      },
      {
        id: nuevoId(),
        metrosCorridos: null,
        tiempoMs: null,
        descansoMs: null,
        series: [
          {
            id: nuevoId(),
            ronda: 1,
            orden: 1,
            ejercicioId: 'plancha',
            repeticiones: null,
            pesoG: null,
            tiempoMs: 60_000,
            distanciaM: null,
            calorias: null,
            descansoMs: null,
          },
        ],
      },
    ],
  });

  it('está vacío sin entrenos', async () => {
    expect(await historial()).toEqual([]);
  });

  it('da cada entreno con su semana, sus minutos, su carga, sus ejercicios por orden y lo corrido', async () => {
    const superserie = conSuperserie('2026-11-12', '18:30');
    const calentamiento = gimnasioConCalentamiento(nuevoId, '2026-11-08');
    await guardar(superserie);
    await guardar(calentamiento);

    expect(await historial()).toEqual([
      {
        id: superserie.id,
        disciplina: 'gimnasio',
        fecha: '2026-11-12',
        hora: '18:30',
        lunes: '2026-11-09',
        minutos: 45,
        esfuerzo: 8,
        carga: 360,
        ejercicios: ['Press banca', 'Remo con barra', 'Plancha'],
        metros: 0,
      },
      {
        id: calentamiento.id,
        disciplina: 'gimnasio',
        fecha: '2026-11-08',
        hora: null,
        // El domingo es de la semana que empezó el lunes de antes.
        lunes: '2026-11-02',
        // 52 minutos y medio se redondean a 53, como en todas las sumas.
        minutos: 53,
        esfuerzo: 7,
        carga: 371,
        ejercicios: ['Press banca'],
        metros: 2000,
      },
    ]);
  });

  it('va del más reciente al más antiguo: por fecha, por hora, y los que no tienen hora al final del día', async () => {
    const manana = conSuperserie('2026-11-12', '08:00');
    const tarde = conSuperserie('2026-11-12', '19:15');
    const sinHora = conSuperserie('2026-11-12', null);
    const antes = conSuperserie('2026-11-11', '23:59');
    for (const entreno of [antes, sinHora, manana, tarde]) await guardar(entreno);

    expect((await historial()).map((entrada) => entrada.id)).toEqual([tarde.id, manana.id, sinHora.id, antes.id]);
  });

  it('los ejercicios van por su primera aparición, aunque se repitan en otro bloque', async () => {
    const bloque = (ejercicioId: string) => ({
      id: nuevoId(),
      metrosCorridos: null,
      tiempoMs: null,
      descansoMs: null,
      series: [
        { id: nuevoId(), ronda: 1, orden: 1, ejercicioId, repeticiones: 8, pesoG: null, tiempoMs: null, distanciaM: null, calorias: null, descansoMs: null },
      ],
    });
    await guardar({
      ...conSuperserie('2026-11-12', '18:30'),
      bloques: [bloque('press-banca'), bloque('remo-barra'), bloque('press-banca')],
    });
    expect((await historial()).map((entrada) => entrada.ejercicios)).toEqual([['Press banca', 'Remo con barra']]);
  });

  it('dos entrenos del mismo día a la misma hora van con el último apuntado primero', async () => {
    const primero = conSuperserie('2026-11-12', '18:30');
    const segundo = conSuperserie('2026-11-12', '18:30');
    await guardar(segundo);
    await guardar(primero);
    // Los identificadores nacen en orden: el segundo es mayor.
    expect((await historial()).map((entrada) => entrada.id)).toEqual([segundo.id, primero.id]);
  });

  it('no enseña los borrados, y cuenta cada disciplina con sus metros', async () => {
    const borrado = conSuperserie('2026-11-12', '18:30');
    const hyrox = hyroxConDescansos(nuevoId);
    await guardar(borrado);
    await guardar(hyrox);
    await puertaDe(db).escribir((tx) => borrarEntrenoEn(tx, borrado.id, T0 + 1));

    expect(await historial()).toEqual([
      expect.objectContaining({ id: hyrox.id, disciplina: 'hyrox', ejercicios: ['Correr', 'Wall balls', 'SkiErg', 'Burpees'], metros: 4000 }),
    ]);
  });
});

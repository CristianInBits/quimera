import { ponerAjusteEn } from '@/datos/ajustes';
import { puertaDe } from '@/datos/base';
import { leerEjercicios, type Ejercicio } from '@/datos/ejercicios';
import { guardarEntrenoEn, huellaDelEntreno, leerEntreno, type Entreno, type EntrenoGuardado } from '@/datos/entrenos';
import {
  anadirCarrera,
  anadirEjercicio,
  anadirVuelta,
  cambiarCarrera,
  cambiarDescanso,
  cambiarEntreno,
  cambiarSerie,
  claveDeCorreccion,
  comoEntrenoNuevo,
  enlazar,
  entrenoNuevo,
  leerBorrador,
  paraCorregir,
  validar,
  type EntrenoEnEdicion,
} from '@/gimnasio/editor';
import type { BaseDePrueba } from '@/pruebas/baseDePrueba';
import { T0, abrirBasePreparada, generadorDeIds, gimnasioConCalentamiento, hyroxConDescansos } from '@/pruebas/datos';

const HOY = '2026-11-15';

describe('Corregir un entreno guardado', () => {
  let db: BaseDePrueba;
  let ejercicios: Map<string, Ejercicio>;
  let nuevoId: () => string;
  beforeEach(async () => {
    db = await abrirBasePreparada();
    ejercicios = new Map((await puertaDe(db).leer(leerEjercicios)).map((e) => [e.id, e]));
    nuevoId = generadorDeIds();
  });
  afterEach(() => db.cerrar());

  const guardar = (entreno: Entreno, ahora = T0, selloLeido?: number | null) =>
    puertaDe(db).escribir((tx) => guardarEntrenoEn(tx, entreno, { ahora, selloLeido }));
  const leer = async (id: string): Promise<EntrenoGuardado> => {
    const leido = await puertaDe(db).leer((l) => leerEntreno(l, id));
    if (leido === null) throw new Error(`No está el entreno ${id}.`);
    return leido;
  };
  const listo = (e: EntrenoEnEdicion): Entreno => {
    const resultado = validar(e, ejercicios, HOY);
    if (resultado.errores) throw new Error(resultado.errores.join(' '));
    return resultado.entreno;
  };

  /**
   * Un entreno como los que apunta el editor: una carrera en cinta con su
   * descanso, una superserie de press banca y remo con una vuelta a medias y
   * sus descansos, y una plancha al final.
   */
  function completo(): EntrenoEnEdicion {
    const cinta = nuevoId();
    let e = cambiarCarrera(anadirCarrera(entrenoNuevo(nuevoId, new Date(2026, 10, 12, 18, 30)), cinta), cinta, {
      kilometros: '2,35',
      minutos: '12',
    });
    e = cambiarDescanso(e, cinta, 'descansoDespues', '120');
    const press = nuevoId();
    const p1 = nuevoId();
    e = anadirEjercicio(e, 'press-banca', press, p1);
    const p2 = nuevoId();
    e = cambiarSerie(anadirVuelta(cambiarSerie(e, press, p1, { peso: '62,5', repeticiones: '8' }), press, [p2]), press, p2, {
      peso: '62,5',
      repeticiones: '6',
    });
    const remo = nuevoId();
    const r1 = nuevoId();
    e = cambiarSerie(anadirEjercicio(e, 'remo-barra', remo, r1), remo, r1, { peso: '50', repeticiones: '10' });
    e = enlazar(e, press, nuevoId);
    e = cambiarDescanso(cambiarDescanso(e, press, 'descansoEntreSeries', '90'), press, 'descansoDespues', '60');
    const plancha = nuevoId();
    const s1 = nuevoId();
    e = cambiarSerie(anadirEjercicio(e, 'plancha', plancha, s1), plancha, s1, { segundos: '75' });
    return cambiarEntreno(e, { minutos: '50', esfuerzo: 8, notas: 'Con calor' });
  }

  it('lo que guarda el editor vuelve al editor y se guarda otra vez igual', async () => {
    const entreno = listo(completo());
    const sello = await guardar(entreno, T0, null);
    const enElEditor = paraCorregir(await leer(entreno.id), nuevoId);

    expect(enElEditor).toMatchObject({
      formato: 2,
      id: entreno.id,
      selloLeido: sello,
      fecha: '2026-11-12',
      hora: '18:30',
      minutos: '50',
      duracionLeida: { minutos: '50', ms: 3_000_000 },
      esfuerzo: 8,
      notas: 'Con calor',
    });
    expect(enElEditor?.bloques.map((bloque) => (bloque.tipo === 'carrera' ? bloque : { ...bloque, vueltas: bloque.vueltas.length }))).toEqual([
      { tipo: 'carrera', id: entreno.bloques[0].id, kilometros: '2,35', minutos: '12', descansoDespues: '120' },
      {
        tipo: 'ejercicios',
        id: entreno.bloques[1].id,
        ejercicioIds: ['press-banca', 'remo-barra'],
        vueltas: 2,
        descansoEntreSeries: '90',
        descansoDespues: '60',
      },
      { tipo: 'ejercicios', id: entreno.bloques[2].id, ejercicioIds: ['plancha'], vueltas: 1, descansoEntreSeries: '', descansoDespues: '' },
    ]);
    // La vuelta a medias de la superserie vuelve con su hueco vacío.
    const superserie = enElEditor?.bloques[1];
    expect(superserie?.tipo === 'ejercicios' && superserie.vueltas[1][1]).toMatchObject({ repeticiones: '', peso: '', segundos: '', hecha: null });

    // Sin tocar nada, se guarda exactamente lo mismo.
    if (enElEditor === null) throw new Error('No se puede corregir.');
    expect(listo(enElEditor)).toEqual(entreno);
    await guardar(listo(enElEditor), T0 + 1000, sello);
    expect(await leer(entreno.id)).toEqual({ ...entreno, modificado: T0 + 1000 });
  });

  it('guardarlo como un entreno nuevo da identificadores nuevos a todo, y se guarda junto al de antes', async () => {
    const entreno = listo(completo());
    await guardar(entreno, T0, null);
    const enElEditor = paraCorregir(await leer(entreno.id), nuevoId);
    if (enElEditor === null) throw new Error('No se puede corregir.');
    const nuevo = comoEntrenoNuevo(enElEditor, nuevoId);

    const viejos = new Set([entreno.id, ...entreno.bloques.flatMap((b) => [b.id, ...b.series.map((s) => s.id)])]);
    const listoNuevo = listo(nuevo);
    const nuevos = [listoNuevo.id, ...listoNuevo.bloques.flatMap((b) => [b.id, ...b.series.map((s) => s.id)])];
    expect(nuevos.filter((id) => viejos.has(id))).toEqual([]);
    expect(nuevo.selloLeido).toBeNull();
    // Lo apuntado es lo mismo.
    const sinIds = (e: Entreno) => JSON.parse(JSON.stringify(e).replace(/"id":"[^"]*"/g, '"id":""'));
    expect(sinIds(listoNuevo)).toEqual(sinIds(entreno));
    await guardar(listoNuevo, T0 + 1000, null);
    expect(db.mirar('SELECT COUNT(*) AS n FROM entreno')).toEqual([{ n: 2 }]);
  });

  it('guardarlo como nuevo conserva la duración con sus milisegundos', async () => {
    const guardado = gimnasioConCalentamiento(nuevoId);
    await guardar(guardado);
    const enElEditor = paraCorregir(await leer(guardado.id), nuevoId);
    if (enElEditor === null) throw new Error('No se puede corregir.');
    expect(listo(comoEntrenoNuevo(enElEditor, nuevoId)).duracionMs).toBe(3_150_000);
  });

  it('la duración que no se toca se queda con sus milisegundos; si se cambia, son los minutos escritos', async () => {
    // 52 minutos y medio, que el editor no sabe escribir.
    const guardado = gimnasioConCalentamiento(nuevoId);
    await guardar(guardado);
    const enElEditor = paraCorregir(await leer(guardado.id), nuevoId);
    if (enElEditor === null) throw new Error('No se puede corregir.');

    expect(enElEditor.minutos).toBe('53');
    expect(listo(enElEditor).duracionMs).toBe(3_150_000);
    expect(listo(cambiarEntreno(enElEditor, { minutos: '55' })).duracionMs).toBe(3_300_000);
    // Volver a escribir lo mismo que había cuenta como no tocarla.
    expect(listo(cambiarEntreno(cambiarEntreno(enElEditor, { minutos: '5' }), { minutos: '53' })).duracionMs).toBe(3_150_000);
  });

  it('no abre en el editor lo que no sabría enseñar sin perderlo, cada cosa por separado', async () => {
    const base = gimnasioConCalentamiento(nuevoId);
    const [cinta, press] = base.bloques;
    const conSeries = (cambio: (serie: Entreno['bloques'][number]['series'][number], i: number) => object): Entreno => ({
      ...base,
      bloques: [cinta, { ...press, series: press.series.map((serie, i) => ({ ...serie, ...cambio(serie, i) })) }],
    });
    const casos: [string, Entreno][] = [
      // Con la forma de uno de gimnasio, para que solo falle la disciplina.
      ['otra disciplina', { ...base, disciplina: 'calistenia' }],
      ['una carrera con series, como las de hyrox', hyroxConDescansos(nuevoId)],
      ['una serie con fracciones de segundo', conSeries(() => ({ repeticiones: null, pesoG: null, ejercicioId: 'plancha', tiempoMs: 45_500 }))],
      ['una serie con distancia', conSeries(() => ({ distanciaM: 100 }))],
      ['una serie con calorías', conSeries(() => ({ calorias: 10 }))],
      ['dos ejercicios en el mismo sitio de la vuelta', conSeries((_, i) => (i === 1 ? { ejercicioId: 'remo-barra' } : {}))],
      ['vueltas que no empiezan en la 1', conSeries((serie) => ({ ronda: serie.ronda + 1 }))],
      ['vueltas con un hueco', conSeries((serie) => ({ ronda: serie.ronda === 3 ? 4 : serie.ronda }))],
      ['descansos distintos entre series', conSeries((_, i) => ({ descansoMs: i === 0 ? 150_000 : i === 1 ? 120_000 : null }))],
      ['un descanso entre series con fracciones de segundo', conSeries((_, i) => ({ descansoMs: i < 2 ? 150_500 : null }))],
      ['un descanso detrás de la última vuelta', conSeries(() => ({ descansoMs: 150_000 }))],
      ['un descanso de después en el último bloque', { ...base, bloques: [cinta, { ...press, descansoMs: 60_000 }] }],
      ['un descanso entre bloques con fracciones de segundo', { ...base, bloques: [{ ...cinta, descansoMs: 120_500 }, press] }],
      ['un bloque de ejercicios con tiempo', { ...base, bloques: [cinta, { ...press, tiempoMs: 600_000 }] }],
      ['una carrera con fracciones de minuto', { ...base, bloques: [{ ...cinta, tiempoMs: 750_000 }, press] }],
      ['una carrera con series', { ...base, bloques: [{ ...cinta, series: [{ ...press.series[0], ronda: 1 }] }, { ...press, id: nuevoId() }] }],
    ];
    for (const [caso, entreno] of casos) {
      const leido: EntrenoGuardado = { ...entreno, modificado: T0 };
      expect([caso, paraCorregir(leido, nuevoId)]).toEqual([caso, null]);
    }
    // Y el de base, sí.
    expect(paraCorregir({ ...base, modificado: T0 }, nuevoId)).not.toBeNull();
  });

  /** Una serie de 8 repeticiones con 60 kg, en su vuelta y su sitio. */
  const serie = (ronda: number, orden: number, ejercicioId: string, descansoMs: number | null) => ({
    id: nuevoId(),
    ronda,
    orden,
    ejercicioId,
    repeticiones: 8,
    pesoG: 60_000,
    tiempoMs: null,
    distanciaM: null,
    calorias: null,
    descansoMs,
  });
  const conUnBloque = (series: Entreno['bloques'][number]['series']): Entreno => ({
    id: nuevoId(),
    disciplina: 'gimnasio',
    fecha: '2026-11-12',
    hora: '18:30',
    duracionMs: 30 * 60_000,
    esfuerzo: 7,
    notas: null,
    bloques: [{ id: nuevoId(), metrosCorridos: null, tiempoMs: null, descansoMs: null, series }],
  });

  it('una superserie sin el primer ejercicio en la primera vuelta vuelve igual', async () => {
    const entreno = conUnBloque([serie(1, 2, 'remo-barra', 90_000), serie(2, 1, 'press-banca', 0), serie(2, 2, 'remo-barra', null)]);
    await guardar(entreno);
    const enElEditor = paraCorregir(await leer(entreno.id), nuevoId);
    if (enElEditor === null) throw new Error('No se puede corregir.');
    expect(listo(enElEditor)).toEqual(entreno);
  });

  it('un ejercicio sin nada en toda la superserie no ocupa sitio, y lo guardado vuelve igual', async () => {
    // Press banca vacío, enlazado con un remo con una serie.
    const press = nuevoId();
    const remo = nuevoId();
    const r1 = nuevoId();
    let e = anadirEjercicio(entrenoNuevo(nuevoId, new Date(2026, 10, 12, 18, 30)), 'press-banca', press, nuevoId());
    e = cambiarSerie(anadirEjercicio(e, 'remo-barra', remo, r1), remo, r1, { peso: '50', repeticiones: '10' });
    e = cambiarEntreno(enlazar(e, press, nuevoId), { minutos: '30', esfuerzo: 6 });
    const entreno = listo(e);
    expect(entreno.bloques[0].series.map(({ ronda, orden, ejercicioId }) => [ronda, orden, ejercicioId])).toEqual([[1, 1, 'remo-barra']]);

    await guardar(entreno);
    const enElEditor = paraCorregir(await leer(entreno.id), nuevoId);
    if (enElEditor === null) throw new Error('No se puede corregir.');
    expect(listo(enElEditor)).toEqual(entreno);
  });

  it('lo que guardó el editor del 2b con un ejercicio vacío en una superserie se corrige cerrando el hueco del orden', async () => {
    // Entonces el remo se guardaba en el sitio 2 aunque el press no tuviera nada.
    const entreno = conUnBloque([serie(1, 2, 'remo-barra', 90_000), serie(2, 2, 'remo-barra', null)]);
    await guardar(entreno);
    const enElEditor = paraCorregir(await leer(entreno.id), nuevoId);
    if (enElEditor === null) throw new Error('No se puede corregir.');
    const corregido = listo(enElEditor);
    expect(corregido.bloques[0].series.map(({ ronda, orden, descansoMs }) => [ronda, orden, descansoMs])).toEqual([
      [1, 1, 90_000],
      [2, 1, null],
    ]);
    // Lo apuntado es lo mismo: solo cambia el número del sitio.
    expect({ ...corregido, bloques: [] }).toEqual({ ...entreno, bloques: [] });
  });

  it('la huella de lo leído va con la corrección, y no con un entreno nuevo', async () => {
    const entreno = listo(completo());
    await guardar(entreno, T0, null);
    const leido = await leer(entreno.id);
    const enElEditor = paraCorregir(leido, nuevoId);
    expect(enElEditor?.huellaLeida).toBe(huellaDelEntreno(leido));
    // Borrar y restaurar cambia el sello, pero no la huella.
    expect(huellaDelEntreno({ ...leido, modificado: T0 + 5000 })).toBe(huellaDelEntreno(leido));
    expect(huellaDelEntreno({ ...leido, notas: 'Otra' })).not.toBe(huellaDelEntreno(leido));
    if (enElEditor === null) throw new Error('No se puede corregir.');
    expect(comoEntrenoNuevo(enElEditor, nuevoId).huellaLeida).toBeNull();
    expect(leerBorrador(JSON.parse(JSON.stringify(enElEditor)))).toEqual(enElEditor);
    expect(leerBorrador({ ...enElEditor, huellaLeida: 7 })).toBeNull();
  });

  it('cada corrección tiene su borrador, que cabe en un ajuste también apartado como ilegible', async () => {
    const entreno = listo(completo());
    const clave = claveDeCorreccion(entreno.id);
    expect(clave).toMatch(/^local\.correccion\.[0-9a-f]{32}$/);
    const borrador = paraCorregir({ ...entreno, modificado: T0 }, nuevoId);
    await puertaDe(db).escribir(async (tx) => {
      await ponerAjusteEn(tx, clave, borrador, T0);
      await ponerAjusteEn(tx, `${clave}.ilegible`, { roto: true }, T0);
    });
    const guardado = db.mirar<{ valor: string }>('SELECT valor FROM ajuste WHERE clave = :clave', { ':clave': clave });
    expect(leerBorrador(JSON.parse(guardado[0].valor))).toEqual(borrador);
  });

  it('un borrador con la duración leída rota se descarta entero', () => {
    const borrador = entrenoNuevo(nuevoId, new Date(2026, 10, 12, 18, 30));
    expect(leerBorrador({ ...borrador, duracionLeida: { minutos: '45', ms: 2_700_000 } })?.duracionLeida).toEqual({
      minutos: '45',
      ms: 2_700_000,
    });
    // Los borradores de antes no la llevan.
    const { duracionLeida: _, ...sinElla } = borrador;
    expect(leerBorrador(sinElla)?.duracionLeida).toBeNull();
    expect(leerBorrador({ ...borrador, duracionLeida: { minutos: 45, ms: 2_700_000 } })).toBeNull();
    expect(leerBorrador({ ...borrador, duracionLeida: { minutos: '45', ms: 2_700_000.5 } })).toBeNull();
    expect(leerBorrador({ ...borrador, duracionLeida: { minutos: '45', ms: 0 } })).toBeNull();
  });
});

import type { Ejercicio } from '@/datos/ejercicios';
import {
  anadirCarrera,
  anadirEjercicio,
  anadirVuelta,
  cambiarCarrera,
  cambiarDescanso,
  cambiarEntreno,
  cambiarSerie,
  carrerasFueraDeLoMedido,
  empezarAhoraSiVacio,
  enlazar,
  entrenoNuevo,
  igualQueLaAnterior,
  leerBorrador,
  marcarHecha,
  minutosMedidos,
  nombresDeLosBloques,
  notaDelEjercicio,
  notasDelBloque,
  palabraDelEsfuerzo,
  pasoDeCarrera,
  pasoDeDescanso,
  pasoDeSerie,
  quitarBloque,
  quitarVuelta,
  separar,
  tieneAlgo,
  unirConY,
  validar,
  type BloqueDeCarrera,
  type BloqueDeEjercicios,
  type EntrenoEnEdicion,
  type SerieEnEdicion,
} from '@/gimnasio/editor';
import { T0, generadorDeIds } from '@/pruebas/datos';

const HOY = '2026-11-15';

const EJERCICIOS = new Map<string, Ejercicio>([
  ['press-banca', { id: 'press-banca', nombre: 'Press banca', grupo: 'pecho', mide: ['repeticiones', 'peso'], porMancuerna: false }],
  ['remo-barra', { id: 'remo-barra', nombre: 'Remo con barra', grupo: 'espalda', mide: ['repeticiones', 'peso'], porMancuerna: false }],
  ['plancha', { id: 'plancha', nombre: 'Plancha', grupo: 'core', mide: ['tiempo'], porMancuerna: false }],
  ['curl-mancuernas', { id: 'curl-mancuernas', nombre: 'Curl con mancuernas', grupo: 'brazo', mide: ['repeticiones', 'peso'], porMancuerna: true }],
]);

/** El bloque de ejercicios en esa posición; falla si es otra cosa. */
function ejercicios(e: EntrenoEnEdicion, b: number): BloqueDeEjercicios {
  const bloque = e.bloques[b];
  if (bloque?.tipo !== 'ejercicios') throw new Error(`El bloque ${b} no es de ejercicios.`);
  return bloque;
}

/** La carrera en esa posición; falla si es otra cosa. */
function carrera(e: EntrenoEnEdicion, b: number): BloqueDeCarrera {
  const bloque = e.bloques[b];
  if (bloque?.tipo !== 'carrera') throw new Error(`El bloque ${b} no es una carrera.`);
  return bloque;
}

/** La serie del ejercicio c en la vuelta v del bloque b. */
const serieDe = (e: EntrenoEnEdicion, b: number, v: number, c = 0): SerieEnEdicion => ejercicios(e, b).vueltas[v][c];

const vacia = (id: string): SerieEnEdicion => ({ id, repeticiones: '', peso: '', segundos: '', hecha: null });

describe('El editor de gimnasio', () => {
  let nuevoId: () => string;
  let e: EntrenoEnEdicion;
  beforeEach(() => {
    nuevoId = generadorDeIds();
    e = entrenoNuevo(nuevoId, new Date(2026, 10, 15, 18, 30));
  });

  /** Añade un ejercicio y devuelve el entreno, el bloque y su primera serie. */
  const conEjercicio = (entreno: EntrenoEnEdicion, ejercicioId: string) => {
    const bloque = nuevoId();
    const serie = nuevoId();
    return { e: anadirEjercicio(entreno, ejercicioId, bloque, serie), bloque, serie };
  };

  it('empieza vacío, con la fecha y la hora locales de ahora', () => {
    expect(e).toMatchObject({ formato: 2, selloLeido: null, fecha: '2026-11-15', hora: '18:30', bloques: [], minutos: '', esfuerzo: null, notas: '' });
    expect(tieneAlgo(e)).toBe(false);
  });

  it('añade un ejercicio con una serie vacía, y series detrás', () => {
    const { e: con, bloque, serie } = conEjercicio(e, 'press-banca');
    const otra = nuevoId();
    const despues = anadirVuelta(con, bloque, [otra]);
    expect(despues.bloques).toEqual([
      {
        tipo: 'ejercicios',
        id: bloque,
        ejercicioIds: ['press-banca'],
        vueltas: [[vacia(serie)], [vacia(otra)]],
        descansoEntreSeries: '',
        descansoDespues: '',
      },
    ]);
    expect(tieneAlgo(despues)).toBe(true);
    // Sin un identificador por ejercicio, no añade nada.
    expect(anadirVuelta(con, bloque, [])).toEqual(con);
  });

  it('los botones suben y bajan un disco, una repetición o cinco segundos, sin bajar de cero', () => {
    const { e: con, bloque, serie } = conEjercicio(e, 'press-banca');
    let x = pasoDeSerie(con, bloque, serie, 'peso', 1);
    expect(serieDe(x, 0, 0).peso).toBe('2,5');
    x = cambiarSerie(x, bloque, serie, { peso: '60' });
    x = pasoDeSerie(x, bloque, serie, 'peso', 1);
    expect(serieDe(x, 0, 0).peso).toBe('62,5');
    x = pasoDeSerie(x, bloque, serie, 'repeticiones', 1);
    x = pasoDeSerie(x, bloque, serie, 'repeticiones', -1);
    x = pasoDeSerie(x, bloque, serie, 'repeticiones', -1);
    expect(serieDe(x, 0, 0).repeticiones).toBe('');
    x = pasoDeSerie(x, bloque, serie, 'segundos', 1);
    expect(serieDe(x, 0, 0).segundos).toBe('5');
    // Un texto que no se entiende no se toca.
    x = cambiarSerie(x, bloque, serie, { peso: 'mucho' });
    expect(pasoDeSerie(x, bloque, serie, 'peso', 1)).toEqual(x);
  });

  it('copia los números de la serie anterior, y en la primera no hace nada', () => {
    const { e: con, bloque, serie } = conEjercicio(e, 'press-banca');
    const segunda = nuevoId();
    let x = cambiarSerie(con, bloque, serie, { peso: '60', repeticiones: '8' });
    x = anadirVuelta(x, bloque, [segunda]);
    x = igualQueLaAnterior(x, bloque, segunda);
    expect(serieDe(x, 0, 1)).toMatchObject({ peso: '60', repeticiones: '8' });
    expect(igualQueLaAnterior(x, bloque, serie)).toEqual(x);
  });

  it('quita series y ejercicios', () => {
    const { e: con, bloque, serie } = conEjercicio(e, 'press-banca');
    expect(ejercicios(quitarVuelta(con, bloque, serie), 0).vueltas).toEqual([]);
    expect(quitarBloque(con, bloque).bloques).toEqual([]);
  });

  it('mide la duración entre la primera serie hecha y la última, si hay dos y no pasan de 4 horas', () => {
    const { e: con, bloque, serie } = conEjercicio(e, 'press-banca');
    const segunda = nuevoId();
    let x = anadirVuelta(con, bloque, [segunda]);
    x = marcarHecha(x, bloque, serie, T0);
    expect(minutosMedidos(x)).toBeNull();
    x = marcarHecha(x, bloque, segunda, T0 + 47 * 60_000 + 20_000);
    expect(minutosMedidos(x)).toBe(47);
    x = marcarHecha(x, bloque, segunda, T0 + 5 * 3_600_000);
    expect(minutosMedidos(x)).toBeNull();
  });

  it('valida un entreno completo y lo deja listo para guardar, sin las series vacías', () => {
    let { e: x, bloque, serie } = conEjercicio(e, 'press-banca');
    x = cambiarSerie(x, bloque, serie, { peso: '62,5', repeticiones: '8' });
    x = anadirVuelta(x, bloque, [nuevoId()]);
    const plancha = conEjercicio(x, 'plancha');
    x = cambiarSerie(plancha.e, plancha.bloque, plancha.serie, { segundos: '90' });
    const vacio = conEjercicio(x, 'curl-mancuernas');
    x = cambiarEntreno(vacio.e, { esfuerzo: 7, minutos: '45', notas: '  ' });

    const resultado = validar(x, EJERCICIOS, HOY);
    expect(resultado.errores).toBeUndefined();
    expect(resultado.entreno).toEqual({
      id: x.id,
      disciplina: 'gimnasio',
      fecha: '2026-11-15',
      hora: '18:30',
      duracionMs: 45 * 60_000,
      esfuerzo: 7,
      notas: null,
      bloques: [
        {
          id: bloque,
          metrosCorridos: null,
          tiempoMs: null,
          descansoMs: null,
          series: [
            { id: serie, ronda: 1, orden: 1, ejercicioId: 'press-banca', repeticiones: 8, pesoG: 62500, tiempoMs: null, distanciaM: null, calorias: null, descansoMs: null },
          ],
        },
        {
          id: plancha.bloque,
          metrosCorridos: null,
          tiempoMs: null,
          descansoMs: null,
          series: [
            { id: plancha.serie, ronda: 1, orden: 1, ejercicioId: 'plancha', repeticiones: null, pesoG: null, tiempoMs: 90_000, distanciaM: null, calorias: null, descansoMs: null },
          ],
        },
      ],
    });
  });

  it('usa la duración medida si no se ha escrito ninguna', () => {
    let { e: x, bloque, serie } = conEjercicio(e, 'press-banca');
    const segunda = nuevoId();
    x = cambiarSerie(x, bloque, serie, { repeticiones: '8' });
    x = anadirVuelta(x, bloque, [segunda]);
    x = cambiarSerie(x, bloque, segunda, { repeticiones: '8' });
    x = marcarHecha(marcarHecha(x, bloque, serie, T0), bloque, segunda, T0 + 30 * 60_000);
    x = cambiarEntreno(x, { esfuerzo: 5 });
    expect(validar(x, EJERCICIOS, HOY).entreno?.duracionMs).toBe(30 * 60_000);
  });

  it.each([
    ['sin ninguna serie', (x: EntrenoEnEdicion) => x, 'Apunta al menos una serie o una carrera.'],
    ['sin esfuerzo', (x: EntrenoEnEdicion) => conSerie(x, { repeticiones: '8' }, { esfuerzo: null }), 'Falta el esfuerzo, del 1 al 10.'],
    ['sin duración', (x: EntrenoEnEdicion) => conSerie(x, { repeticiones: '8' }, { minutos: '' }), 'Falta la duración, en minutos.'],
    ['con una duración que no se entiende', (x: EntrenoEnEdicion) => conSerie(x, { repeticiones: '8' }, { minutos: '45,5' }), 'La duración «45,5» no se entiende: van minutos enteros.'],
    ['con peso y sin repeticiones', (x: EntrenoEnEdicion) => conSerie(x, { peso: '60' }), 'Press banca, serie 1: faltan las repeticiones.'],
    ['con un peso que no se entiende', (x: EntrenoEnEdicion) => conSerie(x, { peso: '60 kg', repeticiones: '8' }), 'Press banca, serie 1: el peso «60 kg» no se entiende.'],
    ['con un peso de 0', (x: EntrenoEnEdicion) => conSerie(x, { peso: '0', repeticiones: '8' }), 'Press banca, serie 1: un peso de 0 se deja vacío.'],
    ['con repeticiones que no se entienden', (x: EntrenoEnEdicion) => conSerie(x, { repeticiones: '8,5' }), 'Press banca, serie 1: las repeticiones «8,5» no se entienden.'],
    ['con segundos en un press banca', (x: EntrenoEnEdicion) => conSerie(x, { segundos: '40' }), 'Press banca, serie 1: Press banca no lleva segundos.'],
  ])('no deja guardar un entreno %s', (_, preparar, error) => {
    expect(validar(preparar(e), EJERCICIOS, HOY).errores).toContain(error);
  });

  /** Un press banca con una serie y el resto bien, salvo lo que se cambie. */
  function conSerie(
    x: EntrenoEnEdicion,
    serie: Partial<Record<'peso' | 'repeticiones' | 'segundos', string>>,
    entreno: Partial<Pick<EntrenoEnEdicion, 'esfuerzo' | 'minutos'>> = {},
  ): EntrenoEnEdicion {
    const { e: con, bloque, serie: id } = conEjercicio(x, 'press-banca');
    return cambiarEntreno(cambiarSerie(con, bloque, id, serie), { esfuerzo: 7, minutos: '45', ...entreno });
  }

  it('lee un borrador bien formado tal cual, y descarta uno roto entero', () => {
    const { e: con, bloque, serie } = conEjercicio(e, 'press-banca');
    const borrador = anadirCarrera(cambiarSerie(con, bloque, serie, { peso: '60' }), nuevoId());
    expect(leerBorrador(JSON.parse(JSON.stringify(borrador)))).toEqual(borrador);
    expect(leerBorrador(null)).toBeNull();
    expect(leerBorrador({ ...borrador, formato: 3 })).toBeNull();
    expect(leerBorrador({ ...borrador, bloques: [{ id: 'x', ejercicioId: 'y', series: [{ id: 'z' }] }] })).toBeNull();
    expect(leerBorrador({ ...borrador, esfuerzo: 'siete' })).toBeNull();
  });

  it('descarta un borrador con un bloque que no tiene su forma', () => {
    const { e: con } = conEjercicio(e, 'press-banca');
    const bloque = ejercicios(con, 0);
    const con2 = (otro: unknown) => leerBorrador({ ...con, bloques: [otro] });
    expect(con2(bloque)).not.toBeNull();
    expect(con2({ ...bloque, tipo: 'cinta' })).toBeNull();
    // Sin ejercicios no hay bloque, aunque tampoco tenga vueltas.
    expect(con2({ ...bloque, ejercicioIds: [], vueltas: [] })).toBeNull();
    expect(con2({ ...bloque, ejercicioIds: ['press-banca', 7] })).toBeNull();
    // Cada vuelta lleva una serie de cada ejercicio, ni más ni menos.
    expect(con2({ ...bloque, ejercicioIds: ['press-banca', 'remo-barra'] })).toBeNull();
    expect(con2({ ...bloque, descansoEntreSeries: 90 })).toBeNull();
    expect(con2({ ...bloque, descansoDespues: 90 })).toBeNull();
    const carreraBien = { tipo: 'carrera', id: 'c', kilometros: '2', minutos: '12', descansoDespues: '' };
    expect(con2(carreraBien)).not.toBeNull();
    expect(con2({ ...carreraBien, minutos: 12 })).toBeNull();
    expect(con2({ ...carreraBien, kilometros: 2 })).toBeNull();
    expect(con2({ ...carreraBien, descansoDespues: 90 })).toBeNull();
  });

  it('un borrador con una superserie, una carrera y descansos va y vuelve igual', () => {
    const press = conEjercicio(e, 'press-banca');
    let y = cambiarSerie(press.e, press.bloque, press.serie, { peso: '60', repeticiones: '8' });
    const remo = conEjercicio(y, 'remo-barra');
    y = cambiarSerie(remo.e, remo.bloque, remo.serie, { repeticiones: '10' });
    y = marcarHecha(y, remo.bloque, remo.serie, T0);
    y = enlazar(y, press.bloque, nuevoId);
    y = cambiarDescanso(cambiarDescanso(y, press.bloque, 'descansoEntreSeries', '90'), press.bloque, 'descansoDespues', '120');
    const cinta = nuevoId();
    y = cambiarCarrera(anadirCarrera(y, cinta), cinta, { kilometros: '2,5', minutos: '12' });
    y = cambiarDescanso(y, cinta, 'descansoDespues', '60');
    // El sello de un entreno que se corrige, que hará falta para corregir.
    y = cambiarEntreno({ ...y, selloLeido: 1_763_000_000_000 }, { minutos: '50', esfuerzo: 7, notas: 'Bien' });
    expect(leerBorrador(JSON.parse(JSON.stringify(y)))).toEqual(y);
  });

  it('convierte un borrador de la forma 1, de antes de las superseries, sin perder nada', () => {
    const serie = { id: nuevoId(), repeticiones: '8', peso: '60', segundos: '', hecha: T0 };
    const otra = { id: nuevoId(), repeticiones: '', peso: '', segundos: '', hecha: null };
    const deLaForma1 = {
      formato: 1,
      id: e.id,
      selloLeido: null,
      fecha: '2026-11-14',
      hora: '19:05',
      bloques: [{ id: 'bloque-1', ejercicioId: 'press-banca', series: [serie, otra] }],
      minutos: '45',
      esfuerzo: 7,
      notas: 'Bien',
    };
    expect(leerBorrador(deLaForma1)).toEqual({
      formato: 2,
      id: e.id,
      selloLeido: null,
      fecha: '2026-11-14',
      hora: '19:05',
      bloques: [
        {
          tipo: 'ejercicios',
          id: 'bloque-1',
          ejercicioIds: ['press-banca'],
          vueltas: [[serie], [otra]],
          descansoEntreSeries: '',
          descansoDespues: '',
        },
      ],
      minutos: '45',
      duracionLeida: null,
      huellaLeida: null,
      esfuerzo: 7,
      notas: 'Bien',
    });
    expect(leerBorrador({ ...deLaForma1, bloques: [{ id: 'b', ejercicioId: 'press-banca', series: [{ id: 's' }] }] })).toBeNull();
  });

  it('dice el esfuerzo con las palabras de Quimera-web', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(palabraDelEsfuerzo)).toEqual([
      'muy suave', 'muy suave', 'suave', 'suave', 'moderado', 'moderado', 'duro', 'duro', 'muy duro', 'máximo',
    ]);
  });

  it('une los nombres con comas y una y', () => {
    expect([[], ['A'], ['A', 'B'], ['A', 'B', 'C']].map(unirConY)).toEqual(['', 'A', 'A y B', 'A, B y C']);
  });

  it('dice lo que conviene saber de cada ejercicio: el peso por mancuerna, o que va en segundos', () => {
    expect(notaDelEjercicio(EJERCICIOS.get('curl-mancuernas'))).toBe('peso por mancuerna');
    expect(notaDelEjercicio(EJERCICIOS.get('plancha'))).toBe('en segundos');
    expect(notaDelEjercicio(EJERCICIOS.get('press-banca'))).toBeNull();
    // Un ejercicio que no se encuentra no dice nada.
    expect(notaDelEjercicio(undefined)).toBeNull();
  });

  it('las notas de un bloque: la suya, con mayúscula, o en una superserie, cada una con el nombre de su ejercicio', () => {
    const curl = EJERCICIOS.get('curl-mancuernas');
    const plancha = EJERCICIOS.get('plancha');
    const press = EJERCICIOS.get('press-banca');
    expect(notasDelBloque([curl], ['Curl con mancuernas'])).toEqual([{ c: 0, texto: 'Peso por mancuerna' }]);
    expect(notasDelBloque([plancha], ['Plancha'])).toEqual([{ c: 0, texto: 'En segundos' }]);
    expect(notasDelBloque([press], ['Press banca'])).toEqual([]);
    expect(notasDelBloque([press, curl, plancha], ['Press banca', 'Curl con mancuernas', 'Plancha'])).toEqual([
      { c: 1, texto: 'Curl con mancuernas: peso por mancuerna' },
      { c: 2, texto: 'Plancha: en segundos' },
    ]);
  });

  it('nombra cada bloque, con su ordinal si un ejercicio se repite o hay varias carreras', () => {
    const una = nuevoId();
    let x = anadirCarrera(e, una);
    const press = conEjercicio(x, 'press-banca');
    const remo = conEjercicio(press.e, 'remo-barra');
    const otroPress = conEjercicio(remo.e, 'press-banca');
    x = anadirCarrera(enlazar(otroPress.e, press.bloque, nuevoId), nuevoId());
    expect(nombresDeLosBloques(x, EJERCICIOS)).toEqual([
      { enFrase: 'la carrera en cinta (la 1.ª)', alEmpezar: 'Carrera en cinta (la 1.ª)', ejercicios: [] },
      {
        enFrase: 'la superserie de Press banca (el 1.º) y Remo con barra',
        alEmpezar: 'La superserie de Press banca (el 1.º) y Remo con barra',
        ejercicios: ['Press banca (el 1.º)', 'Remo con barra'],
      },
      { enFrase: 'Press banca (el 2.º)', alEmpezar: 'Press banca (el 2.º)', ejercicios: ['Press banca (el 2.º)'] },
      { enFrase: 'la carrera en cinta (la 2.ª)', alEmpezar: 'Carrera en cinta (la 2.ª)', ejercicios: [] },
    ]);
    expect(nombresDeLosBloques(anadirCarrera(e, una), EJERCICIOS)[0].enFrase).toBe('la carrera en cinta');
  });

  it('no deja pasar más vueltas de las que caben en la base', () => {
    const { e: x } = conEjercicio(e, 'press-banca');
    const llena = {
      ...x,
      bloques: x.bloques.map((b) =>
        b.tipo === 'ejercicios' ? { ...b, vueltas: Array.from({ length: 1001 }, () => [{ ...vacia(nuevoId()), repeticiones: '5' }]) } : b,
      ),
    };
    expect(validar(cambiarEntreno(llena, { esfuerzo: 9, minutos: '600' }), EJERCICIOS, HOY).errores).toEqual([
      'Press banca: no caben más de 1000 series.',
    ]);
  });

  describe('las superseries', () => {
    /** Un press banca con estas series y un remo con estas otras, uno detrás del otro. */
    function dosEjercicios(press: Partial<SerieEnEdicion>[], remo: Partial<SerieEnEdicion>[]) {
      const a = nuevoId();
      const b = nuevoId();
      let x = anadirEjercicio(anadirEjercicio(e, 'press-banca', a, nuevoId()), 'remo-barra', b, nuevoId());
      x = {
        ...x,
        bloques: x.bloques.map((bloque) =>
          bloque.tipo !== 'ejercicios'
            ? bloque
            : { ...bloque, vueltas: (bloque.id === a ? press : remo).map((s) => [{ ...vacia(nuevoId()), ...s }]) },
        ),
      };
      return { x, a, b };
    }

    it('enlazar une un ejercicio con el siguiente, vuelta a vuelta, con series vacías donde faltan', () => {
      const { x, a, b } = dosEjercicios([{ peso: '60', repeticiones: '8' }, { peso: '60', repeticiones: '8' }, { repeticiones: '6' }], [{ peso: '50', repeticiones: '10' }]);
      const press = ejercicios(x, 0).vueltas.map(([serie]) => serie);
      const remo = ejercicios(x, 1).vueltas.map(([serie]) => serie);
      const y = enlazar(x, a, nuevoId);

      expect(y.bloques).toHaveLength(1);
      const superserie = ejercicios(y, 0);
      expect(superserie).toMatchObject({ tipo: 'ejercicios', id: a, ejercicioIds: ['press-banca', 'remo-barra'] });
      expect(superserie.vueltas.map((vuelta) => vuelta.map((serie) => serie.id))).toEqual([
        [press[0].id, remo[0].id],
        [press[1].id, expect.any(String)],
        [press[2].id, expect.any(String)],
      ]);
      expect(superserie.vueltas[1][1]).toMatchObject({ repeticiones: '', peso: '', segundos: '', hecha: null });
      // Los huecos nuevos tienen identificadores propios.
      expect(new Set(superserie.vueltas.flat().map((serie) => serie.id)).size).toBe(6);
      // Con lo que venga detrás que no sea de ejercicios, o sin nada detrás, no hace nada.
      expect(enlazar(x, b, nuevoId)).toEqual(x);
      expect(enlazar(anadirCarrera(quitarBloque(x, b), nuevoId()), a, nuevoId).bloques).toHaveLength(2);
    });

    it('separar deshace la superserie en un bloque por ejercicio, sin perder nada', () => {
      const { x, a } = dosEjercicios([{ peso: '60', repeticiones: '8' }], [{ peso: '50', repeticiones: '10' }, { repeticiones: '9' }]);
      const conDescansos = cambiarDescanso(cambiarDescanso(x, a, 'descansoEntreSeries', '90'), ejercicios(x, 1).id, 'descansoDespues', '120');
      const superserie = enlazar(conDescansos, a, nuevoId);
      expect(ejercicios(superserie, 0)).toMatchObject({ descansoEntreSeries: '90', descansoDespues: '120' });

      const separados = separar(superserie, a, nuevoId);
      expect(separados.bloques).toHaveLength(2);
      expect(ejercicios(separados, 0)).toMatchObject({ id: a, ejercicioIds: ['press-banca'], descansoEntreSeries: '90', descansoDespues: '' });
      expect(ejercicios(separados, 1)).toMatchObject({ ejercicioIds: ['remo-barra'], descansoEntreSeries: '90', descansoDespues: '120' });
      expect(ejercicios(separados, 1).id).not.toBe(a);
      // Las series escritas siguen ahí, con sus identificadores, y el hueco que puso el enlace se va.
      expect(ejercicios(separados, 1).vueltas.map(([serie]) => serie)).toEqual(ejercicios(x, 1).vueltas.map(([serie]) => serie));
      expect(ejercicios(separados, 0).vueltas).toEqual(ejercicios(x, 0).vueltas);
      // Un ejercicio suelto no se separa.
      expect(separar(x, a, nuevoId)).toEqual(x);
    });

    it('al separar, cada ejercicio conserva al menos una serie, y las vacías marcadas como hechas', () => {
      const { x, a } = dosEjercicios([{}, {}], [{ repeticiones: '10' }, {}, { hecha: T0 }]);
      const separados = separar(enlazar(x, a, nuevoId), a, nuevoId);
      expect(ejercicios(separados, 0).vueltas).toHaveLength(1);
      // La última del remo está vacía pero marcada: su hora mide la duración, y se queda.
      expect(ejercicios(separados, 1).vueltas.map(([serie]) => serie)).toEqual(ejercicios(x, 1).vueltas.map(([serie]) => serie));
    });

    it('enlazar y separar dejan en su sitio los bloques de alrededor', () => {
      const cinta = nuevoId();
      const conCinta = cambiarCarrera(anadirCarrera(e, cinta), cinta, { kilometros: '2' });
      const press = conEjercicio(conCinta, 'press-banca');
      const remo = conEjercicio(press.e, 'remo-barra');
      const plancha = conEjercicio(remo.e, 'plancha');
      const y = enlazar(plancha.e, press.bloque, nuevoId);
      expect(y.bloques.map((b) => b.id)).toEqual([cinta, press.bloque, plancha.bloque]);
      const z = separar(y, press.bloque, nuevoId);
      expect(z.bloques.map((b) => (b.tipo === 'ejercicios' ? b.ejercicioIds.join('+') : 'cinta'))).toEqual([
        'cinta',
        'press-banca',
        'remo-barra',
        'plancha',
      ]);
      expect([z.bloques[0].id, z.bloques[1].id, z.bloques[3].id]).toEqual([cinta, press.bloque, plancha.bloque]);
    });

    it('una superserie se enlaza con un tercer ejercicio, con huecos del tamaño de cada parte', () => {
      const press = conEjercicio(e, 'press-banca');
      const remo = conEjercicio(press.e, 'remo-barra');
      const plancha = conEjercicio(remo.e, 'plancha');
      const conDos = anadirVuelta(plancha.e, plancha.bloque, [nuevoId()]);
      const tri = ejercicios(enlazar(enlazar(conDos, press.bloque, nuevoId), press.bloque, nuevoId), 0);
      expect(tri.ejercicioIds).toEqual(['press-banca', 'remo-barra', 'plancha']);
      expect(tri.vueltas.map((vuelta) => vuelta.length)).toEqual([3, 3]);
    });

    it('si el primero no tiene descanso entre series, la superserie toma el del segundo', () => {
      const { x, a, b } = dosEjercicios([{ repeticiones: '8' }], [{ repeticiones: '10' }]);
      const y = cambiarDescanso(x, b, 'descansoEntreSeries', '90');
      expect(ejercicios(enlazar(y, a, nuevoId), 0).descansoEntreSeries).toBe('90');
    });

    it('en una superserie, la anterior es la del mismo ejercicio en la vuelta de antes, y quitar quita la vuelta', () => {
      const { x, a } = dosEjercicios([{ peso: '60', repeticiones: '8' }, {}], [{ peso: '50', repeticiones: '10' }, {}]);
      const y = enlazar(x, a, nuevoId);
      const remoDeLaSegunda = serieDe(y, 0, 1, 1).id;
      const z = igualQueLaAnterior(y, a, remoDeLaSegunda);
      expect(serieDe(z, 0, 1, 1)).toMatchObject({ peso: '50', repeticiones: '10' });
      expect(ejercicios(quitarVuelta(z, a, remoDeLaSegunda), 0).vueltas).toHaveLength(1);
      // Añadir una vuelta pide un identificador por ejercicio.
      expect(ejercicios(anadirVuelta(z, a, [nuevoId(), nuevoId()]), 0).vueltas).toHaveLength(3);
      expect(anadirVuelta(z, a, [nuevoId()])).toEqual(z);
    });

    it('se guarda como un bloque con las vueltas en orden, sin parar entre ejercicios y con el descanso entre vueltas', () => {
      const { x, a } = dosEjercicios(
        [{ peso: '60', repeticiones: '8' }, { peso: '60', repeticiones: '8' }, {}, {}],
        [{ peso: '50', repeticiones: '10' }, { peso: '50', repeticiones: '10' }, {}, { peso: '50', repeticiones: '9' }],
      );
      let y = enlazar(cambiarDescanso(x, a, 'descansoEntreSeries', '90'), a, nuevoId);
      y = cambiarDescanso(y, a, 'descansoDespues', '120');
      const plancha = conEjercicio(y, 'plancha');
      y = cambiarEntreno(cambiarSerie(plancha.e, plancha.bloque, plancha.serie, { segundos: '60' }), { esfuerzo: 8, minutos: '50' });

      const resultado = validar(y, EJERCICIOS, HOY);
      expect(resultado.errores).toBeUndefined();
      const [superserie, ultimo] = resultado.entreno?.bloques ?? [];
      expect(superserie.descansoMs).toBe(120_000);
      // La tercera vuelta está vacía y no cuenta: la cuarta se guarda como la tercera.
      expect(superserie.series.map(({ ronda, orden, ejercicioId, descansoMs }) => [ronda, orden, ejercicioId, descansoMs])).toEqual([
        [1, 1, 'press-banca', 0],
        [1, 2, 'remo-barra', 90_000],
        [2, 1, 'press-banca', 0],
        [2, 2, 'remo-barra', 90_000],
        [3, 2, 'remo-barra', null],
      ]);
      expect(ultimo.descansoMs).toBeNull();
    });

    it('los avisos dicen el ejercicio y la vuelta', () => {
      const { x, a } = dosEjercicios([{ peso: '60', repeticiones: '8' }, { peso: '60', repeticiones: '8' }], [{ peso: '50', repeticiones: '10' }, { peso: '50' }]);
      const y = cambiarEntreno(enlazar(x, a, nuevoId), { esfuerzo: 7, minutos: '45' });
      expect(validar(y, EJERCICIOS, HOY).errores).toEqual(['Remo con barra, vuelta 2: faltan las repeticiones.']);
      const conDescanso = cambiarDescanso(y, a, 'descansoEntreSeries', '1:30');
      expect(validar(conDescanso, EJERCICIOS, HOY).errores).toContain(
        'La superserie de Press banca y Remo con barra: el descanso entre vueltas «1:30» no se entiende: van segundos.',
      );
    });

    it('la duración se mide con las marcas de todos los ejercicios', () => {
      const { x, a } = dosEjercicios([{ repeticiones: '8' }], [{ repeticiones: '10' }]);
      let y = enlazar(x, a, nuevoId);
      y = marcarHecha(y, a, serieDe(y, 0, 0, 0).id, T0);
      y = marcarHecha(y, a, serieDe(y, 0, 0, 1).id, T0 + 25 * 60_000);
      expect(minutosMedidos(y)).toBe(25);
    });
  });

  describe('los descansos', () => {
    it('los botones suben y bajan quince segundos, sin bajar de cero ni pasar de un día', () => {
      const { e: x, bloque } = conEjercicio(e, 'press-banca');
      let y = pasoDeDescanso(x, bloque, 'descansoEntreSeries', 1);
      expect(ejercicios(y, 0).descansoEntreSeries).toBe('15');
      y = cambiarDescanso(y, bloque, 'descansoEntreSeries', '90');
      y = pasoDeDescanso(y, bloque, 'descansoEntreSeries', 1);
      expect(ejercicios(y, 0).descansoEntreSeries).toBe('105');
      y = cambiarDescanso(y, bloque, 'descansoDespues', '10');
      y = pasoDeDescanso(y, bloque, 'descansoDespues', -1);
      expect(ejercicios(y, 0).descansoDespues).toBe('');
      y = cambiarDescanso(y, bloque, 'descansoDespues', '86390');
      expect(ejercicios(pasoDeDescanso(y, bloque, 'descansoDespues', 1), 0).descansoDespues).toBe('86400');
      // Un texto que no se entiende no se toca.
      y = cambiarDescanso(y, bloque, 'descansoDespues', 'mucho');
      expect(pasoDeDescanso(y, bloque, 'descansoDespues', 1)).toEqual(y);
    });

    it('se guardan detrás de cada serie y del bloque, y el último bloque no tiene descanso de después', () => {
      let { e: x, bloque, serie } = conEjercicio(e, 'press-banca');
      const segunda = nuevoId();
      x = anadirVuelta(cambiarSerie(x, bloque, serie, { repeticiones: '8' }), bloque, [segunda]);
      x = cambiarSerie(x, bloque, segunda, { repeticiones: '8' });
      x = cambiarDescanso(cambiarDescanso(x, bloque, 'descansoEntreSeries', '90'), bloque, 'descansoDespues', '0');
      const curl = conEjercicio(x, 'curl-mancuernas');
      x = cambiarSerie(curl.e, curl.bloque, curl.serie, { repeticiones: '12' });
      // El último no enseña su descanso de después: aunque lleve algo, ni se guarda ni avisa.
      x = cambiarDescanso(x, curl.bloque, 'descansoDespues', 'mucho');
      x = cambiarEntreno(x, { esfuerzo: 6, minutos: '40' });

      const resultado = validar(x, EJERCICIOS, HOY);
      expect(resultado.errores).toBeUndefined();
      const [press, ultimo] = resultado.entreno?.bloques ?? [];
      expect(press.series.map((s) => s.descansoMs)).toEqual([90_000, null]);
      expect(press.descansoMs).toBe(0);
      expect(ultimo.descansoMs).toBeNull();
      expect(ultimo.series.map((s) => s.descansoMs)).toEqual([null]);
    });

    it('el último bloque que se guarda no lleva descanso de después, aunque detrás quede uno vacío', () => {
      const { e: x, bloque, serie } = conEjercicio(e, 'press-banca');
      let y = cambiarDescanso(cambiarSerie(x, bloque, serie, { repeticiones: '8' }), bloque, 'descansoDespues', '120');
      y = cambiarEntreno(conEjercicio(y, 'curl-mancuernas').e, { esfuerzo: 6, minutos: '40' });
      expect(validar(y, EJERCICIOS, HOY).entreno?.bloques.map((b) => b.descansoMs)).toEqual([null]);
    });

    it('la última carrera no avisa por un descanso de después que no se ve', () => {
      const { e: x, bloque, serie } = conEjercicio(e, 'press-banca');
      const cinta = nuevoId();
      let y = cambiarCarrera(anadirCarrera(cambiarSerie(x, bloque, serie, { repeticiones: '8' }), cinta), cinta, { kilometros: '2' });
      y = cambiarEntreno(cambiarDescanso(y, cinta, 'descansoDespues', 'mucho'), { esfuerzo: 6, minutos: '40' });
      expect(validar(y, EJERCICIOS, HOY).errores).toBeUndefined();
    });

    it('avisan si no se entienden o pasan de un día', () => {
      const { e: x, bloque, serie } = conEjercicio(e, 'press-banca');
      let y = cambiarEntreno(cambiarSerie(x, bloque, serie, { repeticiones: '8' }), { esfuerzo: 7, minutos: '45' });
      y = anadirCarrera(y, nuevoId());
      expect(validar(cambiarDescanso(y, bloque, 'descansoEntreSeries', '1:30'), EJERCICIOS, HOY).errores).toEqual([
        'Press banca: el descanso entre series «1:30» no se entiende: van segundos.',
      ]);
      expect(validar(cambiarDescanso(y, bloque, 'descansoDespues', '90000'), EJERCICIOS, HOY).errores).toEqual([
        'Press banca: el descanso antes del siguiente pasa de un día (86400 segundos).',
      ]);
    });
  });

  describe('la carrera en cinta', () => {
    it('se añade vacía, y una vacía no se guarda', () => {
      const id = nuevoId();
      const x = anadirCarrera(e, id);
      expect(x.bloques).toEqual([{ tipo: 'carrera', id, kilometros: '', minutos: '', descansoDespues: '' }]);
      expect(tieneAlgo(x)).toBe(true);
      expect(validar(cambiarEntreno(x, { esfuerzo: 3, minutos: '15' }), EJERCICIOS, HOY).errores).toEqual([
        'Apunta al menos una serie o una carrera.',
      ]);
    });

    it('se guarda como un bloque de carrera, con sus metros y su tiempo, sin series', () => {
      const id = nuevoId();
      let x = anadirCarrera(e, id);
      x = cambiarCarrera(x, id, { kilometros: '2,35', minutos: '12' });
      x = cambiarDescanso(x, id, 'descansoDespues', '120');
      x = cambiarDescanso(x, id, 'descansoEntreSeries', '90');
      expect(carrera(x, 0).descansoDespues).toBe('120');
      expect(carrera(x, 0)).not.toHaveProperty('descansoEntreSeries');
      const press = conEjercicio(x, 'press-banca');
      x = cambiarEntreno(cambiarSerie(press.e, press.bloque, press.serie, { repeticiones: '8' }), { esfuerzo: 6, minutos: '50' });

      const resultado = validar(x, EJERCICIOS, HOY);
      expect(resultado.errores).toBeUndefined();
      expect(resultado.entreno?.bloques[0]).toEqual({ id, metrosCorridos: 2350, tiempoMs: 720_000, descansoMs: 120_000, series: [] });
    });

    it('los botones suben y bajan medio kilómetro o un minuto, sin bajar de cero', () => {
      const id = nuevoId();
      let x = anadirCarrera(e, id);
      x = pasoDeCarrera(pasoDeCarrera(x, id, 'kilometros', 1), id, 'kilometros', 1);
      expect(carrera(x, 0).kilometros).toBe('1');
      x = pasoDeCarrera(x, id, 'kilometros', -1);
      expect(carrera(x, 0).kilometros).toBe('0,5');
      x = cambiarCarrera(x, id, { kilometros: '2,35' });
      expect(carrera(pasoDeCarrera(x, id, 'kilometros', 1), 0).kilometros).toBe('2,85');
      x = pasoDeCarrera(x, id, 'minutos', 1);
      expect(carrera(x, 0).minutos).toBe('1');
      x = pasoDeCarrera(x, id, 'minutos', -1);
      expect(carrera(x, 0).minutos).toBe('');
      x = cambiarCarrera(x, id, { kilometros: 'mucho' });
      expect(pasoDeCarrera(x, id, 'kilometros', 1)).toEqual(x);
    });

    it.each([
      [{ minutos: '12' }, 'Carrera en cinta: falta la distancia.'],
      [{ kilometros: '2 km' }, 'Carrera en cinta: la distancia «2 km» no se entiende.'],
      [{ kilometros: '0' }, 'Carrera en cinta: la distancia tiene que ser mayor que 0.'],
      [{ kilometros: '2', minutos: '12,5' }, 'Carrera en cinta: los minutos «12,5» no se entienden: van minutos enteros.'],
      [{ kilometros: '2', minutos: '3000' }, 'Carrera en cinta: los minutos van de 1 a 2880.'],
      // Los metros escritos donde van kilómetros contarían enteros para las zapatillas.
      [{ kilometros: '800', minutos: '5' }, 'Carrera en cinta: 800 km no puede ser: la distancia va en kilómetros, y 800 m son 0,8 km.'],
      [{ kilometros: '120,5' }, 'Carrera en cinta: 120,5 km no puede ser: la distancia va en kilómetros.'],
      [
        { kilometros: '100', minutos: '10' },
        'Carrera en cinta: 100 km en 10 minutos son 600 km/h: revisa la distancia, que va en kilómetros, y 100 m son 0,1 km, o los minutos.',
      ],
      [{ kilometros: '15', minutos: '14' }, 'Carrera en cinta: 15 km en 14 minutos son 64 km/h: revisa la distancia, que va en kilómetros, o los minutos.'],
    ])('avisa con %o', (cambios, aviso) => {
      const id = nuevoId();
      const x = cambiarEntreno(cambiarCarrera(anadirCarrera(e, id), id, cambios), { esfuerzo: 3, minutos: '15' });
      expect(validar(x, EJERCICIOS, HOY).errores).toEqual([aviso]);
    });

    it('acepta hasta 30 km/h, y 100 km justos sin minutos', () => {
      const id = nuevoId();
      const rapida = cambiarEntreno(cambiarCarrera(anadirCarrera(e, id), id, { kilometros: '5', minutos: '10' }), { esfuerzo: 9, minutos: '15' });
      expect(validar(rapida, EJERCICIOS, HOY).errores).toBeUndefined();
      const larga = cambiarEntreno(cambiarCarrera(anadirCarrera(e, id), id, { kilometros: '100' }), { esfuerzo: 9, minutos: '600' });
      expect(validar(larga, EJERCICIOS, HOY).errores).toBeUndefined();
    });

    it('la duración no puede ser menor que lo corrido', () => {
      const id = nuevoId();
      const x = cambiarCarrera(anadirCarrera(e, id), id, { kilometros: '8', minutos: '50' });
      expect(validar(cambiarEntreno(x, { esfuerzo: 5, minutos: '15' }), EJERCICIOS, HOY).errores).toEqual([
        'La duración (15 minutos) es menor que la carrera en cinta (50 minutos).',
      ]);
      const dos = nuevoId();
      const conDos = cambiarCarrera(anadirCarrera(x, dos), dos, { kilometros: '1', minutos: '10' });
      expect(validar(cambiarEntreno(conDos, { esfuerzo: 5, minutos: '55' }), EJERCICIOS, HOY).errores).toEqual([
        'La duración (55 minutos) es menor que las carreras en cinta (60 minutos).',
      ]);
    });

    it('la duración medida suma las carreras de antes de la primera serie hecha y de después de la última', () => {
      const calentamiento = nuevoId();
      let x = cambiarCarrera(anadirCarrera(e, calentamiento), calentamiento, { kilometros: '2', minutos: '12' });
      const press = conEjercicio(x, 'press-banca');
      const segunda = nuevoId();
      x = cambiarSerie(anadirVuelta(press.e, press.bloque, [segunda]), press.bloque, press.serie, { repeticiones: '8' });
      x = cambiarSerie(x, press.bloque, segunda, { repeticiones: '8' });
      // Sin marcas no se mide nada.
      expect(carrerasFueraDeLoMedido(x)).toBe(0);
      x = marcarHecha(marcarHecha(x, press.bloque, press.serie, T0), press.bloque, segunda, T0 + 40 * 60_000);
      const enMedio = nuevoId();
      const plancha = conEjercicio(cambiarCarrera(anadirCarrera(x, enMedio), enMedio, { kilometros: '1', minutos: '5' }), 'plancha');
      x = marcarHecha(cambiarSerie(plancha.e, plancha.bloque, plancha.serie, { segundos: '60' }), plancha.bloque, plancha.serie, T0 + 50 * 60_000);
      const vuelta = nuevoId();
      x = cambiarCarrera(anadirCarrera(x, vuelta), vuelta, { kilometros: '1', minutos: '8' });

      // La carrera de en medio ya está entre la primera marca y la última.
      expect(minutosMedidos(x)).toBe(50);
      expect(carrerasFueraDeLoMedido(x)).toBe(20);
      expect(validar(cambiarEntreno(x, { esfuerzo: 7 }), EJERCICIOS, HOY).entreno?.duracionMs).toBe(70 * 60_000);
    });

    it('con dos carreras, los avisos dicen cuál', () => {
      const una = nuevoId();
      const otra = nuevoId();
      let x = cambiarCarrera(anadirCarrera(e, una), una, { kilometros: '1' });
      x = cambiarCarrera(anadirCarrera(x, otra), otra, { minutos: '5' });
      expect(validar(cambiarEntreno(x, { esfuerzo: 3, minutos: '15' }), EJERCICIOS, HOY).errores).toEqual([
        'Carrera en cinta (la 2.ª): falta la distancia.',
      ]);
    });
  });

  describe('los límites y los avisos', () => {
    /** Un entreno con un ejercicio y estas series, con esfuerzo y duración bien. */
    const con = (ejercicioId: string, series: Partial<Record<'peso' | 'repeticiones' | 'segundos', string>>[]) => {
      const bloque = nuevoId();
      let x = anadirEjercicio(e, ejercicioId, bloque, nuevoId());
      x = {
        ...x,
        bloques: x.bloques.map((b) => (b.tipo === 'ejercicios' ? { ...b, vueltas: series.map((s) => [{ ...vacia(nuevoId()), ...s }]) } : b)),
      };
      return cambiarEntreno(x, { esfuerzo: 7, minutos: '45' });
    };
    const avisos = (x: EntrenoEnEdicion) => validar(x, EJERCICIOS, HOY).errores ?? [];

    it('no deja pasar más de 1000 kg ni valores fuera de los límites de la base', () => {
      expect(avisos(con('press-banca', [{ peso: '1200', repeticiones: '8' }]))).toEqual([
        'Press banca, serie 1: el peso «1200» pasa de 1000 kg.',
      ]);
      expect(avisos(con('press-banca', [{ repeticiones: '0' }]))).toEqual([
        'Press banca, serie 1: las repeticiones van de 1 a 10000.',
      ]);
      expect(avisos(cambiarEntreno(con('press-banca', [{ repeticiones: '8' }]), { minutos: '0' }))).toEqual([
        'La duración va de 1 minuto a 48 horas (2880 minutos).',
      ]);
    });

    it('no deja una fecha futura ni anterior al año 2000', () => {
      const bien = con('press-banca', [{ repeticiones: '8' }]);
      expect(avisos(cambiarEntreno(bien, { fecha: '2026-11-16' }))).toEqual(['La fecha es de un día que todavía no ha llegado.']);
      expect(avisos(cambiarEntreno(bien, { fecha: '1999-12-31' }))).toEqual(['La fecha es anterior al año 2000.']);
      expect(avisos(cambiarEntreno(bien, { fecha: HOY }))).toEqual([]);
    });

    it('numera las series como la pantalla, contando las vacías, y dice cuál si un ejercicio se repite', () => {
      const x = con('press-banca', [{}, { peso: '60' }]);
      expect(avisos(x)).toEqual(['Press banca, serie 2: faltan las repeticiones.']);
      const bien = con('press-banca', [{}, { peso: '60', repeticiones: '8' }]);
      expect(validar(bien, EJERCICIOS, HOY).entreno?.bloques[0].series.map((s) => s.ronda)).toEqual([1]);

      const otro = nuevoId();
      const dos = anadirEjercicio(bien, 'press-banca', otro, nuevoId());
      const conPeso = cambiarSerie(dos, otro, serieDe(dos, 1, 0).id, { peso: '60' });
      expect(avisos(conPeso)).toEqual(['Press banca (el 2.º), serie 1: faltan las repeticiones.']);
    });

    it('en una plancha faltan los segundos, y no lleva peso', () => {
      expect(avisos(con('plancha', [{ peso: '10' }]))).toEqual([
        'Plancha, serie 1: Plancha no lleva peso.',
        'Plancha, serie 1: faltan los segundos.',
      ]);
    });

    it('una duración medida de menos de 10 minutos no se da por buena', () => {
      const { e: x, bloque, serie } = conEjercicio(e, 'press-banca');
      const segunda = nuevoId();
      let y = cambiarSerie(anadirVuelta(x, bloque, [segunda]), bloque, serie, { repeticiones: '8' });
      y = cambiarSerie(y, bloque, segunda, { repeticiones: '8' });
      y = marcarHecha(marcarHecha(y, bloque, serie, T0), bloque, segunda, T0 + 5 * 60_000);
      y = cambiarEntreno(y, { esfuerzo: 7 });
      expect(avisos(y)).toEqual(['Falta la duración: las series marcadas como hechas solo cubren 5 minutos. Escríbela.']);
    });

    it('mide la duración por la hora de las marcas, aunque se alternen dos ejercicios', () => {
      const a = conEjercicio(e, 'press-banca');
      const b = conEjercicio(a.e, 'plancha');
      const a2 = nuevoId();
      let x = anadirVuelta(b.e, a.bloque, [a2]);
      x = marcarHecha(x, a.bloque, a.serie, T0);
      x = marcarHecha(x, b.bloque, b.serie, T0 + 20 * 60_000);
      x = marcarHecha(x, a.bloque, a2, T0 + 40 * 60_000);
      expect(minutosMedidos(x)).toBe(40);
    });

    it('los botones no bajan de cero ni pasan de los límites', () => {
      const { e: x, bloque, serie } = conEjercicio(e, 'press-banca');
      let y = cambiarSerie(x, bloque, serie, { peso: '1,5', segundos: '5' });
      y = pasoDeSerie(pasoDeSerie(y, bloque, serie, 'peso', -1), bloque, serie, 'segundos', -1);
      expect(serieDe(y, 0, 0)).toMatchObject({ peso: '', segundos: '' });
      y = cambiarSerie(y, bloque, serie, { peso: '999' });
      y = pasoDeSerie(pasoDeSerie(y, bloque, serie, 'peso', 1), bloque, serie, 'peso', 1);
      expect(serieDe(y, 0, 0).peso).toBe('1000');
    });

    it('descarta un borrador con una fecha o una hora imposibles', () => {
      expect(leerBorrador({ ...e, fecha: '2026-11-31' })).toBeNull();
      expect(leerBorrador({ ...e, hora: '25:99' })).toBeNull();
      expect(leerBorrador({ ...e, hora: null })).toEqual({ ...e, hora: null });
    });

    it('un editor que se quedó vacío empieza a la hora de lo primero que se apunta', () => {
      const manana = new Date(2026, 10, 16, 9, 5);
      expect(empezarAhoraSiVacio(e, manana)).toMatchObject({ fecha: '2026-11-16', hora: '09:05' });
      const lleno = conEjercicio(e, 'press-banca').e;
      expect(empezarAhoraSiVacio(lleno, manana)).toEqual(lleno);
    });
  });
});

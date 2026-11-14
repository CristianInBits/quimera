import type { Ejercicio } from '@/datos/ejercicios';
import {
  anadirEjercicio,
  anadirSerie,
  cambiarEntreno,
  cambiarSerie,
  empezarAhoraSiVacio,
  entrenoNuevo,
  igualQueLaAnterior,
  leerBorrador,
  marcarHecha,
  minutosMedidos,
  palabraDelEsfuerzo,
  pasoDeSerie,
  quitarBloque,
  quitarSerie,
  tieneAlgo,
  validar,
  type EntrenoEnEdicion,
} from '@/gimnasio/editor';
import { T0, generadorDeIds } from '@/pruebas/datos';

const HOY = '2026-11-15';

const EJERCICIOS = new Map<string, Ejercicio>([
  ['press-banca', { id: 'press-banca', nombre: 'Press banca', grupo: 'pecho', mide: ['repeticiones', 'peso'], porMancuerna: false }],
  ['plancha', { id: 'plancha', nombre: 'Plancha', grupo: 'core', mide: ['tiempo'], porMancuerna: false }],
  ['curl-mancuernas', { id: 'curl-mancuernas', nombre: 'Curl con mancuernas', grupo: 'brazo', mide: ['repeticiones', 'peso'], porMancuerna: true }],
]);

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
    expect(e).toMatchObject({ formato: 1, selloLeido: null, fecha: '2026-11-15', hora: '18:30', bloques: [], minutos: '', esfuerzo: null, notas: '' });
    expect(tieneAlgo(e)).toBe(false);
  });

  it('añade un ejercicio con una serie vacía, y series detrás', () => {
    const { e: con, bloque, serie } = conEjercicio(e, 'press-banca');
    const otra = nuevoId();
    const despues = anadirSerie(con, bloque, otra);
    expect(despues.bloques).toEqual([
      {
        id: bloque,
        ejercicioId: 'press-banca',
        series: [
          { id: serie, repeticiones: '', peso: '', segundos: '', hecha: null },
          { id: otra, repeticiones: '', peso: '', segundos: '', hecha: null },
        ],
      },
    ]);
    expect(tieneAlgo(despues)).toBe(true);
  });

  it('los botones suben y bajan un disco, una repetición o cinco segundos, sin bajar de cero', () => {
    const { e: con, bloque, serie } = conEjercicio(e, 'press-banca');
    let x = pasoDeSerie(con, bloque, serie, 'peso', 1);
    expect(x.bloques[0].series[0].peso).toBe('2,5');
    x = cambiarSerie(x, bloque, serie, { peso: '60' });
    x = pasoDeSerie(x, bloque, serie, 'peso', 1);
    expect(x.bloques[0].series[0].peso).toBe('62,5');
    x = pasoDeSerie(x, bloque, serie, 'repeticiones', 1);
    x = pasoDeSerie(x, bloque, serie, 'repeticiones', -1);
    x = pasoDeSerie(x, bloque, serie, 'repeticiones', -1);
    expect(x.bloques[0].series[0].repeticiones).toBe('');
    x = pasoDeSerie(x, bloque, serie, 'segundos', 1);
    expect(x.bloques[0].series[0].segundos).toBe('5');
    // Un texto que no se entiende no se toca.
    x = cambiarSerie(x, bloque, serie, { peso: 'mucho' });
    expect(pasoDeSerie(x, bloque, serie, 'peso', 1)).toEqual(x);
  });

  it('copia los números de la serie anterior, y en la primera no hace nada', () => {
    const { e: con, bloque, serie } = conEjercicio(e, 'press-banca');
    const segunda = nuevoId();
    let x = cambiarSerie(con, bloque, serie, { peso: '60', repeticiones: '8' });
    x = anadirSerie(x, bloque, segunda);
    x = igualQueLaAnterior(x, bloque, segunda);
    expect(x.bloques[0].series[1]).toMatchObject({ peso: '60', repeticiones: '8' });
    expect(igualQueLaAnterior(x, bloque, serie)).toEqual(x);
  });

  it('quita series y ejercicios', () => {
    const { e: con, bloque, serie } = conEjercicio(e, 'press-banca');
    expect(quitarSerie(con, bloque, serie).bloques[0].series).toEqual([]);
    expect(quitarBloque(con, bloque).bloques).toEqual([]);
  });

  it('mide la duración entre la primera serie hecha y la última, si hay dos y no pasan de 4 horas', () => {
    const { e: con, bloque, serie } = conEjercicio(e, 'press-banca');
    const segunda = nuevoId();
    let x = anadirSerie(con, bloque, segunda);
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
    x = anadirSerie(x, bloque, nuevoId());
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
    x = anadirSerie(x, bloque, segunda);
    x = cambiarSerie(x, bloque, segunda, { repeticiones: '8' });
    x = marcarHecha(marcarHecha(x, bloque, serie, T0), bloque, segunda, T0 + 30 * 60_000);
    x = cambiarEntreno(x, { esfuerzo: 5 });
    expect(validar(x, EJERCICIOS, HOY).entreno?.duracionMs).toBe(30 * 60_000);
  });

  it.each([
    ['sin ninguna serie', (x: EntrenoEnEdicion) => x, 'Apunta al menos una serie.'],
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
    const borrador = cambiarSerie(con, bloque, serie, { peso: '60' });
    expect(leerBorrador(JSON.parse(JSON.stringify(borrador)))).toEqual(borrador);
    expect(leerBorrador(null)).toBeNull();
    expect(leerBorrador({ ...borrador, formato: 2 })).toBeNull();
    expect(leerBorrador({ ...borrador, bloques: [{ id: 'x', ejercicioId: 'y', series: [{ id: 'z' }] }] })).toBeNull();
    expect(leerBorrador({ ...borrador, esfuerzo: 'siete' })).toBeNull();
  });

  it('dice el esfuerzo con las palabras de Quimera-web', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(palabraDelEsfuerzo)).toEqual([
      'muy suave', 'muy suave', 'suave', 'suave', 'moderado', 'moderado', 'duro', 'duro', 'muy duro', 'máximo',
    ]);
  });

  describe('los límites y los avisos', () => {
    /** Un entreno con un ejercicio y estas series, con esfuerzo y duración bien. */
    const con = (ejercicioId: string, series: Partial<Record<'peso' | 'repeticiones' | 'segundos', string>>[]) => {
      const bloque = nuevoId();
      let x = anadirEjercicio(e, ejercicioId, bloque, nuevoId());
      x = { ...x, bloques: x.bloques.map((b) => ({ ...b, series: series.map((s) => ({ id: nuevoId(), repeticiones: '', peso: '', segundos: '', hecha: null, ...s })) })) };
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
      const conPeso = cambiarSerie(dos, otro, dos.bloques[1].series[0].id, { peso: '60' });
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
      let y = cambiarSerie(anadirSerie(x, bloque, segunda), bloque, serie, { repeticiones: '8' });
      y = cambiarSerie(y, bloque, segunda, { repeticiones: '8' });
      y = marcarHecha(marcarHecha(y, bloque, serie, T0), bloque, segunda, T0 + 5 * 60_000);
      y = cambiarEntreno(y, { esfuerzo: 7 });
      expect(avisos(y)).toEqual(['Falta la duración: las series marcadas como hechas solo cubren 5 minutos. Escríbela.']);
    });

    it('mide la duración por la hora de las marcas, aunque se alternen dos ejercicios', () => {
      const a = conEjercicio(e, 'press-banca');
      const b = conEjercicio(a.e, 'plancha');
      const a2 = nuevoId();
      let x = anadirSerie(b.e, a.bloque, a2);
      x = marcarHecha(x, a.bloque, a.serie, T0);
      x = marcarHecha(x, b.bloque, b.serie, T0 + 20 * 60_000);
      x = marcarHecha(x, a.bloque, a2, T0 + 40 * 60_000);
      expect(minutosMedidos(x)).toBe(40);
    });

    it('los botones no bajan de cero ni pasan de los límites', () => {
      const { e: x, bloque, serie } = conEjercicio(e, 'press-banca');
      let y = cambiarSerie(x, bloque, serie, { peso: '1,5', segundos: '5' });
      y = pasoDeSerie(pasoDeSerie(y, bloque, serie, 'peso', -1), bloque, serie, 'segundos', -1);
      expect(y.bloques[0].series[0]).toMatchObject({ peso: '', segundos: '' });
      y = cambiarSerie(y, bloque, serie, { peso: '999' });
      y = pasoDeSerie(pasoDeSerie(y, bloque, serie, 'peso', 1), bloque, serie, 'peso', 1);
      expect(y.bloques[0].series[0].peso).toBe('1000');
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

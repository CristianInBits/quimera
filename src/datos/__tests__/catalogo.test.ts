import { leerAjuste, ponerAjusteEn, quitarAjusteLocalEn, type ValorDeAjuste } from '@/datos/ajustes';
import { puertaDe } from '@/datos/base';
import {
  CATALOGO,
  CATALOGO_VERSION,
  GRUPOS,
  GRUPOS_DEL_GIMNASIO,
  huellaDelCatalogo,
  sincronizarCatalogoEn,
  type Catalogo,
} from '@/datos/catalogo';
import { esUuidV7 } from '@/datos/ids';
import { prepararBase } from '@/datos/preparar';
import type { BaseDePrueba } from '@/pruebas/baseDePrueba';
import { T0, abrirBasePreparada } from '@/pruebas/datos';

// Las versiones del catálogo que ya han salido de la app, con su huella. Al
// publicar un catálogo nuevo se sube CATALOGO_VERSION y se añade aquí su
// huella; las que ya están no se tocan.
const PUBLICADOS: Record<number, string> = { 1: '18ea78182c9346', 2: '04f59d03457ab4' };
// Las claves que ya han salido de la app. Una clave de esta lista no se quita nunca.
const CLAVES_PUBLICADAS = [
  'correr', 'press-banca', 'press-banca-inclinado', 'press-banca-declinado', 'press-banca-multipower',
  'press-mancuernas', 'press-inclinado-mancuernas', 'press-pecho-maquina', 'aperturas-mancuernas',
  'aperturas-polea', 'contractor-pecho', 'fondos-paralelas', 'flexiones', 'dominadas', 'jalon-pecho',
  'remo-barra', 'remo-mancuerna', 'remo-polea-baja', 'remo-t', 'remo-apoyo-pecho', 'pull-over',
  'pullover-polea', 'encogimientos-barra', 'encogimientos-mancuernas', 'hiperextensiones',
  'sentadilla-trasera', 'sentadilla-frontal', 'sentadilla-bulgara', 'sentadilla-hack',
  'sentadilla-multipower', 'sentadilla-goblet', 'peso-muerto', 'peso-muerto-rumano', 'peso-muerto-sumo',
  'prensa-piernas', 'zancadas', 'subida-cajon', 'hip-thrust', 'puente-gluteo', 'buenos-dias', 'curl-femoral',
  'extension-cuadriceps', 'elevacion-gemelos', 'elevacion-gemelos-sentado', 'aductores-maquina',
  'abductores-maquina', 'press-militar', 'press-hombros-mancuernas', 'press-hombros-maquina',
  'press-tras-nuca', 'press-arnold', 'elevaciones-laterales', 'elevaciones-frontales', 'pajaros',
  'face-pull', 'remo-menton', 'curl-barra', 'curl-barra-z', 'curl-mancuernas', 'curl-inclinado-mancuernas',
  'curl-martillo', 'curl-concentrado', 'curl-banco-scott', 'curl-muneca', 'extension-triceps-polea',
  'extension-triceps-cabeza', 'press-frances', 'press-banca-agarre-cerrado', 'patada-triceps',
  'fondos-banco', 'plancha', 'plancha-lateral', 'hollow-hold', 'elevacion-piernas-colgado',
  'rueda-abdominal', 'giro-ruso', 'crunch', 'crunch-maquina', 'press-pallof', 'lenador-polea',
  'inclinaciones-laterales',
];

// Los ejercicios cuyo peso se apunta por mancuerna, en el orden del catálogo.
const CON_MANCUERNAS = [
  'press-mancuernas', 'press-inclinado-mancuernas', 'aperturas-mancuernas', 'remo-mancuerna',
  'encogimientos-mancuernas', 'sentadilla-bulgara', 'zancadas', 'subida-cajon', 'press-hombros-mancuernas',
  'press-arnold', 'elevaciones-laterales', 'elevaciones-frontales', 'pajaros', 'curl-mancuernas',
  'curl-inclinado-mancuernas', 'curl-martillo', 'curl-concentrado', 'patada-triceps', 'inclinaciones-laterales',
];

/** Un nombre como lo busca una persona: sin mayúsculas ni tildes. */
const llano = (nombre: string) =>
  nombre
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

describe('El catálogo de ejercicios', () => {
  it('cada versión publicada tiene su huella, y cambiar el catálogo obliga a subir la versión', () => {
    expect(CATALOGO_VERSION).toBe(Math.max(...Object.keys(PUBLICADOS).map(Number)));
    expect(huellaDelCatalogo(CATALOGO)).toBe(PUBLICADOS[CATALOGO_VERSION]);
  });

  it('conserva todas las claves publicadas', () => {
    const claves = CATALOGO.map((e) => e.id);
    for (const clave of CLAVES_PUBLICADAS) {
      expect(claves).toContain(clave);
    }
  });

  it('tiene claves legibles, únicas y que no son UUID, y cada entrada mide algo', () => {
    const claves = CATALOGO.map((e) => e.id);
    expect(new Set(claves).size).toBe(claves.length);
    for (const entrada of CATALOGO) {
      expect(entrada.id).toMatch(/^[a-z0-9-]{2,64}$/);
      expect(esUuidV7(entrada.id)).toBe(false);
      expect(entrada.mide.length).toBeGreaterThan(0);
      expect(Object.keys(GRUPOS)).toContain(entrada.grupo);
    }
  });

  it('no repite nombres, aunque se escriban con otras mayúsculas o sin tildes', () => {
    const nombres = CATALOGO.map((e) => llano(e.nombre));
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it('enseña sus grupos con estos nombres y en este orden, y el gimnasio no incluye la carrera', () => {
    expect(Object.entries(GRUPOS)).toEqual([
      ['pecho', 'Pecho'],
      ['espalda', 'Espalda'],
      ['pierna', 'Pierna'],
      ['hombro', 'Hombro'],
      ['brazo', 'Brazo'],
      ['core', 'Core'],
      ['carrera', 'Carrera'],
    ]);
    expect(GRUPOS_DEL_GIMNASIO).toEqual(['pecho', 'espalda', 'pierna', 'hombro', 'brazo', 'core']);
  });

  it('trae los 80 ejercicios de gimnasio de Quimera-web, en sus seis grupos', () => {
    const porGrupo = (grupo: string) => CATALOGO.filter((e) => e.grupo === grupo).length;
    expect(GRUPOS_DEL_GIMNASIO.map(porGrupo)).toEqual([12, 12, 21, 10, 14, 11]);
  });

  it('las planchas y el hollow hold se miden solo en segundos, y el resto del gimnasio en repeticiones y peso', () => {
    const gimnasio = CATALOGO.filter((e) => GRUPOS_DEL_GIMNASIO.includes(e.grupo));
    for (const entrada of gimnasio) {
      const enSegundos = ['plancha', 'plancha-lateral', 'hollow-hold'].includes(entrada.id);
      expect(entrada.mide).toEqual(enSegundos ? ['tiempo'] : ['repeticiones', 'peso']);
    }
  });

  it('el peso por mancuerna lo llevan siempre los mismos ejercicios, y todos miden peso', () => {
    // Al añadir ejercicios con la marca, se añaden aquí. Las claves que ya
    // están no cambian nunca: cambiaría lo que significa el peso ya guardado.
    expect(CATALOGO.filter((e) => e.porMancuerna).map((e) => e.id)).toEqual(CON_MANCUERNAS);
    for (const entrada of CATALOGO.filter((e) => e.porMancuerna)) {
      expect(entrada.mide).toContain('peso');
    }
  });

  describe('en la base', () => {
    let db: BaseDePrueba;
    beforeEach(async () => {
      db = await abrirBasePreparada();
    });
    afterEach(() => db.cerrar());

    const sincronizar = (ahora: number, catalogo?: Catalogo, version?: number) =>
      puertaDe(db).escribir((tx) => sincronizarCatalogoEn(tx, ahora, catalogo, version));
    const fila = (id: string) => db.mirar('SELECT * FROM ejercicio WHERE id = :id', { ':id': id })[0];
    const prueba: Catalogo = [
      { id: 'correr', nombre: 'Correr', grupo: 'carrera', mide: ['tiempo', 'distancia'] },
      { id: 'remo', nombre: 'Remo', grupo: 'espalda', mide: ['tiempo', 'distancia'] },
      { id: 'press-banca', nombre: 'Press banca', grupo: 'pecho', mide: ['repeticiones', 'peso'], retirado: true },
    ];

    it('se copia al preparar la base, y no se vuelve a copiar si no cambia', async () => {
      expect(fila('correr')).toEqual({
        id: 'correr',
        nombre: 'Correr',
        grupo: 'carrera',
        usa_repeticiones: 0,
        usa_peso: 0,
        usa_tiempo: 1,
        usa_distancia: 1,
        usa_calorias: 0,
        propio: 0,
        modificado: T0,
        borrado: 0,
      });
      expect(await puertaDe(db).leer((l) => leerAjuste(l, 'local.catalogo'))).toEqual({
        version: CATALOGO_VERSION,
        huella: huellaDelCatalogo(CATALOGO),
      });
      expect(await sincronizar(T0 + 1000)).toBe(false);
    });

    it('cada ejercicio del catálogo queda en la base con su nombre, su grupo y lo que mide', () => {
      for (const entrada of CATALOGO) {
        const mide = (medida: string) => (entrada.mide.some((m) => m === medida) ? 1 : 0);
        expect(fila(entrada.id)).toEqual({
          id: entrada.id,
          nombre: entrada.nombre,
          grupo: entrada.grupo,
          usa_repeticiones: mide('repeticiones'),
          usa_peso: mide('peso'),
          usa_tiempo: mide('tiempo'),
          usa_distancia: mide('distancia'),
          usa_calorias: mide('calorias'),
          propio: 0,
          modificado: T0,
          borrado: entrada.retirado ? 1 : 0,
        });
      }
    });

    it('copia las entradas nuevas, lo que cambia y las retiradas, sin tocar lo que no cambia', async () => {
      expect(await sincronizar(T0 + 1000, prueba, CATALOGO_VERSION + 1)).toBe(true);
      expect(fila('correr')).toMatchObject({ modificado: T0 });
      expect(fila('remo')).toMatchObject({ nombre: 'Remo', usa_tiempo: 1, usa_calorias: 0, borrado: 0 });
      expect(fila('press-banca')).toMatchObject({ nombre: 'Press banca', borrado: 1, modificado: T0 + 1000 });

      const cambiado: Catalogo = [
        { ...prueba[0], grupo: 'pierna' },
        { ...prueba[1], mide: ['tiempo', 'distancia', 'calorias', 'peso'] },
        prueba[2],
      ];
      expect(await sincronizar(T0 + 2000, cambiado, CATALOGO_VERSION + 2)).toBe(true);
      expect(fila('correr')).toMatchObject({ grupo: 'pierna', modificado: T0 + 2000 });
      expect(fila('remo')).toMatchObject({ usa_calorias: 1, usa_peso: 1, modificado: T0 + 2000 });
      expect(fila('press-banca')).toMatchObject({ modificado: T0 + 1000 });
    });

    it('copia un catálogo cambiado aunque no se haya subido la versión', async () => {
      expect(await sincronizar(T0 + 1000, prueba, CATALOGO_VERSION)).toBe(true);
      expect(fila('remo')).toMatchObject({ nombre: 'Remo' });
    });

    it('una app más vieja no toca un catálogo más nuevo', async () => {
      await sincronizar(T0 + 1000, prueba, CATALOGO_VERSION + 1);
      expect(await sincronizar(T0 + 2000)).toBe(false);
      expect(fila('press-banca')).toMatchObject({ borrado: 1 });
    });

    it('el sello de un ejercicio nunca baja, aunque el reloj vaya hacia atrás', async () => {
      await sincronizar(T0 + 3_600_000, [{ ...prueba[0], nombre: 'Trotar' }], CATALOGO_VERSION + 1);
      expect(fila('correr')).toMatchObject({ nombre: 'Trotar', modificado: T0 + 3_600_000 });
      await sincronizar(T0, prueba, CATALOGO_VERSION + 2);
      expect(fila('correr')).toMatchObject({ nombre: 'Correr', modificado: T0 + 3_600_001 });
    });

    it('preparar la base vuelve a copiar el catálogo si la copia no coincide', async () => {
      await db.runAsync("UPDATE ejercicio SET nombre = 'Trotar' WHERE id = 'correr'", {});
      await puertaDe(db).escribir((tx) =>
        ponerAjusteEn(tx, 'local.catalogo', { version: CATALOGO_VERSION, huella: 'otra' }, T0),
      );
      await prepararBase(db, { ahora: () => T0 + 5000 });
      expect(fila('correr')).toMatchObject({ nombre: 'Correr', modificado: T0 + 5000 });
    });
  });
});

describe.each(['real', 'integer'] as const)('Los ajustes, con los números como en %s', (enteros) => {
  let db: BaseDePrueba;
  beforeEach(async () => {
    db = await abrirBasePreparada({ enteros });
  });
  afterEach(() => db.cerrar());

  const poner = (clave: string, valor: ValorDeAjuste, ahora: number) =>
    puertaDe(db).escribir((tx) => ponerAjusteEn(tx, clave, valor, ahora));
  const leer = (clave: string) => puertaDe(db).leer((l) => leerAjuste(l, clave));
  const crudo = (clave: string) =>
    db.mirar<{ valor: string; modificado: number }>('SELECT valor, modificado FROM ajuste WHERE clave = :clave', {
      ':clave': clave,
    })[0];

  it('guardan su valor en JSON, y un número entero sigue siendo entero', async () => {
    await poner('descanso.por_defecto_ms', 90000, T0);
    expect(await leer('descanso.por_defecto_ms')).toBe(90000);
    expect(crudo('descanso.por_defecto_ms').valor).toBe('90000');
  });

  it('volver al valor por defecto guarda null, con un sello nuevo que nunca baja', async () => {
    await poner('descanso.por_defecto_ms', 90000, T0);
    await poner('descanso.por_defecto_ms', null, T0 - 1000);
    expect(await leer('descanso.por_defecto_ms')).toBeNull();
    expect(crudo('descanso.por_defecto_ms')).toEqual({ valor: 'null', modificado: T0 + 1 });
  });

  it('los ajustes de este móvil se pueden quitar, y los que viajan no', async () => {
    await poner('local.borrador.gimnasio', { formato: 1 }, T0);
    await puertaDe(db).escribir((tx) => quitarAjusteLocalEn(tx, 'local.borrador.gimnasio'));
    expect(await leer('local.borrador.gimnasio')).toBeUndefined();

    await poner('descanso.por_defecto_ms', 90000, T0);
    await expect(
      puertaDe(db).escribir((tx) => quitarAjusteLocalEn(tx, 'descanso.por_defecto_ms')),
    ).rejects.toThrow(/viaja/);
    expect(await leer('descanso.por_defecto_ms')).toBe(90000);
  });

  it('un ajuste que nunca se guardó no tiene valor', async () => {
    expect(await leer('no.existe')).toBeUndefined();
  });

  it('la base rechaza una clave con mayúsculas', async () => {
    await expect(poner('Descanso', 1, T0)).rejects.toThrow(/constraint/i);
    expect(db.mirar('SELECT COUNT(*) AS n FROM ajuste WHERE clave = :c', { ':c': 'Descanso' })).toEqual([{ n: 0 }]);
  });
});

import { leerAjuste, ponerAjusteEn, type ValorDeAjuste } from '@/datos/ajustes';
import { puertaDe } from '@/datos/base';
import {
  CATALOGO,
  CATALOGO_VERSION,
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
const PUBLICADOS: Record<number, string> = { 1: '18ea78182c9346' };
// Las claves que ya han salido de la app. Una clave de esta lista no se quita nunca.
const CLAVES_PUBLICADAS = ['correr'];

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
      { id: 'remo', nombre: 'Remo', grupo: 'hyrox', mide: ['tiempo', 'distancia'] },
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

    it('copia las entradas nuevas, lo que cambia y las retiradas, sin tocar lo que no cambia', async () => {
      expect(await sincronizar(T0 + 1000, prueba, 2)).toBe(true);
      expect(fila('correr')).toMatchObject({ modificado: T0 });
      expect(fila('remo')).toMatchObject({ nombre: 'Remo', usa_tiempo: 1, usa_calorias: 0, borrado: 0 });
      expect(fila('press-banca')).toMatchObject({ nombre: 'Press banca', borrado: 1, modificado: T0 + 1000 });

      const cambiado: Catalogo = [prueba[0], { ...prueba[1], mide: ['tiempo', 'distancia', 'calorias'] }, prueba[2]];
      expect(await sincronizar(T0 + 2000, cambiado, 3)).toBe(true);
      expect(fila('remo')).toMatchObject({ usa_calorias: 1, modificado: T0 + 2000 });
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
      await sincronizar(T0 + 3_600_000, [{ ...prueba[0], nombre: 'Trotar' }], 2);
      expect(fila('correr')).toMatchObject({ nombre: 'Trotar', modificado: T0 + 3_600_000 });
      await sincronizar(T0, prueba, 3);
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

  it('un ajuste que nunca se guardó no tiene valor', async () => {
    expect(await leer('no.existe')).toBeUndefined();
  });

  it('la base rechaza una clave con mayúsculas', async () => {
    await expect(poner('Descanso', 1, T0)).rejects.toThrow(/constraint/i);
    expect(db.mirar('SELECT COUNT(*) AS n FROM ajuste WHERE clave = :c', { ':c': 'Descanso' })).toEqual([{ n: 0 }]);
  });
});

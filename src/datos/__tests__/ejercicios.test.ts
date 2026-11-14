import { puertaDe } from '@/datos/base';
import { CATALOGO, CATALOGO_VERSION, sincronizarCatalogoEn } from '@/datos/catalogo';
import { leerEjercicios, leerEjerciciosPorClave } from '@/datos/ejercicios';
import type { BaseDePrueba } from '@/pruebas/baseDePrueba';
import { T0, abrirBasePreparada } from '@/pruebas/datos';

describe('Los ejercicios que se pueden elegir', () => {
  let db: BaseDePrueba;
  beforeEach(async () => {
    db = await abrirBasePreparada();
  });
  afterEach(() => db.cerrar());

  const leer = () => puertaDe(db).leer((l) => leerEjercicios(l));
  const porClave = (ids: string[]) => puertaDe(db).leer((l) => leerEjerciciosPorClave(l, ids));

  it('salen con lo que miden y con la marca de peso por mancuerna del catálogo', async () => {
    const todos = await leer();
    expect(todos.find((e) => e.id === 'curl-mancuernas')).toEqual({
      id: 'curl-mancuernas',
      nombre: 'Curl con mancuernas',
      grupo: 'brazo',
      mide: ['repeticiones', 'peso'],
      porMancuerna: true,
    });
    expect(todos.find((e) => e.id === 'plancha')).toMatchObject({ mide: ['tiempo'], porMancuerna: false });
    expect(todos.filter((e) => e.porMancuerna).length).toBe(CATALOGO.filter((e) => e.porMancuerna).length);
  });

  it('salen por orden alfabético, como los lee una persona en español', async () => {
    const nombres = (await leer()).filter((e) => e.grupo === 'pierna').map((e) => e.nombre);
    expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, 'es')));
    // «Elevación» va antes que «Extensión», con tilde o sin ella.
    expect(nombres.indexOf('Elevación de gemelos')).toBeLessThan(nombres.indexOf('Extensión de cuádriceps'));
  });

  it('un ejercicio retirado ya no se puede elegir, pero se sigue leyendo por su clave', async () => {
    const sinPress = CATALOGO.map((e) => (e.id === 'press-banca' ? { ...e, retirado: true as const } : e));
    await puertaDe(db).escribir((tx) => sincronizarCatalogoEn(tx, T0, sinPress, CATALOGO_VERSION + 1));

    expect((await leer()).map((e) => e.id)).not.toContain('press-banca');
    const leidos = await porClave(['press-banca', 'plancha', 'press-banca', 'no-existe']);
    expect([...leidos.keys()].sort()).toEqual(['plancha', 'press-banca']);
    expect(leidos.get('press-banca')).toMatchObject({ nombre: 'Press banca', mide: ['repeticiones', 'peso'] });
    expect(await porClave([])).toEqual(new Map());
  });
});

/// <reference types="node" />
import { randomBytes } from 'node:crypto';

import { crearGeneradorDeIds, esUuidV7 } from '@/datos/ids';
import { abrirBaseDePrueba } from '@/pruebas/baseDePrueba';
import { T0 } from '@/pruebas/datos';

const azar = (n: number) => new Uint8Array(randomBytes(n));
const msDe = (id: string) => parseInt(id.slice(0, 8) + id.slice(9, 13), 16);

describe('Los identificadores UUID v7', () => {
  it('llevan la forma, la versión y la variante de un UUID v7, en minúsculas', () => {
    const nuevoId = crearGeneradorDeIds(() => T0, azar);
    for (let i = 0; i < 1000; i++) {
      const id = nuevoId();
      expect(esUuidV7(id)).toBe(true);
      expect(id[14]).toBe('7');
      expect('89ab').toContain(id[19]);
    }
  });

  it('llevan delante el milisegundo en que nacen', () => {
    const nuevoId = crearGeneradorDeIds(() => T0, azar);
    expect(msDe(nuevoId())).toBe(T0);
  });

  it('son únicos y salen en orden, también muchos en el mismo milisegundo', () => {
    const nuevoId = crearGeneradorDeIds(() => T0, azar);
    const ids = Array.from({ length: 20_000 }, nuevoId);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
    // El contador de 12 bits se agota y el milisegundo avanza, sin perder el orden.
    expect(msDe(ids[ids.length - 1])).toBeGreaterThan(T0);
  });

  it('siguen en orden aunque el reloj vaya hacia atrás', () => {
    let reloj = T0;
    const nuevoId = crearGeneradorDeIds(() => reloj, azar);
    const antes = nuevoId();
    reloj = T0 - 60_000;
    const despues = nuevoId();
    expect(despues > antes).toBe(true);
  });

  it('esUuidV7 rechaza otras versiones, las mayúsculas y los guiones de más', () => {
    expect(esUuidV7('019a6f00-0000-4000-8000-000000000001')).toBe(false);
    expect(esUuidV7('019A6F00-0000-7000-8000-000000000001')).toBe(false);
    expect(esUuidV7('019a6f00-0000-7000-c000-000000000001')).toBe(false);
    expect(esUuidV7('019a6f00-0000-7000-8000-00000000-001')).toBe(false);
  });

  it('la base acepta los mismos identificadores que esUuidV7', () => {
    const db = abrirBaseDePrueba();
    const nuevoId = crearGeneradorDeIds(() => T0, azar);
    const comprobar = (sql: string, parametros: Record<string, string>) => db.mirar<{ ok: number }>(sql, parametros);
    const forma =
      "SELECT (:id GLOB '????????-????-7???-[89ab]???-????????????' AND :id NOT GLOB '*[^0-9a-f-]*' AND length(replace(:id, '-', '')) = 32) AS ok";
    for (let i = 0; i < 500; i++) {
      expect(comprobar(forma, { ':id': nuevoId() })).toEqual([{ ok: 1 }]);
    }
    for (const malo of ['019a6f00-0000-4000-8000-000000000001', '019a6f00-0000-7000-8000-00000000-001', 'press-banca']) {
      expect(comprobar(forma, { ':id': malo })).toEqual([{ ok: 0 }]);
    }
    db.cerrar();
  });
});

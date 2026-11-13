/// <reference types="node" />
import { randomBytes } from 'node:crypto';

import { p } from '@/datos/base';
import type { Entreno } from '@/datos/entrenos';
import { crearGeneradorDeIds } from '@/datos/ids';
import { prepararBase } from '@/datos/preparar';

import { abrirBaseDePrueba, type BaseDePrueba, type OpcionesDeLaBaseDePrueba } from './baseDePrueba';

// Lo que comparten las pruebas de los datos: un reloj fijo, identificadores de
// verdad, una base preparada y entrenos de ejemplo.

/** El 9 de noviembre de 2026 a las 10:00 en UTC. */
export const T0 = Date.UTC(2026, 10, 9, 10, 0);

/** Identificadores UUID v7 con un reloj que avanza un milisegundo en cada uno. */
export function generadorDeIds(desde = T0): () => string {
  let reloj = desde;
  return crearGeneradorDeIds(
    () => reloj++,
    (n) => new Uint8Array(randomBytes(n)),
  );
}

export async function abrirBasePreparada(opciones?: OpcionesDeLaBaseDePrueba): Promise<BaseDePrueba> {
  const db = abrirBaseDePrueba(opciones);
  await prepararBase(db, { ahora: () => T0 });
  await anadirEjerciciosDePrueba(db);
  return db;
}

/**
 * Ejercicios con claves de catálogo para los entrenos de ejemplo de hyrox,
 * mientras el catálogo de la app no los trae (llegan en el paso 7).
 */
async function anadirEjerciciosDePrueba(db: BaseDePrueba): Promise<void> {
  const ejercicios: [string, string, number, number, number, number, number][] = [
    ['wall-balls', 'Wall balls', 1, 1, 1, 0, 0],
    ['skierg', 'SkiErg', 0, 0, 1, 1, 1],
    ['burpees', 'Burpees', 1, 0, 1, 0, 0],
  ];
  for (const [id, nombre, repeticiones, peso, tiempo, distancia, calorias] of ejercicios) {
    await db.runAsync(
      `INSERT INTO ejercicio (id, nombre, grupo, usa_repeticiones, usa_peso, usa_tiempo, usa_distancia,
                              usa_calorias, propio, modificado)
       VALUES (:id, :nombre, 'prueba', :repeticiones, :peso, :tiempo, :distancia, :calorias, 0, :modificado)`,
      p({ id, nombre, repeticiones, peso, tiempo, distancia, calorias, modificado: T0 }),
    );
  }
}

/**
 * Un hyrox con bloques propios en el que cada columna de entreno, bloque y
 * serie tiene algún valor: 4 vueltas de 1 km y 20 wall balls con 6 kg, sin
 * parar entre las dos estaciones y con 1 minuto entre vueltas; 3 minutos hasta
 * el bloque siguiente; y 3 vueltas de 20 calorías de SkiErg y 15 burpees.
 */
export function hyroxConDescansos(nuevoId: () => string): Entreno {
  const carreras = [262000, 268000, 271000, 259000];
  const wallBalls = [55000, 61000, 66000, 58000];
  return {
    id: nuevoId(),
    disciplina: 'hyrox',
    fecha: '2026-11-12',
    hora: '19:00',
    duracionMs: 2700000,
    esfuerzo: 8,
    notas: 'Bloques propios',
    bloques: [
      {
        id: nuevoId(),
        metrosCorridos: 4000,
        tiempoMs: 1480000,
        descansoMs: 180000,
        series: [1, 2, 3, 4].flatMap((ronda) => [
          {
            id: nuevoId(),
            ronda,
            orden: 1,
            ejercicioId: 'correr',
            repeticiones: null,
            pesoG: null,
            tiempoMs: carreras[ronda - 1],
            distanciaM: 1000,
            calorias: null,
            descansoMs: 0,
          },
          {
            id: nuevoId(),
            ronda,
            orden: 2,
            ejercicioId: 'wall-balls',
            repeticiones: 20,
            pesoG: 6000,
            tiempoMs: wallBalls[ronda - 1],
            distanciaM: null,
            calorias: null,
            descansoMs: ronda < 4 ? 60000 : null,
          },
        ]),
      },
      {
        id: nuevoId(),
        metrosCorridos: null,
        tiempoMs: null,
        descansoMs: null,
        series: [1, 2, 3].flatMap((ronda) => [
          {
            id: nuevoId(),
            ronda,
            orden: 1,
            ejercicioId: 'skierg',
            repeticiones: null,
            pesoG: null,
            tiempoMs: 80000 + ronda * 2000,
            distanciaM: null,
            calorias: 20,
            descansoMs: 30000,
          },
          {
            id: nuevoId(),
            ronda,
            orden: 2,
            ejercicioId: 'burpees',
            repeticiones: 15,
            pesoG: null,
            tiempoMs: 48000 + ronda * 3000,
            distanciaM: null,
            calorias: null,
            descansoMs: ronda < 3 ? 90000 : null,
          },
        ]),
      },
    ],
  };
}

/** Un día de gimnasio con 2 km de cinta para calentar y press banca con 62,5 kg. */
export function gimnasioConCalentamiento(nuevoId: () => string, fecha = '2026-11-15'): Entreno {
  return {
    id: nuevoId(),
    disciplina: 'gimnasio',
    fecha,
    hora: null,
    duracionMs: 3150000,
    esfuerzo: 7,
    notas: null,
    bloques: [
      { id: nuevoId(), metrosCorridos: 2000, tiempoMs: 720000, descansoMs: 120000, series: [] },
      {
        id: nuevoId(),
        metrosCorridos: null,
        tiempoMs: null,
        descansoMs: null,
        series: [1, 2, 3].map((ronda) => ({
          id: nuevoId(),
          ronda,
          orden: 1,
          ejercicioId: 'press-banca',
          repeticiones: 8,
          pesoG: 62500,
          tiempoMs: null,
          distanciaM: null,
          calorias: null,
          descansoMs: ronda < 3 ? 150000 : null,
        })),
      },
    ],
  };
}

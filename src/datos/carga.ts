import { p, type Lectura } from './base';
import type { Disciplina } from './entrenos';
import { sumarDias } from './fechas';

/** Las semanas que enseña la gráfica de Inicio, esta incluida. */
export const SEMANAS_DE_LA_GRAFICA = 8;

/** Lo que suma una semana, de lunes a domingo. */
export type Semana = {
  lunes: string;
  /** Los minutos de cada entreno por su esfuerzo, sumados. */
  carga: number;
  minutos: number;
  entrenos: number;
  /** Los minutos de cada disciplina con algún entreno, de más a menos. */
  porDisciplina: { disciplina: Disciplina; minutos: number }[];
};

export type CargaDeInicio = {
  estaSemana: Semana;
  laPasada: Semana;
  /** La carga de las últimas semanas, de la más antigua a esta, también las que no tienen entrenos. */
  ultimasSemanas: { lunes: string; carga: number }[];
  /** Si hay algún entreno guardado, de cualquier semana. */
  hayEntrenos: boolean;
};

type Fila = { lunes: string; disciplina: Disciplina; carga: number; minutos: number; entrenos: number };

const vacia = (lunes: string): Semana => ({ lunes, carga: 0, minutos: 0, entrenos: 0, porDisciplina: [] });

/**
 * La carga de la semana del lunes dado y la de la anterior, aunque no tengan
 * entrenos, y la de las semanas de la gráfica. Lee de la vista entreno_hecho,
 * como todas las sumas: los minutos de cada entreno van redondeados y los
 * borrados no cuentan.
 */
export async function leerCargaDeInicio(l: Lectura, lunes: string): Promise<CargaDeInicio> {
  const pasada = sumarDias(lunes, -7);
  const primera = sumarDias(lunes, -7 * (SEMANAS_DE_LA_GRAFICA - 1));
  const filas = await l.getAllAsync<Fila>(
    `SELECT lunes, disciplina, SUM(carga) AS carga, SUM(minutos) AS minutos, COUNT(*) AS entrenos
       FROM entreno_hecho
      WHERE fecha BETWEEN :desde AND :hasta
      GROUP BY lunes, disciplina`,
    p({ desde: primera, hasta: sumarDias(lunes, 6) }),
  );
  const hay = await l.getFirstAsync<{ hay: number }>('SELECT EXISTS (SELECT 1 FROM entreno_hecho) AS hay', {});
  const semana = (deLunes: string): Semana => {
    const suyas = filas.filter((fila) => fila.lunes === deLunes);
    if (suyas.length === 0) return vacia(deLunes);
    return {
      lunes: deLunes,
      carga: suyas.reduce((suma, fila) => suma + fila.carga, 0),
      minutos: suyas.reduce((suma, fila) => suma + fila.minutos, 0),
      entrenos: suyas.reduce((suma, fila) => suma + fila.entrenos, 0),
      porDisciplina: suyas
        .map(({ disciplina, minutos }) => ({ disciplina, minutos }))
        .sort((a, b) => b.minutos - a.minutos || a.disciplina.localeCompare(b.disciplina)),
    };
  };
  const ultimasSemanas = Array.from({ length: SEMANAS_DE_LA_GRAFICA }, (_, i) => {
    const deLunes = sumarDias(primera, 7 * i);
    return { lunes: deLunes, carga: semana(deLunes).carga };
  });
  return { estaSemana: semana(lunes), laPasada: semana(pasada), ultimasSemanas, hayEntrenos: hay?.hay === 1 };
}

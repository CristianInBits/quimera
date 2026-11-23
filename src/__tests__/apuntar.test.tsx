import { renderRouter, screen } from 'expo-router/testing-library';
import { act, within } from '@testing-library/react-native';
import { StyleSheet, useColorScheme } from 'react-native';

import Historial from '@/app/(pestanas)/historial';
import Pestanas from '@/app/(pestanas)/_layout';
import Inicio from '@/app/(pestanas)/index';
import Raiz from '@/app/_layout';
import Apuntar from '@/app/apuntar';
import { p } from '@/datos/base';
import { fechaLocal } from '@/datos/fechas';
import { CLAVE_DEL_BORRADOR } from '@/gimnasio/editor';
import type { BaseDePrueba } from '@/pruebas/baseDePrueba';
import { abrirBasePreparada } from '@/pruebas/datos';
import { PALETAS, sombraDeTarjetaQueSeAbre } from '@/tema/colores';

// La pantalla de elegir disciplina, de verdad, sobre la base de prueba.
let mockBase: BaseDePrueba;
jest.mock('expo-sqlite', () => ({
  SQLiteProvider: ({ children }: { children: unknown }) => children,
  useSQLiteContext: () => mockBase,
}));

// La escala de la letra del sistema: 1 con la letra normal.
let mockEscala = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: mockEscala }),
}));

const RUTAS = {
  _layout: Raiz,
  '(pestanas)/_layout': Pestanas,
  '(pestanas)/index': Inicio,
  '(pestanas)/historial': Historial,
  'apuntar/index': Apuntar,
};

const ocultos = { includeHiddenElements: true } as const;
const estilo = (nombre: string | RegExp) => StyleSheet.flatten(screen.getByRole('button', { name: nombre }).props.style);
const DEMAS = [
  ['Hyrox', 'hyrox'],
  ['Calistenia', 'calistenia'],
  ['Carrera', 'carrera'],
  ['Natación', 'natacion'],
] as const;

/** Deja un entreno nuevo a medias en el móvil, como si se hubiera empezado a apuntar. */
async function entrenoNuevoAMedias() {
  const borrador = {
    formato: 2,
    id: '019a6e8c-0000-7000-8000-0000000000aa',
    selloLeido: null,
    fecha: fechaLocal(new Date()),
    hora: '10:00',
    bloques: [],
    minutos: '',
    duracionLeida: null,
    huellaLeida: null,
    esfuerzo: 6,
    notas: 'A medias',
  };
  await mockBase.runAsync(
    'INSERT INTO ajuste (clave, valor, modificado) VALUES (:clave, :valor, :modificado)',
    p({ clave: CLAVE_DEL_BORRADOR, valor: JSON.stringify(borrador), modificado: Date.now() }),
  );
}

describe('Apuntar', () => {
  beforeEach(async () => {
    mockBase?.cerrar();
    mockBase = await abrirBasePreparada();
  });
  afterEach(() => {
    jest.useRealTimers();
    mockEscala = 1;
  });
  afterAll(() => mockBase.cerrar());

  it('el gimnasio va en una tarjeta ancha teñida, con el borde de su color, su halo, su rinoceronte y la flecha', async () => {
    await renderRouter(RUTAS, { initialUrl: '/apuntar' });
    const gimnasio = await screen.findByRole('button', { name: 'Gimnasio' });
    expect(estilo('Gimnasio')).toMatchObject({
      flexDirection: 'row',
      backgroundColor: PALETAS.claro.disciplina.gimnasio.tinte,
      borderColor: PALETAS.claro.disciplina.gimnasio.marca,
      borderWidth: 2,
      boxShadow: sombraDeTarjetaQueSeAbre(PALETAS.claro),
    });
    expect(within(gimnasio).getByTestId('punto')).toHaveStyle({ backgroundColor: PALETAS.claro.disciplina.gimnasio.marca });
    expect(within(gimnasio).getByTestId('mascota', ocultos).props.source.testUri).toMatch(/rinoceronte\.png$/);
    expect(within(gimnasio).getByTestId('icono-siguiente', ocultos).props.tintColor).toBe(PALETAS.claro.primario);
  });

  it('sin borrador, el gimnasio no dice que haya uno a medias, aunque pase el tiempo', async () => {
    await renderRouter(RUTAS, { initialUrl: '/apuntar' });
    await screen.findByRole('button', { name: 'Gimnasio' });
    await act(() => jest.advanceTimersByTimeAsync(2000));
    expect(screen.getByRole('button', { name: 'Gimnasio' })).toBeOnTheScreen();
    expect(screen.queryByText('Tienes uno a medias: sigue donde lo dejaste')).toBeNull();
  });

  it('con un entreno a medias, el gimnasio lo dice, también al lector de pantalla', async () => {
    await entrenoNuevoAMedias();
    await renderRouter(RUTAS, { initialUrl: '/apuntar' });
    const gimnasio = await screen.findByRole('button', { name: 'Gimnasio, tienes uno a medias' });
    expect(within(gimnasio).getByText('Tienes uno a medias: sigue donde lo dejaste')).toBeOnTheScreen();
  });

  it('las demás van de dos en dos, teñidas, con su punto de color, su nombre que se lee, su «Pronto» y sin poder abrirse', async () => {
    await renderRouter(RUTAS, { initialUrl: '/apuntar' });
    await screen.findByRole('button', { name: 'Gimnasio' });
    expect(screen.getByTestId('rejilla')).toHaveStyle({ flexDirection: 'row', flexWrap: 'wrap' });
    for (const [nombre, disciplina] of DEMAS) {
      const boton = screen.getByRole('button', { name: `${nombre}, pronto` });
      expect(boton).toBeDisabled();
      expect(estilo(`${nombre}, pronto`)).toMatchObject({
        backgroundColor: PALETAS.claro.disciplina[disciplina].tinte,
        flexBasis: '45%',
      });
      expect(within(boton).getByTestId('punto')).toHaveStyle({ backgroundColor: PALETAS.claro.disciplina[disciplina].marca });
      expect(within(boton).getByText(nombre)).toHaveStyle({ color: PALETAS.claro.texto });
      expect(within(boton).getByText('Pronto')).toHaveStyle({
        backgroundColor: PALETAS.claro.pastilla,
        color: PALETAS.claro.textoTenue,
      });
    }
  });

  it('con la letra al 130 % de Android, el gimnasio se apila y cada disciplina que viene ocupa todo el ancho', async () => {
    mockEscala = Math.fround(1.3);
    await renderRouter(RUTAS, { initialUrl: '/apuntar' });
    await screen.findByRole('button', { name: 'Gimnasio' });
    expect(estilo('Gimnasio')).toMatchObject({ flexDirection: 'column' });
    expect(estilo('Hyrox, pronto')).toMatchObject({ flexBasis: '100%' });
  });

  it('en oscuro, cada tarjeta lleva su tinte y su borde oscuros, el gimnasio con su punto y su flecha y sin halo, y «Pronto» sobre el fondo oscuro', async () => {
    jest.mocked(useColorScheme).mockReturnValue('dark');
    try {
      await renderRouter(RUTAS, { initialUrl: '/apuntar' });
      const gimnasio = await screen.findByRole('button', { name: 'Gimnasio' });
      expect(estilo('Gimnasio')).toMatchObject({
        backgroundColor: PALETAS.oscuro.disciplina.gimnasio.tinte,
        borderColor: PALETAS.oscuro.disciplina.gimnasio.marca,
      });
      expect(estilo('Gimnasio').boxShadow).toBeUndefined();
      expect(within(gimnasio).getByTestId('icono-siguiente', ocultos).props.tintColor).toBe(PALETAS.oscuro.primario);
      expect(within(gimnasio).getByTestId('punto')).toHaveStyle({ backgroundColor: PALETAS.oscuro.disciplina.gimnasio.marca });
      for (const [nombre, disciplina] of DEMAS) {
        const boton = screen.getByRole('button', { name: `${nombre}, pronto` });
        expect(estilo(`${nombre}, pronto`)).toMatchObject({
          backgroundColor: PALETAS.oscuro.disciplina[disciplina].tinte,
          borderColor: PALETAS.oscuro.disciplina[disciplina].borde,
          borderWidth: 1,
        });
        expect(within(boton).getByTestId('punto')).toHaveStyle({ backgroundColor: PALETAS.oscuro.disciplina[disciplina].marca });
        expect(within(boton).getByText('Pronto')).toHaveStyle({
          backgroundColor: PALETAS.oscuro.pastilla,
          color: PALETAS.oscuro.textoTenue,
        });
      }
    } finally {
      jest.mocked(useColorScheme).mockReturnValue('light');
    }
  });
});

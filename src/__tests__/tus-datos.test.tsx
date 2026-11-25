/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, fireEvent, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo, ScrollView, StyleSheet, View } from 'react-native';

import Historial from '@/app/(pestanas)/historial';
import Pestanas from '@/app/(pestanas)/_layout';
import Inicio from '@/app/(pestanas)/index';
import * as Raiz from '@/app/_layout';
import TusDatos from '@/app/tus-datos';
import { compartir, elegirArchivo, prepararArchivo } from '@/copias/archivos';
import { puertaDe } from '@/datos/base';
import * as copias from '@/datos/copia';
import {
  apuntarUltimaCopiaEn,
  crearCopiaEn,
  DatoQueNoCabe,
  importarCopiaEn,
  leerCopia,
  textoDeLaCopia,
  type Copia,
} from '@/datos/copia';
import { borrarEntrenoEn, guardarEntrenoEn, restaurarEntrenoEn, type Entreno } from '@/datos/entrenos';
import { deFecha, fechaLocal, sumarDias } from '@/datos/fechas';
import { MIGRACIONES } from '@/datos/migraciones';
import { SELLO_MINIMO } from '@/datos/sellos';
import type { BaseDePrueba } from '@/pruebas/baseDePrueba';
import { abrirBasePreparada, generadorDeIds, gimnasioConCalentamiento, hyroxConDescansos } from '@/pruebas/datos';
import { PALETAS, sombraDelBotonPrincipal } from '@/tema/colores';

// «Tus datos» de verdad sobre la base de prueba, como en historial.test.tsx.
// Los archivos y la hoja de compartir del sistema van simulados: sus pruebas
// están en src/copias.
let mockBase: BaseDePrueba;
jest.mock('expo-sqlite', () => ({
  SQLiteProvider: ({ children }: { children: unknown }) => children,
  useSQLiteContext: () => mockBase,
}));
// La versión de la app sale de app.json, que Jest no tiene: aquí es la 1.0.0.
jest.mock('@/datos/movil', () => {
  const { generadorDeIds } = jest.requireActual('@/pruebas/datos');
  return { nuevoId: generadorDeIds(), prepararBaseDelMovil: async () => undefined, VERSION_DE_LA_APP: '1.0.0' };
});
jest.mock('@/copias/archivos', () => ({
  ...jest.requireActual('@/copias/archivos'),
  prepararArchivo: jest.fn(),
  compartir: jest.fn(),
  elegirArchivo: jest.fn(),
}));
// Lo que tapa abajo el sistema: nada, como da expo-router en las pruebas, salvo donde una prueba diga otra cosa.
let mockAbajo = 0;
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: mockAbajo }),
}));

const RUTAS = {
  // Con su ancla: las pestañas van siempre debajo.
  _layout: Raiz,
  '(pestanas)/_layout': Pestanas,
  '(pestanas)/index': Inicio,
  '(pestanas)/historial': Historial,
  'tus-datos': TusDatos,
};

const INTRO =
  'Quimera guarda tus entrenos en este móvil y no los sube a ningún sitio: si lo pierdes o borras Quimera, puedes ' +
  'perderlos. Una copia guardada fuera te deja recuperarlos, también en un móvil nuevo.';
const EXPLICACION_DE_COPIAR =
  'Quimera prepara un archivo con todo lo que hay en este móvil, y tú eliges dónde guardarlo: mejor fuera del móvil y ' +
  'solo para ti, en Drive o en tu correo, por ejemplo.';
const EXPLICACION_DE_IMPORTAR =
  'Para recuperar tus entrenos en un móvil nuevo, o juntar los de otro móvil tuyo: busca el archivo «quimera-» con su ' +
  'fecha. Lo que tengas y no esté en la copia se queda, y antes de tocar nada verás qué cambia.';
const NO_PUEDE_SABER = 'Quimera no puede saber si la guardaste o cerraste la hoja sin guardarla.';
const NINGUNA_COPIA = 'Todavía no has hecho ninguna copia en este móvil.';
const SIN_CAMBIOS = 'Esta copia no cambia nada de lo que ves: ya tienes todo lo que trae, y lo que has borrado sigue borrado.';
const SIN_CAMBIOS_DE_OTRA = 'Esta copia no trae ningún entreno que no tengas.';
const RECORDARA = 'Si la importas, Quimera recordará ese móvil como tuyo y no volverá a preguntar por sus copias.';
const AVISO_DE_OTRA = 'Es de otra persona: sus entrenos se mezclarán con los tuyos.';
const NO_ES_COPIA = 'Este archivo no es una copia de Quimera, o está dañado. Prueba con otro.';
/** Lo que «Importar» y «Hacer una copia» no responden después de aparecer, en milisegundos. */
const ESPERA_TRAS_CAMBIAR = 500;

/** Una copia de verdad de otro móvil, la primera copia fijada del formato: exportado 0 y seis entrenos, uno borrado. */
const COPIA_V1 = readFileSync(join(__dirname, '..', 'datos', '__tests__', 'copia-v1.json'), 'utf8');

const espias: jest.SpyInstance[] = [];
/**
 * Espía algo y lo quita después de la prueba. Empieza sin llamadas: jest.spyOn
 * sobre algo que ya es un jest.fn, como lo de AccessibilityInfo o lo de los
 * simulacros de View y ScrollView, devuelve ese mismo jest.fn, con lo que le
 * hayan llamado las pruebas de antes.
 */
const espiar = <T extends jest.SpyInstance>(espia: T): T => {
  espia.mockClear();
  espias.push(espia);
  return espia;
};
const dejarPasar = (ms = 2000) => act(() => jest.advanceTimersByTimeAsync(ms));
const ids = generadorDeIds();
const hoy = () => fechaLocal(new Date());

/** Guarda un entreno en una base, como el editor. */
const guardar = (db: BaseDePrueba, entreno: Entreno, ahora = Date.now()) =>
  puertaDe(db).escribir((tx) => guardarEntrenoEn(tx, entreno, { ahora }));
/** La copia de una base, como la hace Quimera. */
const copiaDe = (db: BaseDePrueba, ahora = Date.now()) =>
  puertaDe(db).escribir((tx) => crearCopiaEn(tx, { ahora, app: '1.0.0', nuevoId: ids }));
/** Otro móvil, con estos entrenos, y su copia. */
async function copiaDeOtroMovil(...entrenos: Entreno[]): Promise<Copia> {
  const otro = await abrirBasePreparada();
  try {
    for (const entreno of entrenos) await guardar(otro, entreno);
    return await copiaDe(otro);
  } finally {
    otro.cerrar();
  }
}
/** El selector de archivos da un archivo con este texto. */
const elegir = (texto: string, tamano = Buffer.byteLength(texto)) =>
  jest.mocked(elegirArchivo).mockResolvedValueOnce({ tamano, leer: () => Promise.resolve(texto) });

const boton = (nombre: string) => screen.getByRole('button', { name: nombre });
/** Pulsa «Importar» cuando ya responde, pasado el tiempo que espera después de aparecer. */
async function pulsarImportar() {
  await dejarPasar(ESPERA_TRAS_CAMBIAR);
  await fireEvent.press(boton('Importar'));
}

/**
 * Lo que distingue la clase de un botón: el fondo, el borde, el alto, la sombra
 * del principal y el color de su texto, que es lo único que distingue sutil de
 * enlace y de error.
 */
const claseDe = (nombre: string) => {
  const { backgroundColor, borderColor, minHeight, boxShadow } = StyleSheet.flatten(boton(nombre).props.style);
  const texto = within(boton(nombre)).getByText(/./);
  return { backgroundColor, borderColor, minHeight, boxShadow, color: StyleSheet.flatten(texto.props.style).color };
};
const { primario, bordeControl, sobrePrimario, texto: tinta, textoTenue } = PALETAS.claro;
const CLASES = {
  principal: {
    backgroundColor: primario,
    borderColor: primario,
    minHeight: 56,
    boxShadow: sombraDelBotonPrincipal(PALETAS.claro),
    color: sobrePrimario,
  },
  relleno: { backgroundColor: primario, borderColor: primario, minHeight: 52, boxShadow: undefined, color: sobrePrimario },
  secundario: { backgroundColor: 'transparent', borderColor: bordeControl, minHeight: 52, boxShadow: undefined, color: tinta },
  sutil: { backgroundColor: 'transparent', borderColor: 'transparent', minHeight: 48, boxShadow: undefined, color: textoTenue },
};

/** A qué botón ha llevado la pantalla, la última vez, el foco del lector de pantalla. */
function enfocado(espia: jest.SpyInstance): unknown {
  const ultima = espia.mock.calls.findLast(([, suceso]) => suceso === 'focus');
  return (ultima?.[0] as { props?: { accessibilityLabel?: string } } | undefined)?.props?.accessibilityLabel;
}

/** Abre «Tus datos» y espera a que lea la base. */
async function abrir() {
  await renderRouter(RUTAS, { initialUrl: '/tus-datos' });
  await screen.findByRole('header', { name: 'Hacer una copia' });
}

/** Lo que la pantalla de arriba de la pila le pasa a la cabecera nativa. */
function propsDeLaCabecera(): Record<string, unknown> {
  const todas: Record<string, unknown>[] = [];
  const recorrer = (nodo: ReturnType<typeof screen.getByText>) => {
    if (nodo.type === 'RNSScreenStackHeaderConfig') todas.push(nodo.props);
    for (const hijo of nodo.children) if (typeof hijo !== 'string') recorrer(hijo);
  };
  if (screen.root !== null) recorrer(screen.root);
  return todas.at(-1) ?? {};
}

describe('Tus datos', () => {
  beforeEach(async () => {
    mockBase?.cerrar();
    mockBase = await abrirBasePreparada();
    mockAbajo = 0;
    jest.mocked(prepararArchivo).mockReset().mockImplementation(async (nombre) => `file:///cache/copias/${nombre}`);
    jest.mocked(compartir).mockReset().mockResolvedValue(undefined);
    jest.mocked(elegirArchivo).mockReset().mockResolvedValue(null);
  });
  afterEach(() => {
    jest.useRealTimers();
    espias.forEach((espia) => espia.mockRestore());
    espias.length = 0;
  });
  afterAll(() => mockBase.cerrar());

  it('se abre desde Inicio, encima de las pestañas, con su cabecera', async () => {
    await guardar(mockBase, gimnasioConCalentamiento(ids, hoy()));
    await renderRouter(RUTAS, { initialUrl: '/' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Tus datos' }));
    expect(await screen.findByText(INTRO)).toBeOnTheScreen();
    expect(screen).toHavePathname('/tus-datos');
    expect(propsDeLaCabecera()).toMatchObject({ hidden: false, title: 'Tus datos' });
  });

  it('el final deja sitio a la barra de navegación de Android', async () => {
    mockAbajo = 34;
    await abrir();
    expect(StyleSheet.flatten(screen.getByTestId('tus-datos').props.contentContainerStyle).paddingBottom).toBe(34 + 32);
  });

  it('si no se puede leer lo que hay en el móvil, lo dice, sin las tarjetas', async () => {
    espiar(jest.spyOn(copias, 'leerEstadoDeLasCopias')).mockRejectedValueOnce(new Error('disco roto'));
    await renderRouter(RUTAS, { initialUrl: '/tus-datos' });
    expect(await screen.findByText('No se pudo leer lo que hay en este móvil. (Error: disco roto)')).toHaveStyle({
      color: PALETAS.claro.error,
    });
    expect(screen.getByText(INTRO)).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Hacer una copia' })).toBeNull();
    expect(screen.queryByRole('header', { name: 'Importar una copia' })).toBeNull();
  });

  describe('hacer una copia', () => {
    it('sin entrenos no hay nada que copiar, e importar pasa a ser lo principal', async () => {
      await abrir();
      expect(screen.getByText(INTRO)).toBeOnTheScreen();
      expect(screen.getByText('Todavía no tienes entrenos que copiar.')).toBeOnTheScreen();
      expect(screen.queryByText(EXPLICACION_DE_COPIAR)).toBeNull();
      expect(screen.queryByRole('button', { name: 'Hacer una copia' })).toBeNull();
      expect(screen.queryByText(/Última copia|ninguna copia/)).toBeNull();
      expect(claseDe('Importar una copia')).toEqual(CLASES.principal);
    });

    it('un entreno borrado no es nada que copiar', async () => {
      const gimnasio = gimnasioConCalentamiento(ids, hoy());
      await guardar(mockBase, gimnasio);
      await puertaDe(mockBase).escribir((tx) => borrarEntrenoEn(tx, gimnasio.id, Date.now()));
      await abrir();
      expect(screen.getByText('Todavía no tienes entrenos que copiar.')).toBeOnTheScreen();
    });

    it('con entrenos y sin ninguna copia, lo dice, y hacer una copia es lo principal', async () => {
      await guardar(mockBase, gimnasioConCalentamiento(ids, hoy()));
      await abrir();
      expect(screen.getByText(EXPLICACION_DE_COPIAR)).toBeOnTheScreen();
      expect(screen.getByText(NINGUNA_COPIA)).toBeOnTheScreen();
      expect(claseDe('Hacer una copia')).toEqual(CLASES.principal);
      expect(claseDe('Importar una copia')).toEqual(CLASES.secundario);
    });

    it.each([
      [0, 'hoy.'],
      [1, 'ayer.'],
      [12, 'hace 12 días.'],
    ])('dice cuándo se guardó la última copia, hace %i días: «%s»', async (dias, cuando) => {
      await guardar(mockBase, gimnasioConCalentamiento(ids, hoy()));
      // A mediodía, para que el cambio de hora no la cambie de día.
      const hecha = deFecha(sumarDias(hoy(), -dias)).getTime() + 12 * 3_600_000;
      await puertaDe(mockBase).escribir((tx) => apuntarUltimaCopiaEn(tx, hecha, Date.now()));
      await abrir();
      expect(screen.getByText(`Última copia: ${cuando}`)).toBeOnTheScreen();
    });

    it('prepara el archivo con todo, abre la hoja de compartir y, al cerrarse, pregunta si se guardó; solo el sí la apunta', async () => {
      const gimnasio = gimnasioConCalentamiento(ids, hoy());
      await guardar(mockBase, gimnasio);
      let cerrarLaHoja: () => void = () => {};
      jest.mocked(compartir).mockImplementationOnce(
        () =>
          new Promise<void>((cerrar) => {
            cerrarLaHoja = cerrar;
          }),
      );
      const anuncio = espiar(jest.spyOn(AccessibilityInfo, 'announceForAccessibility'));
      await abrir();
      await fireEvent.press(boton('Hacer una copia'));
      await waitFor(() => expect(compartir).toHaveBeenCalledTimes(1));

      // El archivo: con la fecha y la hora en el nombre, y la copia entera dentro.
      expect(prepararArchivo).toHaveBeenCalledTimes(1);
      const [nombre, texto] = jest.mocked(prepararArchivo).mock.calls[0];
      expect(nombre).toMatch(new RegExp(`^quimera-${hoy()}-\\d{4}\\.json$`));
      const copia = leerCopia(texto);
      expect(copia.entrenos.map((e) => e.id)).toEqual([gimnasio.id]);
      expect(copia.app).toBe('1.0.0');
      expect(compartir).toHaveBeenCalledWith(`file:///cache/copias/${nombre}`);

      // Mientras la hoja está abierta, no se puede empezar otra copia ni importar.
      expect(boton('Preparando la copia')).toBeDisabled();
      expect(boton('Importar una copia')).toBeDisabled();
      expect(anuncio).toHaveBeenCalledWith('Preparando la copia');
      expect(screen.queryByText('¿Has guardado la copia?')).toBeNull();

      await act(async () => cerrarLaHoja());
      expect(await screen.findByText('¿Has guardado la copia?')).toBeOnTheScreen();
      expect(screen.getByText(NO_PUEDE_SABER)).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: '¿Has guardado la copia?' })).toBeOnTheScreen();
      expect(screen.queryByText(EXPLICACION_DE_COPIAR)).toBeNull();
      expect(screen.queryByRole('button', { name: 'Hacer una copia' })).toBeNull();
      // Sin ninguna copia apuntada, no dice que no hay ninguna justo encima de la que se acaba de hacer.
      expect(screen.queryByText(NINGUNA_COPIA)).toBeNull();
      expect(claseDe('Sí, la he guardado')).toEqual(CLASES.relleno);
      expect(claseDe('No la he guardado')).toEqual(CLASES.sutil);
      expect(boton('Importar una copia')).toBeEnabled();
      expect(anuncio).toHaveBeenLastCalledWith(`¿Has guardado la copia? ${NO_PUEDE_SABER}`);

      await fireEvent.press(boton('Sí, la he guardado'));
      expect(await screen.findByText('Última copia: hoy.')).toBeOnTheScreen();
      expect(screen.queryByText('¿Has guardado la copia?')).toBeNull();
      expect(boton('Hacer una copia')).toBeEnabled();
      expect(anuncio).toHaveBeenLastCalledWith('Última copia: hoy.');
      // Apunta la hora de la copia.
      expect(mockBase.mirar("SELECT valor FROM ajuste WHERE clave = 'local.ultima_copia'")).toEqual([
        { valor: String(copia.exportado) },
      ]);
    });

    it('mientras pregunta, la última copia que ya estaba apuntada sigue a la vista', async () => {
      await guardar(mockBase, gimnasioConCalentamiento(ids, hoy()));
      const hecha = deFecha(sumarDias(hoy(), -12)).getTime() + 12 * 3_600_000;
      await puertaDe(mockBase).escribir((tx) => apuntarUltimaCopiaEn(tx, hecha, Date.now()));
      await abrir();
      await fireEvent.press(boton('Hacer una copia'));
      expect(await screen.findByText('¿Has guardado la copia?')).toBeOnTheScreen();
      expect(screen.getByText('Última copia: hace 12 días.')).toBeOnTheScreen();
    });

    it('mientras guarda que se guardó, no deja contestar otra vez', async () => {
      await guardar(mockBase, gimnasioConCalentamiento(ids, hoy()));
      let apuntada: () => void = () => {};
      const apuntar = espiar(jest.spyOn(copias, 'apuntarUltimaCopiaEn')).mockImplementationOnce(
        () =>
          new Promise<void>((terminar) => {
            apuntada = terminar;
          }),
      );
      await abrir();
      await fireEvent.press(boton('Hacer una copia'));
      await fireEvent.press(await screen.findByRole('button', { name: 'Sí, la he guardado' }));
      await waitFor(() => expect(apuntar).toHaveBeenCalledTimes(1));
      expect(boton('Sí, la he guardado')).toBeDisabled();
      expect(boton('No la he guardado')).toBeDisabled();
      await act(async () => apuntada());
      expect(await screen.findByRole('button', { name: 'Hacer una copia' })).toBeEnabled();
    });

    it('con «No» vuelve como estaba, sin apuntar nada, y el foco pasa a «Hacer una copia»', async () => {
      await guardar(mockBase, gimnasioConCalentamiento(ids, hoy()));
      const foco = espiar(jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent'));
      await abrir();
      await fireEvent.press(boton('Hacer una copia'));
      await fireEvent.press(await screen.findByRole('button', { name: 'No la he guardado' }));
      expect(await screen.findByText(EXPLICACION_DE_COPIAR)).toBeOnTheScreen();
      // En el móvil, el botón se monta después del toque: el foco se pide cuando ya está.
      expect(enfocado(foco)).toBeUndefined();
      await dejarPasar(100);
      expect(enfocado(foco)).toBe('Hacer una copia');
      await dejarPasar();
      expect(screen.getByText(NINGUNA_COPIA)).toBeOnTheScreen();
      expect(mockBase.mirar("SELECT valor FROM ajuste WHERE clave = 'local.ultima_copia'")).toEqual([]);
    });

    it('si no se puede compartir, lo dice y deja probar otra vez', async () => {
      await guardar(mockBase, gimnasioConCalentamiento(ids, hoy()));
      jest.mocked(compartir).mockRejectedValueOnce(new Error('sin apps'));
      const anuncio = espiar(jest.spyOn(AccessibilityInfo, 'announceForAccessibility'));
      await abrir();
      await fireEvent.press(boton('Hacer una copia'));
      const fallo = 'No se pudo hacer la copia. Prueba otra vez. (Error: sin apps)';
      expect(await screen.findByText(fallo)).toHaveStyle({ color: PALETAS.claro.error });
      expect(anuncio).toHaveBeenLastCalledWith(fallo);
      expect(screen.queryByText('¿Has guardado la copia?')).toBeNull();
      // Como después de cualquier cambio de la tarjeta, el botón espera medio segundo: un segundo
      // toque justo después del fallo no vuelve a probar. findByText ya ha dejado pasar como
      // mucho 50 ms desde el fallo.
      await fireEvent.press(boton('Hacer una copia'));
      await dejarPasar(10);
      expect(compartir).toHaveBeenCalledTimes(1);
      await dejarPasar(ESPERA_TRAS_CAMBIAR);
      await fireEvent.press(boton('Hacer una copia'));
      expect(await screen.findByText('¿Has guardado la copia?')).toBeOnTheScreen();
      expect(screen.queryByText(fallo)).toBeNull();
    });

    it('si algo guardado no cabe en la copia, lo dice con dónde, sin abrir la hoja', async () => {
      await guardar(mockBase, gimnasioConCalentamiento(ids, hoy()));
      espiar(jest.spyOn(copias, 'crearCopiaEn')).mockRejectedValueOnce(new DatoQueNoCabe('entrenos[0].notas no es válido'));
      await abrir();
      await fireEvent.press(boton('Hacer una copia'));
      expect(
        await screen.findByText('No se pudo hacer la copia: algo guardado no cabe en ella. (entrenos[0].notas no es válido)'),
      ).toBeOnTheScreen();
      expect(prepararArchivo).not.toHaveBeenCalled();
      expect(compartir).not.toHaveBeenCalled();
    });

    it('si no se puede apuntar que se guardó, lo dice y deja contestar otra vez', async () => {
      await guardar(mockBase, gimnasioConCalentamiento(ids, hoy()));
      espiar(jest.spyOn(copias, 'apuntarUltimaCopiaEn')).mockRejectedValueOnce(new Error('disco lleno'));
      await abrir();
      await fireEvent.press(boton('Hacer una copia'));
      await fireEvent.press(await screen.findByRole('button', { name: 'Sí, la he guardado' }));
      expect(await screen.findByText('No se pudo apuntar que la has guardado. Prueba otra vez. (Error: disco lleno)')).toBeOnTheScreen();
      expect(boton('Sí, la he guardado')).toBeEnabled();
      expect(boton('No la he guardado')).toBeEnabled();
      await fireEvent.press(boton('Sí, la he guardado'));
      expect(await screen.findByText('Última copia: hoy.')).toBeOnTheScreen();
    });

    it.each([
      ['Sí, la he guardado', 'Última copia: hoy.'],
      ['No la he guardado', NINGUNA_COPIA],
    ])('un doble toque en «%s» no vuelve a abrir la hoja: «Hacer una copia» espera medio segundo desde que vuelve', async (respuesta, despues) => {
      await guardar(mockBase, gimnasioConCalentamiento(ids, hoy()));
      await abrir();
      await fireEvent.press(boton('Hacer una copia'));
      await screen.findByRole('button', { name: respuesta });
      // Se piensa la respuesta: la espera no cuenta desde la pregunta.
      await dejarPasar(5000);
      await fireEvent.press(boton(respuesta));
      // El segundo toque cae en «Hacer una copia», que vuelve donde estaba la respuesta. findByRole
      // deja pasar como mucho 50 ms desde que vuelve.
      await fireEvent.press(await screen.findByRole('button', { name: 'Hacer una copia' }));
      expect(screen.getByText(despues)).toBeOnTheScreen();
      await dejarPasar(ESPERA_TRAS_CAMBIAR - 60);
      await fireEvent.press(boton('Hacer una copia'));
      await dejarPasar(10);
      expect(compartir).toHaveBeenCalledTimes(1);
      // Pasado el medio segundo, sí.
      await dejarPasar(50);
      await fireEvent.press(boton('Hacer una copia'));
      await waitFor(() => expect(compartir).toHaveBeenCalledTimes(2));
    });

    it('mientras prepara la copia, no se puede salir de la pantalla; al acabar, sí', async () => {
      await guardar(mockBase, gimnasioConCalentamiento(ids, hoy()));
      let cerrarLaHoja: () => void = () => {};
      jest.mocked(compartir).mockImplementationOnce(
        () =>
          new Promise<void>((cerrar) => {
            cerrarLaHoja = cerrar;
          }),
      );
      await abrir();
      await fireEvent.press(boton('Hacer una copia'));
      await waitFor(() => expect(compartir).toHaveBeenCalledTimes(1));
      const anuncio = espiar(jest.spyOn(AccessibilityInfo, 'announceForAccessibility'));
      await act(() => router.back());
      await dejarPasar();
      expect(screen).toHavePathname('/tus-datos');
      // Quien lo intenta, también con el lector de pantalla, sabe por qué no sale.
      expect(anuncio).toHaveBeenLastCalledWith('Preparando la copia');
      await act(async () => cerrarLaHoja());
      expect(await screen.findByText('¿Has guardado la copia?')).toBeOnTheScreen();
      await act(() => router.back());
      await waitFor(() => expect(screen).toHavePathname('/'));
    });
  });

  describe('las esperas, con la hora del móvil que retrocede', () => {
    // La hora automática corrige el reloj del móvil, que iba un minuto adelantado. Las esperas
    // se cuentan con performance.now(), que no retrocede: jest.setSystemTime mueve Date.now()
    // y no performance.now().
    it('con el resumen a la vista, «Importar» responde pasado el medio segundo', async () => {
      elegir(
        textoDeLaCopia(
          await copiaDeOtroMovil(gimnasioConCalentamiento(ids, hoy()), { ...hyroxConDescansos(ids), fecha: sumarDias(hoy(), -1) }),
        ),
      );
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      await fireEvent.press(await screen.findByRole('button', { name: 'Sí, es mía' }));
      await screen.findByRole('header', { name: 'Esto es lo que va a cambiar' });
      jest.setSystemTime(Date.now() - 60_000);
      await dejarPasar(ESPERA_TRAS_CAMBIAR);
      await fireEvent.press(boton('Importar'));
      expect(await screen.findByText('Copia importada. Han entrado 2 entrenos.')).toBeOnTheScreen();
    });

    it('después de «No», «Hacer una copia» responde pasado el medio segundo', async () => {
      await guardar(mockBase, gimnasioConCalentamiento(ids, hoy()));
      await abrir();
      await fireEvent.press(boton('Hacer una copia'));
      await fireEvent.press(await screen.findByRole('button', { name: 'No la he guardado' }));
      jest.setSystemTime(Date.now() - 60_000);
      await dejarPasar(ESPERA_TRAS_CAMBIAR);
      await fireEvent.press(boton('Hacer una copia'));
      await waitFor(() => expect(compartir).toHaveBeenCalledTimes(2));
    });

    it('después de «Cancelar», «Importar una copia» responde pasado el medio segundo', async () => {
      elegir(textoDeLaCopia(await copiaDeOtroMovil(gimnasioConCalentamiento(ids, hoy()))));
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      await fireEvent.press(await screen.findByRole('button', { name: 'Cancelar' }));
      jest.setSystemTime(Date.now() - 60_000);
      await dejarPasar(ESPERA_TRAS_CAMBIAR);
      await fireEvent.press(boton('Importar una copia'));
      await waitFor(() => expect(elegirArchivo).toHaveBeenCalledTimes(2));
    });
  });

  describe('importar una copia', () => {
    it.each([
      ['en la pregunta', false],
      ['en lo que va a cambiar', true],
    ])('un doble toque en «Cancelar», %s, no vuelve a abrir el selector: «Importar una copia» espera medio segundo', async (_, contestando) => {
      elegir(textoDeLaCopia(await copiaDeOtroMovil(gimnasioConCalentamiento(ids, hoy()))));
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      if (contestando) await fireEvent.press(await screen.findByRole('button', { name: 'Sí, es mía' }));
      await fireEvent.press(await screen.findByRole('button', { name: 'Cancelar' }));
      // El segundo toque cae en «Importar una copia», que puede aparecer donde estaba «Cancelar».
      await dejarPasar(ESPERA_TRAS_CAMBIAR - 1);
      await fireEvent.press(boton('Importar una copia'));
      await dejarPasar(0);
      expect(elegirArchivo).toHaveBeenCalledTimes(1);
      await dejarPasar(1);
      await fireEvent.press(boton('Importar una copia'));
      await waitFor(() => expect(elegirArchivo).toHaveBeenCalledTimes(2));
    });

    it('un doble toque en «Importar» no abre el selector al acabar: «Importar una copia» espera medio segundo', async () => {
      elegir(textoDeLaCopia(await copiaDeOtroMovil(gimnasioConCalentamiento(ids, hoy()))));
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      await fireEvent.press(await screen.findByRole('button', { name: 'Sí, es mía' }));
      await pulsarImportar();
      // findByText deja pasar como mucho 50 ms desde que acabó.
      await fireEvent.press(await screen.findByRole('button', { name: 'Importar una copia' }));
      expect(screen.getByText('Copia importada. Ha entrado 1 entreno.')).toBeOnTheScreen();
      await dejarPasar(ESPERA_TRAS_CAMBIAR - 60);
      await fireEvent.press(boton('Importar una copia'));
      await dejarPasar(0);
      expect(elegirArchivo).toHaveBeenCalledTimes(1);
      await dejarPasar(60);
      await fireEvent.press(boton('Importar una copia'));
      await waitFor(() => expect(elegirArchivo).toHaveBeenCalledTimes(2));
    });

    it('mientras lee la copia, se puede salir: todavía no hay nada a medias', async () => {
      jest.mocked(elegirArchivo).mockResolvedValueOnce({ tamano: 4, leer: () => new Promise<string>(() => {}) });
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      expect(await screen.findByRole('button', { name: 'Leyendo la copia' })).toBeDisabled();
      await act(() => router.back());
      await waitFor(() => expect(screen).toHavePathname('/'));
    });

    it('mientras se prepara una copia, «Importar otra copia» está desactivado y no abre el selector', async () => {
      await guardar(mockBase, gimnasioConCalentamiento(ids, hoy()));
      elegir('hola');
      let cerrarLaHoja: () => void = () => {};
      jest.mocked(compartir).mockImplementationOnce(
        () =>
          new Promise<void>((cerrar) => {
            cerrarLaHoja = cerrar;
          }),
      );
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      expect(await screen.findByText(NO_ES_COPIA)).toBeOnTheScreen();
      await fireEvent.press(boton('Hacer una copia'));
      await waitFor(() => expect(compartir).toHaveBeenCalledTimes(1));
      expect(boton('Importar otra copia')).toBeDisabled();
      await fireEvent.press(boton('Importar otra copia'));
      expect(elegirArchivo).toHaveBeenCalledTimes(1);
      await act(async () => cerrarLaHoja());
      expect(await screen.findByText('¿Has guardado la copia?')).toBeOnTheScreen();
      expect(boton('Importar otra copia')).toBeEnabled();
    });

    it('al cerrar el selector sin elegir nada, no hay ningún dedo encima: «Importar una copia» no espera', async () => {
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      await waitFor(() => expect(boton('Importar una copia')).toBeEnabled());
      await fireEvent.press(boton('Importar una copia'));
      await waitFor(() => expect(elegirArchivo).toHaveBeenCalledTimes(2));
    });

    it('cerrar el selector sin elegir nada deja la tarjeta como estaba, con el foco en su botón', async () => {
      const foco = espiar(jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent'));
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      await waitFor(() => expect(elegirArchivo).toHaveBeenCalledTimes(1));
      await dejarPasar();
      expect(screen.getByText(EXPLICACION_DE_IMPORTAR)).toBeOnTheScreen();
      expect(boton('Importar una copia')).toBeEnabled();
      expect(enfocado(foco)).toBe('Importar una copia');
    });

    it('si el selector falla, lo dice', async () => {
      jest.mocked(elegirArchivo).mockRejectedValueOnce(new Error('sin selector'));
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      expect(await screen.findByText('No se pudo leer el archivo. Prueba otra vez. (Error: sin selector)')).toBeOnTheScreen();
      expect(boton('Importar otra copia')).toBeEnabled();
    });

    it('no lee el archivo hasta que se ha pintado «Leyendo la copia»', async () => {
      const leer = jest.fn(() => Promise.resolve('hola'));
      jest.mocked(elegirArchivo).mockResolvedValueOnce({ tamano: 4, leer });
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      expect(await screen.findByRole('button', { name: 'Leyendo la copia' })).toBeDisabled();
      expect(leer).not.toHaveBeenCalled();
      expect(await screen.findByText(NO_ES_COPIA)).toBeOnTheScreen();
      expect(leer).toHaveBeenCalledTimes(1);
    });

    it('mientras lee la copia, lo dice, y no deja elegir otra ni hacer una copia', async () => {
      await guardar(mockBase, gimnasioConCalentamiento(ids, hoy()));
      let leida: (texto: string) => void = () => {};
      const leer = jest.fn(
        () =>
          new Promise<string>((terminar) => {
            leida = terminar;
          }),
      );
      jest.mocked(elegirArchivo).mockResolvedValueOnce({ tamano: 4, leer });
      const anuncio = espiar(jest.spyOn(AccessibilityInfo, 'announceForAccessibility'));
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      expect(await screen.findByRole('button', { name: 'Leyendo la copia' })).toBeDisabled();
      expect(boton('Hacer una copia')).toBeDisabled();
      expect(anuncio).toHaveBeenLastCalledWith('Leyendo la copia');
      await waitFor(() => expect(leer).toHaveBeenCalledTimes(1));
      expect(boton('Leyendo la copia')).toBeDisabled();
      await act(async () => leida('hola'));
      expect(await screen.findByText(NO_ES_COPIA)).toBeOnTheScreen();
      expect(boton('Hacer una copia')).toBeEnabled();
    });

    it('un archivo de más de 50 MB no se lee, y uno de 50 MB justos sí', async () => {
      const grande = jest.fn(() => Promise.resolve(COPIA_V1));
      jest.mocked(elegirArchivo).mockResolvedValueOnce({ tamano: 50 * 1024 * 1024 + 1, leer: grande });
      const justo = jest.fn(() => Promise.resolve(COPIA_V1));
      jest.mocked(elegirArchivo).mockResolvedValueOnce({ tamano: 50 * 1024 * 1024, leer: justo });
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      expect(await screen.findByText(NO_ES_COPIA)).toBeOnTheScreen();
      expect(grande).not.toHaveBeenCalled();
      await fireEvent.press(boton('Importar otra copia'));
      expect(await screen.findByRole('header', { name: '¿Esta copia es tuya?' })).toBeOnTheScreen();
      expect(justo).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['un archivo que no es una copia', () => elegir('hola'), NO_ES_COPIA],
      [
        'una copia dañada',
        () => {
          const copia = JSON.parse(COPIA_V1) as Copia;
          elegir(JSON.stringify({ ...copia, entrenos: [{ ...copia.entrenos[0], fecha: '2026-02-30' }] }));
        },
        'La copia está dañada y no se puede importar. Prueba con otra. (entrenos[0].fecha no es válido)',
      ],
      [
        'una copia de una Quimera más nueva',
        () => elegir(JSON.stringify({ ...(JSON.parse(COPIA_V1) as Copia), version: 2 })),
        'La copia es de una Quimera más nueva que esta. Actualiza Quimera para importarla.',
      ],
      [
        'un archivo que no se puede leer',
        () =>
          jest.mocked(elegirArchivo).mockResolvedValueOnce({ tamano: 100, leer: () => Promise.reject(new Error('sin permiso')) }),
        'No se pudo leer el archivo. Prueba otra vez. (Error: sin permiso)',
      ],
    ])('%s: lo dice en rojo, sin tocar nada, y deja elegir otro', async (_, preparar, mensaje) => {
      preparar();
      const anuncio = espiar(jest.spyOn(AccessibilityInfo, 'announceForAccessibility'));
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      expect(await screen.findByText(mensaje)).toHaveStyle({ color: PALETAS.claro.error });
      expect(anuncio).toHaveBeenLastCalledWith(mensaje);
      expect(screen.queryByText(EXPLICACION_DE_IMPORTAR)).toBeNull();
      expect(claseDe('Importar otra copia')).toEqual(CLASES.principal);
      expect(mockBase.mirar('SELECT id FROM entreno')).toEqual([]);
      await fireEvent.press(boton('Importar otra copia'));
      await waitFor(() => expect(elegirArchivo).toHaveBeenCalledTimes(2));
      expect(await screen.findByText(EXPLICACION_DE_IMPORTAR)).toBeOnTheScreen();
    });

    it.each([
      [
        'un ejercicio que no existe',
        (copia: Copia) => {
          copia.entrenos[0].bloques[1].series[0].ejercicio_id = 'remo-nuevo';
          return copia;
        },
        'La copia está dañada y no se puede importar. Prueba con otra. (el ejercicio remo-nuevo no existe)',
      ],
      [
        'una disciplina que no existe, de una base más nueva',
        (copia: Copia) => ({ ...copia, base: MIGRACIONES.length + 1, entrenos: [{ ...copia.entrenos[0], disciplina: 'remo' }] }),
        'La copia es de una Quimera más nueva que esta. Actualiza Quimera para importarla.',
      ],
    ])('lo que no se ve hasta comparar con el móvil, %s, sale como al leer la copia', async (_, cambiar, mensaje) => {
      const copia = JSON.parse(textoDeLaCopia(await copiaDeOtroMovil(gimnasioConCalentamiento(ids, hoy())))) as Copia;
      elegir(JSON.stringify(cambiar(copia)));
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      expect(await screen.findByText(mensaje)).toHaveStyle({ color: PALETAS.claro.error });
      expect(boton('Importar otra copia')).toBeEnabled();
    });

    it('la lista sube hasta la tarjeta de importar, medida en lo que se acaba de pintar, al leer y al contestar', async () => {
      // Jest no mide la pantalla: la tarjeta de importar está a 700 del principio de la lista.
      const interior = { soy: 'el contenido de la lista' };
      const lista = ScrollView.prototype as unknown as { getInnerViewRef: () => unknown; scrollTo: (a: unknown) => void };
      const vista = View.prototype as unknown as { measureLayout: (...a: unknown[]) => void };
      espiar(jest.spyOn(lista, 'getInnerViewRef')).mockReturnValue(interior);
      const desplazar = espiar(jest.spyOn(lista, 'scrollTo'));
      const medir = espiar(jest.spyOn(vista, 'measureLayout')).mockImplementation((_relativo, alMedir) =>
        (alMedir as (x: number, y: number, ancho: number, alto: number) => void)(0, 700, 350, 400),
      );
      elegir(textoDeLaCopia(await copiaDeOtroMovil(gimnasioConCalentamiento(ids, hoy()))));
      await abrir();
      expect(desplazar).not.toHaveBeenCalled();
      await fireEvent.press(boton('Importar una copia'));
      await screen.findByRole('header', { name: '¿Esta copia es tuya?' });
      await waitFor(() => expect(desplazar).toHaveBeenCalledTimes(1));
      expect(desplazar).toHaveBeenLastCalledWith({ y: 700 - 16, animated: true });
      expect(medir).toHaveBeenCalledWith(interior, expect.any(Function));
      expect((medir.mock.contexts[0] as { props: { testID?: string } }).props.testID).toBe('tarjeta-de-importar');
      // Al contestar, lo que va a cambiar empieza otra vez arriba de la tarjeta.
      await fireEvent.press(boton('Sí, es mía'));
      await screen.findByRole('header', { name: 'Esto es lo que va a cambiar' });
      await waitFor(() => expect(desplazar).toHaveBeenCalledTimes(2));
    });

    it('la lista sube hasta la tarjeta de importar también si el archivo no vale y al acabar de importar', async () => {
      const lista = ScrollView.prototype as unknown as { getInnerViewRef: () => unknown; scrollTo: (a: unknown) => void };
      const vista = View.prototype as unknown as { measureLayout: (...a: unknown[]) => void };
      espiar(jest.spyOn(lista, 'getInnerViewRef')).mockReturnValue({ soy: 'el contenido de la lista' });
      const desplazar = espiar(jest.spyOn(lista, 'scrollTo'));
      espiar(jest.spyOn(vista, 'measureLayout')).mockImplementation((_relativo, alMedir) =>
        (alMedir as (x: number, y: number, ancho: number, alto: number) => void)(0, 700, 350, 400),
      );
      elegir('hola');
      elegir(textoDeLaCopia(await copiaDeOtroMovil(gimnasioConCalentamiento(ids, hoy()))));
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      expect(await screen.findByText(NO_ES_COPIA)).toBeOnTheScreen();
      await waitFor(() => expect(desplazar).toHaveBeenCalledTimes(1));
      await fireEvent.press(boton('Importar otra copia'));
      await fireEvent.press(await screen.findByRole('button', { name: 'Sí, es mía' }));
      await screen.findByRole('header', { name: 'Esto es lo que va a cambiar' });
      desplazar.mockClear();
      await pulsarImportar();
      expect(await screen.findByText('Copia importada. Ha entrado 1 entreno.')).toBeOnTheScreen();
      await waitFor(() => expect(desplazar).toHaveBeenCalledTimes(1));
    });

    it('mientras está abierto el selector, no se abre otro ni se puede hacer una copia', async () => {
      await guardar(mockBase, gimnasioConCalentamiento(ids, hoy()));
      let cerrarElSelector: (elegido: null) => void = () => {};
      jest.mocked(elegirArchivo).mockImplementationOnce(
        () =>
          new Promise((cerrar) => {
            cerrarElSelector = cerrar;
          }),
      );
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      expect(boton('Importar una copia')).toBeDisabled();
      expect(boton('Hacer una copia')).toBeDisabled();
      await fireEvent.press(boton('Importar una copia'));
      expect(elegirArchivo).toHaveBeenCalledTimes(1);
      await act(async () => cerrarElSelector(null));
      expect(boton('Importar una copia')).toBeEnabled();
      expect(boton('Hacer una copia')).toBeEnabled();
    });

    it('mientras se prepara una copia, «Importar» del resumen está desactivado', async () => {
      await guardar(mockBase, gimnasioConCalentamiento(ids, hoy()));
      elegir(textoDeLaCopia(await copiaDeOtroMovil(gimnasioConCalentamiento(ids, sumarDias(hoy(), -1)))));
      let cerrarLaHoja: () => void = () => {};
      jest.mocked(compartir).mockImplementationOnce(
        () =>
          new Promise<void>((cerrar) => {
            cerrarLaHoja = cerrar;
          }),
      );
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      await fireEvent.press(await screen.findByRole('button', { name: 'Sí, es mía' }));
      await screen.findByRole('header', { name: 'Esto es lo que va a cambiar' });
      await fireEvent.press(boton('Hacer una copia'));
      await waitFor(() => expect(compartir).toHaveBeenCalledTimes(1));
      expect(boton('Importar')).toBeDisabled();
      await act(async () => cerrarLaHoja());
      expect(await screen.findByText('¿Has guardado la copia?')).toBeOnTheScreen();
      expect(boton('Importar')).toBeEnabled();
    });

    it('con el resumen a la vista, sin importar, se puede salir', async () => {
      elegir(textoDeLaCopia(await copiaDeOtroMovil(gimnasioConCalentamiento(ids, hoy()))));
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      await fireEvent.press(await screen.findByRole('button', { name: 'Sí, es mía' }));
      await screen.findByRole('header', { name: 'Esto es lo que va a cambiar' });
      await act(() => router.back());
      await waitFor(() => expect(screen).toHavePathname('/'));
    });

    it('con entrenos en el móvil, «Importar otra copia» es secundario, como en el dibujo', async () => {
      await guardar(mockBase, gimnasioConCalentamiento(ids, hoy()));
      elegir('hola');
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      expect(await screen.findByText(NO_ES_COPIA)).toBeOnTheScreen();
      expect(claseDe('Importar otra copia')).toEqual(CLASES.secundario);
    });

    it('la línea de la copia cuenta solo los entrenos sin borrar, y sin fecha si la copia no la da', async () => {
      elegir(COPIA_V1);
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      expect(await screen.findByText('Copia con 5 entrenos.')).toBeOnTheScreen();
    });

    it('una copia de este mismo móvil no pregunta de quién es, dice que no cambia nada, e importarla no cambia nada', async () => {
      await guardar(mockBase, gimnasioConCalentamiento(ids, hoy()));
      elegir(textoDeLaCopia(await copiaDe(mockBase)));
      const antes = mockBase.mirar('SELECT * FROM entreno');
      const anuncio = espiar(jest.spyOn(AccessibilityInfo, 'announceForAccessibility'));
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      expect(await screen.findByText(SIN_CAMBIOS)).toBeOnTheScreen();
      expect(screen.getByText('Copia hecha hoy, con 1 entreno.')).toBeOnTheScreen();
      expect(screen.queryByText('¿Esta copia es tuya?')).toBeNull();
      expect(screen.queryByText(RECORDARA)).toBeNull();
      expect(screen.queryByText('Esto es lo que va a cambiar')).toBeNull();
      expect(anuncio).toHaveBeenLastCalledWith(`Copia hecha hoy, con 1 entreno. ${SIN_CAMBIOS}`);
      await pulsarImportar();
      expect(await screen.findByText('Copia importada. No ha cambiado nada de lo que ves.')).toBeOnTheScreen();
      expect(anuncio).toHaveBeenLastCalledWith('Copia importada. No ha cambiado nada de lo que ves.');
      expect(screen.getByText(EXPLICACION_DE_IMPORTAR)).toBeOnTheScreen();
      expect(boton('Importar una copia')).toBeEnabled();
      expect(mockBase.mirar('SELECT * FROM entreno')).toEqual(antes);
    });

    describe('la copia de otro móvil', () => {
      const deOtroMovil = () => copiaDeOtroMovil(gimnasioConCalentamiento(ids, hoy()), { ...hyroxConDescansos(ids), fecha: sumarDias(hoy(), -1) });

      it('pregunta de quién es, con lo que pasa con cada respuesta', async () => {
        elegir(textoDeLaCopia(await deOtroMovil()));
        const anuncio = espiar(jest.spyOn(AccessibilityInfo, 'announceForAccessibility'));
        await abrir();
        await fireEvent.press(boton('Importar una copia'));
        expect(await screen.findByRole('header', { name: '¿Esta copia es tuya?' })).toBeOnTheScreen();
        expect(screen.getByText('Copia hecha hoy, con 2 entrenos.')).toBeOnTheScreen();
        expect(
          screen.getByText('Viene de otro móvil, o de antes de reinstalar Quimera. Si la hizo otra persona en su móvil, contesta que no.'),
        ).toBeOnTheScreen();
        expect(
          screen.getByText(
            'Se junta con lo que tienes: de cada entreno queda su última versión. Con las próximas copias de ese móvil, Quimera ya no lo preguntará.',
          ),
        ).toBeOnTheScreen();
        expect(
          screen.getByText(
            'Sus entrenos se mezclan con los tuyos: salen en tu historial, cuentan en tu semana y van en tus copias, y solo se quitan borrándolos uno a uno. Lo tuyo no cambia.',
          ),
        ).toBeOnTheScreen();
        // Las dos respuestas pesan lo mismo.
        expect(claseDe('Sí, es mía')).toEqual(CLASES.secundario);
        expect(claseDe('No, es de otra persona')).toEqual(CLASES.secundario);
        expect(claseDe('Cancelar')).toEqual(CLASES.sutil);
        expect(anuncio).toHaveBeenLastCalledWith('Copia hecha hoy, con 2 entrenos. ¿Esta copia es tuya?');
        expect(screen.queryByText(EXPLICACION_DE_IMPORTAR)).toBeNull();
      });

      it('con «sí», enseña lo que entra y lo importa con sus sellos; en un móvil sin entrenos, cuenta como su última copia', async () => {
        const suya = await deOtroMovil();
        elegir(textoDeLaCopia(suya));
        const anuncio = espiar(jest.spyOn(AccessibilityInfo, 'announceForAccessibility'));
        await abrir();
        await fireEvent.press(boton('Importar una copia'));
        await fireEvent.press(await screen.findByRole('button', { name: 'Sí, es mía' }));
        expect(await screen.findByRole('header', { name: 'Esto es lo que va a cambiar' })).toBeOnTheScreen();
        expect(screen.getByText('Entran 2 entrenos en tu historial.')).toBeOnTheScreen();
        expect(screen.getByText('Copia hecha hoy, con 2 entrenos.')).toBeOnTheScreen();
        expect(screen.queryByText(AVISO_DE_OTRA)).toBeNull();
        expect(screen.queryByText('¿Esta copia es tuya?')).toBeNull();
        expect(claseDe('Importar')).toEqual(CLASES.relleno);
        expect(claseDe('Cancelar')).toEqual(CLASES.sutil);
        expect(anuncio).toHaveBeenLastCalledWith('Esto es lo que va a cambiar. Entran 2 entrenos en tu historial.');
        expect(mockBase.mirar('SELECT id FROM entreno')).toEqual([]);

        await pulsarImportar();
        expect(await screen.findByText('Copia importada. Han entrado 2 entrenos.')).toBeOnTheScreen();
        expect(anuncio).toHaveBeenLastCalledWith('Copia importada. Han entrado 2 entrenos.');
        expect(mockBase.mirar('SELECT id, modificado FROM entreno ORDER BY id')).toEqual(
          suya.entrenos.map(({ id, modificado }) => ({ id, modificado })).sort((a, b) => a.id.localeCompare(b.id)),
        );
        // Ya hay algo que copiar, y la copia importada, que trae todo, cuenta como la última.
        expect(screen.getByText('Última copia: hoy.')).toBeOnTheScreen();
        expect(boton('Hacer una copia')).toBeEnabled();
        expect(claseDe('Importar una copia')).toEqual(CLASES.secundario);
      });

      it('un doble toque en «Sí, es mía» no importa sin dejar ver lo que cambia: «Importar» espera medio segundo desde que aparece', async () => {
        elegir(textoDeLaCopia(await deOtroMovil()));
        await abrir();
        await fireEvent.press(boton('Importar una copia'));
        await screen.findByRole('button', { name: 'Sí, es mía' });
        // Se piensa la respuesta: la espera no cuenta desde la pregunta.
        await dejarPasar(5000);
        await fireEvent.press(boton('Sí, es mía'));
        // El segundo toque de un doble toque lento cae en «Importar», que acaba de aparecer en su sitio.
        await dejarPasar(ESPERA_TRAS_CAMBIAR - 1);
        await fireEvent.press(boton('Importar'));
        expect(screen.queryByRole('button', { name: 'Importando' })).toBeNull();
        expect(screen.getByText('Entran 2 entrenos en tu historial.')).toBeOnTheScreen();
        // Pasado el medio segundo justo, sí importa.
        await dejarPasar(1);
        await fireEvent.press(boton('Importar'));
        expect(await screen.findByText('Copia importada. Han entrado 2 entrenos.')).toBeOnTheScreen();
      });

      it('con «no», avisa de que se mezclan, y entran con el sello mínimo y sin contar como copia guardada', async () => {
        elegir(textoDeLaCopia(await deOtroMovil()));
        const anuncio = espiar(jest.spyOn(AccessibilityInfo, 'announceForAccessibility'));
        await abrir();
        await fireEvent.press(boton('Importar una copia'));
        await fireEvent.press(await screen.findByRole('button', { name: 'No, es de otra persona' }));
        expect(await screen.findByText(AVISO_DE_OTRA)).toBeOnTheScreen();
        expect(screen.getByText('Entran 2 entrenos en tu historial.')).toBeOnTheScreen();
        expect(anuncio).toHaveBeenLastCalledWith(`${AVISO_DE_OTRA} Esto es lo que va a cambiar. Entran 2 entrenos en tu historial.`);
        await pulsarImportar();
        expect(await screen.findByText('Copia importada. Han entrado 2 entrenos.')).toBeOnTheScreen();
        expect(mockBase.mirar('SELECT DISTINCT modificado FROM entreno')).toEqual([{ modificado: SELLO_MINIMO }]);
        expect(screen.getByText(NINGUNA_COPIA)).toBeOnTheScreen();
      });

      it('«Cancelar», en la pregunta o en lo que va a cambiar, deja la tarjeta como estaba, sin tocar nada, con el foco en su botón', async () => {
        const suya = textoDeLaCopia(await deOtroMovil());
        elegir(suya);
        elegir(suya);
        const foco = espiar(jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent'));
        await abrir();
        await fireEvent.press(boton('Importar una copia'));
        await fireEvent.press(await screen.findByRole('button', { name: 'Cancelar' }));
        expect(await screen.findByText(EXPLICACION_DE_IMPORTAR)).toBeOnTheScreen();
        expect(screen.queryByText('¿Esta copia es tuya?')).toBeNull();
        expect(enfocado(foco)).toBeUndefined();
        await dejarPasar(100);
        expect(enfocado(foco)).toBe('Importar una copia');
        foco.mockClear();
        await dejarPasar(ESPERA_TRAS_CAMBIAR);
        await fireEvent.press(boton('Importar una copia'));
        await fireEvent.press(await screen.findByRole('button', { name: 'Sí, es mía' }));
        await fireEvent.press(await screen.findByRole('button', { name: 'Cancelar' }));
        expect(await screen.findByText(EXPLICACION_DE_IMPORTAR)).toBeOnTheScreen();
        expect(enfocado(foco)).toBeUndefined();
        await dejarPasar();
        expect(enfocado(foco)).toBe('Importar una copia');
        expect(mockBase.mirar('SELECT id FROM entreno')).toEqual([]);
        expect(mockBase.mirar("SELECT clave FROM ajuste WHERE clave = 'local.personas'")).toEqual([]);
      });

      it('con «sí» y sin nada que cambie a la vista, lo dice, y que recordará ese móvil', async () => {
        elegir(textoDeLaCopia(await copiaDeOtroMovil()));
        const anuncio = espiar(jest.spyOn(AccessibilityInfo, 'announceForAccessibility'));
        await abrir();
        await fireEvent.press(boton('Importar una copia'));
        expect(await screen.findByText('Copia hecha hoy, sin entrenos.')).toBeOnTheScreen();
        await fireEvent.press(boton('Sí, es mía'));
        expect(await screen.findByText(SIN_CAMBIOS)).toBeOnTheScreen();
        expect(screen.getByText(RECORDARA)).toBeOnTheScreen();
        expect(screen.queryByText('Esto es lo que va a cambiar')).toBeNull();
        expect(anuncio).toHaveBeenLastCalledWith(`${SIN_CAMBIOS} ${RECORDARA}`);
        await pulsarImportar();
        expect(await screen.findByText('Copia importada. No ha cambiado nada de lo que ves.')).toBeOnTheScreen();
        // Recuerda la persona de la copia como suya.
        expect(mockBase.mirar("SELECT clave FROM ajuste WHERE clave = 'local.personas'")).toEqual([{ clave: 'local.personas' }]);
      });

      it('con «no» y sin ningún entreno que no tenga, lo dice, sin el aviso', async () => {
        elegir(textoDeLaCopia(await copiaDeOtroMovil()));
        await abrir();
        await fireEvent.press(boton('Importar una copia'));
        await fireEvent.press(await screen.findByRole('button', { name: 'No, es de otra persona' }));
        expect(await screen.findByText(SIN_CAMBIOS_DE_OTRA)).toBeOnTheScreen();
        expect(screen.queryByText(AVISO_DE_OTRA)).toBeNull();
        expect(screen.queryByText(RECORDARA)).toBeNull();
      });

      it('con «no», el resumen es el de la copia de otra persona: lo que este móvil ya tiene no cambia', async () => {
        const compartido = gimnasioConCalentamiento(ids, hoy());
        const ahora = Date.now();
        await guardar(mockBase, compartido, ahora - 60_000);
        const otro = await abrirBasePreparada();
        let copia: Copia;
        try {
          await guardar(otro, compartido, ahora - 30_000);
          copia = await copiaDe(otro, ahora - 10_000);
        } finally {
          otro.cerrar();
        }
        elegir(textoDeLaCopia(copia));
        elegir(textoDeLaCopia(copia));
        await abrir();
        await fireEvent.press(boton('Importar una copia'));
        await fireEvent.press(await screen.findByRole('button', { name: 'Sí, es mía' }));
        expect(await screen.findByText('Se actualiza 1 entreno que se cambió después en el otro móvil.')).toBeOnTheScreen();
        await fireEvent.press(boton('Cancelar'));
        await dejarPasar(ESPERA_TRAS_CAMBIAR);
        await fireEvent.press(boton('Importar una copia'));
        await fireEvent.press(await screen.findByRole('button', { name: 'No, es de otra persona' }));
        expect(await screen.findByText(SIN_CAMBIOS_DE_OTRA)).toBeOnTheScreen();
        expect(screen.queryByText(/^Se actualiza/)).toBeNull();
        expect(screen.queryByText(AVISO_DE_OTRA)).toBeNull();
      });
    });

    it('de un móvil ya aceptado como tuyo no pregunta, y enseña lo que se borra y lo que se actualiza', async () => {
      const otro = await abrirBasePreparada();
      try {
        const gimnasio = gimnasioConCalentamiento(ids, hoy());
        const hyrox = { ...hyroxConDescansos(ids), fecha: sumarDias(hoy(), -1) };
        const ahora = Date.now();
        await guardar(otro, gimnasio, ahora - 60_000);
        await guardar(otro, hyrox, ahora - 60_000);
        const primera = await copiaDe(otro, ahora - 50_000);
        await puertaDe(mockBase).escribir((tx) => importarCopiaEn(tx, primera, { ahora: ahora - 40_000, nuevoId: ids, esMia: true }));
        // En el otro móvil, después: se corrige uno, borrándolo y deshaciéndolo, y se borra el otro.
        await puertaDe(otro).escribir((tx) => borrarEntrenoEn(tx, gimnasio.id, ahora - 30_000));
        await puertaDe(otro).escribir((tx) => restaurarEntrenoEn(tx, gimnasio.id, ahora - 20_000));
        await puertaDe(otro).escribir((tx) => borrarEntrenoEn(tx, hyrox.id, ahora - 20_000));
        elegir(textoDeLaCopia(await copiaDe(otro, ahora - 10_000)));
      } finally {
        otro.cerrar();
      }
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      expect(await screen.findByText('Se borra 1 entreno que se borró después en el otro móvil.')).toBeOnTheScreen();
      expect(screen.getByText('Se actualiza 1 entreno que se cambió después en el otro móvil.')).toBeOnTheScreen();
      expect(screen.queryByText(/^Entra/)).toBeNull();
      expect(screen.queryByText('¿Esta copia es tuya?')).toBeNull();
      await pulsarImportar();
      expect(await screen.findByText('Copia importada. Se ha actualizado 1 entreno y se ha borrado 1.')).toBeOnTheScreen();
      expect(mockBase.mirar('SELECT COUNT(*) AS vivos FROM entreno WHERE borrado = 0')).toEqual([{ vivos: 1 }]);
    });

    it('si no se puede importar, lo dice, no cambia nada y deja probar otra vez', async () => {
      elegir(textoDeLaCopia(await copiaDeOtroMovil(gimnasioConCalentamiento(ids, hoy()))));
      espiar(jest.spyOn(copias, 'importarCopiaEn')).mockRejectedValueOnce(new Error('disco lleno'));
      const anuncio = espiar(jest.spyOn(AccessibilityInfo, 'announceForAccessibility'));
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      await fireEvent.press(await screen.findByRole('button', { name: 'Sí, es mía' }));
      await pulsarImportar();
      const fallo = 'No se pudo importar la copia. No ha cambiado nada: prueba otra vez. (Error: disco lleno)';
      expect(await screen.findByText(fallo)).toHaveStyle({ color: PALETAS.claro.error });
      expect(anuncio).toHaveBeenLastCalledWith(fallo);
      expect(screen.getByText('Entra 1 entreno en tu historial.')).toBeOnTheScreen();
      expect(boton('Importar')).toBeEnabled();
      expect(mockBase.mirar('SELECT id FROM entreno')).toEqual([]);
      // El segundo toque de un doble toque en «Importar» no vuelve a probar enseguida: la espera
      // cuenta desde el fallo. findByText ya ha dejado pasar como mucho 50 ms desde entonces.
      await dejarPasar(ESPERA_TRAS_CAMBIAR - 60);
      await fireEvent.press(boton('Importar'));
      await dejarPasar(10);
      expect(screen.getByText(fallo)).toBeOnTheScreen();
      expect(mockBase.mirar('SELECT id FROM entreno')).toEqual([]);
      await dejarPasar(50);
      await fireEvent.press(boton('Importar'));
      expect(await screen.findByText('Copia importada. Ha entrado 1 entreno.')).toBeOnTheScreen();
    });

    it('mientras importa, todo está desactivado, no se puede empezar una copia ni salir de la pantalla', async () => {
      await guardar(mockBase, gimnasioConCalentamiento(ids, hoy()));
      elegir(textoDeLaCopia(await copiaDeOtroMovil(gimnasioConCalentamiento(ids, sumarDias(hoy(), -1)))));
      let fallar: (error: Error) => void = () => {};
      const importar = espiar(jest.spyOn(copias, 'importarCopiaEn')).mockImplementationOnce(
        () =>
          new Promise((_, rechazar) => {
            fallar = rechazar;
          }),
      );
      const anuncio = espiar(jest.spyOn(AccessibilityInfo, 'announceForAccessibility'));
      await abrir();
      await fireEvent.press(boton('Importar una copia'));
      await fireEvent.press(await screen.findByRole('button', { name: 'No, es de otra persona' }));
      await pulsarImportar();
      expect(await screen.findByRole('button', { name: 'Importando' })).toBeDisabled();
      expect(boton('Cancelar')).toBeDisabled();
      expect(boton('Hacer una copia')).toBeDisabled();
      expect(anuncio).toHaveBeenLastCalledWith('Importando');
      // Ya dentro de la transacción.
      await waitFor(() => expect(importar).toHaveBeenCalledTimes(1));
      expect(boton('Importando')).toBeDisabled();
      anuncio.mockClear();
      await act(() => router.back());
      await dejarPasar();
      expect(screen).toHavePathname('/tus-datos');
      expect(anuncio).toHaveBeenLastCalledWith('Importando');
      await act(async () => fallar(new Error('se acabó')));
      expect(await screen.findByText(/^No se pudo importar la copia/)).toBeOnTheScreen();
      expect(boton('Hacer una copia')).toBeEnabled();
    });
  });
});

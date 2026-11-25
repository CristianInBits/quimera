/// <reference types="node" />
import { shareAsync } from 'expo-sharing';

import { compartir, elegirArchivo, prepararArchivo, TAMANO_MAXIMO } from '@/copias/archivos';

// expo-file-system, simulado con un disco en memoria: las carpetas que
// existen y lo que guarda cada archivo, por su dirección: un texto, que se
// guarda en UTF-8, o unos bytes cualesquiera.
const mockDisco = {
  carpetas: new Set<string>(),
  archivos: new Map<string, string | Uint8Array>(),
  /** Cuántas veces se ha leído lo que guarda algún archivo. */
  lecturas: 0,
  /** Los nombres de los archivos que fallan al borrarlos. */
  sinBorrar: new Set<string>(),
  /** Lo que devuelve el selector de archivos, y con qué opciones se abrió. */
  elegido: null as unknown,
  opcionesDelSelector: [] as unknown[],
};

/** Los bytes de lo que guarda un archivo: un texto, en UTF-8. */
const mockBytes = (guardado: string | Uint8Array) => (typeof guardado === 'string' ? new Uint8Array(Buffer.from(guardado, 'utf8')) : guardado);

/** Una parte de una dirección: un texto, o una carpeta o un archivo, con la suya. */
type MockParte = string | { uri: string };

jest.mock('expo-file-system', () => {
  const unir = (partes: MockParte[]) => partes.map((parte) => (typeof parte === 'string' ? parte : parte.uri).replace(/\/$/, '')).join('/');
  class Directory {
    readonly uri: string;
    constructor(...partes: MockParte[]) {
      this.uri = `${unir(partes)}/`;
    }
    get name() {
      return this.uri.slice(0, -1).split('/').pop() ?? '';
    }
    get exists() {
      return mockDisco.carpetas.has(this.uri);
    }
    create({ intermediates = false, idempotent = false }: { intermediates?: boolean; idempotent?: boolean } = {}) {
      if (this.exists && !idempotent) throw new Error(`La carpeta ${this.uri} ya existe.`);
      const madre = this.uri.slice(0, -1).replace(/[^/]+$/, '');
      if (!intermediates && !mockDisco.carpetas.has(madre)) throw new Error(`No existe la carpeta ${madre}.`);
      mockDisco.carpetas.add(this.uri);
    }
    list() {
      return [...mockDisco.archivos.keys()]
        .filter((uri) => uri.startsWith(this.uri) && !uri.slice(this.uri.length).includes('/'))
        .map((uri) => new File(uri));
    }
  }
  class File {
    readonly uri: string;
    constructor(...partes: MockParte[]) {
      this.uri = unir(partes);
    }
    get name() {
      return this.uri.split('/').pop() ?? '';
    }
    get size() {
      return mockBytes(mockDisco.archivos.get(this.uri) ?? '').length;
    }
    async write(texto: string) {
      const carpeta = this.uri.replace(/[^/]+$/, '');
      if (!mockDisco.carpetas.has(carpeta)) throw new Error(`No existe la carpeta ${carpeta}.`);
      mockDisco.archivos.set(this.uri, texto);
    }
    async bytes() {
      mockDisco.lecturas++;
      const guardado = mockDisco.archivos.get(this.uri);
      if (guardado === undefined) throw new Error(`No existe ${this.uri}.`);
      return mockBytes(guardado);
    }
    async text() {
      mockDisco.lecturas++;
      const guardado = mockDisco.archivos.get(this.uri);
      if (guardado === undefined) throw new Error(`No existe ${this.uri}.`);
      return Buffer.from(mockBytes(guardado)).toString('utf8');
    }
    delete() {
      if (mockDisco.sinBorrar.has(this.name)) throw new Error(`No se puede borrar ${this.name}.`);
      mockDisco.archivos.delete(this.uri);
    }
    static async pickFileAsync(...opciones: unknown[]) {
      mockDisco.opcionesDelSelector = opciones;
      return mockDisco.elegido;
    }
  }
  return { Directory, File, Paths: { cache: new Directory('file:///cache') } };
});
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(() => Promise.resolve()) }));

const CARPETA = 'file:///cache/copias/';

describe('Los archivos de las copias', () => {
  beforeEach(() => {
    mockDisco.carpetas = new Set(['file:///cache/']);
    mockDisco.archivos = new Map();
    mockDisco.lecturas = 0;
    mockDisco.sinBorrar = new Set();
    mockDisco.elegido = null;
    mockDisco.opcionesDelSelector = [];
    jest.mocked(shareAsync).mockClear();
  });

  describe('al preparar el de una copia', () => {
    it('lo escribe con su nombre en su carpeta de la caché, que crea si no está, y da su dirección', async () => {
      const uri = await prepararArchivo('quimera-2026-11-25-1830.json', '{"formato":"quimera"}');
      expect(uri).toBe(`${CARPETA}quimera-2026-11-25-1830.json`);
      expect([...mockDisco.archivos]).toEqual([[uri, '{"formato":"quimera"}']]);
      // La segunda vez, la carpeta ya está.
      await prepararArchivo('quimera-2026-11-25-1831.json', 'otra');
      expect(mockDisco.archivos.get(`${CARPETA}quimera-2026-11-25-1831.json`)).toBe('otra');
    });

    it('borra lo que quede de otros días, pero no las copias de hoy, que otra app puede estar leyendo', async () => {
      mockDisco.carpetas.add(CARPETA);
      for (const nombre of ['quimera-2026-11-24-2359.json', 'quimera-2025-11-25-1830.json', 'otra-cosa.txt', 'quimera-2026-11-25-0001.json']) {
        mockDisco.archivos.set(`${CARPETA}${nombre}`, 'vieja');
      }
      // Lo de fuera de la carpeta no se toca.
      mockDisco.archivos.set('file:///cache/quimera-2026-11-24-2359.json', 'de otro');
      await prepararArchivo('quimera-2026-11-25-1830.json', 'nueva');
      expect([...mockDisco.archivos.keys()].sort()).toEqual([
        `${CARPETA}quimera-2026-11-25-0001.json`,
        `${CARPETA}quimera-2026-11-25-1830.json`,
        'file:///cache/quimera-2026-11-24-2359.json',
      ]);
    });

    it('una copia vieja que no se puede borrar no impide hacer la nueva', async () => {
      mockDisco.carpetas.add(CARPETA);
      mockDisco.archivos.set(`${CARPETA}quimera-2026-11-23-1000.json`, 'vieja');
      mockDisco.archivos.set(`${CARPETA}quimera-2026-11-24-1000.json`, 'vieja');
      mockDisco.sinBorrar.add('quimera-2026-11-23-1000.json');
      await prepararArchivo('quimera-2026-11-25-1830.json', 'nueva');
      expect([...mockDisco.archivos.keys()].sort()).toEqual([
        `${CARPETA}quimera-2026-11-23-1000.json`,
        `${CARPETA}quimera-2026-11-25-1830.json`,
      ]);
    });
  });

  it('comparte el archivo como JSON, sin título', async () => {
    await compartir(`${CARPETA}quimera-2026-11-25-1830.json`);
    expect(shareAsync).toHaveBeenCalledTimes(1);
    expect(shareAsync).toHaveBeenCalledWith(`${CARPETA}quimera-2026-11-25-1830.json`, { mimeType: 'application/json' });
  });

  describe('al elegir uno para importarlo', () => {
    it('abre el selector sin filtrar por tipo, y da lo que mide y cómo leerlo', async () => {
      const texto = '{"formato":"quimera","notas":"ñandú"}';
      mockDisco.archivos.set('file:///inbox/copia.json', texto);
      const { File } = jest.requireMock<{ File: new (uri: string) => unknown }>('expo-file-system');
      mockDisco.elegido = { canceled: false, result: new File('file:///inbox/copia.json') };
      const elegido = await elegirArchivo();
      expect(mockDisco.opcionesDelSelector).toEqual([{ multipleFiles: false }]);
      // Elegirlo no lo lee: la pantalla mira antes lo que mide.
      expect(mockDisco.lecturas).toBe(0);
      // En bytes, no en letras.
      expect(elegido?.tamano).toBe(texto.length + 2);
      expect(await elegido?.leer()).toBe(texto);
      expect(mockDisco.lecturas).toBe(1);
    });

    /** Elige un archivo con estos bytes y lee su texto. */
    async function leerBytes(bytes: number[]): Promise<string | undefined> {
      mockDisco.archivos.set('file:///inbox/archivo', new Uint8Array(bytes));
      const { File } = jest.requireMock<{ File: new (uri: string) => unknown }>('expo-file-system');
      mockDisco.elegido = { canceled: false, result: new File('file:///inbox/archivo') };
      return (await elegirArchivo())?.leer();
    }

    it('lo que no es UTF-8, como una foto, sale con caracteres de sustitución, sin fallar', async () => {
      const sustitucion = String.fromCharCode(0xfffd);
      expect(await leerBytes([0xff, 0xd8, 0x41, 0xc3])).toBe(`${sustitucion}${sustitucion}A${sustitucion}`);
    });

    it('quita la marca de orden de bytes del principio', async () => {
      expect(await leerBytes([0xef, 0xbb, 0xbf, 0x7b, 0x7d])).toBe('{}');
    });

    it('si se cierra sin elegir nada, no da nada', async () => {
      mockDisco.elegido = { canceled: true, result: null };
      expect(await elegirArchivo()).toBeNull();
    });
  });

  it('el tope de lo que se lee es de 50 MB', () => {
    expect(TAMANO_MAXIMO).toBe(52_428_800);
  });
});

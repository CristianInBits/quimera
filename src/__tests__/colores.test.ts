import { PALETAS, coloresDeLaBarra, type Paleta } from '@/tema/colores';

// El contraste de las pautas de accesibilidad WCAG 2: de 1:1 a 21:1. El texto
// pequeño necesita 4,5:1, y las marcas y el texto grande, 3:1.

function luminancia(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const canal = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(n >> 16) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

function contraste(a: string, b: string): number {
  const [clara, oscura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (clara + 0.05) / (oscura + 0.05);
}

/** Todos los colores de una paleta, también los de las disciplinas. */
function todos(paleta: Paleta): string[] {
  return Object.values(paleta).flatMap((valor) => (typeof valor === 'string' ? [valor] : Object.values(valor)));
}

describe.each(['claro', 'oscuro'] as const)('Los colores en modo %s', (modo) => {
  const paleta = PALETAS[modo];
  const fondos = [paleta.fondo, paleta.fondoElevado, paleta.fondoHundido];

  it('son colores escritos como #rrggbb', () => {
    expect(todos(paleta).length).toBeGreaterThan(10);
    for (const color of todos(paleta)) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('el texto, el texto tenue y el error se leen sobre los tres fondos', () => {
    for (const color of [paleta.texto, paleta.textoTenue, paleta.error]) {
      for (const fondo of fondos) {
        expect(contraste(color, fondo)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('cada disciplina se lee como texto sobre el fondo, y como marca sobre los otros dos', () => {
    for (const color of Object.values(paleta.disciplina)) {
      expect(contraste(color, paleta.fondo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(color, paleta.fondoElevado)).toBeGreaterThanOrEqual(3);
      expect(contraste(color, paleta.fondoHundido)).toBeGreaterThanOrEqual(3);
    }
  });

  it('en la barra de pestañas de Android se ve cuál está elegida', () => {
    const barra = coloresDeLaBarra(paleta, 'android');
    expect(contraste(barra.indicador, barra.fondo)).toBeGreaterThanOrEqual(3);
    expect(contraste(barra.iconoElegido, barra.indicador)).toBeGreaterThanOrEqual(3);
    expect(contraste(barra.icono, barra.fondo)).toBeGreaterThanOrEqual(3);
    expect(contraste(barra.etiqueta, barra.fondo)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(barra.etiquetaElegida, barra.fondo)).toBeGreaterThanOrEqual(4.5);
  });

  it('en la barra de pestañas del iPhone se leen los iconos y las etiquetas', () => {
    const barra = coloresDeLaBarra(paleta, 'ios');
    expect(contraste(barra.iconoElegido, barra.fondo)).toBeGreaterThanOrEqual(3);
    expect(contraste(barra.icono, barra.fondo)).toBeGreaterThanOrEqual(3);
    expect(contraste(barra.etiqueta, barra.fondo)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(barra.etiquetaElegida, barra.fondo)).toBeGreaterThanOrEqual(4.5);
  });
});

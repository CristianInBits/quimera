/// <reference types="node" />
import { transformFileSync, transformSync, type TransformOptions } from '@babel/core';
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// En el móvil, todo el código de la app pasa por React Compiler (app.json),
// que memoriza lo que pintan los componentes. Si con alguno se rinde, lo deja
// sin compilar y no avisa: el componente funciona, pero sin memorizar nada y
// sin las comprobaciones del compilador. Esta prueba pasa cada fichero por
// babel-preset-expo, como Metro, y pide que el compilador no se rinda con
// ninguno. Las pruebas y sus ayudas no cuentan.

const SRC = join(__dirname, '..');

function ficheros(carpeta: string): string[] {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(carpeta, entrada.name);
    if (entrada.isDirectory()) {
      return entrada.name === '__tests__' || entrada.name === 'pruebas' ? [] : ficheros(ruta);
    }
    return /\.tsx?$/.test(entrada.name) ? [ruta] : [];
  });
}

/** Lo que cuenta el compilador cuando se rinde, cuando se salta una función o cuando falla. */
const DE_RENDIRSE = ['CompileError', 'CompileSkip', 'PipelineError'];

type Suceso = { kind: string; fnName?: string | null; memoSlots?: number };

/**
 * Pasa un fichero, o un trozo de código como si fuera ese fichero, por
 * babel-preset-expo, y devuelve lo que contó React Compiler y el código que sale.
 */
function compilar(fichero: string, fuente?: string): { sucesos: Suceso[]; codigo: string } {
  const sucesos: Suceso[] = [];
  const opciones = {
    babelrc: false,
    configFile: false,
    filename: fichero,
    presets: [
      [
        require.resolve('babel-preset-expo'),
        {
          'react-compiler': {
            panicThreshold: 'none',
            logger: { logEvent: (_fichero: string, suceso: Suceso) => sucesos.push(suceso) },
          },
        },
      ],
    ],
    // Lo que dice Metro de sí mismo al transformar para Android, con React Compiler.
    caller: { name: 'metro', bundler: 'metro', platform: 'android', supportsReactCompiler: true },
  } as TransformOptions;
  const resultado = fuente === undefined ? transformFileSync(fichero, opciones) : transformSync(fuente, opciones);
  return { sucesos, codigo: resultado?.code ?? '' };
}

describe('React Compiler', () => {
  it.each(ficheros(SRC).map((ruta) => relative(SRC, ruta).split(sep).join('/')))(
    'compila %s sin rendirse',
    (ruta) => {
      const { sucesos, codigo } = compilar(join(SRC, ruta));
      expect(sucesos.filter((suceso) => DE_RENDIRSE.includes(suceso.kind))).toEqual([]);
      // Y de verdad lo ha compilado: en un fichero de componentes, al menos uno.
      if (ruta.endsWith('.tsx')) expect(sucesos.map((suceso) => suceso.kind)).toContain('CompileSuccess');
      // Lo que memoriza llega al código que sale. Un «'use no memo'» arriba del
      // fichero cuenta lo compilado, pero lo tira.
      if (sucesos.some((suceso) => suceso.kind === 'CompileSuccess' && (suceso.memoSlots ?? 0) > 0)) {
        expect(codigo).toContain('react/compiler-runtime');
      }
    },
  );

  it('se rinde con un componente que rompe las reglas de los hooks, así que la prueba de arriba puede fallar', () => {
    const fuente = `
      import { useState } from 'react';
      import { Text } from 'react-native';
      export function Contador({ con }: { con: boolean }) {
        if (con) {
          const [n] = useState(0);
          return <Text>{n}</Text>;
        }
        return null;
      }
    `;
    const { sucesos } = compilar(join(SRC, 'componentes', 'Contador.tsx'), fuente);
    expect(sucesos.map((suceso) => suceso.kind)).toContain('CompileError');
  });
});

// La configuración de Jest. Es la del preset jest-expo con dos cambios:
// - Una zona horaria distinta de UTC antes de todas las pruebas, para notar
//   las fechas en UTC (src/pruebas/zonaHoraria.ts).
// - El código pasa por React Compiler, como en el móvil: jest-expo no se lo
//   pide a babel-preset-expo, y sin él las pruebas verían otro código.
const path = require('path');

const jestExpo = path.dirname(require.resolve('jest-expo/package.json'));
const preset = require('jest-expo/jest-preset');
const [babelJest, opciones] = preset.transform['\\.[jt]sx?$'];

module.exports = {
  preset: 'jest-expo',
  globalSetup: '<rootDir>/src/pruebas/zonaHoraria.ts',
  transform: {
    ...preset.transform,
    '\\.[jt]sx?$': [
      require.resolve(babelJest, { paths: [jestExpo] }),
      { ...opciones, caller: { ...opciones.caller, supportsReactCompiler: true } },
    ],
  },
};

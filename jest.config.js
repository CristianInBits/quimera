// La configuración de Jest. Es la del preset jest-expo con tres cambios:
// - Una zona horaria distinta de UTC antes de todas las pruebas, para notar
//   las fechas en UTC (src/pruebas/zonaHoraria.ts).
// - El código pasa por React Compiler, como en el móvil: jest-expo no se lo
//   pide a babel-preset-expo, y sin él las pruebas verían otro código.
// - Cada prueba, y cada gancho como beforeEach, tiene 30 s, en vez de los 5
//   de Jest. Sin su caché (en un clon nuevo, con otro Node, después de jest
//   --clearCache o con otra configuración, también al cambiar una opción de
//   este fichero, como testTimeout), cada proceso de Jest transforma con
//   Babel lo que React Native carga al pintar, sobre todo su renderer (React
//   Compiler no cuenta: no compila node_modules). Lo que un fichero de
//   pruebas no cargó al importarse lo paga su primera prueba que pinta, y los
//   procesos se quitan la CPU y la memoria. Las más lentas son las primeras
//   de TarjetaDeEsfuerzo y ResumenDelEntreno, cuyos ficheros no cargan el
//   renderer al importarse: la de TarjetaDeEsfuerzo tarda unos 2 s sola, de 7
//   a 13 s en la suite entera y unos 25 s con tres suites sin caché a la vez;
//   con cuatro, pasa de 30, y con 5 s fallaba.
const path = require('path');

const jestExpo = path.dirname(require.resolve('jest-expo/package.json'));
const preset = require('jest-expo/jest-preset');
const [babelJest, opciones] = preset.transform['\\.[jt]sx?$'];

module.exports = {
  preset: 'jest-expo',
  globalSetup: '<rootDir>/src/pruebas/zonaHoraria.ts',
  testTimeout: 30_000,
  transform: {
    ...preset.transform,
    '\\.[jt]sx?$': [
      require.resolve(babelJest, { paths: [jestExpo] }),
      { ...opciones, caller: { ...opciones.caller, supportsReactCompiler: true } },
    ],
  },
};

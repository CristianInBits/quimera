// La versión de la app que va en cada copia. Las pruebas de las pantallas
// simulan @/datos/movil entero, y el expo-constants de jest-expo no trae la
// versión de app.json: aquí se simula expo-constants.
describe('La versión de la app', () => {
  const version = () => jest.requireActual<{ VERSION_DE_LA_APP: string }>('@/datos/movil').VERSION_DE_LA_APP;

  it('sale de expoConfig.version, la de app.json, y si no la hay, «desconocida»', () => {
    jest.isolateModules(() => {
      jest.doMock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { name: 'Quimera', version: '1.2.3' } } }));
      expect(version()).toBe('1.2.3');
    });
    jest.isolateModules(() => {
      jest.doMock('expo-constants', () => ({ __esModule: true, default: { expoConfig: null } }));
      expect(version()).toBe('desconocida');
    });
  });
});

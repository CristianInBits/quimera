import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AvisoDeshacer } from '@/componentes/AvisoDeshacer';
import { PALETAS } from '@/tema/colores';

// En Android la app se dibuja hasta abajo, por detrás de la barra de los tres
// botones: si el aviso no la tiene en cuenta, la barra tapa «Deshacer».
describe('El aviso de deshacer', () => {
  it('dice lo que mide al pintarse, para que la pantalla le deje sitio debajo', async () => {
    const alMedir = jest.fn();
    await render(
      <SafeAreaProvider
        initialMetrics={{ frame: { x: 0, y: 0, width: 400, height: 800 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}
      >
        <AvisoDeshacer texto="Serie 1 quitada" alDeshacer={() => {}} alAcabar={() => {}} onLayout={alMedir} />
      </SafeAreaProvider>,
    );
    // fireEvent.layout no sube por el árbol: solo lo recibe la caja del aviso, como en el móvil.
    await fireEvent.layout(screen.getByTestId('aviso-deshacer'), { x: 16, y: 700, width: 358, height: 56 });
    expect(alMedir).toHaveBeenCalledTimes(1);
    expect(alMedir.mock.calls[0][0].nativeEvent.layout.height).toBe(56);
  });
  it('queda por encima de la barra de navegación del sistema', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 400, height: 800 },
          insets: { top: 24, right: 0, bottom: 48, left: 0 },
        }}
      >
        <AvisoDeshacer texto="Serie 1 quitada" alDeshacer={() => {}} alAcabar={() => {}} />
      </SafeAreaProvider>,
    );

    // El aviso es la caja que lleva el texto: 48 de la barra y 16 de margen.
    expect(screen.getByText('Serie 1 quitada').parent).toHaveStyle({ bottom: 64 });
  });

  it('«Deshacer» se lee sobre el aviso: va en el color del fondo, y el aviso en el del texto', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 400, height: 800 },
          insets: { top: 0, right: 0, bottom: 0, left: 0 },
        }}
      >
        <AvisoDeshacer texto="Serie 1 quitada" alDeshacer={() => {}} alAcabar={() => {}} />
      </SafeAreaProvider>,
    );
    expect(screen.getByText('Deshacer')).toHaveStyle({ color: PALETAS.claro.fondo });
    expect(screen.getByText('Serie 1 quitada').parent).toHaveStyle({ backgroundColor: PALETAS.claro.texto });
  });
});

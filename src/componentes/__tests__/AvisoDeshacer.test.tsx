import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
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

  it('flotando, deja a cada lado 16, el margen del editor, o el margen de su pantalla si se lo dan', async () => {
    const metricas = { frame: { x: 0, y: 0, width: 400, height: 800 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } };
    await render(
      <SafeAreaProvider initialMetrics={metricas}>
        <AvisoDeshacer texto="Serie 1 quitada" alDeshacer={() => {}} alAcabar={() => {}} />
        <AvisoDeshacer texto="Entreno de hoy borrado" margen={20} alDeshacer={() => {}} alAcabar={() => {}} />
      </SafeAreaProvider>,
    );
    const [delEditor, delHistorial] = screen.getAllByTestId('aviso-deshacer');
    expect(delEditor).toHaveStyle({ position: 'absolute', left: 16, right: 16 });
    expect(delHistorial).toHaveStyle({ position: 'absolute', left: 20, right: 20 });
  });

  it('en línea, en su sitio, no flota ni lleva márgenes a los lados', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{ frame: { x: 0, y: 0, width: 400, height: 800 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}
      >
        <AvisoDeshacer texto="Entreno de hoy borrado" enLinea margen={20} alDeshacer={() => {}} alAcabar={() => {}} />
      </SafeAreaProvider>,
    );
    const estilo = StyleSheet.flatten(screen.getByTestId('aviso-deshacer').props.style);
    expect(estilo).toMatchObject({ marginBottom: 12 });
    expect(estilo.position).toBeUndefined();
    expect(estilo.left).toBeUndefined();
    expect(estilo.right).toBeUndefined();
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

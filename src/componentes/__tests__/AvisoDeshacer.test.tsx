import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AvisoDeshacer } from '@/componentes/AvisoDeshacer';

// En Android la app se dibuja hasta abajo, por detrás de la barra de los tres
// botones: si el aviso no la tiene en cuenta, la barra tapa «Deshacer».
describe('El aviso de deshacer', () => {
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
});

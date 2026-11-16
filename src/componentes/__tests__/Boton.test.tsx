import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, useColorScheme } from 'react-native';

import { Boton, type VarianteDeBoton } from '@/componentes/Boton';
import { PALETAS, sombraDelBotonPrincipal } from '@/tema/colores';

/** El estilo de la caja del botón, sin pulsar. */
const caja = (nombre: string) => StyleSheet.flatten(screen.getByRole('button', { name: nombre }).props.style);
/** El estilo del texto del botón. */
const letra = (titulo: string) => StyleSheet.flatten(screen.getByText(titulo).props.style);

describe('Un botón', () => {
  it('es un botón con su título como nombre, o con la etiqueta si la lleva', async () => {
    const alPulsar = jest.fn();
    await render(
      <>
        <Boton titulo="Guardar" alPulsar={alPulsar} />
        <Boton titulo="Serie" etiqueta="Añadir una serie de Press banca" alPulsar={() => {}} />
      </>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(alPulsar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Añadir una serie de Press banca' })).toBeOnTheScreen();
  });

  it('deshabilitado, no hace nada, lo dice y el principal pierde su sombra', async () => {
    const alPulsar = jest.fn();
    await render(<Boton titulo="Guardar" variante="principal" deshabilitado alPulsar={alPulsar} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(alPulsar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    expect(caja('Guardar').boxShadow).toBeUndefined();
  });

  it('el principal lleva la sombra de su rosa, y los demás no', async () => {
    await render(
      <>
        <Boton titulo="Guardar" variante="principal" alPulsar={() => {}} />
        <Boton titulo="Corregir" variante="secundario" alPulsar={() => {}} />
      </>,
    );
    expect(caja('Guardar').boxShadow).toBe(sombraDelBotonPrincipal(PALETAS.claro));
    expect(caja('Corregir').boxShadow).toBeUndefined();
  });

  it('con otro color en un botón sin borde, como Deshacer en el aviso, lo lleva el texto y el borde sigue sin verse', async () => {
    await render(<Boton titulo="Deshacer" variante="sutil" color="#123456" alPulsar={() => {}} />);
    expect(letra('Deshacer')).toMatchObject({ color: '#123456' });
    expect(caja('Deshacer')).toMatchObject({ borderColor: 'transparent' });
  });

  it('con otro color en un botón con borde, lo llevan el texto y el borde', async () => {
    await render(<Boton titulo="Deshacer" variante="secundario" color="#123456" alPulsar={() => {}} />);
    expect(caja('Deshacer')).toMatchObject({ borderColor: '#123456' });
    expect(letra('Deshacer')).toMatchObject({ color: '#123456' });
  });

  it('el icono va delante del texto, en su color, y el lector de pantalla no lo lee', async () => {
    await render(<Boton titulo="Apuntar un entreno" icono="mas" variante="principal" alPulsar={() => {}} />);
    const boton = screen.getByRole('button', { name: 'Apuntar un entreno' });
    const icono = screen.getByTestId('icono-mas', { includeHiddenElements: true });
    const texto = screen.getByText('Apuntar un entreno');
    expect(boton.children.indexOf(icono)).toBeGreaterThanOrEqual(0);
    expect(boton.children.indexOf(icono)).toBeLessThan(boton.children.indexOf(texto));
    // Sobre el rosa del principal, el icono va en el color de encima del rosa, como el texto.
    expect(icono.props.tintColor).toBe(PALETAS.claro.sobrePrimario);
    expect(icono).not.toBeVisible();
    expect(texto).toBeVisible();
  });

  it('el texto se parte en líneas en vez de cortarse', async () => {
    await render(<Boton titulo="Igual que la anterior (70 kg × 8)" variante="contorno" alPulsar={() => {}} />);
    const texto = screen.getByText('Igual que la anterior (70 kg × 8)');
    expect(texto.props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(texto.props.style)).toMatchObject({ flexShrink: 1 });
  });
});

describe.each(['claro', 'oscuro'] as const)('Las clases de botón en modo %s', (modo) => {
  const paleta = PALETAS[modo];
  beforeEach(() => jest.mocked(useColorScheme).mockReturnValue(modo === 'oscuro' ? 'dark' : 'light'));
  afterEach(() => jest.mocked(useColorScheme).mockReturnValue('light'));

  it.each([
    ['principal', paleta.primario, paleta.primario, paleta.sobrePrimario],
    ['secundario', 'transparent', paleta.primario, paleta.primario],
    ['tonal', paleta.tintePrimario, paleta.tintePrimario, paleta.primarioTexto],
    ['contorno', paleta.superficie, paleta.bordeControl, paleta.texto],
    ['enlace', 'transparent', 'transparent', paleta.primario],
    ['sutil', 'transparent', 'transparent', paleta.textoTenue],
    ['error', 'transparent', 'transparent', paleta.error],
  ] as const)('%s: fondo, borde de 2 y texto de su clase, y nunca menos de 48', async (variante, fondo, borde, tinta) => {
    await render(<Boton titulo="Probar" variante={variante as VarianteDeBoton} alPulsar={() => {}} />);
    const estilo = caja('Probar');
    expect(estilo).toMatchObject({ backgroundColor: fondo, borderColor: borde, borderWidth: 2 });
    expect(estilo.minHeight).toBeGreaterThanOrEqual(48);
    expect(estilo.minWidth).toBeGreaterThanOrEqual(48);
    expect(letra('Probar')).toMatchObject({ color: tinta });
  });
});

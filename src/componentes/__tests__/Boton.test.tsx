import { fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet, useColorScheme } from 'react-native';

import { Boton, type VarianteDeBoton } from '@/componentes/Boton';
import { PALETAS, sombraDelBotonPrincipal } from '@/tema/colores';

/** El estilo de la caja del botón, sin pulsar. */
const caja = (nombre: string) => StyleSheet.flatten(screen.getByRole('button', { name: nombre }).props.style);
/** El estilo del texto del botón. */
const letra = (titulo: string) => StyleSheet.flatten(screen.getByText(titulo).props.style);
/** El lado de la caja de un icono: su tamaño por la escala de la letra, que en Jest vale lo que diga Dimensions. */
const ladoDelIcono = (nombre: string) =>
  StyleSheet.flatten(screen.getByTestId(`icono-${nombre}`, { includeHiddenElements: true }).props.style).width;

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

  it('el principal lleva la sombra de su rosa, y los demás no, ni siquiera el relleno', async () => {
    await render(
      <>
        <Boton titulo="Guardar" variante="principal" alPulsar={() => {}} />
        <Boton titulo="Corregir" variante="secundario" alPulsar={() => {}} />
        <Boton titulo="Hecha" variante="relleno" alPulsar={() => {}} />
      </>,
    );
    expect(caja('Guardar').boxShadow).toBe(sombraDelBotonPrincipal(PALETAS.claro));
    expect(caja('Corregir').boxShadow).toBeUndefined();
    expect(caja('Hecha').boxShadow).toBeUndefined();
  });

  it('el relleno es el de Hecha: más bajo que el principal, con su esquina de control, su relleno y un icono de 18', async () => {
    await render(<Boton titulo="Hecha" icono="hecha" variante="relleno" alPulsar={() => {}} />);
    expect(caja('Hecha')).toMatchObject({ minHeight: 52, borderRadius: 16, paddingHorizontal: 16, gap: 8 });
    expect(letra('Hecha')).toMatchObject({ fontSize: 16, fontWeight: '700' });
    expect(ladoDelIcono('hecha')).toBe(18 * Dimensions.get('window').fontScale);
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

  it('con iconoDetras, el icono va detrás del texto, como la marca de Hecha', async () => {
    await render(<Boton titulo="Hecha" icono="hecha" iconoDetras variante="relleno" alPulsar={() => {}} />);
    const boton = screen.getByRole('button', { name: 'Hecha' });
    const icono = screen.getByTestId('icono-hecha', { includeHiddenElements: true });
    const texto = screen.getByText('Hecha');
    expect(boton.children.indexOf(texto)).toBeGreaterThanOrEqual(0);
    expect(boton.children.indexOf(icono)).toBeGreaterThan(boton.children.indexOf(texto));
  });

  it('el enlace largo lleva el texto al principio de la línea y algo menos de peso; el enlace, centrado y en negrita', async () => {
    const titulo = 'Enlazar en superserie con Remo con mancuerna + Fondos en paralelas';
    await render(
      <>
        <Boton titulo={titulo} icono="enlazar" variante="enlaceLargo" alPulsar={() => {}} />
        <Boton titulo="Serie" icono="mas" variante="enlace" alPulsar={() => {}} />
      </>,
    );
    expect(caja(titulo)).toMatchObject({ justifyContent: 'flex-start' });
    expect(letra(titulo)).toMatchObject({ textAlign: 'left', fontWeight: '600' });
    expect(caja('Serie')).toMatchObject({ justifyContent: 'center' });
    expect(letra('Serie')).toMatchObject({ textAlign: 'center', fontWeight: '700' });
  });

  it('el de contorno lleva el icono en rosa y el texto en el color del texto; con otro color, lo lleva todo', async () => {
    await render(<Boton titulo="Igual que la anterior" icono="repetir" variante="contorno" alPulsar={() => {}} />);
    const icono = () => screen.getByTestId('icono-repetir', { includeHiddenElements: true });
    expect(icono().props.tintColor).toBe(PALETAS.claro.primario);
    expect(letra('Igual que la anterior')).toMatchObject({ color: PALETAS.claro.texto });
    // Su icono mide 18, como en la maqueta.
    expect(ladoDelIcono('repetir')).toBe(18 * Dimensions.get('window').fontScale);

    await render(
      <Boton titulo="Igual que la anterior" icono="repetir" variante="contorno" color="#123456" alPulsar={() => {}} />,
    );
    expect(icono().props.tintColor).toBe('#123456');
    expect(letra('Igual que la anterior')).toMatchObject({ color: '#123456' });
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
    ['relleno', paleta.primario, paleta.primario, paleta.sobrePrimario],
    ['secundario', 'transparent', paleta.primario, paleta.primario],
    ['tonal', paleta.tintePrimario, paleta.tintePrimario, paleta.primarioTexto],
    ['contorno', paleta.superficie, paleta.bordeControl, paleta.texto],
    ['enlace', 'transparent', 'transparent', paleta.primario],
    ['enlaceLargo', 'transparent', 'transparent', paleta.primario],
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

  it('el icono del contorno va en el rosa del modo, aunque el texto vaya en el color del texto', async () => {
    await render(<Boton titulo="Igual que la anterior" icono="repetir" variante="contorno" alPulsar={() => {}} />);
    expect(screen.getByTestId('icono-repetir', { includeHiddenElements: true }).props.tintColor).toBe(paleta.primario);
    expect(letra('Igual que la anterior')).toMatchObject({ color: paleta.texto });
  });
});

import { useLayoutEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { Icono } from '@/componentes/Icono';
import { usePaleta } from '@/tema/colores';
import { datos, esLetraGrande, espacio, radio, texto, toqueMinimo } from '@/tema/medidas';

/** El tamaño de la letra del número, cuando cabe. */
const LETRA = 22;
/** Lo más que se encoge la letra de un número que no cabe. */
const LETRA_MINIMA = 12;
/** El borde de la caja del número y de los botones. */
const BORDE = 2;
/**
 * El relleno de los lados de la caja del número: ninguno, porque el número
 * necesita todo el ancho. Hay que decirlo, porque Android pone uno a sus campos.
 */
const RELLENO = 0;
/** El hueco entre los botones y la caja del número. */
const HUECO = espacio[1];
/**
 * Lo que mide de ancho una cifra en negrita, en partes del tamaño de su letra:
 * en Roboto, la de Android, 0,56; con holgura, para que valga también para la
 * del iPhone.
 */
const ANCHO_DE_CIFRA = 0.58;
/** Lo que ocupa «62,5» en cifras: el número que tiene que caber siempre en su letra. */
const CIFRAS_MINIMAS = 3.5;
/** El tamaño del icono de los botones de menos y más, que crece con la letra del sistema. */
const ICONO_DEL_PASO = 20;

/** Lo que ocupa un número escrito, en cifras: la coma o el punto cuentan media. */
function cifrasDe(valor: string): number {
  return [...valor].reduce((cifras, letra) => cifras + (letra === ',' || letra === '.' ? 0.5 : 1), 0);
}

/**
 * Las cifras con las que se elige la letra de un número. Con decimales, con
 * sitio siempre para la coma y una cifra más: así, al dar pasos de 2,5 por
 * encima de 100 kg, 100, 102,5 y 105 van del mismo tamaño, y la letra no
 * crece y encoge a cada toque.
 */
function cifrasParaLaLetra(valor: string, decimales: boolean): number {
  const cifras = cifrasDe(valor);
  return decimales ? Math.max(cifras, cifrasDe(valor.split(/[,.]/)[0]) + 1.5) : cifras;
}

/**
 * Lo que mide de lado un botón de menos o de más: 48, o lo que pida su icono
 * si la letra del sistema es enorme, como con los tamaños de accesibilidad
 * del iPhone, con su borde y un poco de aire alrededor.
 */
function ladoDelPaso(fontScale: number): number {
  return Math.max(toqueMinimo, ICONO_DEL_PASO * fontScale + 2 * (BORDE + HUECO));
}

/** Lo que mide la caja del número en el campo más estrecho de una fila: lo justo para «62,5» en su letra. */
function cajaMinima(fontScale: number): number {
  return CIFRAS_MINIMAS * ANCHO_DE_CIFRA * LETRA * fontScale + 2 * (BORDE + RELLENO);
}

/**
 * Lo mínimo que mide un campo que va en fila con otros: los dos botones, sus
 * huecos y la caja del número, con sitio para «62,5» en una letra que crece
 * con la del sistema. Si en la fila no caben todos, se apilan. No depende del
 * número escrito: así los campos no cambian de sitio al teclear ni al dar
 * pasos, y un número más largo encoge su letra (letraQueCabe).
 */
export function anchoEnFila(fontScale: number): number {
  return 2 * ladoDelPaso(fontScale) + 2 * HUECO + cajaMinima(fontScale);
}

/**
 * El tamaño de la letra del número: el de siempre si cabe en su caja y, si
 * no, el más grande con el que cabe entero, como un peso de 102,5 en un campo
 * estrecho. Hasta saber lo que mide la caja se cuenta con la más estrecha que
 * puede tener en una fila.
 */
export function letraQueCabe(valor: string, caja: number | null, fontScale: number, decimales = false): number {
  const cifras = cifrasParaLaLetra(valor, decimales);
  if (cifras === 0) return LETRA;
  const sitio = (caja ?? cajaMinima(fontScale)) - 2 * (BORDE + RELLENO);
  return Math.max(LETRA_MINIMA, Math.min(LETRA, sitio / (cifras * ANCHO_DE_CIFRA * fontScale)));
}

/** Un botón redondo de menos o de más, en el rosa suave y con el borde rosa. */
function Paso({ sentido, etiqueta, alPulsar }: { sentido: 1 | -1; etiqueta: string; alPulsar: () => void }) {
  const paleta = usePaleta();
  const { fontScale } = useWindowDimensions();
  const lado = ladoDelPaso(fontScale);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={alPulsar}
      style={({ pressed }) => [
        estilos.paso,
        {
          width: lado,
          height: lado,
          borderRadius: lado / 2,
          backgroundColor: paleta.tintePrimario,
          borderColor: paleta.primario,
        },
        pressed && estilos.pulsado,
      ]}
    >
      <Icono nombre={sentido === 1 ? 'mas' : 'menos'} color={paleta.primario} tamano={ICONO_DEL_PASO} />
    </Pressable>
  );
}

/**
 * Un número con un menos y un más a los lados, y el teclado en medio por si
 * hay que saltar lejos: se apunta de pie, con una mano.
 */
export function CampoConPasos({
  etiqueta,
  etiquetaAccesible = etiqueta,
  valor,
  decimales = false,
  ayuda = null,
  enFila = false,
  alCambiar,
  alDarUnPaso,
}: {
  etiqueta: string;
  /** Lo que dice el lector de pantalla, si la etiqueta sola no basta para saber de qué es. */
  etiquetaAccesible?: string;
  valor: string;
  /** Si lleva coma decimal, como el peso o los kilómetros. */
  decimales?: boolean;
  /** Una línea debajo, como «1:30» para unos segundos. */
  ayuda?: string | null;
  /**
   * Si va en una fila con otros campos, que se parte cuando no caben
   * (flexWrap). Con la letra grande, cada uno ocupa la línea entera.
   */
  enFila?: boolean;
  alCambiar: (valor: string) => void;
  alDarUnPaso: (sentido: 1 | -1) => void;
}) {
  const paleta = usePaleta();
  const { fontScale } = useWindowDimensions();
  const entrada = useRef<ComponentRef<typeof TextInput>>(null);
  // Lo que mide la caja del número. Se mide antes de pintarse, para que el
  // número salga ya con su letra; onLayout sigue los cambios de ancho de después.
  const [caja, setCaja] = useState<number | null>(null);
  useLayoutEffect(() => {
    entrada.current?.measure((_x, _y, ancho) => {
      if (ancho > 0) setCaja(ancho);
    });
  }, []);
  return (
    <View
      testID="campo-con-pasos"
      style={[
        estilos.campo,
        enFila && {
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: esLetraGrande(fontScale) ? '100%' : anchoEnFila(fontScale),
        },
      ]}
    >
      <Text style={[estilos.etiqueta, { color: paleta.textoTenue }]}>{etiqueta}</Text>
      <View testID="controles" style={estilos.controles}>
        <Paso sentido={-1} etiqueta={`Bajar ${etiquetaAccesible}`} alPulsar={() => alDarUnPaso(-1)} />
        <TextInput
          ref={entrada}
          accessibilityLabel={etiquetaAccesible}
          value={valor}
          onChangeText={alCambiar}
          onLayout={(evento) => setCaja(evento.nativeEvent.layout.width)}
          keyboardType={decimales ? 'decimal-pad' : 'number-pad'}
          selectTextOnFocus
          style={[
            datos,
            estilos.entrada,
            {
              fontSize: letraQueCabe(valor, caja, fontScale, decimales),
              color: paleta.texto,
              backgroundColor: paleta.campo,
              borderColor: paleta.bordeControl,
            },
          ]}
        />
        <Paso sentido={1} etiqueta={`Subir ${etiquetaAccesible}`} alPulsar={() => alDarUnPaso(1)} />
      </View>
      {ayuda !== null && <Text style={[estilos.ayuda, { color: paleta.textoTenue }]}>{ayuda}</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: {
    gap: espacio[1],
    // En una fila, si una etiqueta ocupa dos líneas, los números siguen a la misma altura.
    justifyContent: 'flex-end',
  },
  etiqueta: {
    marginLeft: espacio[1],
    fontSize: texto.s,
  },
  controles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HUECO,
  },
  paso: {
    borderWidth: BORDE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entrada: {
    flex: 1,
    minHeight: 52,
    borderWidth: BORDE,
    borderRadius: radio.control,
    paddingHorizontal: RELLENO,
    paddingVertical: 0,
    fontWeight: '700',
    textAlign: 'center',
  },
  ayuda: {
    fontSize: texto.s,
    textAlign: 'center',
  },
  pulsado: {
    opacity: 0.7,
  },
});

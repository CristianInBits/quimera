import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Icono } from '@/componentes/Icono';
import { ladoDeLaMarca, MarcaDeDisciplina } from '@/componentes/MarcaDeDisciplina';
import { NOMBRE_DE_DISCIPLINA } from '@/datos/entrenos';
import { fechaEnFrase, textoDeFecha } from '@/datos/fechas';
import type { EntradaDelHistorial } from '@/datos/historial';
import { palabraDelEsfuerzo, textoDeMinutos } from '@/gimnasio/editor';
import { sombraDeEntreno, usePaleta } from '@/tema/colores';
import { datos, esLetraGrande, espacio, radio, texto, toqueMinimo } from '@/tema/medidas';

import { resumenDelContenido } from './textos';

/**
 * Un entreno en el historial: una tarjeta teñida del color de su disciplina,
 * con su marca y su nombre, cuándo fue, lo que se hizo y cuánto duró y costó.
 * Se toca entera para abrir su detalle, y la flecha lo dice.
 *
 * Lo que se hizo ocupa como mucho dos líneas, y lo que no quepa acaba en
 * puntos suspensivos. Con la letra grande, en dos líneas no cabría casi nada:
 * ocupa las que haga falta. El lector de pantalla lo lee todo en una frase,
 * con la fecha entera.
 */
export function TarjetaDeEntreno({
  entrada,
  hoy,
  alPulsar,
}: {
  entrada: EntradaDelHistorial;
  hoy: string;
  alPulsar: () => void;
}) {
  const paleta = usePaleta();
  const { fontScale } = useWindowDimensions();
  const grande = esLetraGrande(fontScale);
  const colores = paleta.disciplina[entrada.disciplina];
  const nombre = NOMBRE_DE_DISCIPLINA[entrada.disciplina];
  const cuando = `${textoDeFecha(entrada.fecha, hoy)}${entrada.hora === null ? '' : `, ${entrada.hora}`}`;
  const contenido = resumenDelContenido(entrada.ejercicios, entrada.metros);
  const cuanto = `${textoDeMinutos(entrada.minutos)} · esfuerzo ${entrada.esfuerzo}, ${palabraDelEsfuerzo(entrada.esfuerzo)}`;
  // Para el lector de pantalla, la fecha entera y comas en vez de puntos medios.
  const paraLeer = [
    `${nombre}, ${fechaEnFrase(entrada.fecha, hoy)}${entrada.hora === null ? '' : `, a las ${entrada.hora}`}`,
    contenido,
    cuanto,
  ]
    .filter((parte) => parte !== null)
    .map((parte) => parte.split(' · ').join(', '))
    .join('. ');
  return (
    <Pressable
      testID="entreno"
      accessibilityRole="button"
      accessibilityLabel={paraLeer}
      onPress={alPulsar}
      style={({ pressed }) => [
        estilos.tarjeta,
        { backgroundColor: colores.tinte, borderColor: colores.borde, boxShadow: sombraDeEntreno(paleta) },
        pressed && estilos.pulsado,
      ]}
    >
      <View style={estilos.textos}>
        <View testID="cabecera-del-entreno" style={estilos.cabecera}>
          <MarcaDeDisciplina disciplina={entrada.disciplina} tamano="historial" />
          <Text style={[datos, estilos.cuando, { color: paleta.texto }]}>
            <Text style={estilos.nombre}>{nombre}</Text> · {cuando}
          </Text>
        </View>
        {contenido !== null && (
          <Text numberOfLines={grande ? undefined : 2} style={[estilos.contenido, { color: paleta.texto }]}>
            {contenido}
          </Text>
        )}
        <Text style={[datos, estilos.cuanto, { color: paleta.textoTenue }]}>{cuanto}</Text>
      </View>
      <Icono nombre="siguiente" color={paleta.textoTenue} tamano={20} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    minHeight: toqueMinimo,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[3],
    // El borde va por dentro: con él, lo de dentro empieza a 14 por arriba y por
    // abajo, a 16 a la izquierda y a 12 a la derecha, como en la maqueta.
    paddingVertical: 13,
    paddingLeft: 15,
    paddingRight: 11,
    borderWidth: 1,
    borderRadius: radio.grande,
  },
  textos: {
    flex: 1,
    gap: 2,
  },
  // La marca va arriba, y el nombre y la fecha, en líneas de su alto: en una
  // línea quedan centrados con ella, como en la maqueta, y si no caben y se
  // parten, la marca va con la primera. Las dos crecen con la letra del
  // sistema casi al mismo paso hasta el 200 % de Android y el xxxLarge del
  // iPhone; con los tamaños de accesibilidad del iPhone, la línea crece más
  // deprisa y la marca queda algo por encima de su centro.
  cabecera: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacio[2],
  },
  cuando: {
    flexShrink: 1,
    fontSize: texto.m,
    fontWeight: '500',
    lineHeight: ladoDeLaMarca('historial'),
  },
  nombre: {
    fontWeight: '700',
  },
  contenido: {
    fontSize: 15,
  },
  cuanto: {
    fontSize: texto.s,
  },
  pulsado: {
    opacity: 0.7,
  },
});

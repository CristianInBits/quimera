import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Icono } from '@/componentes/Icono';
import { NOMBRE_DE_DISCIPLINA, type Disciplina } from '@/datos/entrenos';
import { textoDeMinutos } from '@/gimnasio/editor';
import { cifra } from '@/inicio/comparar';
import { usePaleta } from '@/tema/colores';
import { datos, esLetraGrande, espacio, radio } from '@/tema/medidas';

/**
 * Los minutos de una disciplina en la semana, en una ficha teñida de su color
 * con su icono y su nombre: el color nunca va solo. Para el lector de
 * pantalla es una sola cosa, «Gimnasio, 118 minutos». Con la letra grande,
 * cada ficha ocupa todo el ancho, para que el nombre no se parta.
 */
export function FichaDeDisciplina({ disciplina, minutos }: { disciplina: Disciplina; minutos: number }) {
  const paleta = usePaleta();
  const { fontScale } = useWindowDimensions();
  const colores = paleta.disciplina[disciplina];
  const nombre = NOMBRE_DE_DISCIPLINA[disciplina];
  // Encima del rosa del gimnasio, el icono va en la tinta de encima del rosa, como la maqueta.
  const tinta = colores.marca === paleta.primario ? paleta.sobrePrimario : paleta.sobreMarca;
  return (
    <View
      accessible
      accessibilityLabel={`${nombre}, ${textoDeMinutos(minutos)}`}
      style={[
        estilos.ficha,
        { backgroundColor: colores.tinte, borderColor: colores.borde, flexBasis: esLetraGrande(fontScale) ? '100%' : 140 },
      ]}
    >
      <View style={estilos.cabecera}>
        {/* Sin ancho fijo: crece con el icono, que crece con la letra. */}
        <View testID="marca-de-disciplina" style={[estilos.marca, { backgroundColor: colores.marca }]}>
          <Icono nombre={disciplina} color={tinta} tamano={18} />
        </View>
        <Text style={[estilos.nombre, { color: paleta.texto }]}>{nombre}</Text>
      </View>
      <Text style={{ color: paleta.texto }}>
        <Text style={[datos, estilos.cifra]}>{cifra(minutos)}</Text>
        <Text style={[estilos.unidad, { color: paleta.textoTenue }]}>{minutos === 1 ? ' minuto' : ' minutos'}</Text>
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  ficha: {
    flexGrow: 1,
    flexShrink: 1,
    gap: 6,
    paddingVertical: espacio[3],
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: radio.boton,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[2],
  },
  marca: {
    minWidth: 28,
    minHeight: 28,
    padding: 5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nombre: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  cifra: {
    fontSize: 24,
    fontWeight: '700',
  },
  unidad: {
    fontSize: 15,
    fontWeight: '500',
  },
});

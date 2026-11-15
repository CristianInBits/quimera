import { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Boton } from '@/componentes/Boton';
import { GRUPOS, GRUPOS_DEL_GIMNASIO, type Grupo } from '@/datos/catalogo';
import type { Ejercicio } from '@/datos/ejercicios';
import { usePaleta } from '@/tema/colores';
import { espacio, radio, texto, titulos, toqueMinimo } from '@/tema/medidas';

/**
 * Elegir un ejercicio de una lista, nunca escribirlo: con texto libre, el mismo
 * ejercicio escrito de dos formas serían dos ejercicios. Primero el grupo y
 * después el ejercicio, a toques.
 */
export function SelectorDeEjercicio({
  visible,
  ejercicios,
  color,
  alElegir,
  alCerrar,
}: {
  visible: boolean;
  ejercicios: readonly Ejercicio[];
  color: string;
  alElegir: (ejercicio: Ejercicio) => void;
  alCerrar: () => void;
}) {
  const paleta = usePaleta();
  const [grupo, setGrupo] = useState<Grupo>(GRUPOS_DEL_GIMNASIO[0]);
  const delGrupo = ejercicios.filter((e) => e.grupo === grupo);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={alCerrar}>
      <SafeAreaView style={[estilos.pantalla, { backgroundColor: paleta.fondo }]}>
        <View style={estilos.cabecera}>
          <Text accessibilityRole="header" dynamicTypeRamp="largeTitle" style={[estilos.titulo, { color: paleta.texto }]}>
            Elige un ejercicio
          </Text>
          <Boton titulo="Cerrar" alPulsar={alCerrar} variante="sutil" />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={estilos.filaDeGrupos}
          contentContainerStyle={estilos.grupos}
        >
          {GRUPOS_DEL_GIMNASIO.map((g) => {
            const elegido = g === grupo;
            return (
              <Pressable
                key={g}
                accessibilityRole="tab"
                accessibilityState={{ selected: elegido }}
                onPress={() => setGrupo(g)}
                style={[
                  estilos.grupo,
                  { borderColor: elegido ? color : paleta.textoTenue, backgroundColor: elegido ? color : 'transparent' },
                ]}
              >
                <Text style={[estilos.textoDelGrupo, { color: elegido ? paleta.fondo : paleta.texto }]}>{GRUPOS[g]}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <FlatList
          data={delGrupo}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => alElegir(item)}
              style={({ pressed }) => [estilos.ejercicio, { borderColor: paleta.bordeSuave }, pressed && { opacity: 0.6 }]}
            >
              <Text style={[estilos.nombre, { color: paleta.texto }]}>{item.nombre}</Text>
              {item.porMancuerna && <Text style={[estilos.nota, { color: paleta.textoTenue }]}>Peso por mancuerna</Text>}
              {item.mide.includes('tiempo') && <Text style={[estilos.nota, { color: paleta.textoTenue }]}>En segundos</Text>}
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: espacio[4],
    paddingTop: espacio[2],
  },
  titulo: {
    ...titulos.pantalla,
    flexShrink: 1,
  },
  // Sin esto, la fila de grupos se estira y se reparte el alto con la lista.
  filaDeGrupos: {
    flexGrow: 0,
  },
  grupos: {
    gap: espacio[2],
    paddingHorizontal: espacio[4],
    paddingVertical: espacio[3],
  },
  grupo: {
    minHeight: toqueMinimo,
    paddingHorizontal: espacio[4],
    borderRadius: radio.control,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  textoDelGrupo: {
    fontSize: texto.m,
    fontWeight: '600',
  },
  ejercicio: {
    minHeight: toqueMinimo + espacio[2],
    paddingHorizontal: espacio[4],
    paddingVertical: espacio[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  nombre: {
    fontSize: texto.m,
  },
  nota: {
    fontSize: texto.s,
  },
});

import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Mascota } from '@/componentes/Mascota';
import { leerAjuste } from '@/datos/ajustes';
import type { Disciplina } from '@/datos/entrenos';
import { usePuerta } from '@/datos/usarBase';
import { CLAVE_DEL_BORRADOR, leerBorrador } from '@/gimnasio/editor';
import { usePaleta } from '@/tema/colores';
import { espacio, radio, texto, toqueMinimo } from '@/tema/medidas';

// Qué entreno apuntar. Las disciplinas llegan de una en una: por ahora solo
// el gimnasio; las demás salen para que se vea lo que viene.
const DISCIPLINAS: { id: Disciplina; nombre: string; lista: boolean }[] = [
  { id: 'gimnasio', nombre: 'Gimnasio', lista: true },
  { id: 'hyrox', nombre: 'Hyrox', lista: false },
  { id: 'calistenia', nombre: 'Calistenia', lista: false },
  { id: 'carrera', nombre: 'Carrera', lista: false },
  { id: 'natacion', nombre: 'Natación', lista: false },
];

export default function Apuntar() {
  const puerta = usePuerta();
  const paleta = usePaleta();
  // La lista llega hasta abajo, por detrás de la barra de navegación de Android.
  const margenes = useSafeAreaInsets();
  const [aMedias, setAMedias] = useState(false);

  // Al volver del editor, el borrador puede haber cambiado.
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      void puerta
        .leer((l) => leerAjuste(l, CLAVE_DEL_BORRADOR))
        .then((valor) => {
          if (vivo) setAMedias(leerBorrador(valor) !== null);
        });
      return () => {
        vivo = false;
      };
    }, [puerta]),
  );

  return (
    <ScrollView
      style={{ backgroundColor: paleta.fondo }}
      contentContainerStyle={[estilos.contenido, { paddingBottom: margenes.bottom + espacio[4] }]}
    >
      <Stack.Screen options={{ headerShown: true, title: 'Apuntar un entreno' }} />
      {DISCIPLINAS.map((d) => {
        const color = paleta.disciplina[d.id];
        return (
          <Pressable
            key={d.id}
            accessibilityRole="button"
            accessibilityState={{ disabled: !d.lista }}
            accessibilityLabel={!d.lista ? `${d.nombre}, pronto` : aMedias ? `${d.nombre}, tienes uno a medias` : d.nombre}
            disabled={!d.lista}
            onPress={() => router.navigate('/apuntar/gimnasio')}
            style={({ pressed }) => [
              estilos.disciplina,
              { borderColor: d.lista ? color : paleta.borde },
              pressed && estilos.pulsado,
            ]}
          >
            <View style={[estilos.marca, { backgroundColor: d.lista ? color : paleta.borde }]} />
            {d.lista && <Mascota disciplina={d.id} tamano={56} />}
            <View style={estilos.textos}>
              <Text style={[estilos.nombre, { color: d.lista ? paleta.texto : paleta.textoTenue }]}>{d.nombre}</Text>
              {!d.lista && <Text style={[estilos.nota, { color: paleta.textoTenue }]}>Pronto</Text>}
              {d.lista && aMedias && (
                <Text style={[estilos.nota, { color: paleta.texto }]}>Tienes uno a medias: sigue donde lo dejaste</Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: {
    padding: espacio[4],
    gap: espacio[3],
  },
  disciplina: {
    minHeight: toqueMinimo + espacio[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[3],
    borderWidth: 1.5,
    borderRadius: radio,
    paddingRight: espacio[4],
    overflow: 'hidden',
  },
  marca: {
    width: espacio[2],
    alignSelf: 'stretch',
  },
  textos: {
    flex: 1,
    paddingVertical: espacio[3],
  },
  nombre: {
    fontSize: texto.l,
    fontWeight: '700',
  },
  nota: {
    fontSize: texto.s,
  },
  pulsado: {
    opacity: 0.7,
  },
});

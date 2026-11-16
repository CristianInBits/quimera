import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EscenarioDeLaMascota, type ProporcionesDelEscenario } from '@/componentes/EscenarioDeLaMascota';
import { Icono } from '@/componentes/Icono';
import { leerAjuste } from '@/datos/ajustes';
import { NOMBRE_DE_DISCIPLINA, type Disciplina } from '@/datos/entrenos';
import { usePuerta } from '@/datos/usarBase';
import { CLAVE_DEL_BORRADOR, leerBorrador } from '@/gimnasio/editor';
import { sombraDeTarjetaQueSeAbre, usePaleta } from '@/tema/colores';
import { esLetraGrande, espacio, radio, titulos } from '@/tema/medidas';

/** El lado del círculo de fuera del escenario de cada mascota. */
const ESCENARIO = 120;
/** Las proporciones de la maqueta para Apuntar: el dibujo algo más pequeño y sin asomar por arriba. */
const PROPORCIONES_DE_APUNTAR: ProporcionesDelEscenario = { arriba: 0.133, interior: 0.733, dibujo: 1.1, alzado: -0.025 };

// Qué entreno apuntar. Las disciplinas llegan de una en una: por ahora solo el
// gimnasio, en una tarjeta ancha; las demás salen debajo, de dos en dos, para
// que se vea lo que viene, con su mascota y «Pronto».
const PRONTO: Disciplina[] = ['hyrox', 'calistenia', 'carrera', 'natacion'];

export default function Apuntar() {
  const puerta = usePuerta();
  const paleta = usePaleta();
  const { fontScale } = useWindowDimensions();
  // Con la letra grande, lo que va en fila se apila, para que los nombres no se partan.
  const grande = esLetraGrande(fontScale);
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

  const gimnasio = paleta.disciplina.gimnasio;
  const nombreDelGimnasio = (
    <View style={estilos.nombre}>
      <View testID="punto" style={[estilos.punto, { backgroundColor: gimnasio.marca }]} />
      <Text style={[estilos.nombreDelGimnasio, { color: paleta.texto }]}>{NOMBRE_DE_DISCIPLINA.gimnasio}</Text>
    </View>
  );
  const aviso = aMedias && (
    <Text style={[estilos.aMedias, { color: paleta.texto }]}>Tienes uno a medias: sigue donde lo dejaste</Text>
  );
  const flecha = <Icono nombre="siguiente" color={paleta.primario} tamano={22} />;

  return (
    <ScrollView
      style={{ backgroundColor: paleta.fondo }}
      contentContainerStyle={[estilos.contenido, { paddingBottom: margenes.bottom + espacio[8] }]}
    >
      <Stack.Screen options={{ headerShown: true, title: 'Apuntar un entreno' }} />
      <Pressable
        testID="gimnasio"
        accessibilityRole="button"
        accessibilityLabel={aMedias ? 'Gimnasio, tienes uno a medias' : 'Gimnasio'}
        onPress={() => router.navigate('/apuntar/gimnasio')}
        style={({ pressed }) => [
          estilos.gimnasio,
          grande && estilos.gimnasioApilado,
          { backgroundColor: gimnasio.tinte, borderColor: gimnasio.marca, boxShadow: sombraDeTarjetaQueSeAbre(paleta) },
          pressed && estilos.pulsado,
        ]}
      >
        <EscenarioDeLaMascota disciplina="gimnasio" tamano={ESCENARIO} proporciones={PROPORCIONES_DE_APUNTAR} />
        {grande ? (
          // El rinoceronte arriba; debajo, el nombre con la flecha y, a todo el ancho, el aviso.
          <View style={estilos.textosApilados}>
            <View style={estilos.filaDelNombre}>
              {nombreDelGimnasio}
              {flecha}
            </View>
            {aviso}
          </View>
        ) : (
          <>
            <View style={estilos.textos}>
              {nombreDelGimnasio}
              {aviso}
            </View>
            {flecha}
          </>
        )}
      </Pressable>

      <View testID="rejilla" style={estilos.rejilla}>
        {PRONTO.map((disciplina) => {
          const colores = paleta.disciplina[disciplina];
          const nombre = NOMBRE_DE_DISCIPLINA[disciplina];
          return (
            <Pressable
              key={disciplina}
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              accessibilityLabel={`${nombre}, pronto`}
              disabled
              style={[
                estilos.pronto,
                { backgroundColor: colores.tinte, borderColor: colores.borde, flexBasis: grande ? '100%' : '45%' },
              ]}
            >
              <EscenarioDeLaMascota disciplina={disciplina} tamano={ESCENARIO} proporciones={PROPORCIONES_DE_APUNTAR} />
              <View style={estilos.nombre}>
                <View testID="punto" style={[estilos.punto, { backgroundColor: colores.marca }]} />
                <Text style={[estilos.nombreDeOtra, { color: paleta.texto }]}>{nombre}</Text>
              </View>
              <Text style={[estilos.pastilla, { backgroundColor: paleta.pastilla, color: paleta.textoTenue }]}>Pronto</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  contenido: {
    paddingHorizontal: espacio[4],
    paddingTop: espacio[2],
    gap: espacio[3],
  },
  gimnasio: {
    minHeight: 156,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[3],
    paddingVertical: espacio[2],
    paddingLeft: espacio[2],
    paddingRight: espacio[3],
    borderWidth: 2,
    borderRadius: radio.tarjeta,
  },
  gimnasioApilado: {
    flexDirection: 'column',
    paddingHorizontal: espacio[4],
    paddingBottom: espacio[4],
  },
  textos: {
    flex: 1,
    gap: espacio[1],
  },
  textosApilados: {
    alignSelf: 'stretch',
    gap: espacio[1],
  },
  filaDelNombre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacio[2],
  },
  nombre: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[2],
  },
  punto: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  nombreDelGimnasio: {
    ...titulos.cabecera,
    flexShrink: 1,
  },
  aMedias: {
    fontSize: 15,
    fontWeight: '500',
  },
  rejilla: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacio[3],
  },
  pronto: {
    flexGrow: 1,
    alignItems: 'center',
    gap: espacio[1],
    paddingTop: espacio[2],
    paddingHorizontal: 10,
    paddingBottom: 14,
    borderWidth: 1,
    borderRadius: radio.tarjeta,
  },
  nombreDeOtra: {
    ...titulos.semana,
    flexShrink: 1,
  },
  pastilla: {
    marginTop: 2,
    paddingVertical: 3,
    paddingHorizontal: espacio[3],
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: 13,
    fontWeight: '700',
  },
  pulsado: {
    opacity: 0.7,
  },
});

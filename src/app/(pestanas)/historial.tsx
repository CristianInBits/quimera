import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvisoDeshacer } from '@/componentes/AvisoDeshacer';
import { useHoy } from '@/componentes/useHoy';
import { ponerAjusteEn } from '@/datos/ajustes';
import { restaurarEntrenoEn } from '@/datos/entrenos';
import { textoDeSemana } from '@/datos/fechas';
import { leerHistorial, type EntradaDelHistorial } from '@/datos/historial';
import { usePuerta } from '@/datos/usarBase';
import { claveDeCorreccion, textoDeMinutos } from '@/gimnasio/editor';
import { TarjetaDeEntreno } from '@/historial/TarjetaDeEntreno';
import { recogerElBorrado, type Borrado } from '@/historial/ultimoBorrado';
import { usePaleta } from '@/tema/colores';
import { datos, espacio, texto, titulos } from '@/tema/medidas';

/** El margen de los lados de la pantalla. */
const MARGEN = espacio[5];
/** El hueco entre dos entrenos de una semana, el mismo que hay bajo la cabecera de la semana. */
const HUECO = 10;

type Semana = { lunes: string; titulo: string; minutos: number; data: EntradaDelHistorial[] };

/** Los entrenos, que llegan del más reciente al más antiguo, agrupados por semanas de lunes a domingo. */
function porSemanas(entradas: EntradaDelHistorial[], hoy: string): Semana[] {
  const semanas: Semana[] = [];
  for (const entrada of entradas) {
    const ultima = semanas[semanas.length - 1];
    if (ultima !== undefined && ultima.lunes === entrada.lunes) {
      ultima.data.push(entrada);
      ultima.minutos += entrada.minutos;
    } else {
      semanas.push({ lunes: entrada.lunes, titulo: textoDeSemana(entrada.lunes, hoy), minutos: entrada.minutos, data: [entrada] });
    }
  }
  return semanas;
}

/**
 * El historial: los entrenos por semanas, del más reciente al más antiguo. Al
 * tocar uno se abre su detalle, desde donde se corrige o se borra. Las dos
 * pestañas están montadas a la vez, así que la lista se vuelve a leer cada vez
 * que se enseña.
 */
export default function Historial() {
  const puerta = usePuerta();
  const paleta = usePaleta();
  const hoy = useHoy();
  const [entradas, setEntradas] = useState<EntradaDelHistorial[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deshacer, setDeshacer] = useState<Borrado | null>(null);

  const leer = useCallback(
    () =>
      puerta
        .leer(leerHistorial)
        .then((leidas) => {
          setEntradas(leidas);
          setError(null);
        })
        .catch((e: unknown) => setError(`No se pudo leer el historial. (${String(e)})`)),
    [puerta],
  );

  useFocusEffect(
    useCallback(() => {
      // Un entreno que se acaba de borrar en su detalle se puede deshacer aquí.
      const borrado = recogerElBorrado();
      if (borrado !== null) setDeshacer(borrado);
      void leer();
    }, [leer]),
  );

  const restaurar = (borrado: Borrado) => {
    setDeshacer(null);
    puerta
      .escribir(async (tx) => {
        const ahora = Date.now();
        await restaurarEntrenoEn(tx, borrado.id, ahora);
        // Su corrección a medias, si tenía, vuelve a su sitio.
        if (borrado.correccion !== undefined) await ponerAjusteEn(tx, claveDeCorreccion(borrado.id), borrado.correccion, ahora);
      })
      .then(leer)
      .catch((e: unknown) => setError(`No se pudo deshacer el borrado. (${String(e)})`));
  };

  const semanas = entradas === null ? [] : porSemanas(entradas, hoy);
  const primera = semanas[0]?.lunes;
  // En Android el aviso flota abajo, cerca del pulgar, como en el editor. En el
  // iPhone la lista pasa por debajo de la barra de pestañas, que lo taparía, y
  // va arriba, en su sitio.
  const aviso =
    deshacer === null ? null : (
      <AvisoDeshacer
        enLinea={Platform.OS === 'ios'}
        margen={MARGEN}
        texto={deshacer.aviso}
        alDeshacer={() => restaurar(deshacer)}
        alAcabar={() => setDeshacer(null)}
      />
    );

  return (
    <SafeAreaView testID="historial" edges={['top']} style={[estilos.pantalla, { backgroundColor: paleta.fondo }]}>
      <Text accessibilityRole="header" dynamicTypeRamp="largeTitle" style={[estilos.titulo, { color: paleta.texto }]}>
        Historial
      </Text>
      {Platform.OS === 'ios' && aviso}
      {error !== null && <Text style={[estilos.error, { color: paleta.error }]}>{error}</Text>}
      {entradas !== null && entradas.length === 0 ? (
        <View style={estilos.vacio}>
          <Text style={[estilos.aviso, { color: paleta.textoTenue }]}>Aquí saldrán tus entrenos cuando apuntes el primero.</Text>
        </View>
      ) : (
        <SectionList
          sections={semanas}
          keyExtractor={(entrada) => entrada.id}
          // En el iPhone, el final de la lista queda por encima de la barra de
          // pestañas: las pestañas nativas solo lo hacen solas con el primer hijo.
          contentInsetAdjustmentBehavior="automatic"
          stickySectionHeadersEnabled={false}
          contentContainerStyle={estilos.lista}
          renderSectionHeader={({ section }) => (
            // Si el título y la suma no caben en una línea, la suma baja debajo del título.
            <View testID="semana" style={[estilos.semana, section.lunes !== primera && estilos.otraSemana]}>
              <Text accessibilityRole="header" style={[estilos.tituloDeSemana, { color: paleta.texto }]}>
                {section.titulo}
              </Text>
              <Text style={[datos, estilos.sumaDeSemana, { color: paleta.textoTenue }]}>
                {section.data.length === 1 ? '1 entreno' : `${section.data.length} entrenos`} · {textoDeMinutos(section.minutos)}
              </Text>
            </View>
          )}
          ItemSeparatorComponent={Separacion}
          renderItem={({ item }) => (
            <TarjetaDeEntreno
              entrada={item}
              hoy={hoy}
              alPulsar={() => router.navigate({ pathname: '/entreno/[id]', params: { id: item.id } })}
            />
          )}
        />
      )}
      {Platform.OS !== 'ios' && aviso}
    </SafeAreaView>
  );
}

/** El hueco entre dos entrenos de la misma semana. */
function Separacion() {
  return <View testID="separacion" style={estilos.separacion} />;
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    paddingHorizontal: MARGEN,
  },
  titulo: {
    ...titulos.pantalla,
    letterSpacing: -0.2,
    paddingTop: espacio[3],
    paddingBottom: 14,
  },
  error: {
    fontSize: texto.m,
    marginBottom: espacio[3],
  },
  vacio: {
    flex: 1,
    justifyContent: 'center',
  },
  aviso: {
    fontSize: texto.m,
    textAlign: 'center',
  },
  lista: {
    paddingBottom: espacio[8],
  },
  semana: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    columnGap: espacio[3],
    paddingBottom: HUECO,
  },
  /** La primera semana va justo debajo del título; las demás, separadas de la de antes. */
  otraSemana: {
    paddingTop: 22,
  },
  tituloDeSemana: {
    ...titulos.semana,
    flexShrink: 1,
  },
  sumaDeSemana: {
    fontSize: texto.s,
  },
  separacion: {
    height: HUECO,
  },
});

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvisoDeshacer } from '@/componentes/AvisoDeshacer';
import { useHoy } from '@/componentes/useHoy';
import { ponerAjusteEn } from '@/datos/ajustes';
import { NOMBRE_DE_DISCIPLINA, restaurarEntrenoEn } from '@/datos/entrenos';
import { fechaEnFrase, textoDeFecha, textoDeSemana } from '@/datos/fechas';
import { leerHistorial, type EntradaDelHistorial } from '@/datos/historial';
import { usePuerta } from '@/datos/usarBase';
import { claveDeCorreccion, palabraDelEsfuerzo, textoDeMinutos } from '@/gimnasio/editor';
import { resumenDelContenido } from '@/historial/textos';
import { recogerElBorrado, type Borrado } from '@/historial/ultimoBorrado';
import { usePaleta } from '@/tema/colores';
import { datos, espacio, texto, titulos, toqueMinimo } from '@/tema/medidas';

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
  // En Android el aviso flota abajo, cerca del pulgar, como en el editor. En el
  // iPhone la lista pasa por debajo de la barra de pestañas, que lo taparía, y
  // va arriba, en su sitio.
  const aviso =
    deshacer === null ? null : (
      <AvisoDeshacer
        enLinea={Platform.OS === 'ios'}
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
            <View style={estilos.semana}>
              <Text accessibilityRole="header" style={[estilos.tituloDeSemana, { color: paleta.texto }]}>
                {section.titulo}
              </Text>
              <Text style={[estilos.sumaDeSemana, { color: paleta.textoTenue }]}>
                {section.data.length === 1 ? '1 entreno' : `${section.data.length} entrenos`} · {textoDeMinutos(section.minutos)}
              </Text>
            </View>
          )}
          renderItem={({ item }) => <FilaDeEntreno entrada={item} hoy={hoy} />}
        />
      )}
      {Platform.OS !== 'ios' && aviso}
    </SafeAreaView>
  );
}

function FilaDeEntreno({ entrada, hoy }: { entrada: EntradaDelHistorial; hoy: string }) {
  const paleta = usePaleta();
  const cuando = `${textoDeFecha(entrada.fecha, hoy)}${entrada.hora === null ? '' : `, ${entrada.hora}`}`;
  const contenido = resumenDelContenido(entrada.ejercicios, entrada.metros);
  const cuanto = `${textoDeMinutos(entrada.minutos)} · esfuerzo ${entrada.esfuerzo}, ${palabraDelEsfuerzo(entrada.esfuerzo)}`;
  const nombre = NOMBRE_DE_DISCIPLINA[entrada.disciplina];
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
      accessibilityRole="button"
      accessibilityLabel={paraLeer}
      onPress={() => router.navigate({ pathname: '/entreno/[id]', params: { id: entrada.id } })}
      style={({ pressed }) => [estilos.fila, pressed && estilos.pulsado]}
    >
      <View style={[estilos.marca, { backgroundColor: paleta.disciplina[entrada.disciplina].marca }]} />
      <View style={estilos.textos}>
        <Text style={[estilos.cuando, { color: paleta.texto }]}>
          {nombre} · {cuando}
        </Text>
        {contenido !== null && (
          <Text numberOfLines={1} style={[estilos.contenido, { color: paleta.texto }]}>
            {contenido}
          </Text>
        )}
        <Text style={[datos, estilos.cuanto, { color: paleta.textoTenue }]}>{cuanto}</Text>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    paddingHorizontal: espacio[4],
  },
  titulo: {
    ...titulos.pantalla,
    paddingVertical: espacio[4],
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
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: espacio[2],
    paddingTop: espacio[4],
    paddingBottom: espacio[2],
  },
  tituloDeSemana: {
    ...titulos.semana,
    flexShrink: 1,
  },
  sumaDeSemana: {
    fontSize: texto.s,
  },
  fila: {
    minHeight: toqueMinimo,
    flexDirection: 'row',
    gap: espacio[3],
    paddingVertical: espacio[2],
  },
  marca: {
    width: espacio[1],
    borderRadius: espacio[1],
  },
  textos: {
    flex: 1,
    gap: 2,
  },
  cuando: {
    fontSize: texto.m,
    fontWeight: '600',
  },
  contenido: {
    fontSize: texto.m,
  },
  cuanto: {
    fontSize: texto.s,
  },
  pulsado: {
    opacity: 0.7,
  },
});

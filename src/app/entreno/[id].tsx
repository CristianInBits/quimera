import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton } from '@/componentes/Boton';
import { TituloConMarca } from '@/componentes/TituloConMarca';
import { useHoy } from '@/componentes/useHoy';
import { leerAjuste, quitarAjusteLocalEn } from '@/datos/ajustes';
import { leerEjerciciosPorClave, type Ejercicio } from '@/datos/ejercicios';
import { NOMBRE_DE_DISCIPLINA, borrarEntrenoEn, leerEntreno, type EntrenoGuardado } from '@/datos/entrenos';
import { fechaEnFrase } from '@/datos/fechas';
import { usePuerta } from '@/datos/usarBase';
import { claveDeCorreccion, leerBorrador } from '@/gimnasio/editor';
import { BloqueGuardado } from '@/historial/BloqueGuardado';
import { ResumenDelEntreno } from '@/historial/ResumenDelEntreno';
import { avisarDelBorrado } from '@/historial/ultimoBorrado';
import { usePaleta } from '@/tema/colores';
import { espacio, radio, texto, titulos } from '@/tema/medidas';

type Leido = {
  /** Null si no existe o está borrado. */
  entreno: EntrenoGuardado | null;
  /** Los ejercicios del entreno, por su clave. */
  ejercicios: Map<string, Ejercicio>;
  /** Si hay una corrección a medias de este entreno en el móvil. */
  corrigiendo: boolean;
};

/**
 * Un entreno guardado, entero, con lo necesario para corregirlo o borrarlo.
 * Arriba, su resumen; debajo, cada bloque en su tarjeta, las notas y los
 * botones. Borrar no pregunta: el entreno desaparece del historial y allí sale
 * el aviso para deshacerlo. Se vuelve a leer cada vez que se enseña, porque al
 * volver de corregirlo ha cambiado.
 */
export default function DetalleDelEntreno() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const puerta = usePuerta();
  const paleta = usePaleta();
  const hoy = useHoy();
  const margenes = useSafeAreaInsets();
  const [leido, setLeido] = useState<Leido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [errorAlBorrar, setErrorAlBorrar] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      puerta
        .leer(async (l): Promise<Leido> => {
          const entreno = await leerEntreno(l, id);
          const ids = entreno?.bloques.flatMap((bloque) => bloque.series.map((serie) => serie.ejercicioId)) ?? [];
          const ejercicios = await leerEjerciciosPorClave(l, ids);
          const borrador = leerBorrador(await leerAjuste(l, claveDeCorreccion(id)));
          return { entreno, ejercicios, corrigiendo: borrador !== null && borrador.id === id };
        })
        .then((nuevo) => {
          if (!vivo) return;
          setLeido(nuevo);
          // Lo que falló antes ya no vale con el entreno releído, como al volver de corregirlo.
          setError(null);
          setErrorAlBorrar(null);
        })
        .catch((e: unknown) => {
          if (vivo) setError(`No se pudo leer el entreno. (${String(e)})`);
        });
      return () => {
        vivo = false;
      };
    }, [puerta, id]),
  );

  const entreno = leido?.entreno ?? null;
  const disciplina = entreno?.disciplina ?? null;
  const nombre = disciplina === null ? null : NOMBRE_DE_DISCIPLINA[disciplina];
  // Mientras se lee, la cabecera va sin título, para no enseñar uno que cambie
  // enseguida; si no se puede leer, o el entreno ya no está, «Entreno».
  const titulo = leido === null && error === null ? '' : (nombre ?? 'Entreno');
  // Con el entreno leído, su disciplina va con su marca delante del título,
  // como en el editor. En Android, la pila recibe un título vacío, para que el
  // título con su marca empiece justo después de la flecha. Las opciones se
  // juntan con las de antes: sin disciplina, headerTitle tiene que quitar la
  // marca que hubiera. Al detalle se llega desde el historial: el botón atrás
  // del iPhone lo dice.
  const opciones = {
    headerShown: true,
    title: disciplina !== null && Platform.OS === 'android' ? '' : titulo,
    headerTitle: disciplina === null ? undefined : () => <TituloConMarca disciplina={disciplina} titulo={titulo} />,
    headerBackTitle: 'Historial',
  };
  // Con el título vacío, TalkBack no tiene qué decir al abrir la pantalla: se le
  // dice el nombre de la disciplina, una vez, al leerse el entreno.
  useEffect(() => {
    if (Platform.OS === 'android' && nombre !== null) AccessibilityInfo.announceForAccessibility(nombre);
  }, [nombre]);
  // Si no se puede borrar, se dice junto a los botones, donde se ha pulsado, y se anuncia.
  useEffect(() => {
    if (errorAlBorrar !== null) AccessibilityInfo.announceForAccessibility(errorAlBorrar);
  }, [errorAlBorrar]);

  const borrar = (guardado: EntrenoGuardado) => {
    setBorrando(true);
    setErrorAlBorrar(null);
    const clave = claveDeCorreccion(guardado.id);
    puerta
      .escribir(async (tx) => {
        // Su corrección a medias se aparta con él: vuelve si se deshace el borrado.
        const correccion = await leerAjuste(tx, clave);
        if (correccion !== undefined) await quitarAjusteLocalEn(tx, clave);
        await borrarEntrenoEn(tx, guardado.id, Date.now());
        return correccion;
      })
      .then((correccion) => {
        const cuando = fechaEnFrase(guardado.fecha, hoy);
        const de = cuando === 'hoy' || cuando === 'ayer' ? `de ${cuando}` : `del ${cuando}`;
        avisarDelBorrado({ id: guardado.id, aviso: `Entreno ${de} borrado`, correccion });
        router.dismissTo('/historial');
      })
      .catch((e: unknown) => {
        setBorrando(false);
        setErrorAlBorrar(`No se pudo borrar el entreno. (${String(e)})`);
      });
  };

  return (
    <View style={[estilos.pantalla, { backgroundColor: paleta.fondo }]}>
      <Stack.Screen options={opciones} />
      <ScrollView
        testID="detalle"
        contentContainerStyle={[estilos.contenido, { paddingBottom: margenes.bottom + espacio[8] }]}
      >
        {error !== null && <Text style={[estilos.error, { color: paleta.error }]}>{error}</Text>}
        {leido !== null && entreno === null && (
          <Text style={[estilos.aviso, { color: paleta.textoTenue }]}>Este entreno ya no está: se ha borrado.</Text>
        )}
        {entreno !== null && leido !== null && (
          <>
            <ResumenDelEntreno entreno={entreno} hoy={hoy} />

            {entreno.bloques.map((bloque) => (
              <BloqueGuardado key={bloque.id} bloque={bloque} ejercicios={leido.ejercicios} />
            ))}

            {entreno.notas !== null && (
              <View testID="notas" style={estilos.notas}>
                <Text accessibilityRole="header" style={[estilos.tituloDeNotas, { color: paleta.texto }]}>
                  Notas
                </Text>
                <View
                  testID="caja-de-notas"
                  style={[estilos.cajaDeNotas, { backgroundColor: paleta.superficie, borderColor: paleta.bordeSuave }]}
                >
                  <Text style={[estilos.textoDeNotas, { color: paleta.texto }]}>{entreno.notas}</Text>
                </View>
              </View>
            )}

            <View testID="botones" style={estilos.botones}>
              {errorAlBorrar !== null && (
                <Text accessibilityLiveRegion="polite" style={[estilos.error, { color: paleta.error }]}>
                  {errorAlBorrar}
                </Text>
              )}
              {/* Por ahora solo el gimnasio tiene editor. */}
              {entreno.disciplina === 'gimnasio' && (
                <Boton
                  titulo={leido.corrigiendo ? 'Seguir corrigiendo' : 'Corregir'}
                  variante="secundario"
                  deshabilitado={borrando}
                  alPulsar={() => router.navigate({ pathname: '/apuntar/gimnasio', params: { corregir: entreno.id } })}
                />
              )}
              <Boton
                titulo={borrando ? 'Borrando' : 'Borrar entreno'}
                variante="error"
                deshabilitado={borrando}
                alPulsar={() => borrar(entreno)}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
  },
  contenido: {
    paddingTop: espacio[2],
    paddingHorizontal: espacio[4],
    gap: espacio[3],
  },
  error: {
    fontSize: texto.m,
  },
  aviso: {
    fontSize: texto.m,
    textAlign: 'center',
    marginTop: espacio[8],
  },
  // Las notas y los botones van algo más separados de lo de encima, como en la maqueta.
  notas: {
    marginTop: espacio[1],
    gap: espacio[2],
  },
  tituloDeNotas: titulos.seccion,
  cajaDeNotas: {
    paddingVertical: espacio[3],
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: radio.boton,
  },
  textoDeNotas: {
    fontSize: texto.m,
  },
  botones: {
    marginTop: espacio[1],
    gap: espacio[1],
  },
});

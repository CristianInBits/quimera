import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton } from '@/componentes/Boton';
import { Mascota } from '@/componentes/Mascota';
import { useHoy } from '@/componentes/useHoy';
import { leerAjuste, quitarAjusteLocalEn } from '@/datos/ajustes';
import { leerEjerciciosPorClave } from '@/datos/ejercicios';
import { NOMBRE_DE_DISCIPLINA, borrarEntrenoEn, leerEntreno, type EntrenoGuardado } from '@/datos/entrenos';
import { fechaEnFrase, textoDeFecha } from '@/datos/fechas';
import { usePuerta } from '@/datos/usarBase';
import { claveDeCorreccion, leerBorrador, palabraDelEsfuerzo } from '@/gimnasio/editor';
import { BloqueGuardado } from '@/historial/BloqueGuardado';
import { textoDelTiempoGuardado } from '@/historial/textos';
import { avisarDelBorrado } from '@/historial/ultimoBorrado';
import { usePaleta } from '@/tema/colores';
import { datos, espacio, texto, titulos } from '@/tema/medidas';

const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

type Leido = {
  /** Null si no existe o está borrado. */
  entreno: EntrenoGuardado | null;
  nombres: Map<string, string>;
  /** Si hay una corrección a medias de este entreno en el móvil. */
  corrigiendo: boolean;
};

/**
 * Un entreno guardado, entero, con lo necesario para corregirlo o borrarlo.
 * Borrar no pregunta: el entreno desaparece del historial y allí sale el aviso
 * para deshacerlo. Se vuelve a leer cada vez que se enseña, porque al volver de
 * corregirlo ha cambiado.
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

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      puerta
        .leer(async (l): Promise<Leido> => {
          const entreno = await leerEntreno(l, id);
          const ids = entreno?.bloques.flatMap((bloque) => bloque.series.map((serie) => serie.ejercicioId)) ?? [];
          const ejercicios = await leerEjerciciosPorClave(l, ids);
          const borrador = leerBorrador(await leerAjuste(l, claveDeCorreccion(id)));
          return {
            entreno,
            nombres: new Map([...ejercicios.values()].map((ejercicio) => [ejercicio.id, ejercicio.nombre])),
            corrigiendo: borrador !== null && borrador.id === id,
          };
        })
        .then((nuevo) => {
          if (vivo) setLeido(nuevo);
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
  const titulo = entreno === null ? 'Entreno' : NOMBRE_DE_DISCIPLINA[entreno.disciplina];

  const borrar = (guardado: EntrenoGuardado) => {
    setBorrando(true);
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
        setError(`No se pudo borrar el entreno. (${String(e)})`);
      });
  };

  return (
    <View style={[estilos.pantalla, { backgroundColor: paleta.fondo }]}>
      {/* Al detalle se llega desde el historial: el botón atrás del iPhone lo dice. */}
      <Stack.Screen options={{ headerShown: true, title: titulo, headerBackTitle: 'Historial' }} />
      <ScrollView contentContainerStyle={[estilos.contenido, { paddingBottom: margenes.bottom + espacio[8] }]}>
        {error !== null && <Text style={[estilos.error, { color: paleta.error }]}>{error}</Text>}
        {leido !== null && entreno === null && (
          <Text style={[estilos.aviso, { color: paleta.textoTenue }]}>Este entreno ya no está: se ha borrado.</Text>
        )}
        {entreno !== null && leido !== null && (
          <>
            <View style={estilos.cabecera}>
              <View style={estilos.resumen}>
                <Text
                  accessibilityLabel={`${conMayuscula(fechaEnFrase(entreno.fecha, hoy))}${entreno.hora === null ? '' : `, a las ${entreno.hora}`}`}
                  style={[datos, estilos.cuando, { color: paleta.texto }]}
                >
                  {textoDeFecha(entreno.fecha, hoy)}
                  {entreno.hora === null ? '' : `, ${entreno.hora}`}
                </Text>
                <Text style={[datos, estilos.dato, { color: paleta.texto }]}>{textoDelTiempoGuardado(entreno.duracionMs)}</Text>
                <Text style={[estilos.esfuerzo, { color: paleta.texto }]}>
                  Esfuerzo {entreno.esfuerzo}, {palabraDelEsfuerzo(entreno.esfuerzo)}
                </Text>
              </View>
              <Mascota disciplina={entreno.disciplina} esfuerzo={entreno.esfuerzo} tamano={72} />
            </View>

            {entreno.bloques.map((bloque) => (
              <BloqueGuardado
                key={bloque.id}
                bloque={bloque}
                nombres={leido.nombres}
                color={paleta.disciplina[entreno.disciplina].texto}
              />
            ))}

            {entreno.notas !== null && (
              <View style={estilos.notas}>
                <Text style={[estilos.tituloDeNotas, { color: paleta.texto }]}>Notas</Text>
                <Text style={[estilos.textoDeNotas, { color: paleta.texto }]}>{entreno.notas}</Text>
              </View>
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
    padding: espacio[4],
    gap: espacio[4],
  },
  error: {
    fontSize: texto.m,
  },
  aviso: {
    fontSize: texto.m,
    textAlign: 'center',
    marginTop: espacio[8],
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[3],
  },
  resumen: {
    flex: 1,
    gap: espacio[1],
  },
  cuando: {
    fontSize: texto.l,
    fontWeight: '600',
  },
  dato: {
    fontSize: texto.xl,
  },
  esfuerzo: {
    fontSize: texto.m,
  },
  notas: {
    gap: espacio[1],
  },
  tituloDeNotas: titulos.seccion,
  textoDeNotas: {
    fontSize: texto.m,
  },
});

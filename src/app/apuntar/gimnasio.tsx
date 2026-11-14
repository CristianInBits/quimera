import { Stack, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvisoDeshacer } from '@/componentes/AvisoDeshacer';
import { Boton } from '@/componentes/Boton';
import { CampoDeFecha } from '@/componentes/CampoDeFecha';
import { EvitarTeclado } from '@/componentes/EvitarTeclado';
import { SelectorDeEsfuerzo } from '@/componentes/SelectorDeEsfuerzo';
import { useHoy } from '@/componentes/useHoy';
import { leerAjuste, ponerAjusteEn, quitarAjusteLocalEn } from '@/datos/ajustes';
import { GRUPOS_DEL_GIMNASIO } from '@/datos/catalogo';
import { leerEjercicios, leerEjerciciosPorClave, type Ejercicio } from '@/datos/ejercicios';
import { EntrenoCambiado, EntrenoNoValido, guardarEntrenoEn } from '@/datos/entrenos';
import { nuevoId } from '@/datos/movil';
import { usePuerta } from '@/datos/usarBase';
import { BloqueDeEjercicio } from '@/gimnasio/BloqueDeEjercicio';
import {
  CLAVE_DEL_BORRADOR,
  MINUTOS_MEDIDOS_MINIMOS,
  anadirEjercicio,
  cambiarEntreno,
  empezarAhoraSiVacio,
  entrenoNuevo,
  leerBorrador,
  minutosMedidos,
  textoDeMinutos,
  tieneAlgo,
  validar,
  type EntrenoEnEdicion,
} from '@/gimnasio/editor';
import { SelectorDeEjercicio } from '@/gimnasio/SelectorDeEjercicio';
import { usePaleta } from '@/tema/colores';
import { datos, espacio, radio, texto, toqueMinimo } from '@/tema/medidas';

/** Dónde se aparta un borrador que esta versión no sabe leer, para no perderlo. */
const CLAVE_DEL_ILEGIBLE = `${CLAVE_DEL_BORRADOR}.ilegible`;

type Cambio = (e: EntrenoEnEdicion) => EntrenoEnEdicion;

/**
 * Apuntar un entreno de gimnasio, en directo o después. Todo lo que se escribe
 * se guarda solo como borrador en este móvil, así que cerrar la app no pierde
 * nada: al volver, el entreno sigue donde estaba.
 */
export default function ApuntarGimnasio() {
  const puerta = usePuerta();
  const paleta = usePaleta();
  const hoy = useHoy();
  // Lo que tapan las barras del sistema: la pantalla llega hasta abajo, por
  // detrás de la barra de navegación de Android y de la raya del iPhone.
  const margenes = useSafeAreaInsets();
  const color = paleta.disciplina.gimnasio;
  const [elegibles, setElegibles] = useState<Ejercicio[] | null>(null);
  const [retirados, setRetirados] = useState<Ejercicio[]>([]);
  const [entreno, setEntreno] = useState<EntrenoEnEdicion | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [sinBorrador, setSinBorrador] = useState(false);
  const [apartado, setApartado] = useState(false);
  const [deshacer, setDeshacer] = useState<{ texto: string; anterior: EntrenoEnEdicion } | null>(null);
  // Después de guardar o descartar, el borrador no se vuelve a escribir.
  const cerrado = useRef(false);
  // Lo último que falta por guardar como borrador, y lo último que se ve.
  const pendiente = useRef<EntrenoEnEdicion | null>(null);
  const ultimo = useRef<EntrenoEnEdicion | null>(null);
  const lista = useRef<ComponentRef<typeof ScrollView>>(null);
  const desplazado = useRef(0);

  useEffect(() => {
    let vivo = true;
    puerta
      .leer(async (l) => {
        const valor = await leerAjuste(l, CLAVE_DEL_BORRADOR);
        const borrador = leerBorrador(valor);
        const ids = borrador?.bloques.map((bloque) => bloque.ejercicioId) ?? [];
        return {
          elegibles: await leerEjercicios(l),
          porClave: await leerEjerciciosPorClave(l, ids),
          borrador,
          ilegible: valor !== undefined && borrador === null ? valor : undefined,
        };
      })
      .then(async (leido) => {
        if (leido.ilegible !== undefined) {
          // Uno que no se puede leer, quizá de otra versión, se aparta en vez de pisarlo.
          const ilegible = leido.ilegible;
          await puerta.escribir(async (tx) => {
            await ponerAjusteEn(tx, CLAVE_DEL_ILEGIBLE, ilegible, Date.now());
            await quitarAjusteLocalEn(tx, CLAVE_DEL_BORRADOR);
          });
        }
        if (vivo) {
          setElegibles(leido.elegibles);
          setRetirados([...leido.porClave.values()]);
          setEntreno(leido.borrador ?? entrenoNuevo(nuevoId, new Date()));
          setApartado(leido.ilegible !== undefined);
        }
      })
      .catch((error: unknown) => setErrores([`No se pudo abrir el editor: ${String(error)}`]));
    return () => {
      vivo = false;
    };
  }, [puerta]);

  /**
   * Escribe el borrador, pero solo el suyo: si el que hay guardado es de otro
   * entreno (por ejemplo, de otro editor abierto encima), no lo toca.
   */
  const guardarBorrador = useCallback(
    (e: EntrenoEnEdicion) =>
      puerta
        .escribir(async (tx) => {
          const guardado = leerBorrador(await leerAjuste(tx, CLAVE_DEL_BORRADOR));
          if (guardado !== null && guardado.id !== e.id) return;
          if (tieneAlgo(e)) await ponerAjusteEn(tx, CLAVE_DEL_BORRADOR, e, Date.now());
          else if (guardado !== null) await quitarAjusteLocalEn(tx, CLAVE_DEL_BORRADOR);
        })
        .then(() => setSinBorrador(false))
        .catch(() => setSinBorrador(true)),
    [puerta],
  );

  // El borrador se escribe un momento después del último cambio, y también al
  // salir de la pantalla, para no perder lo último que se tecleó.
  useEffect(() => {
    if (entreno === null) return;
    ultimo.current = entreno;
    if (cerrado.current) return;
    pendiente.current = entreno;
    const temporizador = setTimeout(() => {
      const e = pendiente.current;
      pendiente.current = null;
      if (e !== null && !cerrado.current) void guardarBorrador(e);
    }, 400);
    return () => clearTimeout(temporizador);
  }, [entreno, guardarBorrador]);

  useEffect(
    () => () => {
      const e = pendiente.current;
      if (e !== null && !cerrado.current) void guardarBorrador(e);
    },
    [guardarBorrador],
  );

  useEffect(() => {
    if (errores.length > 0) AccessibilityInfo.announceForAccessibility(errores[0]);
  }, [errores]);

  const cambiar = useCallback((cambio: Cambio) => {
    setEntreno((e) => (e === null ? e : cambio(e)));
    setErrores([]);
  }, []);

  /**
   * Desplaza lo justo para que se vea entera una franja de la ventana, como el
   * panel de una serie, por encima de la barra del sistema y del aviso de deshacer.
   */
  const asegurarVisible = useCallback(
    (desdeArriba: number, alto: number) => {
      const visible = Dimensions.get('window').height - margenes.bottom - espacio[8] * 2;
      const sobra = desdeArriba + alto - visible;
      if (sobra > 0) lista.current?.scrollTo({ y: desplazado.current + sobra, animated: true });
    },
    [margenes.bottom],
  );

  if (entreno === null || elegibles === null) {
    return (
      <View style={[estilos.pantalla, { backgroundColor: paleta.fondo }]}>
        <Stack.Screen options={{ headerShown: true, title: 'Gimnasio' }} />
        {errores.map((error, i) => (
          <Text key={i} style={[estilos.error, { color: paleta.error }]}>
            {error}
          </Text>
        ))}
      </View>
    );
  }

  const porId = new Map([...retirados, ...elegibles].map((e) => [e.id, e]));
  const medidos = minutosMedidos(entreno);

  const quitar = (que: string, cambio: Cambio) => {
    setDeshacer({ texto: que, anterior: entreno });
    cambiar(cambio);
  };

  const guardar = async () => {
    const resultado = validar(entreno, porId, hoy);
    if (resultado.errores) {
      setErrores(resultado.errores);
      return;
    }
    cerrado.current = true;
    pendiente.current = null;
    setGuardando(true);
    try {
      await puerta.escribir(async (tx) => {
        await guardarEntrenoEn(tx, resultado.entreno, { ahora: Date.now(), selloLeido: entreno.selloLeido });
        await quitarAjusteLocalEn(tx, CLAVE_DEL_BORRADOR);
      });
      router.dismissTo('/');
    } catch (error) {
      cerrado.current = false;
      setGuardando(false);
      // Lo tecleado justo antes de Guardar, o mientras se guardaba, vuelve al borrador.
      if (ultimo.current !== null) void guardarBorrador(ultimo.current);
      setErrores([
        error instanceof EntrenoNoValido
          ? error.problemas.join(' ')
          : error instanceof EntrenoCambiado
            ? 'Este entreno ya estaba guardado. Descarta este borrador y, si hace falta, corrige el guardado.'
            : `No se pudo guardar el entreno. Lo apuntado sigue aquí. (${String(error)})`,
      ]);
    }
  };

  const descartar = () => {
    Alert.alert('¿Descartar este entreno?', 'Se borra todo lo apuntado, y no se puede recuperar.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: () => {
          cerrado.current = true;
          pendiente.current = null;
          puerta
            .escribir((tx) => quitarAjusteLocalEn(tx, CLAVE_DEL_BORRADOR))
            .then(() => {
              if (router.canGoBack()) router.back();
              else router.replace('/');
            })
            .catch((error: unknown) => {
              cerrado.current = false;
              setErrores([`No se pudo descartar el entreno. (${String(error)})`]);
            });
        },
      },
    ]);
  };

  return (
    <View style={[estilos.pantalla, { backgroundColor: paleta.fondo }]}>
      <Stack.Screen options={{ headerShown: true, title: 'Gimnasio' }} />
      <EvitarTeclado style={estilos.pantalla}>
        <ScrollView
          ref={lista}
          // Abajo queda sitio para la barra del sistema y, encima, para el aviso de deshacer.
          contentContainerStyle={[estilos.contenido, { paddingBottom: margenes.bottom + espacio[8] * 3 }]}
          keyboardShouldPersistTaps="handled"
          onScroll={(evento) => {
            desplazado.current = evento.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={32}
        >
          {apartado && (
            <Text style={[estilos.ayuda, { color: paleta.textoTenue }]}>
              Había un entreno a medias que esta versión de Quimera no sabe leer. Lo he guardado aparte, sin borrarlo.
            </Text>
          )}

          <CampoDeFecha
            fecha={entreno.fecha}
            hora={entreno.hora}
            hoy={hoy}
            alCambiar={(fecha, hora) => cambiar((e) => cambiarEntreno(e, { fecha, hora }))}
          />

          {entreno.bloques.map((bloque) => (
            <BloqueDeEjercicio
              key={bloque.id}
              bloque={bloque}
              ejercicio={porId.get(bloque.ejercicioId)}
              elegida={elegida}
              alElegir={setElegida}
              cambiar={cambiar}
              quitar={quitar}
              asegurarVisible={asegurarVisible}
              nuevoId={nuevoId}
              color={color}
            />
          ))}

          <Boton titulo="+ Añadir ejercicio" variante="secundario" color={color} alPulsar={() => setEligiendo(true)} />

          <View style={estilos.seccion}>
            <Text style={[estilos.titulo, { color: paleta.texto }]}>Duración</Text>
            <View style={estilos.minutos}>
              <TextInput
                accessibilityLabel="Duración en minutos"
                value={entreno.minutos}
                placeholder={medidos !== null && medidos >= MINUTOS_MEDIDOS_MINIMOS ? String(medidos) : ''}
                placeholderTextColor={paleta.textoTenue}
                onChangeText={(minutos) => cambiar((e) => cambiarEntreno(e, { minutos }))}
                keyboardType="number-pad"
                style={[datos, estilos.entrada, { color: paleta.texto, borderColor: paleta.textoTenue }]}
              />
              <Text style={[estilos.unidad, { color: paleta.texto }]}>minutos</Text>
            </View>
            <Text style={[estilos.ayuda, { color: paleta.textoTenue }]}>
              {entreno.minutos.trim() !== ''
                ? 'La que has escrito.'
                : medidos === null
                  ? 'Escríbela, o marca las series como hechas mientras entrenas y se medirá sola.'
                  : medidos < MINUTOS_MEDIDOS_MINIMOS
                    ? `Las series marcadas solo cubren ${textoDeMinutos(medidos)}: escribe la duración.`
                    : `${textoDeMinutos(medidos)} entre la primera serie hecha y la última. Si fue más, escríbelo.`}
            </Text>
          </View>

          <View style={estilos.seccion}>
            <Text style={[estilos.titulo, { color: paleta.texto }]}>Esfuerzo</Text>
            <SelectorDeEsfuerzo
              valor={entreno.esfuerzo}
              color={color}
              alCambiar={(esfuerzo) => cambiar((e) => cambiarEntreno(e, { esfuerzo }))}
            />
          </View>

          <View style={estilos.seccion}>
            <Text style={[estilos.titulo, { color: paleta.texto }]}>Notas</Text>
            <TextInput
              accessibilityLabel="Notas"
              value={entreno.notas}
              onChangeText={(notas) => cambiar((e) => cambiarEntreno(e, { notas }))}
              multiline
              maxLength={4000}
              style={[estilos.notas, { color: paleta.texto, borderColor: paleta.textoTenue }]}
            />
          </View>

          {errores.length > 0 && (
            <View accessibilityLiveRegion="polite" style={estilos.errores}>
              {errores.map((error, i) => (
                <Text key={i} style={[estilos.error, { color: paleta.error }]}>
                  {error}
                </Text>
              ))}
            </View>
          )}
          {sinBorrador && (
            <Text style={[estilos.error, { color: paleta.error }]}>
              No se ha podido guardar el borrador: si cierras la app, se perderá lo último.
            </Text>
          )}

          <Boton
            titulo={guardando ? 'Guardando' : 'Guardar'}
            variante="principal"
            color={color}
            deshabilitado={guardando}
            alPulsar={() => void guardar()}
          />
          <Boton titulo="Descartar este entreno" variante="sutil" color={paleta.error} alPulsar={descartar} />
        </ScrollView>
      </EvitarTeclado>

      {deshacer !== null && (
        <AvisoDeshacer
          texto={deshacer.texto}
          alDeshacer={() => {
            const anterior = deshacer.anterior;
            setDeshacer(null);
            cambiar(() => anterior);
          }}
          alAcabar={() => setDeshacer(null)}
        />
      )}

      <SelectorDeEjercicio
        visible={eligiendo}
        ejercicios={elegibles.filter((e) => GRUPOS_DEL_GIMNASIO.some((g) => g === e.grupo))}
        color={color}
        alElegir={(ejercicio) => {
          const idDelBloque = nuevoId();
          const idDeLaSerie = nuevoId();
          cambiar((e) => anadirEjercicio(empezarAhoraSiVacio(e, new Date()), ejercicio.id, idDelBloque, idDeLaSerie));
          setElegida(idDeLaSerie);
          setEligiendo(false);
        }}
        alCerrar={() => setEligiendo(false)}
      />
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
  seccion: {
    gap: espacio[2],
  },
  titulo: {
    fontSize: texto.l,
    fontWeight: '700',
  },
  minutos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[3],
  },
  entrada: {
    width: 120,
    minHeight: toqueMinimo,
    borderWidth: 1.5,
    borderRadius: radio,
    fontSize: texto.xl,
    textAlign: 'center',
  },
  unidad: {
    fontSize: texto.m,
  },
  ayuda: {
    fontSize: texto.s,
  },
  notas: {
    minHeight: toqueMinimo * 2,
    borderWidth: 1.5,
    borderRadius: radio,
    padding: espacio[3],
    fontSize: texto.m,
    textAlignVertical: 'top',
  },
  errores: {
    gap: espacio[1],
  },
  error: {
    fontSize: texto.m,
  },
});

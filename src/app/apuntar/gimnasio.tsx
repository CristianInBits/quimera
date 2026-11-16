import { Stack, router, useLocalSearchParams } from 'expo-router';
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
import { Mascota } from '@/componentes/Mascota';
import { SelectorDeEsfuerzo } from '@/componentes/SelectorDeEsfuerzo';
import { useHoy } from '@/componentes/useHoy';
import { leerAjuste, ponerAjusteEn, quitarAjusteLocalEn } from '@/datos/ajustes';
import { GRUPOS_DEL_GIMNASIO } from '@/datos/catalogo';
import { leerEjercicios, leerEjerciciosPorClave, type Ejercicio } from '@/datos/ejercicios';
import { EntrenoCambiado, EntrenoNoValido, guardarEntrenoEn, huellaDelEntreno, leerEntreno } from '@/datos/entrenos';
import { nuevoId } from '@/datos/movil';
import { usePuerta } from '@/datos/usarBase';
import { BloqueDeEjercicio } from '@/gimnasio/BloqueDeEjercicio';
import { CarreraEnCinta } from '@/gimnasio/CarreraEnCinta';
import {
  CLAVE_DEL_BORRADOR,
  MINUTOS_MEDIDOS_MINIMOS,
  anadirCarrera,
  anadirEjercicio,
  cambiarEntreno,
  carrerasFueraDeLoMedido,
  claveDeCorreccion,
  comoEntrenoNuevo,
  empezarAhoraSiVacio,
  entrenoNuevo,
  leerBorrador,
  minutosMedidos,
  nombresDeLosBloques,
  paraCorregir,
  textoDeMinutos,
  tieneAlgo,
  validar,
  type EntrenoEnEdicion,
} from '@/gimnasio/editor';
import { SelectorDeEjercicio } from '@/gimnasio/SelectorDeEjercicio';
import { usePaleta } from '@/tema/colores';
import { datos, espacio, radio, texto, titulos, toqueMinimo } from '@/tema/medidas';

type Cambio = (e: EntrenoEnEdicion) => EntrenoEnEdicion;

/**
 * Apuntar un entreno de gimnasio, en directo o después, o corregir uno ya
 * guardado, con el parámetro «corregir». Todo lo que se escribe se guarda solo
 * como borrador en este móvil, así que cerrar la app no pierde nada: al volver,
 * el entreno sigue donde estaba. Cada corrección tiene su propio borrador,
 * aparte del entreno nuevo a medias.
 */
export default function ApuntarGimnasio() {
  const { corregir } = useLocalSearchParams<{ corregir?: string }>();
  const corrigiendo = corregir !== undefined;
  // El borrador de esta pantalla, y dónde se aparta si esta versión no lo sabe leer.
  const clave = corregir === undefined ? CLAVE_DEL_BORRADOR : claveDeCorreccion(corregir);
  const puerta = usePuerta();
  const paleta = usePaleta();
  const hoy = useHoy();
  // Lo que tapan las barras del sistema: la pantalla llega hasta abajo, por
  // detrás de la barra de navegación de Android y de la raya del iPhone.
  const margenes = useSafeAreaInsets();
  const color = paleta.disciplina.gimnasio.texto;
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
  // Al corregir, si el entreno cambió o se borró mientras tanto, se puede guardar como uno nuevo.
  const [cambiado, setCambiado] = useState(false);
  // El borrador no se escribe hasta el primer cambio: abrir una corrección y salir sin tocar nada no deja borrador.
  const tocado = useRef(false);
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
        const valor = await leerAjuste(l, clave);
        const leidoDelBorrador = leerBorrador(valor);
        // El borrador de una corrección solo vale para su entreno.
        const borrador =
          leidoDelBorrador !== null && (corregir === undefined || leidoDelBorrador.id === corregir) ? leidoDelBorrador : null;
        const guardado = corregir !== undefined && borrador === null ? await leerEntreno(l, corregir) : null;
        const aCorregir = guardado === null ? null : paraCorregir(guardado, nuevoId);
        const inicial = borrador ?? aCorregir;
        const ids = inicial?.bloques.flatMap((bloque) => (bloque.tipo === 'ejercicios' ? bloque.ejercicioIds : [])) ?? [];
        return {
          elegibles: await leerEjercicios(l),
          porClave: await leerEjerciciosPorClave(l, ids),
          inicial,
          borrado: corregir !== undefined && borrador === null && guardado === null,
          noSeCorrige: guardado !== null && aCorregir === null,
          ilegible: valor !== undefined && leidoDelBorrador === null ? valor : undefined,
        };
      })
      .then(async (leido) => {
        if (leido.ilegible !== undefined) {
          // Uno que no se puede leer, quizá de otra versión, se aparta en vez de pisarlo.
          const ilegible = leido.ilegible;
          await puerta.escribir(async (tx) => {
            await ponerAjusteEn(tx, `${clave}.ilegible`, ilegible, Date.now());
            await quitarAjusteLocalEn(tx, clave);
          });
        }
        if (!vivo) return;
        if (leido.borrado) {
          setErrores(['Este entreno ya no está: se ha borrado.']);
        } else if (leido.noSeCorrige) {
          setErrores([
            'Este entreno tiene datos que el editor de gimnasio todavía no sabe enseñar, y al corregirlo aquí se perderían.',
          ]);
        } else {
          setElegibles(leido.elegibles);
          setRetirados([...leido.porClave.values()]);
          setEntreno(leido.inicial ?? entrenoNuevo(nuevoId, new Date()));
          setApartado(leido.ilegible !== undefined);
        }
      })
      .catch((error: unknown) => setErrores([`No se pudo abrir el editor: ${String(error)}`]));
    return () => {
      vivo = false;
    };
  }, [puerta, clave, corregir]);

  /**
   * Escribe el borrador, pero solo el suyo: si el que hay guardado es de otro
   * entreno (por ejemplo, de otro editor abierto encima), no lo toca.
   */
  const guardarBorrador = useCallback(
    (e: EntrenoEnEdicion) =>
      puerta
        .escribir(async (tx) => {
          const guardado = leerBorrador(await leerAjuste(tx, clave));
          if (guardado !== null && guardado.id !== e.id) return;
          if (tieneAlgo(e)) await ponerAjusteEn(tx, clave, e, Date.now());
          else if (guardado !== null) await quitarAjusteLocalEn(tx, clave);
        })
        .then(() => setSinBorrador(false))
        .catch(() => setSinBorrador(true)),
    [puerta, clave],
  );

  // El borrador se escribe un momento después del último cambio, y también al
  // salir de la pantalla, para no perder lo último que se tecleó.
  useEffect(() => {
    if (entreno === null) return;
    ultimo.current = entreno;
    if (cerrado.current || !tocado.current) return;
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
    tocado.current = true;
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

  const titulo = corrigiendo ? 'Corregir entreno' : 'Gimnasio';

  if (entreno === null || elegibles === null) {
    return (
      <View style={[estilos.pantalla, { backgroundColor: paleta.fondo }]}>
        <Stack.Screen options={{ headerShown: true, title: titulo }} />
        {errores.map((error, i) => (
          <Text key={i} style={[estilos.error, { color: paleta.error }]}>
            {error}
          </Text>
        ))}
      </View>
    );
  }

  const porId = new Map([...retirados, ...elegibles].map((e) => [e.id, e]));
  const nombres = nombresDeLosBloques(entreno, porId);
  const medidos = minutosMedidos(entreno);
  // Lo que se corrió antes de la primera serie hecha o después de la última, como el calentamiento.
  const corridosFuera = carrerasFueraDeLoMedido(entreno);
  const medidaValida = medidos !== null && medidos >= MINUTOS_MEDIDOS_MINIMOS;

  /** Un cambio que se puede deshacer desde el aviso de abajo, como quitar algo o enlazar en superserie. */
  const conDeshacer = (aviso: string, cambio: Cambio) => {
    setDeshacer({ texto: aviso, anterior: entreno });
    cambiar(cambio);
  };

  /**
   * Guarda el entreno y quita su borrador. Al corregir, «comoNuevo» lo guarda
   * como un entreno aparte, con otro identificador: es la salida cuando el
   * guardado cambió o se borró mientras se corregía.
   */
  const guardar = async (comoNuevo = false) => {
    const aGuardar = comoNuevo ? comoEntrenoNuevo(entreno, nuevoId) : entreno;
    const resultado = validar(aGuardar, porId, hoy);
    if (resultado.errores) {
      setErrores(resultado.errores);
      return;
    }
    cerrado.current = true;
    pendiente.current = null;
    setGuardando(true);
    setCambiado(false);
    try {
      await puerta.escribir(async (tx) => {
        let selloLeido = aGuardar.selloLeido;
        if (aGuardar.huellaLeida !== null) {
          // Borrar el entreno y deshacer el borrado le cambia el sello, pero no lo
          // apuntado: si sigue siendo lo que se leyó, la corrección va encima.
          const ahora = await leerEntreno(tx, aGuardar.id);
          if (ahora !== null && huellaDelEntreno(ahora) === aGuardar.huellaLeida) selloLeido = ahora.modificado;
        }
        await guardarEntrenoEn(tx, resultado.entreno, { ahora: Date.now(), selloLeido });
        await quitarAjusteLocalEn(tx, clave);
      });
      if (!corrigiendo) router.dismissTo('/');
      else if (comoNuevo) router.dismissTo('/historial');
      else router.back();
    } catch (error) {
      cerrado.current = false;
      setGuardando(false);
      // Lo tecleado justo antes de Guardar, o mientras se guardaba, vuelve al borrador.
      if (ultimo.current !== null) void guardarBorrador(ultimo.current);
      let mensaje = `No se pudo guardar el entreno. Lo apuntado sigue aquí. (${String(error)})`;
      if (error instanceof EntrenoNoValido) {
        mensaje = error.problemas.join(' ');
      } else if (error instanceof EntrenoCambiado && !corrigiendo) {
        mensaje = 'Este entreno ya estaba guardado. Descarta este borrador y, si hace falta, corrige el guardado.';
      } else if (error instanceof EntrenoCambiado) {
        setCambiado(true);
        const sigue = await puerta.leer((l) => leerEntreno(l, entreno.id)).catch(() => null);
        mensaje = `Este entreno ${sigue === null ? 'se ha borrado' : 'ha cambiado'} mientras lo corregías. Puedes guardar lo tuyo como un entreno nuevo, o descartar los cambios.`;
      }
      setErrores([mensaje]);
    }
  };

  const descartar = () => {
    Alert.alert(
      corrigiendo ? '¿Descartar los cambios?' : '¿Descartar este entreno?',
      corrigiendo ? 'El entreno guardado se queda como estaba.' : 'Se borra todo lo apuntado, y no se puede recuperar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () => {
            cerrado.current = true;
            pendiente.current = null;
            puerta
              .escribir((tx) => quitarAjusteLocalEn(tx, clave))
              .then(() => {
                if (router.canGoBack()) router.back();
                else router.replace('/');
              })
              .catch((error: unknown) => {
                cerrado.current = false;
                setErrores([`No se pudo descartar ${corrigiendo ? 'los cambios' : 'el entreno'}. (${String(error)})`]);
              });
          },
        },
      ],
    );
  };

  return (
    <View style={[estilos.pantalla, { backgroundColor: paleta.fondo }]}>
      <Stack.Screen options={{ headerShown: true, title: titulo }} />
      <EvitarTeclado style={estilos.pantalla}>
        <ScrollView
          testID="editor"
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

          {/* El día, las tarjetas de los ejercicios y los botones para añadir van más juntos
              que las secciones de debajo, con los huecos de la maqueta. */}
          <View testID="lista">
            <CampoDeFecha
              fecha={entreno.fecha}
              hora={entreno.hora}
              hoy={hoy}
              alCambiar={(fecha, hora) => cambiar((e) => cambiarEntreno(e, { fecha, hora }))}
            />

            {entreno.bloques.length > 0 && (
              <View testID="bloques" style={estilos.bloques}>
                {entreno.bloques.map((bloque, i) => {
                  const ultimo = i === entreno.bloques.length - 1;
                  if (bloque.tipo === 'carrera') {
                    return (
                      <CarreraEnCinta
                        key={bloque.id}
                        bloque={bloque}
                        nombre={nombres[i]}
                        ultimo={ultimo}
                        cambiar={cambiar}
                        conDeshacer={conDeshacer}
                      />
                    );
                  }
                  const despues = entreno.bloques[i + 1];
                  return (
                    <BloqueDeEjercicio
                      key={bloque.id}
                      bloque={bloque}
                      nombre={nombres[i]}
                      ejercicios={bloque.ejercicioIds.map((id) => porId.get(id))}
                      siguiente={
                        despues?.tipo === 'ejercicios'
                          ? despues.ejercicioIds.map((id) => porId.get(id)?.nombre ?? id).join(' + ')
                          : null
                      }
                      ultimo={ultimo}
                      elegida={elegida}
                      alElegir={setElegida}
                      cambiar={cambiar}
                      conDeshacer={conDeshacer}
                      asegurarVisible={asegurarVisible}
                      nuevoId={nuevoId}
                    />
                  );
                })}
              </View>
            )}

            <View testID="anadir" style={estilos.anadir}>
              <Boton titulo="Añadir ejercicio" icono="mas" variante="secundario" alPulsar={() => setEligiendo(true)} />
              <Boton
                titulo="Carrera en cinta"
                etiqueta="Añadir una carrera en cinta, como el calentamiento"
                icono="mas"
                variante="enlace"
                alPulsar={() => {
                  const id = nuevoId();
                  cambiar((e) => anadirCarrera(empezarAhoraSiVacio(e, new Date()), id));
                }}
              />
            </View>
          </View>

          <View style={estilos.seccion}>
            <Text style={[estilos.titulo, { color: paleta.texto }]}>Duración</Text>
            <View style={estilos.minutos}>
              <TextInput
                accessibilityLabel="Duración en minutos"
                value={entreno.minutos}
                placeholder={medidaValida ? String(medidos + corridosFuera) : ''}
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
                  : !medidaValida
                    ? `Las series marcadas solo cubren ${textoDeMinutos(medidos)}: escribe la duración.`
                    : corridosFuera > 0
                      ? `${textoDeMinutos(medidos + corridosFuera)}: ${corridosFuera} de carrera en cinta y ${medidos} entre la primera serie hecha y la última. Si fue más, escríbelo.`
                      : `${textoDeMinutos(medidos)} entre la primera serie hecha y la última. Si fue más, escríbelo.`}
            </Text>
          </View>

          <View style={estilos.seccion}>
            <Text style={[estilos.titulo, { color: paleta.texto }]}>Esfuerzo</Text>
            <View style={estilos.mascota}>
              <Mascota disciplina="gimnasio" esfuerzo={entreno.esfuerzo} tamano={96} />
            </View>
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

          {cambiado && (
            <Boton
              titulo="Guardarlo como un entreno nuevo"
              variante="secundario"
              deshabilitado={guardando}
              alPulsar={() => void guardar(true)}
            />
          )}
          <Boton
            titulo={guardando ? 'Guardando' : corrigiendo ? 'Guardar los cambios' : 'Guardar'}
            variante="principal"
            deshabilitado={guardando}
            alPulsar={() => void guardar()}
          />
          <Boton
            titulo={corrigiendo ? 'Descartar los cambios' : 'Descartar este entreno'}
            variante="error"
            alPulsar={descartar}
          />
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
    // Arriba, más cerca de la cabecera, como en la maqueta.
    paddingTop: espacio[2],
    gap: espacio[4],
  },
  seccion: {
    gap: espacio[2],
  },
  bloques: {
    marginTop: espacio[2],
    gap: espacio[2],
  },
  anadir: {
    marginTop: espacio[3],
    gap: espacio[1],
  },
  mascota: {
    alignItems: 'center',
  },
  titulo: titulos.seccion,
  minutos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[3],
  },
  entrada: {
    width: 120,
    minHeight: toqueMinimo,
    borderWidth: 1.5,
    borderRadius: radio.control,
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
    borderRadius: radio.boton,
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

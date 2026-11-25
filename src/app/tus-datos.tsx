import { Stack, useFocusEffect, usePreventRemove } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View, type PressableInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton } from '@/componentes/Boton';
import { Icono, type NombreDeIcono } from '@/componentes/Icono';
import { Tarjeta } from '@/componentes/Tarjeta';
import { useHoy } from '@/componentes/useHoy';
import { compartir, elegirArchivo, prepararArchivo, TAMANO_MAXIMO, type ArchivoElegido } from '@/copias/archivos';
import {
  filasDelResumen,
  lineaDeLaCopia,
  mensajeAlApuntar,
  mensajeAlCopiar,
  mensajeAlImportar,
  mensajeAlLeer,
  textoDeLaFila,
  textoDeLaUltimaCopia,
  textoDeLoImportado,
  type FilaDelResumen,
} from '@/copias/textos';
import {
  apuntarUltimaCopiaEn,
  CopiaNoValida,
  crearCopiaEn,
  datosDeLaCopia,
  importarCopiaEn,
  leerCopia,
  leerEstadoDeLasCopias,
  nombreDeLaCopia,
  resumirImportacion,
  textoDeLaCopia,
  type Copia,
  type EstadoDeLasCopias,
  type ResumenDeImportacion,
} from '@/datos/copia';
import { nuevoId, VERSION_DE_LA_APP } from '@/datos/movil';
import { usePuerta } from '@/datos/usarBase';
import { usePaleta } from '@/tema/colores';
import { espacio, radio, texto, titulos } from '@/tema/medidas';

const NO_PUEDE_SABER = 'Quimera no puede saber si la guardaste o cerraste la hoja sin guardarla.';
const AVISO_DE_OTRA_PERSONA = 'Es de otra persona: sus entrenos se mezclarán con los tuyos.';
const SIN_CAMBIOS = 'Esta copia no cambia nada de lo que ves: ya tienes todo lo que trae, y lo que has borrado sigue borrado.';
const SIN_CAMBIOS_DE_OTRA = 'Esta copia no trae ningún entreno que no tengas.';
const RECORDARA_EL_MOVIL = 'Si la importas, Quimera recordará ese móvil como tuyo y no volverá a preguntar por sus copias.';

/**
 * Lo que «Importar», «Hacer una copia» e «Importar una copia» no responden
 * después de aparecer, en milisegundos. Pueden aparecer donde estaba el botón
 * que se acaba de pulsar: con un doble toque en «Sí, es mía», el segundo
 * importaría sin dejar ver lo que cambia; con uno en «Sí, la he guardado»,
 * abriría otra vez la hoja de compartir, y con uno en «Cancelar» o en
 * «Importar», otra vez el selector de archivos. Se cuenta con
 * performance.now(), que no retrocede aunque cambie la hora del móvil.
 */
const ESPERA_TRAS_CAMBIAR = 500;

/** La tarjeta «Hacer una copia». */
type Copiar =
  /** Con cuándo se volvió a este paso: hasta ESPERA_TRAS_CAMBIAR después, «Hacer una copia» no hace nada. */
  | { paso: 'listo'; error: string | null; desde: number }
  /** Mientras se prepara el archivo y está abierta la hoja de compartir. */
  | { paso: 'preparando' }
  /** La hoja de compartir se ha cerrado: falta saber si se guardó la copia hecha en ese instante. */
  | { paso: 'pregunta'; exportado: number; apuntando: boolean; error: string | null };

/** Lo que enseña la tarjeta «Importar una copia» antes de importar. */
type Resumen = {
  paso: 'resumen';
  copia: Copia;
  /** Lo que se contestó a «¿Esta copia es tuya?», o nada si no hacía falta preguntarlo. */
  esMia: boolean | undefined;
  resumen: ResumenDeImportacion;
  importando: boolean;
  error: string | null;
  /** Cuándo apareció, o cuándo falló la última vez: hasta ESPERA_TRAS_CAMBIAR después, «Importar» no hace nada. */
  desde: number;
};

/** La tarjeta «Importar una copia». */
type Importar =
  /**
   * Con lo que cambió la última importación, si se acaba de importar, y con
   * cuándo se volvió aquí con un toque: hasta ESPERA_TRAS_CAMBIAR después,
   * «Importar una copia» no hace nada.
   */
  | { paso: 'inicio'; importado: ResumenDeImportacion | null; desde: number }
  /** Mientras está abierto el selector de archivos. */
  | { paso: 'eligiendo' }
  | { paso: 'leyendo' }
  | { paso: 'error'; mensaje: string }
  | { paso: 'pregunta'; copia: Copia; siEsMia: ResumenDeImportacion; siNo: ResumenDeImportacion }
  | Resumen;

/**
 * Espera a que se pinte lo último que ha cambiado, como «Leyendo la copia»,
 * antes de un trabajo que ocupa el hilo de JavaScript, como leer una copia
 * grande.
 */
const dejarQueSePinte = () => new Promise<void>((listo) => requestAnimationFrame(() => setTimeout(listo, 0)));

/**
 * Lee la copia de un archivo elegido. Uno de más de TAMANO_MAXIMO no se lee:
 * no es una copia de Quimera. Va fuera de la pantalla porque React Compiler
 * no compila un throw dentro de un try.
 */
async function leerElArchivo(archivo: ArchivoElegido): Promise<Copia> {
  if (archivo.tamano > TAMANO_MAXIMO) {
    throw new CopiaNoValida('noEsCopia');
  }
  return leerCopia(await archivo.leer());
}

/**
 * «Tus datos»: hacer una copia de los datos de este móvil para guardarla
 * fuera, e importar una. Se abre encima de las pestañas, desde Inicio. Cada
 * estado nuevo de una tarjeta se anuncia al lector de pantalla, porque lo que
 * había donde estaba el foco, como el botón que se pulsó, ya no está.
 */
export default function TusDatos() {
  const puerta = usePuerta();
  const paleta = usePaleta();
  const hoy = useHoy();
  const margenes = useSafeAreaInsets();
  const [estado, setEstado] = useState<EstadoDeLasCopias | null>(null);
  const [errorAlLeer, setErrorAlLeer] = useState<string | null>(null);
  const [copiar, setCopiar] = useState<Copiar>({ paso: 'listo', error: null, desde: Number.NEGATIVE_INFINITY });
  const [importar, setImportar] = useState<Importar>({ paso: 'inicio', importado: null, desde: Number.NEGATIVE_INFINITY });
  // Un objeto nuevo en cada anuncio, para repetir también un texto igual al anterior.
  const [anuncio, setAnuncio] = useState<{ texto: string } | null>(null);
  // Cada vez que crece, la lista sube hasta la tarjeta de importar, donde empieza lo nuevo.
  const [verImportar, setVerImportar] = useState(0);
  // El botón al que pasa el foco del lector de pantalla cuando una tarjeta vuelve a su principio.
  const [enfocar, setEnfocar] = useState<{ en: 'copiar' | 'importar' } | null>(null);
  const lista = useRef<ComponentRef<typeof ScrollView>>(null);
  const tarjetaDeImportar = useRef<ComponentRef<typeof View>>(null);
  const botonDeCopiar = useRef<PressableInstance>(null);
  const botonDeImportar = useRef<PressableInstance>(null);

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      puerta
        .leer((l) => leerEstadoDeLasCopias(l, Date.now()))
        .then((leido) => {
          if (!vivo) return;
          setEstado(leido);
          setErrorAlLeer(null);
        })
        .catch((e: unknown) => {
          if (vivo) setErrorAlLeer(`No se pudo leer lo que hay en este móvil. (${String(e)})`);
        });
      return () => {
        vivo = false;
      };
    }, [puerta]),
  );

  useEffect(() => {
    if (anuncio !== null) AccessibilityInfo.announceForAccessibility(anuncio.texto);
  }, [anuncio]);
  const anunciar = (texto: string) => setAnuncio({ texto });

  // Después de pintar lo nuevo. measureLayout lee dónde ha quedado la tarjeta en lo que se
  // acaba de pintar, también si la de arriba ha crecido a la vez, como al restaurar una copia
  // en un móvil sin entrenos; onLayout lo diría más tarde.
  useEffect(() => {
    const contenido = lista.current?.getInnerViewRef();
    if (verImportar === 0 || contenido == null) return;
    tarjetaDeImportar.current?.measureLayout(contenido, (_x, y) =>
      lista.current?.scrollTo({ y: Math.max(0, y - espacio[4]), animated: true }),
    );
  }, [verImportar]);
  const subirAImportar = () => setVerImportar((n) => n + 1);

  // Cuando una tarjeta vuelve a su principio, como con «No» o «Cancelar», el botón que tenía el
  // foco ya no está: el lector de pantalla pasa al botón principal de la tarjeta. Se pide
  // después de pintar: tras un toque, React corre este efecto antes de que el móvil monte el
  // botón nuevo, y el aviso de foco, que no espera al montaje, se perdería.
  useEffect(() => {
    if (enfocar === null) return;
    let vivo = true;
    void dejarQueSePinte().then(() => {
      const boton = enfocar.en === 'copiar' ? botonDeCopiar.current : botonDeImportar.current;
      if (vivo && boton !== null) AccessibilityInfo.sendAccessibilityEvent(boton, 'focus');
    });
    return () => {
      vivo = false;
    };
  }, [enfocar]);

  const copiando = copiar.paso === 'preparando';
  const importando =
    importar.paso === 'eligiendo' || importar.paso === 'leyendo' || (importar.paso === 'resumen' && importar.importando);
  // Mientras se prepara la copia o se importa, no se sale de la pantalla: la hoja de compartir
  // se abriría encima de Inicio, sin preguntar después si se guardó, y lo importado no se vería.
  // Quien lo intenta oye por qué: lo que está haciendo.
  usePreventRemove(copiando || (importar.paso === 'resumen' && importar.importando), () =>
    anunciar(copiando ? 'Preparando la copia' : 'Importando'),
  );

  const hacerCopia = async () => {
    if (copiar.paso === 'listo' && performance.now() - copiar.desde < ESPERA_TRAS_CAMBIAR) return;
    setCopiar({ paso: 'preparando' });
    anunciar('Preparando la copia');
    try {
      const instante = new Date();
      const copia = await puerta.escribir((tx) => crearCopiaEn(tx, { ahora: instante.getTime(), app: VERSION_DE_LA_APP, nuevoId }));
      const uri = await prepararArchivo(nombreDeLaCopia(instante), textoDeLaCopia(copia));
      await compartir(uri);
      setCopiar({ paso: 'pregunta', exportado: copia.exportado, apuntando: false, error: null });
      anunciar(`¿Has guardado la copia? ${NO_PUEDE_SABER}`);
    } catch (e) {
      const mensaje = mensajeAlCopiar(e);
      setCopiar({ paso: 'listo', error: mensaje, desde: performance.now() });
      anunciar(mensaje);
    }
  };

  const apuntarCopia = async (exportado: number) => {
    setCopiar({ paso: 'pregunta', exportado, apuntando: true, error: null });
    try {
      const ahora = Date.now();
      const leido = await puerta.escribir(async (tx) => {
        await apuntarUltimaCopiaEn(tx, exportado, ahora);
        return leerEstadoDeLasCopias(tx, ahora);
      });
      setEstado(leido);
      setErrorAlLeer(null);
      setCopiar({ paso: 'listo', error: null, desde: performance.now() });
      const { antes, destacado } = textoDeLaUltimaCopia(leido.ultimaCopia, hoy);
      anunciar(`${antes}${destacado}`);
    } catch (e) {
      const mensaje = mensajeAlApuntar(e);
      setCopiar({ paso: 'pregunta', exportado, apuntando: false, error: mensaje });
      anunciar(mensaje);
    }
  };

  /** Enseña lo que cambiaría al importar, y lo anuncia; la línea de la copia, solo si aún no se dijo. */
  const verResumen = (copia: Copia, esMia: boolean | undefined, resumen: ResumenDeImportacion, linea: string | null) => {
    setImportar({ paso: 'resumen', copia, esMia, resumen, importando: false, error: null, desde: performance.now() });
    const filas = filasDelResumen(resumen);
    const partes = linea === null ? [] : [linea];
    if (filas.length > 0) {
      if (esMia === false) partes.push(AVISO_DE_OTRA_PERSONA);
      partes.push('Esto es lo que va a cambiar.', ...filas.map(textoDeLaFila));
    } else {
      partes.push(esMia === false ? SIN_CAMBIOS_DE_OTRA : SIN_CAMBIOS);
      if (esMia === true) partes.push(RECORDARA_EL_MOVIL);
    }
    anunciar(partes.join(' '));
  };

  const fallarAlLeer = (e: unknown) => {
    const mensaje = mensajeAlLeer(e);
    setImportar({ paso: 'error', mensaje });
    anunciar(mensaje);
    subirAImportar();
  };

  const elegirCopia = async () => {
    if (importar.paso === 'inicio' && performance.now() - importar.desde < ESPERA_TRAS_CAMBIAR) return;
    setImportar({ paso: 'eligiendo' });
    let archivo: ArchivoElegido | null;
    try {
      // Hoy elegirArchivo no falla, porque expo-file-system da un fallo como si se cerrara el
      // selector; si fallara, la tarjeta lo diría en vez de quedarse en «eligiendo».
      archivo = await elegirArchivo();
    } catch (e) {
      fallarAlLeer(e);
      return;
    }
    if (archivo === null) {
      setImportar({ paso: 'inicio', importado: null, desde: Number.NEGATIVE_INFINITY });
      setEnfocar({ en: 'importar' });
      return;
    }
    setImportar({ paso: 'leyendo' });
    anunciar('Leyendo la copia');
    try {
      await dejarQueSePinte();
      const copia = await leerElArchivo(archivo);
      const { siEsMia, siNo } = await puerta.leer(async (l) => {
        const comoMia = await resumirImportacion(l, copia);
        return { siEsMia: comoMia, siNo: comoMia.preguntar ? await resumirImportacion(l, copia, { esMia: false }) : null };
      });
      const linea = lineaDeLaCopia(datosDeLaCopia(copia), hoy);
      if (siNo === null) {
        verResumen(copia, undefined, siEsMia, linea);
      } else {
        setImportar({ paso: 'pregunta', copia, siEsMia, siNo });
        anunciar(`${linea} ¿Esta copia es tuya?`);
      }
      subirAImportar();
    } catch (e) {
      fallarAlLeer(e);
    }
  };

  const contestar = (pregunta: Extract<Importar, { paso: 'pregunta' }>, esMia: boolean) => {
    verResumen(pregunta.copia, esMia, esMia ? pregunta.siEsMia : pregunta.siNo, null);
    subirAImportar();
  };

  const confirmar = async (resumen: Resumen) => {
    if (performance.now() - resumen.desde < ESPERA_TRAS_CAMBIAR) return;
    setImportar({ ...resumen, importando: true, error: null });
    anunciar('Importando');
    try {
      const ahora = Date.now();
      const { importado, leido } = await puerta.escribir(async (tx) => {
        const hecho = await importarCopiaEn(tx, resumen.copia, { ahora, nuevoId, esMia: resumen.esMia });
        return { importado: hecho, leido: await leerEstadoDeLasCopias(tx, ahora) };
      });
      setEstado(leido);
      setErrorAlLeer(null);
      setImportar({ paso: 'inicio', importado, desde: performance.now() });
      anunciar(textoDeLoImportado(importado));
      subirAImportar();
    } catch (e) {
      const mensaje = mensajeAlImportar(e);
      setImportar({ ...resumen, importando: false, error: mensaje, desde: performance.now() });
      anunciar(mensaje);
    }
  };

  return (
    <ScrollView
      ref={lista}
      testID="tus-datos"
      style={{ backgroundColor: paleta.fondo }}
      contentContainerStyle={[estilos.contenido, { paddingBottom: margenes.bottom + espacio[8] }]}
    >
      <Stack.Screen options={{ headerShown: true, title: 'Tus datos' }} />
      <Text style={[estilos.intro, { color: paleta.textoTenue }]}>
        Quimera guarda tus entrenos en este móvil y no los sube a ningún sitio: si lo pierdes o borras Quimera, puedes
        perderlos. Una copia guardada fuera te deja recuperarlos, también en un móvil nuevo.
      </Text>
      {errorAlLeer !== null && <Text style={[estilos.parrafo, { color: paleta.error }]}>{errorAlLeer}</Text>}
      {estado !== null && (
        <>
          <TarjetaDeCopiar
            estado={estado}
            hoy={hoy}
            copiar={copiar}
            ocupado={importando}
            alHacer={() => void hacerCopia()}
            alGuardarla={(exportado) => void apuntarCopia(exportado)}
            alNoGuardarla={() => {
              setCopiar({ paso: 'listo', error: null, desde: performance.now() });
              setEnfocar({ en: 'copiar' });
            }}
            refDelBoton={botonDeCopiar}
          />
          <View ref={tarjetaDeImportar} testID="tarjeta-de-importar">
            <TarjetaDeImportar
              importar={importar}
              hayEntrenos={estado.hayEntrenos}
              hoy={hoy}
              ocupado={copiando}
              alElegir={() => void elegirCopia()}
              alContestar={contestar}
              alConfirmar={(resumen) => void confirmar(resumen)}
              alCancelar={() => {
                setImportar({ paso: 'inicio', importado: null, desde: performance.now() });
                setEnfocar({ en: 'importar' });
              }}
              refDelBoton={botonDeImportar}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

/** El título de una tarjeta. */
function TituloDeTarjeta({ children }: { children: string }) {
  const paleta = usePaleta();
  return (
    <Text accessibilityRole="header" style={[estilos.tituloDeTarjeta, { color: paleta.texto }]}>
      {children}
    </Text>
  );
}

/** Una pregunta o un apartado dentro de una tarjeta, como «¿Esta copia es tuya?». */
function Pregunta({ children }: { children: string }) {
  const paleta = usePaleta();
  return (
    <Text accessibilityRole="header" style={[estilos.pregunta, { color: paleta.texto }]}>
      {children}
    </Text>
  );
}

/**
 * Un aviso en su caja, con su icono delante: en el fondo suave de las filas,
 * como la línea de la copia, o en el tinte del color de las acciones, como
 * «Copia importada», con el icono en ese color.
 */
function Caja({ icono, tinte = false, fuerte = false, children }: { icono: NombreDeIcono; tinte?: boolean; fuerte?: boolean; children: string }) {
  const paleta = usePaleta();
  return (
    <View style={[estilos.caja, { backgroundColor: tinte ? paleta.tintePrimario : paleta.superficieSuave }]}>
      <Icono nombre={icono} color={tinte ? paleta.primario : paleta.textoTenue} tamano={20} />
      <Text style={[estilos.parrafo, estilos.junto, fuerte && estilos.seminegrita, { color: paleta.texto }]}>{children}</Text>
    </View>
  );
}

/** Un mensaje de error dentro de una tarjeta. */
function Fallo({ children }: { children: string }) {
  const paleta = usePaleta();
  return <Text style={[estilos.parrafo, { color: paleta.error }]}>{children}</Text>;
}

/** Una de las respuestas a «¿Esta copia es tuya?», con lo que pasa si se elige. */
function Respuesta({ titulo, alPulsar, children }: { titulo: string; alPulsar: () => void; children: string }) {
  const paleta = usePaleta();
  return (
    <View style={estilos.respuesta}>
      <Boton titulo={titulo} variante="secundario" alPulsar={alPulsar} />
      <Text style={[estilos.nota, { color: paleta.textoTenue }]}>{children}</Text>
    </View>
  );
}

/** Una fila de «Esto es lo que va a cambiar», con la cifra en negrita. */
function FilaDelCambio({ fila }: { fila: FilaDelResumen }) {
  const paleta = usePaleta();
  return (
    <View style={estilos.fila}>
      <Icono nombre={fila.icono} color={paleta.texto} tamano={20} />
      <Text style={[estilos.parrafo, estilos.junto, { color: paleta.texto }]}>
        {fila.antes}
        <Text style={estilos.negrita}>{fila.destacado}</Text>
        {fila.despues}
      </Text>
    </View>
  );
}

/**
 * La tarjeta «Hacer una copia»: cuándo se guardó la última y el botón para
 * hacer otra. Al cerrarse la hoja de compartir, pregunta si se guardó, porque
 * la hoja no lo dice; solo el «sí» la apunta.
 */
function TarjetaDeCopiar({
  estado,
  hoy,
  copiar,
  ocupado,
  alHacer,
  alGuardarla,
  alNoGuardarla,
  refDelBoton,
}: {
  estado: EstadoDeLasCopias;
  hoy: string;
  copiar: Copiar;
  /** Si la otra tarjeta está trabajando: entonces no se puede empezar una copia. */
  ocupado: boolean;
  alHacer: () => void;
  alGuardarla: (exportado: number) => void;
  alNoGuardarla: () => void;
  /** El de «Hacer una copia», para llevar a él el foco del lector de pantalla. */
  refDelBoton: Ref<PressableInstance>;
}) {
  const paleta = usePaleta();
  if (!estado.hayEntrenos) {
    return (
      <Tarjeta relleno={espacio[5]} style={estilos.tarjeta}>
        <TituloDeTarjeta>Hacer una copia</TituloDeTarjeta>
        <Text style={[estilos.parrafo, { color: paleta.textoTenue }]}>Todavía no tienes entrenos que copiar.</Text>
      </Tarjeta>
    );
  }
  const ultima = textoDeLaUltimaCopia(estado.ultimaCopia, hoy);
  return (
    <Tarjeta relleno={espacio[5]} style={estilos.tarjeta}>
      <TituloDeTarjeta>Hacer una copia</TituloDeTarjeta>
      {copiar.paso !== 'pregunta' && (
        <Text style={[estilos.parrafo, { color: paleta.texto }]}>
          Quimera prepara un archivo con todo lo que hay en este móvil, y tú eliges dónde guardarlo: mejor fuera del móvil y
          solo para ti, en Drive o en tu correo, por ejemplo.
        </Text>
      )}
      {/* Mientras pregunta si se guardó la que se acaba de hacer, «Todavía no has hecho ninguna
          copia» parecería decir que ha fallado: solo sale la última que ya estaba apuntada. */}
      {(copiar.paso !== 'pregunta' || estado.ultimaCopia !== null) && (
        <View style={[estilos.fila, estilos.filaDelReloj]}>
          <Icono nombre="reloj" color={paleta.textoTenue} tamano={18} />
          <Text style={[estilos.parrafo, estilos.junto, { color: paleta.textoTenue }]}>
            {ultima.antes}
            <Text style={[estilos.seminegrita, { color: paleta.texto }]}>{ultima.destacado}</Text>
          </Text>
        </View>
      )}
      {copiar.paso === 'pregunta' ? (
        <View style={[estilos.cajaDePregunta, { backgroundColor: paleta.tintePrimario }]}>
          <Pregunta>¿Has guardado la copia?</Pregunta>
          <Text style={[estilos.parrafo, { color: paleta.textoTenue }]}>{NO_PUEDE_SABER}</Text>
          {copiar.error !== null && <Fallo>{copiar.error}</Fallo>}
          <Boton
            titulo="Sí, la he guardado"
            variante="relleno"
            icono="hecha"
            deshabilitado={copiar.apuntando}
            alPulsar={() => alGuardarla(copiar.exportado)}
          />
          <Boton
            titulo="No"
            etiqueta="No la he guardado"
            variante="sutil"
            deshabilitado={copiar.apuntando}
            alPulsar={alNoGuardarla}
          />
        </View>
      ) : (
        <>
          {copiar.paso === 'listo' && copiar.error !== null && <Fallo>{copiar.error}</Fallo>}
          <Boton
            ref={refDelBoton}
            titulo={copiar.paso === 'preparando' ? 'Preparando la copia' : 'Hacer una copia'}
            variante="principal"
            icono="subir"
            deshabilitado={copiar.paso === 'preparando' || ocupado}
            alPulsar={alHacer}
          />
        </>
      )}
    </Tarjeta>
  );
}

/**
 * La tarjeta «Importar una copia». Antes de tocar nada lee el archivo entero,
 * pregunta de quién es la copia si hace falta y enseña lo que va a cambiar;
 * solo «Importar» escribe, en una sola transacción.
 */
function TarjetaDeImportar({
  importar,
  hayEntrenos,
  hoy,
  ocupado,
  alElegir,
  alContestar,
  alConfirmar,
  alCancelar,
  refDelBoton,
}: {
  importar: Importar;
  /** Sin entrenos que copiar, importar es lo que toca: su botón pasa a ser el principal. */
  hayEntrenos: boolean;
  hoy: string;
  /** Si la otra tarjeta está trabajando: entonces no se puede empezar a importar. */
  ocupado: boolean;
  alElegir: () => void;
  alContestar: (pregunta: Extract<Importar, { paso: 'pregunta' }>, esMia: boolean) => void;
  alConfirmar: (resumen: Resumen) => void;
  alCancelar: () => void;
  /** El de «Importar una copia» o «Importar otra copia», para llevar a él el foco del lector de pantalla. */
  refDelBoton: Ref<PressableInstance>;
}) {
  const paleta = usePaleta();
  const varianteDeElegir = hayEntrenos ? 'secundario' : 'principal';
  const tarjeta = (contenido: ReactNode) => (
    <Tarjeta relleno={espacio[5]} style={estilos.tarjeta}>
      <TituloDeTarjeta>Importar una copia</TituloDeTarjeta>
      {contenido}
    </Tarjeta>
  );

  switch (importar.paso) {
    case 'inicio':
    case 'eligiendo':
    case 'leyendo':
      return tarjeta(
        <>
          {importar.paso === 'inicio' && importar.importado !== null && (
            <Caja icono="hecha" tinte>
              {textoDeLoImportado(importar.importado)}
            </Caja>
          )}
          <Text style={[estilos.parrafo, { color: paleta.texto }]}>
            Para recuperar tus entrenos en un móvil nuevo, o juntar los de otro móvil tuyo: busca el archivo «quimera-» con su
            fecha. Lo que tengas y no esté en la copia se queda, y antes de tocar nada verás qué cambia.
          </Text>
          <Boton
            ref={refDelBoton}
            titulo={importar.paso === 'leyendo' ? 'Leyendo la copia' : 'Importar una copia'}
            variante={varianteDeElegir}
            icono="bajar"
            deshabilitado={importar.paso !== 'inicio' || ocupado}
            alPulsar={alElegir}
          />
        </>,
      );
    case 'error':
      return tarjeta(
        <>
          <Fallo>{importar.mensaje}</Fallo>
          <Boton
            ref={refDelBoton}
            titulo="Importar otra copia"
            variante={varianteDeElegir}
            icono="bajar"
            deshabilitado={ocupado}
            alPulsar={alElegir}
          />
        </>,
      );
    case 'pregunta':
      return tarjeta(
        <>
          <Caja icono="documento">{lineaDeLaCopia(datosDeLaCopia(importar.copia), hoy)}</Caja>
          <View style={estilos.trasLaCaja}>
            <Pregunta>¿Esta copia es tuya?</Pregunta>
          </View>
          <Text style={[estilos.parrafo, { color: paleta.textoTenue }]}>
            Viene de otro móvil, o de antes de reinstalar Quimera. Si la hizo otra persona en su móvil, contesta que no.
          </Text>
          <Respuesta titulo="Sí, es mía" alPulsar={() => alContestar(importar, true)}>
            Se junta con lo que tienes: de cada entreno queda su última versión. Con las próximas copias de ese móvil, Quimera ya
            no lo preguntará.
          </Respuesta>
          <Respuesta titulo="No, es de otra persona" alPulsar={() => alContestar(importar, false)}>
            Sus entrenos se mezclan con los tuyos: salen en tu historial, cuentan en tu semana y van en tus copias, y solo se
            quitan borrándolos uno a uno. Lo tuyo no cambia.
          </Respuesta>
          <Boton titulo="Cancelar" variante="sutil" alPulsar={alCancelar} />
        </>,
      );
    case 'resumen': {
      const filas = filasDelResumen(importar.resumen);
      return tarjeta(
        <>
          <Caja icono="documento">{lineaDeLaCopia(datosDeLaCopia(importar.copia), hoy)}</Caja>
          {importar.esMia === false && filas.length > 0 && (
            <Caja icono="aviso" tinte fuerte>
              {AVISO_DE_OTRA_PERSONA}
            </Caja>
          )}
          {filas.length > 0 ? (
            <>
              <View style={estilos.trasLaCaja}>
                <Pregunta>Esto es lo que va a cambiar</Pregunta>
              </View>
              <View style={estilos.filas}>
                {filas.map((fila) => (
                  <FilaDelCambio key={textoDeLaFila(fila)} fila={fila} />
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={[estilos.parrafo, { color: paleta.texto }]}>
                {importar.esMia === false ? SIN_CAMBIOS_DE_OTRA : SIN_CAMBIOS}
              </Text>
              {importar.esMia === true && (
                <Text style={[estilos.parrafo, { color: paleta.textoTenue }]}>{RECORDARA_EL_MOVIL}</Text>
              )}
            </>
          )}
          {importar.error !== null && <Fallo>{importar.error}</Fallo>}
          <View style={estilos.trasLaCaja}>
            <Boton
              titulo={importar.importando ? 'Importando' : 'Importar'}
              variante="relleno"
              icono="bajar"
              deshabilitado={importar.importando || ocupado}
              alPulsar={() => alConfirmar(importar)}
            />
          </View>
          <Boton titulo="Cancelar" variante="sutil" deshabilitado={importar.importando} alPulsar={alCancelar} />
        </>,
      );
    }
  }
}

const estilos = StyleSheet.create({
  contenido: {
    paddingTop: espacio[1],
    paddingHorizontal: espacio[5],
    gap: espacio[4],
  },
  intro: {
    fontSize: texto.m,
  },
  tarjeta: {
    gap: espacio[3],
  },
  tituloDeTarjeta: titulos.bloque,
  pregunta: {
    fontSize: 17,
    fontWeight: '700',
  },
  parrafo: {
    fontSize: 15,
  },
  nota: {
    fontSize: texto.s,
    paddingHorizontal: espacio[1],
  },
  seminegrita: {
    fontWeight: '600',
  },
  negrita: {
    fontWeight: '700',
  },
  // Lo que va después de una caja o de una lista, un poco más separado, como en el dibujo.
  trasLaCaja: {
    marginTop: espacio[1],
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  filaDelReloj: {
    gap: espacio[2],
  },
  // El texto junto a su icono se parte en líneas en vez de salirse.
  junto: {
    flexShrink: 1,
  },
  filas: {
    gap: 10,
  },
  caja: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: espacio[3],
    paddingHorizontal: 14,
    borderRadius: radio.pequeno,
  },
  cajaDePregunta: {
    gap: espacio[3],
    padding: espacio[4],
    borderRadius: radio.boton,
  },
  respuesta: {
    gap: 6,
  },
});

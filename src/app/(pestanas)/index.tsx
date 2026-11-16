import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bocadillo } from '@/componentes/Bocadillo';
import { Boton } from '@/componentes/Boton';
import { EscenarioDeLaMascota, type ProporcionesDelEscenario } from '@/componentes/EscenarioDeLaMascota';
import { Tarjeta } from '@/componentes/Tarjeta';
import { useHoy } from '@/componentes/useHoy';
import { leerCargaDeInicio, type CargaDeInicio } from '@/datos/carga';
import { lunesDe } from '@/datos/fechas';
import { usePuerta } from '@/datos/usarBase';
import { cifra, compararConLaPasada, partirLaComparacion } from '@/inicio/comparar';
import { FichaDeDisciplina } from '@/inicio/FichaDeDisciplina';
import { GraficaDeSemanas } from '@/inicio/GraficaDeSemanas';
import { usePaleta } from '@/tema/colores';
import { datos, esLetraGrande, espacio, texto, titulos } from '@/tema/medidas';

/** El lado del escenario del rinoceronte junto a la carga. */
const ESCENARIO = 156;
/** El lado del escenario del rinoceronte encima de la carga, con la letra grande. */
const ESCENARIO_APILADO = 140;
/** El lado del escenario del rinoceronte cuando todavía no hay entrenos, con las proporciones de la maqueta. */
const ESCENARIO_DE_BIENVENIDA = 200;
const PROPORCIONES_DE_BIENVENIDA: ProporcionesDelEscenario = { arriba: 0.08, interior: 0.7, dibujo: 1.12, alzado: 0.035 };

// El botón va abajo, al alcance del pulgar, si la pantalla da para ello. En el
// iPhone, la barra de pestañas se dibuja encima de la pantalla: el borde de
// abajo de la zona segura, que ya la cuenta, deja el botón encima de ella. En
// Android, expo-router ya deja la pantalla encima de su barra.
const BORDES_SEGUROS = Platform.OS === 'ios' ? (['top', 'bottom'] as const) : (['top'] as const);

// La pantalla de inicio: cómo va la semana y, debajo, el botón para apuntar un
// entreno. Las dos pestañas están montadas a la vez, así que la carga se
// vuelve a leer cada vez que se enseña, como al volver de guardar un entreno.
export default function Inicio() {
  const puerta = usePuerta();
  const paleta = usePaleta();
  const hoy = useHoy();
  const lunes = lunesDe(hoy);
  const [carga, setCarga] = useState<CargaDeInicio | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      puerta
        .leer((l) => leerCargaDeInicio(l, lunes))
        .then((leida) => {
          if (!vivo) return;
          setCarga(leida);
          setError(null);
        })
        .catch((e: unknown) => {
          if (vivo) setError(`No se pudo leer la carga de la semana. (${String(e)})`);
        });
      return () => {
        vivo = false;
      };
    }, [puerta, lunes]),
  );

  return (
    <SafeAreaView edges={BORDES_SEGUROS} style={[estilos.pantalla, { backgroundColor: paleta.fondo }]}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <View style={estilos.cabecera}>
          {/* Con la letra grande de iOS crece como los títulos del sistema, no sin tope. */}
          <Text accessibilityRole="header" dynamicTypeRamp="largeTitle" style={[estilos.titulo, { color: paleta.texto }]}>
            Quimera
          </Text>
          <Text style={[estilos.lema, { color: paleta.textoTenue }]}>Tus entrenos, en tu móvil.</Text>
        </View>
        <EstaSemana carga={carga} error={error} />
        {/* Empuja el botón abajo, al alcance del pulgar, si la pantalla da para ello. */}
        <View style={estilos.hueco} />
        <Boton titulo="Apuntar un entreno" icono="mas" variante="principal" alPulsar={() => router.navigate('/apuntar')} />
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * La carga de esta semana, la de Quimera-web: los minutos de cada entreno por
 * su esfuerzo, sumados de lunes a domingo. Junto a la cifra está el
 * rinoceronte, que cuenta en su bocadillo cómo va respecto a la pasada.
 * Debajo, la gráfica de las últimas semanas y los minutos de cada disciplina.
 * Sin ningún entreno guardado, un cero enorme no dice nada: entonces el
 * rinoceronte da la bienvenida y cuenta lo que habrá aquí.
 */
function EstaSemana({ carga, error }: { carga: CargaDeInicio | null; error: string | null }) {
  const paleta = usePaleta();
  const { fontScale } = useWindowDimensions();
  // Con la letra grande, la cifra no cabe junto al rinoceronte: él va arriba y la cifra, debajo.
  const apilado = esLetraGrande(fontScale);
  const tituloDeLaSemana = (
    <Text accessibilityRole="header" style={[estilos.tituloDeSeccion, { color: paleta.texto }]}>
      Esta semana
    </Text>
  );

  if (error !== null) {
    return (
      <Tarjeta destacada relleno={espacio[5]} style={estilos.tarjeta}>
        {tituloDeLaSemana}
        <Text style={[estilos.parrafo, { color: paleta.error }]}>{error}</Text>
      </Tarjeta>
    );
  }
  if (carga === null) {
    return null;
  }
  if (!carga.hayEntrenos) {
    return (
      <Tarjeta destacada relleno={espacio[5]} style={estilos.tarjeta}>
        {tituloDeLaSemana}
        <View style={estilos.bienvenida}>
          <EscenarioDeLaMascota
            disciplina="gimnasio"
            tamano={ESCENARIO_DE_BIENVENIDA}
            colores={paleta.escenarioDeInicio}
            proporciones={PROPORCIONES_DE_BIENVENIDA}
          />
        </View>
        <Bocadillo>
          <Text style={[estilos.parrafo, estilos.centrado, { color: paleta.texto }]}>
            Cuando apuntes tu primer entreno, aquí verás la carga de la semana y cómo va respecto a la pasada.
          </Text>
        </Bocadillo>
      </Tarjeta>
    );
  }

  const { destacado, resto } = partirLaComparacion(compararConLaPasada(carga.estaSemana, carga.laPasada));
  return (
    <>
      <Tarjeta destacada relleno={espacio[5]} style={estilos.tarjeta}>
        <View testID="fila-de-la-carga" style={[estilos.fila, apilado && estilos.filaApilada]}>
          <View style={[estilos.columnaDeLaCarga, apilado && estilos.columnaApilada]}>
            {tituloDeLaSemana}
            <View
              accessible
              accessibilityLabel={`Carga de esta semana: ${cifra(carga.estaSemana.carga)}`}
              style={estilos.carga}
            >
              {/* Una cifra larga encoge para caber en una línea, en vez de partirse. */}
              <Text
                dynamicTypeRamp="largeTitle"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[datos, estilos.cifra, { color: paleta.texto }]}
              >
                {cifra(carga.estaSemana.carga)}
              </Text>
              <Text style={[estilos.parrafo, { color: paleta.textoTenue }]}>de carga</Text>
            </View>
          </View>
          <EscenarioDeLaMascota
            disciplina="gimnasio"
            tamano={apilado ? ESCENARIO_APILADO : ESCENARIO}
            colores={paleta.escenarioDeInicio}
          />
        </View>
        {/* El pico apunta al rinoceronte: a la mitad de su escenario desde la derecha, o al centro si va arriba. */}
        <Bocadillo pico={apilado ? undefined : ESCENARIO / 2}>
          <Text style={[estilos.parrafo, { color: paleta.texto }]}>
            {destacado !== '' && <Text style={estilos.destacado}>{destacado}</Text>}
            {resto}
          </Text>
        </Bocadillo>
        <GraficaDeSemanas semanas={carga.ultimasSemanas} />
        {carga.estaSemana.porDisciplina.length > 0 && (
          <View style={estilos.fichas}>
            {carga.estaSemana.porDisciplina.map(({ disciplina, minutos }) => (
              <FichaDeDisciplina key={disciplina} disciplina={disciplina} minutos={minutos} />
            ))}
          </View>
        )}
      </Tarjeta>
      <Text style={[estilos.nota, { color: paleta.textoTenue }]}>
        Minutos por esfuerzo. Compara tus semanas entre sí, no unas disciplinas con otras.
      </Text>
    </>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
  },
  contenido: {
    flexGrow: 1,
    paddingHorizontal: espacio[5],
    paddingTop: espacio[3],
    paddingBottom: espacio[4],
  },
  cabecera: {
    gap: 2,
  },
  titulo: {
    ...titulos.pantalla,
    letterSpacing: -0.2,
  },
  lema: {
    fontSize: texto.m,
  },
  tituloDeSeccion: titulos.seccion,
  parrafo: {
    fontSize: texto.m,
  },
  centrado: {
    textAlign: 'center',
  },
  destacado: {
    fontWeight: '700',
  },
  tarjeta: {
    marginTop: espacio[5],
    gap: 14,
  },
  bienvenida: {
    alignItems: 'center',
  },
  fila: {
    flexDirection: 'row',
    gap: espacio[2],
  },
  filaApilada: {
    flexDirection: 'column-reverse',
    alignItems: 'center',
  },
  columnaDeLaCarga: {
    flex: 1,
    justifyContent: 'space-between',
  },
  columnaApilada: {
    flex: 0,
    alignSelf: 'stretch',
    gap: espacio[2],
  },
  carga: {
    gap: 2,
    paddingBottom: espacio[2],
  },
  cifra: {
    fontSize: 60,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  fichas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  nota: {
    fontSize: texto.s,
    marginTop: espacio[3],
    marginHorizontal: espacio[1],
  },
  hueco: {
    flexGrow: 1,
    minHeight: espacio[4],
  },
});

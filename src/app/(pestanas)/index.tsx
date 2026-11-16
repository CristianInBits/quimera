import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Boton } from '@/componentes/Boton';
import { Tarjeta } from '@/componentes/Tarjeta';
import { useHoy } from '@/componentes/useHoy';
import { leerCargaDeInicio, type CargaDeInicio } from '@/datos/carga';
import { NOMBRE_DE_DISCIPLINA } from '@/datos/entrenos';
import { lunesDe } from '@/datos/fechas';
import { usePuerta } from '@/datos/usarBase';
import { textoDeMinutos } from '@/gimnasio/editor';
import { cifra, compararConLaPasada } from '@/inicio/comparar';
import { usePaleta } from '@/tema/colores';
import { datos, espacio, texto, titulos } from '@/tema/medidas';

// La pantalla de inicio: cómo va la semana y, debajo, el botón para apuntar un
// entreno. Las dos pestañas están montadas a la vez, así que la carga se
// vuelve a leer cada vez que se enseña, como al volver de guardar un entreno.
// Va en un ScrollView, primer hijo de la pantalla, para que en el iPhone la
// barra de pestañas no tape el botón.
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
    <SafeAreaView edges={['top']} style={[estilos.pantalla, { backgroundColor: paleta.fondo }]}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <View style={estilos.cabecera}>
          {/* Con la letra grande de iOS crece como los títulos del sistema, no sin tope. */}
          <Text dynamicTypeRamp="largeTitle" style={[estilos.titulo, { color: paleta.texto }]}>
            Quimera
          </Text>
          <Text style={[estilos.lema, { color: paleta.textoTenue }]}>Tus entrenos, en tu móvil.</Text>
        </View>
        <EstaSemana carga={carga} error={error} />
        <Boton titulo="Apuntar un entreno" icono="mas" variante="principal" alPulsar={() => router.navigate('/apuntar')} />
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * La carga de esta semana, la de Quimera-web: los minutos de cada entreno por
 * su esfuerzo, sumados de lunes a domingo. Debajo, cómo va respecto a la
 * pasada y los minutos de cada disciplina. Sin ningún entreno guardado, un
 * cero enorme no dice nada: entonces sale lo que habrá aquí.
 */
function EstaSemana({ carga, error }: { carga: CargaDeInicio | null; error: string | null }) {
  const paleta = usePaleta();
  return (
    <View style={estilos.seccion}>
      <Text accessibilityRole="header" style={[estilos.tituloDeSeccion, { color: paleta.texto }]}>
        Esta semana
      </Text>
      {error !== null && <Text style={[estilos.parrafo, { color: paleta.error }]}>{error}</Text>}
      {carga !== null && !carga.hayEntrenos && (
        <Text style={[estilos.parrafo, { color: paleta.textoTenue }]}>
          Cuando apuntes tu primer entreno, aquí verás la carga de la semana y cómo va respecto a la pasada.
        </Text>
      )}
      {carga !== null && carga.hayEntrenos && (
        <>
          <Tarjeta destacada relleno={espacio[5]} style={estilos.tarjeta}>
            <View accessible accessibilityLabel={`Carga de esta semana: ${cifra(carga.estaSemana.carga)}`} style={estilos.carga}>
              <Text dynamicTypeRamp="largeTitle" style={[datos, estilos.cifra, { color: paleta.texto }]}>
                {cifra(carga.estaSemana.carga)}
              </Text>
              <Text style={[estilos.unidad, { color: paleta.textoTenue }]}>de carga</Text>
            </View>
            <Text style={[estilos.parrafo, { color: paleta.texto }]}>
              {compararConLaPasada(carga.estaSemana, carga.laPasada)}
            </Text>
            {carga.estaSemana.porDisciplina.map(({ disciplina, minutos }) => (
              <View
                key={disciplina}
                accessible
                accessibilityLabel={`${NOMBRE_DE_DISCIPLINA[disciplina]}, ${textoDeMinutos(minutos)}`}
                style={estilos.disciplina}
              >
                <View style={[estilos.marca, { backgroundColor: paleta.disciplina[disciplina].marca }]} />
                {/* Si con la letra grande no caben juntos, los minutos bajan debajo del nombre. */}
                <View style={estilos.nombreYMinutos}>
                  <Text style={[estilos.nombre, { color: paleta.texto }]}>{NOMBRE_DE_DISCIPLINA[disciplina]}</Text>
                  <Text style={[datos, estilos.minutos, { color: paleta.texto }]}>{textoDeMinutos(minutos)}</Text>
                </View>
              </View>
            ))}
          </Tarjeta>
          <Text style={[estilos.nota, { color: paleta.textoTenue }]}>
            Minutos por esfuerzo. Compara tus semanas entre sí, no unas disciplinas con otras.
          </Text>
        </>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
  },
  contenido: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: espacio[8],
    paddingHorizontal: espacio[6],
    paddingVertical: espacio[8],
  },
  cabecera: {
    alignItems: 'center',
    gap: espacio[2],
  },
  titulo: titulos.pantalla,
  lema: {
    fontSize: texto.l,
  },
  seccion: {
    gap: espacio[2],
  },
  tituloDeSeccion: titulos.seccion,
  parrafo: {
    fontSize: texto.m,
  },
  tarjeta: {
    gap: espacio[3],
  },
  carga: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: espacio[2],
  },
  cifra: {
    fontSize: texto.datoXl,
    fontWeight: '700',
  },
  unidad: {
    fontSize: texto.m,
  },
  disciplina: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[3],
  },
  marca: {
    width: espacio[1],
    alignSelf: 'stretch',
    borderRadius: espacio[1],
  },
  nombreYMinutos: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: espacio[3],
  },
  nombre: {
    fontSize: texto.m,
  },
  minutos: {
    fontSize: texto.m,
  },
  nota: {
    fontSize: texto.s,
  },
});

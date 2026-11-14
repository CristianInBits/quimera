import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CampoConPasos } from '@/componentes/CampoConPasos';
import { usePaleta } from '@/tema/colores';
import { espacio, texto, toqueMinimo } from '@/tema/medidas';

import { cambiarDescanso, pasoDeDescanso, textoDeSegundos, type EntrenoEnEdicion } from './editor';

type Cambio = (e: EntrenoEnEdicion) => EntrenoEnEdicion;

/** Un descanso escrito, dicho para leer: «1:30», «sin parar», o tal cual si no es un número de segundos. */
export function textoDelDescanso(segundos: string): string | null {
  const limpio = segundos.trim();
  if (limpio === '') return null;
  if (!/^[0-9]+$/.test(limpio)) return limpio;
  const n = Number(limpio);
  return n === 0 ? 'sin parar' : textoDeSegundos(n);
}

/**
 * Los descansos de un bloque, plegados en una línea que dice los que hay: son
 * opcionales, y abiertos ocuparían sitio en cada ejercicio. Se apuntan en
 * segundos, que es como se cuentan en el gimnasio.
 */
export function Descansos({
  bloqueId,
  nombre,
  entreSeries,
  despues,
  cambiar,
}: {
  bloqueId: string;
  /** De qué bloque son, para el lector de pantalla: «Press banca» o «la superserie de…». */
  nombre: string;
  /** El descanso entre series o entre vueltas, con su título, o null si el bloque no tiene. */
  entreSeries: { titulo: string; valor: string } | null;
  /** El descanso antes del bloque siguiente, o null en el último, que no tiene siguiente. */
  despues: string | null;
  cambiar: (cambio: Cambio) => void;
}) {
  const paleta = usePaleta();
  const [abiertos, setAbiertos] = useState(false);
  if (entreSeries === null && despues === null) {
    return null;
  }
  const entre = entreSeries === null ? null : textoDelDescanso(entreSeries.valor);
  const antes = despues === null ? null : textoDelDescanso(despues);
  const resumen =
    [
      entre === null || entreSeries === null ? null : `${entre} ${entreSeries.titulo.toLowerCase()}`,
      antes === null ? null : `${antes} antes del siguiente`,
    ]
      .filter((parte) => parte !== null)
      .join(' · ') || 'sin apuntar';

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Descansos de ${nombre}: ${resumen}`}
        accessibilityState={{ expanded: abiertos }}
        onPress={() => setAbiertos(!abiertos)}
        style={({ pressed }) => [estilos.fila, pressed && estilos.pulsado]}
      >
        <Text style={[estilos.titulo, { color: paleta.texto }]}>Descansos</Text>
        <Text style={[estilos.resumen, { color: paleta.textoTenue }]}>{resumen}</Text>
        <Text style={[estilos.flecha, { color: paleta.textoTenue }]}>{abiertos ? '▴' : '▾'}</Text>
      </Pressable>
      {abiertos && (
        <View style={estilos.campos}>
          {entreSeries !== null && (
            <CampoConPasos
              etiqueta={`${entreSeries.titulo} (segundos)`}
              etiquetaAccesible={`Descanso ${entreSeries.titulo.toLowerCase()} de ${nombre}, en segundos`}
              valor={entreSeries.valor}
              ayuda={entre !== null && entre !== entreSeries.valor.trim() ? entre : null}
              alCambiar={(valor) => cambiar((e) => cambiarDescanso(e, bloqueId, 'descansoEntreSeries', valor))}
              alDarUnPaso={(sentido) => cambiar((e) => pasoDeDescanso(e, bloqueId, 'descansoEntreSeries', sentido))}
            />
          )}
          {despues !== null && (
            <CampoConPasos
              etiqueta="Antes del siguiente (segundos)"
              etiquetaAccesible={`Descanso después de ${nombre}, en segundos`}
              valor={despues}
              ayuda={antes !== null && antes !== despues.trim() ? antes : null}
              alCambiar={(valor) => cambiar((e) => cambiarDescanso(e, bloqueId, 'descansoDespues', valor))}
              alDarUnPaso={(sentido) => cambiar((e) => pasoDeDescanso(e, bloqueId, 'descansoDespues', sentido))}
            />
          )}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: {
    minHeight: toqueMinimo,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[2],
    paddingHorizontal: espacio[3],
  },
  titulo: {
    fontSize: texto.m,
    fontWeight: '600',
  },
  resumen: {
    flex: 1,
    fontSize: texto.s,
    textAlign: 'right',
  },
  flecha: {
    fontSize: texto.m,
  },
  campos: {
    paddingHorizontal: espacio[3],
    paddingBottom: espacio[2],
    gap: espacio[3],
  },
  pulsado: {
    opacity: 0.7,
  },
});

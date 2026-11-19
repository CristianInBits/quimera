import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { EscenarioDeLaMascota, PROPORCIONES_DEL_ESFUERZO } from '@/componentes/EscenarioDeLaMascota';
import { Tarjeta } from '@/componentes/Tarjeta';
import type { EntrenoGuardado } from '@/datos/entrenos';
import { fechaEnFrase, textoDeFecha } from '@/datos/fechas';
import { palabraDelEsfuerzo } from '@/gimnasio/editor';
import { usePaleta } from '@/tema/colores';
import { datos, esLetraGrande, espacio, texto } from '@/tema/medidas';

import { partesDelTiempoGuardado, textoDelTiempoGuardado } from './textos';

/** El lado del círculo de fuera del escenario de la mascota. */
const ESCENARIO = 120;

const conMayuscula = (frase: string) => frase.charAt(0).toUpperCase() + frase.slice(1);

/**
 * Un entreno de un vistazo, en una tarjeta teñida de su disciplina: cuándo
 * fue, cuánto duró, en grande, y cuánto costó, con la mascota haciendo ese
 * esfuerzo al lado, sobre su escenario. Con la letra grande, la mascota va
 * arriba y lo demás debajo, a todo el ancho.
 */
export function ResumenDelEntreno({ entreno, hoy }: { entreno: EntrenoGuardado; hoy: string }) {
  const paleta = usePaleta();
  const { fontScale } = useWindowDimensions();
  const grande = esLetraGrande(fontScale);
  const { cifra, unidad } = partesDelTiempoGuardado(entreno.duracionMs);
  return (
    // El borde va por dentro: con él, lo de dentro empieza a 16, como en la maqueta.
    <Tarjeta testID="resumen" disciplina={entreno.disciplina} relleno={15}>
      <View testID="fila-del-resumen" style={[estilos.fila, grande && estilos.filaApilada]}>
        <View testID="columna-del-resumen" style={[estilos.columna, grande && estilos.columnaApilada]}>
          <Text
            accessibilityLabel={`${conMayuscula(fechaEnFrase(entreno.fecha, hoy))}${entreno.hora === null ? '' : `, a las ${entreno.hora}`}`}
            style={[datos, estilos.cuando, { color: paleta.texto }]}
          >
            {textoDeFecha(entreno.fecha, hoy)}
            {entreno.hora === null ? '' : `, ${entreno.hora}`}
          </Text>
          {/* Para el lector de pantalla, la duración en una frase: «55 minutos». */}
          <View testID="duracion" accessible accessibilityLabel={textoDelTiempoGuardado(entreno.duracionMs)} style={estilos.duracion}>
            {/* Un reloj largo, con la letra grande, encoge antes que partirse. */}
            <Text numberOfLines={1} adjustsFontSizeToFit style={[datos, estilos.cifra, { color: paleta.texto }]}>
              {cifra}
            </Text>
            {unidad !== null && <Text style={[estilos.unidad, { color: paleta.textoTenue }]}>{unidad}</Text>}
          </View>
          <Text style={[estilos.esfuerzo, { color: paleta.texto }]}>
            Esfuerzo {entreno.esfuerzo}, {palabraDelEsfuerzo(entreno.esfuerzo)}
          </Text>
        </View>
        <View style={estilos.escenario}>
          <EscenarioDeLaMascota
            disciplina={entreno.disciplina}
            esfuerzo={entreno.esfuerzo}
            tamano={ESCENARIO}
            proporciones={PROPORCIONES_DEL_ESFUERZO}
          />
        </View>
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio[2],
  },
  // Con la letra grande, la mascota arriba y, debajo, lo demás a todo el ancho.
  filaApilada: {
    flexDirection: 'column-reverse',
  },
  columna: {
    flex: 1,
    gap: espacio[1],
  },
  columnaApilada: {
    flex: 0,
    alignSelf: 'stretch',
  },
  cuando: {
    fontSize: texto.l,
    fontWeight: '600',
  },
  duracion: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: 6,
  },
  cifra: {
    flexShrink: 1,
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  unidad: {
    fontSize: texto.m,
  },
  esfuerzo: {
    fontSize: texto.m,
    fontWeight: '500',
  },
  // La caja del escenario, 4 más ancha por cada lado que su círculo, como en la maqueta.
  escenario: {
    paddingHorizontal: espacio[1],
  },
});

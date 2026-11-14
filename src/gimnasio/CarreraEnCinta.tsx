import { StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/componentes/Boton';
import { CampoConPasos } from '@/componentes/CampoConPasos';
import { usePaleta } from '@/tema/colores';
import { espacio, radio, texto } from '@/tema/medidas';

import { Descansos } from './Descansos';
import {
  cambiarCarrera,
  pasoDeCarrera,
  quitarBloque,
  type BloqueDeCarrera,
  type EntrenoEnEdicion,
  type NombreDeBloque,
} from './editor';

type Cambio = (e: EntrenoEnEdicion) => EntrenoEnEdicion;

/**
 * Una carrera dentro del entreno, como el calentamiento en cinta: la distancia
 * y los minutos, a la vista, sin series que abrir.
 */
export function CarreraEnCinta({
  bloque,
  nombre,
  ultimo,
  cambiar,
  conDeshacer,
}: {
  bloque: BloqueDeCarrera;
  /** Cómo se nombra para el lector de pantalla y en los avisos: «la carrera en cinta (la 2.ª)» si hay varias. */
  nombre: NombreDeBloque;
  /** El último bloque no tiene descanso hasta el siguiente. */
  ultimo: boolean;
  cambiar: (cambio: Cambio) => void;
  /** Hace un cambio que se puede deshacer desde el aviso, como quitarla. */
  conDeshacer: (aviso: string, cambio: Cambio) => void;
}) {
  const paleta = usePaleta();
  return (
    <View style={[estilos.bloque, { borderColor: paleta.textoTenue }]}>
      <View style={estilos.cabecera}>
        <Text accessibilityRole="header" style={[estilos.titulo, { color: paleta.texto }]}>
          Carrera en cinta
        </Text>
        <Boton
          titulo="Quitar"
          etiqueta={`Quitar ${nombre.enFrase}`}
          variante="sutil"
          color={paleta.textoTenue}
          alPulsar={() => conDeshacer(`${nombre.alEmpezar} quitada`, (e) => quitarBloque(e, bloque.id))}
        />
      </View>
      <View style={estilos.campos}>
        <CampoConPasos
          etiqueta="Distancia (km)"
          etiquetaAccesible={`Distancia de ${nombre.enFrase}, en kilómetros`}
          valor={bloque.kilometros}
          decimales
          alCambiar={(kilometros) => cambiar((e) => cambiarCarrera(e, bloque.id, { kilometros }))}
          alDarUnPaso={(sentido) => cambiar((e) => pasoDeCarrera(e, bloque.id, 'kilometros', sentido))}
        />
        <CampoConPasos
          etiqueta="Tiempo (minutos)"
          etiquetaAccesible={`Tiempo de ${nombre.enFrase}, en minutos`}
          valor={bloque.minutos}
          alCambiar={(minutos) => cambiar((e) => cambiarCarrera(e, bloque.id, { minutos }))}
          alDarUnPaso={(sentido) => cambiar((e) => pasoDeCarrera(e, bloque.id, 'minutos', sentido))}
        />
      </View>
      <Descansos
        bloqueId={bloque.id}
        nombre={nombre.enFrase}
        entreSeries={null}
        despues={ultimo ? null : bloque.descansoDespues}
        cambiar={cambiar}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radio,
    paddingVertical: espacio[2],
    gap: espacio[2],
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: espacio[3],
  },
  titulo: {
    flex: 1,
    fontSize: texto.l,
    fontWeight: '700',
  },
  campos: {
    paddingHorizontal: espacio[3],
    gap: espacio[3],
  },
});

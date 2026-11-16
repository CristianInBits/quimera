import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { deFecha, fechaLocal, horaLocal, textoDeFecha } from '@/datos/fechas';
import { usePaleta } from '@/tema/colores';
import { datos, espacio, texto } from '@/tema/medidas';

import { Boton } from './Boton';

/** El primer día que admite la base. */
const PRIMER_DIA = '2000-01-01';

/**
 * El día y la hora en que empezó el entreno. Salen los de ahora, y se cambian
 * con el selector del sistema: el diálogo de Android, o el del iPhone debajo.
 * Solo deja elegir días entre el año 2000 y hoy, que es lo que admite la base.
 */
export function CampoDeFecha({
  fecha,
  hora,
  hoy,
  alCambiar,
}: {
  fecha: string;
  hora: string | null;
  hoy: string;
  alCambiar: (fecha: string, hora: string | null) => void;
}) {
  const paleta = usePaleta();
  const [enIos, setEnIos] = useState<'date' | 'time' | null>(null);
  const instante = deFecha(fecha);
  if (hora !== null) {
    const [h, m] = hora.split(':').map(Number);
    instante.setHours(h, m);
  }

  const elegir = (modo: 'date' | 'time', elegido: Date) => {
    if (modo === 'date') {
      alCambiar(fechaLocal(elegido), hora);
    } else {
      alCambiar(fecha, horaLocal(elegido));
    }
  };

  const abrir = (modo: 'date' | 'time') => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: instante,
        mode: modo,
        is24Hour: true,
        minimumDate: modo === 'date' ? deFecha(PRIMER_DIA) : undefined,
        maximumDate: modo === 'date' ? deFecha(hoy) : undefined,
        onValueChange: (_evento, elegido) => elegir(modo, elegido),
      });
    } else {
      setEnIos(enIos === modo ? null : modo);
    }
  };

  return (
    <View style={estilos.contenedor}>
      <Text style={[datos, estilos.valor, { color: paleta.texto }]}>
        {textoDeFecha(fecha, hoy)}
        {hora === null ? '' : `, ${hora}`}
      </Text>
      <View style={estilos.botones}>
        <Boton titulo="Cambiar el día" icono="calendario" variante="tonal" alPulsar={() => abrir('date')} />
        <Boton titulo="Cambiar la hora" icono="reloj" variante="tonal" alPulsar={() => abrir('time')} />
      </View>
      {Platform.OS === 'ios' && enIos !== null && (
        <DateTimePicker
          value={instante}
          mode={enIos}
          display="inline"
          minimumDate={enIos === 'date' ? deFecha(PRIMER_DIA) : undefined}
          maximumDate={enIos === 'date' ? deFecha(hoy) : undefined}
          onValueChange={(_evento, elegido) => elegir(enIos, elegido)}
          onDismiss={() => setEnIos(null)}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    gap: espacio[1],
  },
  valor: {
    marginLeft: espacio[1],
    fontSize: texto.l,
    fontWeight: '600',
  },
  // Con la letra grande, «Cambiar la hora» baja a otra línea en vez de cortarse.
  botones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacio[2],
  },
});

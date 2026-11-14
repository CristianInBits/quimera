import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { KeyboardAvoidingView, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Aparta el contenido del teclado en los dos sistemas. En Android, con la app
 * dibujada de borde a borde como en Expo 58, la ventana ya no encoge al abrir
 * el teclado, así que hace falta igual que en el iPhone.
 *
 * KeyboardAvoidingView necesita saber a qué altura de la pantalla empieza,
 * que depende de la cabecera: se mide al colocarse en lugar de suponerla.
 */
export function EvitarTeclado({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const caja = useRef<ComponentRef<typeof View>>(null);
  const [desdeArriba, setDesdeArriba] = useState(0);
  return (
    <View
      ref={caja}
      style={{ flex: 1 }}
      onLayout={() => caja.current?.measureInWindow((_x, y) => setDesdeArriba(y))}
    >
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={desdeArriba} style={style}>
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

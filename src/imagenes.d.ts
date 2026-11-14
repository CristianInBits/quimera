// Una imagen importada, como los dibujos de las mascotas, es la fuente de un
// <Image>. Expo no lo declara para TypeScript.
declare module '*.png' {
  import type { ImageSourcePropType } from 'react-native';

  const imagen: ImageSourcePropType;
  export default imagen;
}

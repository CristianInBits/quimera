# Quimera

App para apuntar entrenamientos de gimnasio, hyrox, calistenia, carrera y natación, en iPhone y en Android.

Está en construcción. Se hace con Expo y React Native en TypeScript, y los datos se guardan solo en el móvil de cada persona: no hay servidor ni cuentas.

## Privacidad del repositorio

El repositorio es público, así que nada privado puede entrar en él. Al clonarlo hay que activar las comprobaciones que corren antes de cada commit y de cada subida:

```bash
git config core.hooksPath .githooks
```

Rechazan el commit si lleva ficheros de herramientas locales o de la carpeta `privado/`, claves o credenciales, correos que no sean de ejemplo, rutas de una carpeta personal o alguno de los datos personales que cada uno apunta en `privado/palabras-prohibidas.txt`, que no se sube. Para revisar todo el repositorio y su historia de una vez:

```bash
sh scripts/comprobar-privacidad.sh --todo
```

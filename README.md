# Quimera

App para apuntar entrenamientos de gimnasio, hyrox, calistenia, carrera y natación, en iPhone y en Android.

Está en construcción. Se hace con Expo y React Native en TypeScript, y los datos se guardan solo en el móvil de cada persona: no hay servidor ni cuentas.

## Cómo arrancarla

Node va en un entorno de [micromamba](https://mamba.readthedocs.io/) dentro del proyecto, en `.entorno/`, que no se sube:

```bash
micromamba create -y -p ./.entorno -c conda-forge nodejs=26
micromamba activate ./.entorno
npm install
npm start
```

En Windows, `scripts\arrancar.cmd` hace lo mismo que `npm start` sin activar nada: pone delante el Node de `.entorno/`.

Al arrancar sale un código QR: se escanea con Expo Go en el móvil, conectado a la misma wifi que el ordenador. Las comprobaciones son `npm test`, `npm run lint` y `npm run tipos`.

## Documentación

- [Las copias de los datos](docs/copias.md): qué lleva una copia, cómo se hace y todo lo que puede pasar al importarla.

## Privacidad del repositorio

El repositorio es público, así que nada privado puede entrar en él. Al clonarlo hay que activar las comprobaciones que corren antes de cada commit y de cada subida:

```bash
git config core.hooksPath .githooks
```

Rechazan el commit si lleva ficheros de herramientas locales o de la carpeta `privado/`, claves o credenciales, correos que no sean de ejemplo, rutas de una carpeta personal o alguno de los datos personales que cada uno apunta en `privado/palabras-prohibidas.txt`, que no se sube. Para revisar todo el repositorio y su historia de una vez:

```bash
sh scripts/comprobar-privacidad.sh --todo
```

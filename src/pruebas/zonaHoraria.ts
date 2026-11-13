/// <reference types="node" />
// Antes de todas las pruebas: una zona horaria al oeste de UTC y con cambio de
// hora. Así las pruebas de fechas notan que algo use la fecha en UTC en lugar
// de la local, también en una máquina que esté en UTC. Las pruebas heredan la
// zona porque Jest las lanza después de esto.
export default function fijarZonaHoraria(): void {
  process.env.TZ = 'America/Los_Angeles';
}

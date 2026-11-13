// Las migraciones de la base del móvil, en orden. La posición i deja la base en
// la versión i + 1 (PRAGMA user_version). prepararBase aplica las pendientes.
//
// Reglas, porque cada migración se aplica una sola vez en cada móvil y no se
// puede deshacer:
// - Una migración que ya se ha aplicado en algún móvil no se cambia nunca. Las
//   pruebas fijan su huella, y la app no abre una base cuyas migraciones no
//   coinciden con las de su código.
// - Solo se añaden tablas, índices, vistas, disparadores, filas de claves fijas
//   y columnas (ALTER TABLE ADD COLUMN). Nada de DROP ni RENAME: rehacer una
//   tabla borraría en cascada sus filas hijas.
// - Al añadir una columna a una tabla STRICT, SQLite vuelve a comprobar todos
//   los CHECK de la tabla en todas sus filas. Por eso los CHECK no usan
//   funciones de fecha y hora cuando basta un GLOB: su resultado cambia entre
//   versiones de SQLite (strftime('%H:%M', '24:00') da '24:00' en el SQLite
//   3.53.3 del móvil y '00:00' en el 3.54 de las pruebas), y una fila que
//   aceptó una versión dejaría la app sin arrancar con otra.
// - Una columna nueva admite NULL o lleva un DEFAULT que cumple su CHECK. Si
//   su CHECK mira también otra columna, se escribe «columna IS NULL OR
//   (condición)»: escrito como «(condición) AND otra», las filas viejas que no
//   cumplen la otra parte darían falso.
// - Ninguna tabla nueva apunta con clave foránea a bloque ni a serie: guardar
//   un entreno los borra y los vuelve a escribir, y la cascada se llevaría por
//   delante esas filas. Las pruebas lo comprueban.
// - Una columna nueva no se llama como las que añaden las vistas (lunes,
//   minutos, carga, fecha, hora, disciplina, entreno_id ni bloque_orden),
//   porque las vistas usan «*» y el nombre se repetiría.
// - Solo comillas simples. Las funciones de fecha no leen el reloj ni la zona
//   del móvil (now, localtime, CURRENT_TIMESTAMP), porque las fechas las pone
//   la app. Sin transacciones ni PRAGMA, que los pone prepararBase; y END solo
//   para cerrar disparadores, porque suelto equivale a COMMIT.
// - Una migración que corrige datos no sube los sellos de modificación.
//
// Las unidades son siempre enteras: gramos, metros y milisegundos. Los sellos
// de modificación son milisegundos desde 1970 en UTC, y la marca de borrado
// vale 0 o 1.

export const MIGRACIONES: readonly string[] = [
  // 1. La base común (paso 2).
  `
-- Las cinco disciplinas. Añadir otra es un INSERT en una migración.
CREATE TABLE disciplina (
  id TEXT PRIMARY KEY NOT NULL CHECK (id GLOB '[a-z]*' AND id NOT GLOB '*[^a-z]*' AND length(id) <= 20)
) STRICT;

INSERT INTO disciplina (id) VALUES ('gimnasio'), ('hyrox'), ('calistenia'), ('carrera'), ('natacion');

-- Los ejercicios: los del catálogo de la app, con una clave legible y fija
-- (propio = 0), y los que crea cada persona, con un UUID v7 (propio = 1). Los
-- usa_* dicen qué mide cada uno.
CREATE TABLE ejercicio (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) BETWEEN 2 AND 64 AND id NOT GLOB '*[^a-z0-9-]*'),
  nombre TEXT NOT NULL CHECK (length(trim(nombre, ' ' || char(9, 10, 13))) BETWEEN 1 AND 80),
  grupo TEXT NOT NULL CHECK (grupo GLOB '[a-z]*' AND grupo NOT GLOB '*[^a-z_]*' AND length(grupo) <= 30),
  usa_repeticiones INTEGER NOT NULL CHECK (usa_repeticiones IN (0, 1)),
  usa_peso INTEGER NOT NULL CHECK (usa_peso IN (0, 1)),
  usa_tiempo INTEGER NOT NULL CHECK (usa_tiempo IN (0, 1)),
  usa_distancia INTEGER NOT NULL CHECK (usa_distancia IN (0, 1)),
  usa_calorias INTEGER NOT NULL CHECK (usa_calorias IN (0, 1)),
  propio INTEGER NOT NULL CHECK (propio IN (0, 1)),
  modificado INTEGER NOT NULL CHECK (modificado >= 1700000000000),
  borrado INTEGER NOT NULL DEFAULT 0 CHECK (borrado IN (0, 1)),
  CHECK (usa_repeticiones + usa_peso + usa_tiempo + usa_distancia + usa_calorias >= 1),
  CHECK (propio = (id GLOB '????????-????-7???-[89ab]???-????????????' AND id NOT GLOB '*[^0-9a-f-]*' AND length(replace(id, '-', '')) = 32))
) STRICT;

-- Cada entreno hecho: el día y la hora locales en que empezó, sin zona
-- horaria; la duración, de 1 minuto a 48 horas; y el esfuerzo, del 1 al 10.
-- La hora va de 00:00 a 23:59 y se comprueba con GLOB, no con strftime, que
-- acepta 24:00 en unas versiones de SQLite y en otras no.
CREATE TABLE entreno (
  id TEXT PRIMARY KEY NOT NULL CHECK (id GLOB '????????-????-7???-[89ab]???-????????????' AND id NOT GLOB '*[^0-9a-f-]*' AND length(replace(id, '-', '')) = 32),
  disciplina TEXT NOT NULL REFERENCES disciplina (id),
  fecha TEXT NOT NULL CHECK (date(fecha) IS fecha AND fecha BETWEEN '2000-01-01' AND '2099-12-31'),
  hora TEXT CHECK (hora GLOB '[0-2][0-9]:[0-5][0-9]' AND hora < '24:00'),
  duracion_ms INTEGER NOT NULL CHECK (duracion_ms BETWEEN 60000 AND 172800000),
  esfuerzo INTEGER NOT NULL CHECK (esfuerzo BETWEEN 1 AND 10),
  notas TEXT CHECK (length(trim(notas, ' ' || char(9, 10, 13))) > 0 AND length(notas) <= 4000),
  modificado INTEGER NOT NULL CHECK (modificado >= 1700000000000),
  borrado INTEGER NOT NULL DEFAULT 0 CHECK (borrado IN (0, 1))
) STRICT;

CREATE INDEX entreno_por_fecha ON entreno (fecha);

-- Las partes de un entreno, en orden. Un bloque con metros_corridos es un
-- bloque de carrera, en cualquier disciplina: guarda todo lo corrido, con
-- calentamiento y recuperaciones, y es lo que sumarán las zapatillas.
-- tiempo_ms es lo que duró el bloque entero, y descanso_ms, el descanso hasta
-- el bloque siguiente.
CREATE TABLE bloque (
  id TEXT PRIMARY KEY NOT NULL CHECK (id GLOB '????????-????-7???-[89ab]???-????????????' AND id NOT GLOB '*[^0-9a-f-]*' AND length(replace(id, '-', '')) = 32),
  entreno_id TEXT NOT NULL REFERENCES entreno (id) ON DELETE CASCADE,
  orden INTEGER NOT NULL CHECK (orden BETWEEN 1 AND 1000),
  metros_corridos INTEGER CHECK (metros_corridos BETWEEN 1 AND 1000000),
  tiempo_ms INTEGER CHECK (tiempo_ms BETWEEN 1000 AND 172800000),
  descanso_ms INTEGER CHECK (descanso_ms BETWEEN 0 AND 86400000),
  modificado INTEGER NOT NULL CHECK (modificado >= 1700000000000),
  borrado INTEGER NOT NULL DEFAULT 0 CHECK (borrado IN (0, 1)),
  UNIQUE (entreno_id, orden)
) STRICT;

-- Una fila por cada cosa hecha y por vuelta: la vuelta (ronda), su sitio en
-- la vuelta (orden), el ejercicio y lo que se midió. descanso_ms es el
-- descanso que vino después: 0 es sin parar, y NULL, que no se apuntó. El
-- descanso después de la última serie de una vuelta es el descanso entre
-- vueltas.
CREATE TABLE serie (
  id TEXT PRIMARY KEY NOT NULL CHECK (id GLOB '????????-????-7???-[89ab]???-????????????' AND id NOT GLOB '*[^0-9a-f-]*' AND length(replace(id, '-', '')) = 32),
  bloque_id TEXT NOT NULL REFERENCES bloque (id) ON DELETE CASCADE,
  ronda INTEGER NOT NULL CHECK (ronda BETWEEN 1 AND 1000),
  orden INTEGER NOT NULL CHECK (orden BETWEEN 1 AND 1000),
  ejercicio_id TEXT NOT NULL REFERENCES ejercicio (id),
  repeticiones INTEGER CHECK (repeticiones BETWEEN 1 AND 10000),
  peso_g INTEGER CHECK (peso_g BETWEEN 1 AND 1000000),
  tiempo_ms INTEGER CHECK (tiempo_ms BETWEEN 1 AND 86400000),
  distancia_m INTEGER CHECK (distancia_m BETWEEN 1 AND 1000000),
  calorias INTEGER CHECK (calorias BETWEEN 1 AND 10000),
  descanso_ms INTEGER CHECK (descanso_ms BETWEEN 0 AND 86400000),
  modificado INTEGER NOT NULL CHECK (modificado >= 1700000000000),
  borrado INTEGER NOT NULL DEFAULT 0 CHECK (borrado IN (0, 1)),
  UNIQUE (bloque_id, ronda, orden),
  CHECK (repeticiones IS NOT NULL OR tiempo_ms IS NOT NULL OR distancia_m IS NOT NULL OR calorias IS NOT NULL)
) STRICT;

CREATE INDEX serie_por_ejercicio ON serie (ejercicio_id, bloque_id);

-- Los ajustes, con su valor en JSON. Las claves local.* son de este móvil y
-- no viajan al exportar.
CREATE TABLE ajuste (
  clave TEXT PRIMARY KEY NOT NULL CHECK (length(clave) <= 64 AND clave GLOB '[a-z]*' AND clave NOT GLOB '*[^a-z0-9._]*'),
  valor TEXT NOT NULL CHECK (json_valid(valor)),
  modificado INTEGER NOT NULL CHECK (modificado >= 1700000000000)
) STRICT;

-- Los entrenos sin borrar, con el lunes de su semana, sus minutos redondeados
-- y su carga (minutos por esfuerzo). Todas las sumas leen de estas vistas.
CREATE VIEW entreno_hecho AS
SELECT e.*,
       date(e.fecha, '-6 days', 'weekday 1') AS lunes,
       (e.duracion_ms + 30000) / 60000 AS minutos,
       (e.duracion_ms + 30000) / 60000 * e.esfuerzo AS carga
FROM entreno AS e
WHERE e.borrado = 0;

CREATE VIEW bloque_hecho AS
SELECT b.*, e.fecha, e.disciplina
FROM bloque AS b
JOIN entreno AS e ON e.id = b.entreno_id
WHERE b.borrado = 0 AND e.borrado = 0;

CREATE VIEW serie_hecha AS
SELECT s.*, b.entreno_id, b.orden AS bloque_orden, e.fecha, e.hora, e.disciplina
FROM serie AS s
JOIN bloque AS b ON b.id = s.bloque_id
JOIN entreno AS e ON e.id = b.entreno_id
WHERE s.borrado = 0 AND b.borrado = 0 AND e.borrado = 0;

-- Borrar o restaurar un entreno marca o desmarca sus bloques y sus series, con
-- el mismo sello.
CREATE TRIGGER entreno_marca_sus_hijas
AFTER UPDATE OF borrado ON entreno
WHEN NEW.borrado IS NOT OLD.borrado
BEGIN
  UPDATE bloque SET borrado = NEW.borrado, modificado = NEW.modificado WHERE entreno_id = NEW.id;
  UPDATE serie SET borrado = NEW.borrado, modificado = NEW.modificado
   WHERE bloque_id IN (SELECT id FROM bloque WHERE entreno_id = NEW.id);
END;
`,
];

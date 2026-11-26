# Las copias de los datos

Quimera guarda los datos solo en el móvil: no hay servidor ni cuentas. La copia es un archivo JSON que se hace y se importa en la pantalla «Tus datos». Es la única vía que da Quimera para pasar los datos de un móvil a otro, también entre un iPhone y un Android, y su única protección si se pierde el móvil o se borra la app. En Android, la copia de seguridad de Google puede guardar además los datos de la app por su cuenta, como se explica en «Límites conocidos», pero Quimera no cuenta con ella.

Este documento explica qué lleva una copia, cómo se hace y todo lo que puede pasar al importarla. Las reglas del formato, de la persona y de cómo se juntan los datos, con sus razones, están también en el comentario del principio de `src/datos/copia.ts`; las demás, en los comentarios de las funciones y de la pantalla que se listan en «Dónde está en el código». Si cambia la copia o la importación, este documento cambia con ellas.

## Palabras que se usan aquí

- **Sello:** la hora del último cambio de un entreno, de un ejercicio propio o de un ajuste, en milisegundos desde 1970 (la columna `modificado`). Nunca baja: si el reloj del móvil va hacia atrás, el cambio lleva el sello anterior más uno. Nunca es menor que el sello mínimo (`SELLO_MINIMO`, el 14 de noviembre de 2023 a las 22:13:20 UTC), que es también el sello que lleva lo que entra de la copia de otra persona. Al juntar dos versiones de lo mismo, gana la del sello mayor.
- **Marca de borrado:** la columna `borrado`. Un entreno borrado no desaparece de la base: se queda marcado, para que el borrado viaje en las copias y el entreno no reaparezca al importar en otro móvil.
- **Persona:** el identificador que dice de quién son los datos de una instalación de Quimera. Se explica en «De quién es la copia».
- **Transacción:** un grupo de escrituras en la base que entra entero o no entra nada.

## Para qué sirve

| Caso | Qué se hace | Qué pasa |
|---|---|---|
| Guardar los datos fuera del móvil | «Hacer una copia» y guardarla fuera del móvil y solo para ti, en Drive o en el correo, por ejemplo | La copia solo protege si queda fuera del móvil. Con «Sí, la he guardado» cuenta como la última copia: Quimera no puede saber dónde se guardó |
| Recuperar los datos en un móvil nuevo, o después de reinstalar Quimera | «Importar una copia» y contestar «Sí, es mía» | Entra todo y, si el móvil no tenía ningún entreno sin borrar, la copia cuenta como su última copia, con la hora en que se hizo |
| Juntar dos móviles propios, como el móvil y la tableta | Importar en cada uno la copia del otro y contestar «Sí, es mía» la primera vez | De cada entreno queda su versión más reciente, y desde entonces no se pregunta en ningún sentido |
| Llevar los entrenos de un móvil a otro que solo los recibe, como del móvil a la tableta | Importar en la tableta cada copia nueva del móvil y contestar «Sí, es mía» la primera vez | Cada copia trae lo que cambió en el móvil, también lo borrado; lo que la tableta tenga más reciente se queda, y desde la segunda copia no pregunta |
| Importar otra vez una copia ya importada como propia, o una de este mismo móvil | «Importar una copia» | No pregunta y no cambia nada de lo que se ve |
| Volver atrás con una copia anterior, o recuperar con ella un entreno borrado después de hacerla | «Importar una copia» | No sirve: lo que se corrigió o se borró después en el móvil tiene un sello mayor y se queda como está |
| Juntar con los tuyos los entrenos de otra persona | Importar su copia y contestar «No, es de otra persona» | Sus entrenos se mezclan con los tuyos, y lo tuyo no cambia |

## Qué lleva una copia

- **El nombre:** `quimera-2026-11-25-1830.json`, con la fecha y la hora locales en que se hizo. Con la hora, dos copias del mismo día, como la del móvil y la de la tableta, no se llaman igual, salvo que se hagan en el mismo minuto.
- **La cabecera:** `formato` («quimera»), `version` (la del formato, hoy 1), `app` (la versión de Quimera que la hizo), `base` (la versión del esquema de la base), `catalogo` (la versión del catálogo de ejercicios), `exportado` y `persona`. `exportado` es la hora del reloj del móvil al hacerla, en milisegundos. No es un sello y no decide qué versión gana al importar: vale cualquier hora desde 1970, para que una copia hecha con el reloj atrasado se pueda leer igual, y solo se usa para la línea de la copia y para la última copia.
- **Los entrenos**, también los borrados, con su sello y su marca. Cada uno lleva dentro sus bloques, en orden, y las series de cada bloque, con los nombres y las unidades enteras de la base: gramos, metros y milisegundos. De un entreno borrado no viajan sus notas ni sus bloques, porque para juntar móviles bastan su identificador, su sello y su marca; su disciplina, su fecha, su hora, su duración y su esfuerzo sí viajan, porque el formato los pide. El formato es el mismo: una copia con los borrados enteros, como `copia-v1.json`, se importa igual.
- **Los ejercicios propios**, los que crea la persona, también los borrados, enteros y con su nombre, porque los entrenos que los usan los siguen nombrando. Los ejercicios del catálogo no viajan: las series los nombran por su clave, que es la misma en todos los móviles.
- **Los ajustes que viajan**, con su clave, su valor y su sello. Un ajuste que viaja no se borra nunca: para volver a su valor por defecto se guarda null, porque nada se borra porque falte en la copia y el valor viejo volvería con la siguiente importación. Los ajustes «local.*» son de cada móvil y no viajan nunca, como la última copia, las personas recordadas o el entreno a medias del editor. La persona va en la cabecera, no entre los ajustes.

Hoy no hay ninguna pantalla para crear ejercicios propios ni ajustes que viajen, así que una copia hecha con la app lleva, en la práctica, la cabecera y los entrenos.

## Hacer una copia

1. Inicio lleva el botón «Tus datos» junto al nombre de la app, o debajo del lema si no cabe. Abre la pantalla encima de las pestañas.
2. Sin ningún entreno sin borrar, la tarjeta «Hacer una copia» dice «Todavía no tienes entrenos que copiar.», sin botón y sin nada de la última copia; entonces «Importar una copia» pasa a ser el botón principal.
3. «Hacer una copia» prepara el archivo en la caché de la app, en la carpeta `copias`, y abre la hoja de compartir del sistema para guardarlo donde se quiera. Hasta que se cierra la hoja, el botón dice «Preparando la copia» y está desactivado. Al preparar un archivo, borra los de otros días; los de hoy se quedan, porque la app con la que se compartió uno puede estar leyéndolo todavía.
4. Al cerrarse la hoja, la tarjeta pregunta «¿Has guardado la copia?», con «Quimera no puede saber si la guardaste o cerraste la hoja sin guardarla.», porque ni Android ni el iPhone dicen si se guardó. Solo «Sí, la he guardado» apunta la copia como la última; «No» deja todo como estaba. Mientras se apunta, «Sí, la he guardado» y «No» están desactivados. Con la pregunta a la vista se puede salir de la pantalla, pero entonces la copia no se apunta, igual que con «No». Mientras pregunta, la tarjeta quita su explicación y no dice «Todavía no has hecho ninguna copia en este móvil.», que parecería decir que la copia ha fallado; si ya había una última copia apuntada, la sigue enseñando.
5. La tarjeta dice cuándo se hizo la última copia que se sabe guardada fuera del móvil, por días del calendario y no por horas: «Última copia: hoy.», «Última copia: ayer.», «Última copia: hace 12 días.» o «Todavía no has hecho ninguna copia en este móvil.».

Si algo falla, la tarjeta lo dice y deja probar otra vez:

- «No se pudo hacer la copia. Prueba otra vez. (detalle)», por ejemplo si no se puede abrir la hoja de compartir.
- «No se pudo hacer la copia: algo guardado no cabe en ella. (detalle)». Antes de compartirla, la copia pasa por las mismas comprobaciones que el archivo de una copia al importarlo, todas menos la comparación con el móvil que la reciba: si algo de la base no cabe en el formato, falla al hacerla, con el móvil delante, y no al restaurarla, cuando quizá el móvil ya no está. Entonces no deja nada escrito, ni siquiera la persona, y no abre la hoja de compartir. El detalle dice dónde está el problema, como «entrenos[3].notas no es válido».
- «No se pudo apuntar que la has guardado. Prueba otra vez. (detalle)», y deja contestar otra vez.

### La última copia

Se guarda en el ajuste local `local.ultima_copia`, en milisegundos, y no viaja: cada móvil sabe de sus copias. La usará el recordatorio mensual, que todavía no está hecho. Sus reglas:

- La apunta «Sí, la he guardado», con la hora en que se hizo la copia. También la apunta importar una copia propia en un móvil sin ningún entreno sin borrar, como se explica en «De quién es la copia». Si ese móvil tenía entrenos borrados que la copia trae vivos, con un sello anterior, en el móvil siguen borrados y la copia cuenta igual como la última, aunque esos entrenos volverían si la copia se restaurara en otro móvil.
- No retrocede: una copia más antigua que la apuntada no la cambia. La excepción es una apuntada que va por delante del reloj: la siguiente la sustituye, aunque sea anterior.
- Una copia hecha a una hora posterior a la de este móvil, porque el reloj del móvil que la hizo iba adelantado, cuenta con la hora de este móvil.
- Si la hora de la copia o la de este móvil es anterior al sello mínimo, que solo da un reloj atrasado, no se apunta nada. Si el reloj está atrasado pero la hora es posterior al sello mínimo, se apunta esa hora atrasada.
- Una apuntada que va más de un día por delante del reloj, porque se apuntó con el reloj adelantado, no cuenta, y la pantalla dice que no hay ninguna copia. Una que va como mucho un día por delante sigue contando y se dice como de hoy.

## Importar una copia, paso a paso

1. «Importar una copia» abre el selector de archivos del sistema, sin filtrar por tipo, porque Drive puede dar una copia como `application/octet-stream`. Si se cierra sin elegir nada, la tarjeta vuelve a su principio, con «Importar una copia», sin el error ni el resultado de la importación anterior que tuviera a la vista. Si el selector falla, expo-file-system lo da como cerrado sin elegir; si un día el selector lanzara un error, la tarjeta diría «No se pudo leer el archivo. Prueba otra vez. (detalle)».
2. Con «Leyendo la copia» a la vista, Quimera lee el archivo entero y lo comprueba antes de tocar nada:
   - un archivo de más de 50 MB no se lee, porque no es una copia: diez años de entrenos diarios no llegan a la mitad;
   - el texto se saca de los bytes como UTF-8, igual en Android y en el iPhone, y vale también con la marca de orden de bytes delante, como lo guardan algunos editores de texto; lo que no es UTF-8 no falla al leerlo, pero una foto, por ejemplo, deja de ser JSON;
   - tiene que ser JSON con `"formato": "quimera"`, y una versión del formato más nueva pide actualizar Quimera;
   - cada campo pasa las comprobaciones de la base y algunas más, sin campos desconocidos ni identificadores repetidos; los casos están en «Archivos que no se importan»;
   - después, todavía con «Leyendo la copia», se compara con el móvil: cada disciplina de los entrenos tiene que existir en el móvil, y cada ejercicio de las series, en el móvil o entre los ejercicios propios de la copia.
3. Arriba sale la línea de la copia, para reconocerla: «Copia hecha el viernes 20 de noviembre, con 52 entrenos.», con «hoy» o «ayer» cuando toca. Cuenta solo los entrenos sin borrar. Si la copia es de otro año, la fecha lleva el año: «Copia hecha el viernes 7 de noviembre de 2025, con 52 entrenos.». Si no trae ningún entreno sin borrar, dice «sin entrenos», como en «Copia hecha hoy, sin entrenos.». Va sin la fecha, como en «Copia con 52 entrenos.» o «Copia sin entrenos.», si la hora de la copia es anterior al sello mínimo o de 2100 en adelante, que solo dan un reloj atrasado o una copia editada a mano.
4. Si hace falta, pregunta «¿Esta copia es tuya?», como se explica en «De quién es la copia».
5. Enseña lo que va a cambiar, sin haber escrito nada todavía, como se explica en «Lo que enseña antes de importar».
6. Solo «Importar» escribe, en una sola transacción. Mientras importa, el botón dice «Importando» y todo está desactivado, también «Cancelar». Si algo falla a medias, no entra nada, ni siquiera la persona que el móvil iba a estrenar, y la tarjeta dice «No se pudo importar la copia. No ha cambiado nada: prueba otra vez. (detalle)», con lo que va a cambiar todavía a la vista; «Importar» vuelve a responder pasado medio segundo.
7. Al acabar, la tarjeta vuelve a su principio y dice encima lo que ha cambiado, solo con lo que no es cero: «Copia importada. Han entrado 12 entrenos, se han actualizado 3 y se ha borrado 1.», o «Copia importada. No ha cambiado nada de lo que ves.». Después de los entrenos van los ejercicios propios y los ajustes, y los ajustes que no estaban cuentan como actualizados, como en «Copia importada. Han entrado 2 entrenos, ha entrado 1 ejercicio, se han borrado 3 y se han actualizado 2 ajustes.». A la vez se pone al día la tarjeta «Hacer una copia»: si la copia ha contado como la última, dice cuándo se hizo, como «Última copia: hoy.».

«Cancelar», en la pregunta o en lo que va a cambiar, devuelve la tarjeta a su principio, con «Importar una copia», sin tocar nada: tampoco recuerda la persona de la copia, aunque se hubiera contestado «sí».

## De quién es la copia

Cada instalación de Quimera tiene su persona, un identificador que nace la primera vez que hace falta, al hacer o al importar una copia, y que no cambia nunca: un móvil nunca toma la persona de una copia. Por eso la persona identifica, en realidad, una instalación: el móvil, la tableta y cada reinstalación de una misma persona tienen una distinta. Así, un móvil nuevo o reinstalado que restaura una copia estrena una persona nueva, y los demás móviles propios preguntan una vez por sus copias. La excepción es una reinstalación en Android que recupera la base desde la copia de seguridad de Google, como se cuenta en «Límites conocidos»: con la base vuelve también la persona de antes.

Además, cada móvil recuerda, en el ajuste local `local.personas`, las otras personas a las que contestó «sí». Ese ajuste no viaja y no se olvida.

**Cuándo pregunta.** Pregunta «¿Esta copia es tuya?» si la persona de la copia no es la del móvil ni una que el móvil ya aceptó como suya. También pregunta en un móvil recién estrenado, sin datos: si no lo hiciera, recordaría como suya la persona de la copia de un amigo, tomaría sus ajustes, y las copias siguientes del amigo entrarían sin preguntar. No pregunta con una copia del propio móvil ni con la de un móvil al que ya se contestó «sí». Debajo de la pregunta, la tarjeta explica: «Viene de otro móvil, o de antes de reinstalar Quimera. Si la hizo otra persona en su móvil, contesta que no.». Las dos respuestas pesan lo mismo, y cada una dice debajo lo que pasa: bajo «Sí, es mía», «Se junta con lo que tienes: de cada entreno queda su última versión. Con las próximas copias de ese móvil, Quimera ya no lo preguntará.»; bajo «No, es de otra persona», «Sus entrenos se mezclan con los tuyos: salen en tu historial, cuentan en tu semana y van en tus copias, y solo se quitan borrándolos uno a uno. Lo tuyo no cambia.». Al final va «Cancelar».

**Si la copia es tuya**, porque se contesta «Sí, es mía» o porque no hace falta preguntar:

- los datos se juntan con las reglas de «Cómo se juntan los datos»: de cada entreno queda su versión más reciente;
- el móvil toma los ajustes más recientes de la copia;
- con «sí», recuerda la persona de la copia, y sus copias siguientes ya no preguntan, aunque vayan siempre en el mismo sentido, como de un móvil a una tableta que solo las recibe;
- si el móvil no tenía ningún entreno sin borrar, como uno recién estrenado, la copia cuenta como su última copia, con la hora de la copia y con las reglas de «La última copia»: no hace retroceder una última copia más reciente, y no se apunta nada si la hora de la copia o la de este móvil es anterior al sello mínimo.

**Si es de otra persona**, con «No, es de otra persona»:

- solo entran los entrenos y los ejercicios propios que el móvil no tiene, también los borrados, que entran con su marca y sin aparecer; lo que ya tiene, también lo borrado, no cambia ni se borra, aunque la copia lo traiga corregido o borrado;
- no toma ningún ajuste ni recuerda la persona, así que la siguiente copia de esa persona vuelve a preguntar;
- lo que entra lleva el sello mínimo, así que pierde frente a cualquier versión de los móviles propios, también al juntarlos después: lo que otra persona haga con tus entrenos no gana nunca a los tuyos;
- sus entrenos salen en el historial, cuentan en la semana y viajan en tus copias, y solo se quitan borrándolos uno a uno;
- la copia no cuenta como tu última copia.

En los dos casos, un móvil que aún no tenía persona estrena la suya. Si había que preguntar y no se contestó, no se importa nada: `importarCopiaEn` lanza un error sin escribir. La pantalla siempre pregunta antes.

## Cómo se juntan los datos

Con una copia propia:

- **Entreno a entreno**, gana la versión con el sello mayor, entera, con sus bloques y sus series: un entreno nunca queda mezcla de dos móviles. Si el móvil tiene una versión igual o más reciente, se queda la suya.
- **Nada se borra porque falte en la copia:** lo que tengas y no esté en la copia se queda.
- **Un borrado más reciente** en la copia, sobre un entreno que el móvil tiene, se aplica como un borrado hecho en el móvil: cambian su marca y su sello, y lo que el móvil guarda de él se queda, sin vaciarlo. Si ya estaba borrado, solo cambia su sello. Un borrado que llega con una copia no se puede deshacer desde la app: «Deshacer» solo sale unos segundos en el Historial, después de borrar un entreno en su detalle.
- **Un entreno borrado que el móvil no tenía** entra borrado, sin aparecer.
- **Un entreno borrado en el móvil vuelve a aparecer** si la copia trae una versión sin borrar más reciente que el borrado: porque en el otro móvil se restauró después, o porque allí se corrigió después de borrarlo aquí. Vuelve con la versión de la copia, y el resumen lo cuenta en «Entran».
- **Los ejercicios propios** siguen la regla del sello mayor, enteros también cuando llegan borrados: entran, también borrados, cambian enteros si son más recientes y vuelven si se restauran. Como los borrados viajan con su nombre, un borrado más reciente no cambia solo la marca y el sello, como en los entrenos: sustituye entero al ejercicio del móvil, con el nombre, el grupo y lo que mide en la copia.
- **Los ajustes** que viajan entran si son más recientes. La copia nunca trae ajustes locales, así que no cambia los del móvil; solo los escribe la propia importación: `local.personas`, al contestar «sí», y `local.ultima_copia`, al importar una copia propia en un móvil sin ningún entreno sin borrar.
- **Importar dos veces la misma copia** no cambia nada la segunda vez, ni vuelve a preguntar.

Importar no comprueba que cada serie lleve solo lo que mide su ejercicio, como hace el editor al guardar: la copia viene de otra Quimera que ya lo comprobó, y si un ejercicio propio cambió entre medias, es mejor recuperar los entrenos que no poder importar ninguno.

## Lo que enseña antes de importar

Antes de «Importar», la tarjeta dice, bajo «Esto es lo que va a cambiar», qué cambia, con una fila por cada cosa que no es cero. Van primero los entrenos, después los ejercicios propios y al final los ajustes, y en cada uno, primero lo que se borra, para que no pase sin verse:

- «Se borra 1 entreno que se borró después en el otro móvil.»
- «Entran 12 entrenos en tu historial.»
- «Se actualizan 3 entrenos que se cambiaron después en el otro móvil.»
- Lo mismo con los ejercicios propios: «Se borra 1 ejercicio que se borró después en el otro móvil.», «Entran 2 ejercicios creados en el otro móvil.» y «Se actualiza 1 ejercicio que se cambió después en el otro móvil.».
- Y con los ajustes, que nunca se borran y, si no estaban, cuentan como actualizados: «Se actualiza 1 ajuste que se cambió después en el otro móvil.».

Cada fila cuenta por los sellos, no por lo que se ve. «Entran» cuenta lo que no estaba y lo que aquí estaba borrado y llega sin borrar con un sello más reciente. «Se actualizan» cuenta lo que se ve aquí y llega sin borrar con un sello más reciente, aunque se vea igual, como un entreno que en el otro móvil se borró y se recuperó con «Deshacer». «Se borra» cuenta lo que se ve aquí y llega borrado con un sello más reciente. No cuenta lo que el móvil tiene igual o más reciente, ni lo que llega borrado y aquí no estaba o ya estaba borrado, aunque entre borrado o le cambie el sello.

Con la copia de otra persona, cuenta solo los entrenos y los ejercicios propios sin borrar que el móvil no tiene, y ningún ajuste, y encima de las filas avisa: «Es de otra persona: sus entrenos se mezclarán con los tuyos.».

Si no cambia nada a la vista, en lugar del título y las filas dice:

- «Esta copia no cambia nada de lo que ves: ya tienes todo lo que trae, y lo que has borrado sigue borrado.»;
- con la copia de otra persona, «Esta copia no trae ningún entreno que no tengas.», sin el aviso;
- si se contestó «sí», además, «Si la importas, Quimera recordará ese móvil como tuyo y no volverá a preguntar por sus copias.».

## Archivos que no se importan

Cada caso sale en rojo en la tarjeta, sin tocar nada, con el botón «Importar otra copia» para elegir otro archivo:

| Qué pasa | Qué dice la tarjeta |
|---|---|
| No es JSON, es JSON de otra cosa o pasa de 50 MB; también lo que no es texto, como una foto elegida por error, que al sacar su texto como UTF-8 deja de ser JSON | «Este archivo no es una copia de Quimera, o está dañado. Prueba con otro.» |
| Es una copia, pero algo no vale | «La copia está dañada y no se puede importar. Prueba con otra. (detalle)», con dónde está el primer problema |
| Es de una versión del formato más nueva, o usa una disciplina o un ejercicio que este móvil no conoce y viene de una base o de un catálogo más nuevos | «La copia es de una Quimera más nueva que esta. Actualiza Quimera para importarla.» |
| No se puede leer el archivo, por ejemplo por falta de permiso, o falla otra cosa al leerlo o al compararlo con el móvil, como la lectura de la base del móvil | «No se pudo leer el archivo. Prueba otra vez. (detalle)», con el error en el detalle |

Una copia está dañada si tiene, por ejemplo:

- un campo fuera de sus límites, como una fecha que no existe («entrenos[0].fecha no es válido»), unas notas vacías o de más de 4000 caracteres, un nombre de ejercicio vacío o de más de 80 caracteres, una serie sin repeticiones, tiempo, distancia ni calorías, un ejercicio que no mide nada, o un sello anterior al sello mínimo o con decimales;
- un campo de la cabecera que no vale o que falta, que se nombra como los demás, como «persona no es válido» o «entrenos no es válido»;
- un campo que el formato no conoce, en cualquier sitio: si está en la cabecera, el detalle dice «su cabecera no es válida», y si está dentro de un entreno, un bloque, una serie, un ejercicio o un ajuste, dice qué objeto lo lleva, como «entrenos[0] no es válido»;
- un identificador repetido, un ajuste que sale dos veces o dos series en el mismo sitio de un bloque;
- un ajuste que no viaja, como uno «local.*» o la persona;
- algo que la base guardaría pero el móvil no leería igual: textos con caracteres nulos o con medio carácter de UTF-16, números que no caben en un ajuste, ajustes con más de 32 niveles de listas u objetos, o sellos mayores que 9.007.199.254.740.991, el mayor entero que JavaScript guarda exacto;
- una disciplina que no existe en este móvil, o un ejercicio que no existe ni en este móvil ni entre los ejercicios propios de la copia, cuando ni la base ni el catálogo de la copia son más nuevos que los del móvil («la disciplina remo no existe», «el ejercicio remo-nuevo no existe»). Como salvaguarda, también un ejercicio propio de la copia que en este móvil es del catálogo, aunque hoy no puede darse: la base obliga a que los ejercicios propios lleven un UUID y los del catálogo no.

Hay un caso que las comprobaciones no ven y que solo sale al tocar «Importar»: un bloque o una serie de la copia con el identificador de uno que el móvil ya tiene en otro entreno, que solo da una copia editada a mano. La copia pasa la pregunta y lo que va a cambiar, y al importar la tarjeta dice «No se pudo importar la copia. No ha cambiado nada: prueba otra vez. (detalle)», con el error de SQLite en el detalle; probar otra vez falla igual.

## La pantalla, en detalle

- **Si no puede leer el móvil.** Si al abrirse no puede leer lo que hay en el móvil, la pantalla dice «No se pudo leer lo que hay en este móvil. (detalle)», sin las tarjetas.
- **Cuándo no se puede salir.** Mientras se prepara la copia y sigue abierta la hoja de compartir, o mientras se importa, no se puede salir de la pantalla: la hoja se abriría encima de Inicio, sin preguntar después si se guardó la copia, y lo importado no se vería. Quien lo intenta con el lector de pantalla oye lo que está haciendo: «Preparando la copia» o «Importando». Mientras lee la copia, con la pregunta «¿Esta copia es tuya?» o con lo que va a cambiar a la vista, sí se puede salir, porque todavía no se ha escrito nada. También con la pregunta «¿Has guardado la copia?»: entonces la copia no se apunta como la última, igual que con «No».
- **Una cosa cada vez.** Mientras una tarjeta prepara la copia, con la hoja de compartir abierta, elige o lee un archivo, o importa, la otra no puede empezar nada: «Hacer una copia», «Importar una copia», «Importar otra copia» e «Importar» están desactivados. «Sí, la he guardado» y «No» siguen activos, y mientras se apunta que la copia se guardó, la tarjeta de importar no se desactiva.
- **Sin dobles toques.** «Importar», «Hacer una copia» e «Importar una copia» no responden durante medio segundo cada vez que aparecen o vuelven a estar disponibles, también después de un fallo al hacer la copia o al importar, porque pueden salir donde estaba el botón que se acaba de pulsar. Un doble toque en «Sí, es mía» importaría sin dejar ver lo que cambia; uno en «Sí, la he guardado» o en «No» abriría otra vez la hoja de compartir; uno en «Cancelar» o en «Importar», otra vez el selector de archivos, y uno en «Hacer una copia» o en «Importar» que acaba de fallar volvería a probar enseguida. El medio segundo se cuenta con `performance.now()`, que no retrocede aunque cambie la hora del móvil. Al cerrar el selector sin elegir no hay espera, porque no hay ningún dedo encima.
- **«Leyendo la copia», antes de leer.** Leer y comprobar una copia grande ocupa el hilo de JavaScript, y mientras tanto la pantalla no responde. Por eso, antes de leerla, espera a que se pinte «Leyendo la copia»: así se ve qué está haciendo, en vez de quedarse quieta con lo de antes.
- **La lista sigue a la tarjeta.** Al leer una copia, al contestar la pregunta, si el archivo no vale y al acabar de importar, la lista sube hasta la tarjeta «Importar una copia».
- **Con el lector de pantalla** (TalkBack en Android; en el iPhone, VoiceOver, todavía sin probar), cada estado nuevo de una tarjeta se anuncia. Al volver una tarjeta a su principio, con «No», con «Cancelar» o al cerrar el selector sin elegir, el foco pasa a su botón, «Hacer una copia» o «Importar una copia». El botón «No» se lee «No la he guardado».
- **En Inicio sin entrenos**, debajo del bocadillo, una pista: «¿Tienes una copia de tus entrenos? Recupérala en Tus datos.».

## Límites conocidos

- La persona identifica una instalación, no a una persona: comparar entrenos con amigos necesitará otro dato, con otra versión del formato.
- Un «sí» por error no se olvida sin borrar los datos de la app: las copias siguientes de esa persona entran sin preguntar, con sus ajustes más recientes. El error se queda en el móvil donde se contestó, pero lo que ese móvil tomó de ellas viaja en sus copias como cualquier cambio suyo.
- Con «no», las correcciones y los borrados que la otra persona haga después en sus propios entrenos ya importados no llegan. Si dos móviles propios importan con «no» copias distintas de esa persona, sus entrenos se quedan distintos en cada uno, y sus sellos ya no dicen cuándo cambiaron.
- Si un ejercicio propio cambia lo que mide, los entrenos con él que lleguen en una copia pueden traer medidas que el ejercicio de este móvil no mide, y el editor no deja corregirlos tal cual. Con «no», pasa siempre que la otra persona haya cambiado el ejercicio, porque este móvil se queda con el suyo; con «sí», cuando el ejercicio se cambió en los dos móviles y el de este es más reciente. Lo tendrá que resolver la pantalla de crear ejercicios.
- Los sellos salen del reloj de cada móvil. Si dos móviles cambian el mismo entreno sin haberse importado entre medias, se queda entero el cambio con la hora mayor, y el otro se pierde: con el reloj de un móvil adelantado, un cambio suyo gana a otro hecho después en el otro móvil, y el resumen lo cuenta con «Se actualiza 1 entreno que se cambió después en el otro móvil.» aunque se cambiara antes.
- Un sello en el máximo, 9.007.199.254.740.991, solo llega con una copia editada a mano y ya no distingue versiones: esa fila gana en todos los móviles que importen como suyas esa copia o las siguientes, y desde entonces sus cambios, también borrarla, ya no viajan entre ellos.
- El nombre de un ejercicio propio borrado viaja para siempre en las copias, porque los entrenos que lo usan lo siguen nombrando, también en otros móviles. La pantalla de crear ejercicios tendrá que decirlo, o pedir otra versión del formato.
- El «peso por mancuerna» todavía no está en la base ni en el formato. Hoy no se pierde nada, porque solo lo llevan ejercicios del catálogo, que viajan por su clave y lo toman del catálogo de cada Quimera. Llegará con la pantalla de crear ejercicios, con una migración y una versión nueva del formato, y las copias de la versión 1 se seguirán pudiendo importar.
- Lo que no es UTF-8 no se rechaza por serlo: cada byte que no vale se cambia por el carácter de sustitución (U+FFFD). Por eso, una copia que un editor de texto volvió a guardar en otra codificación, como Latin-1, sigue siendo JSON y se importa con ese carácter en lugar de las letras con tilde, la eñe y los demás caracteres que no son ASCII de sus notas y de los nombres de sus ejercicios propios.
- La copia es JSON sin cifrar: quien tenga el archivo lee todos los entrenos, con sus notas, también los de otras personas que se importaron. De los entrenos borrados viajan para siempre su disciplina, su fecha, su hora, su duración y su esfuerzo, porque el formato los pide; solo se quedan fuera sus notas y sus bloques. Por eso la pantalla aconseja guardarla fuera del móvil y solo para ti.
- Android guarda por su cuenta los datos de la app en la copia de seguridad de Google (`android.allowBackup`, que Expo deja activado) y puede devolverlos con la base entera al reinstalar Quimera o al estrenar otro Android con esa copia de seguridad. Entonces vuelven también la persona del móvil y sus ajustes locales, como las personas recordadas y la última copia: ese móvil no estrena persona, los móviles que ya lo conocían no vuelven a preguntar por sus copias y un «sí» por error tampoco se olvida al reinstalar. Falta decidir si se apaga.

## Lo que falta

- **La pantalla de rescate:** si la base no se puede preparar, la app enseñará el error y dejará compartir el archivo de la base tal cual, en vez de cerrarse sin ningún mensaje, como pasaría hoy en una compilación de producción; en desarrollo sale la pantalla roja de error. La base no se borra nunca.
- **El recordatorio mensual:** si hace más de un mes de la última copia y hay entrenos, Inicio lo dirá con un aviso que lleva a «Tus datos». Falta decidir desde cuándo cuenta el mes en un móvil con entrenos que todavía no ha hecho ninguna copia.
- **Probarlo en un iPhone:** en un móvil, las copias solo se han probado en Android, también con TalkBack. Falta probar en un iPhone la hoja de compartir, el selector de archivos, la lectura del archivo y VoiceOver.
- **«Tus datos» con la letra más grande del iPhone:** con los tamaños de letra de accesibilidad, en los iPhone de 375 puntos de ancho, algunas palabras se parten por dentro, como «Preparando» de «Preparando la copia» desde el 214 %, y más palabras desde el 264 %. Falta una pasada de diseño antes de publicar en el iPhone; en Android, al 200 %, no se parte nada desde Android 14.

## Dónde está en el código

| Qué | Dónde |
|---|---|
| El formato, crear la copia y su nombre, leerla, compararla con el móvil, importarla, la persona y la última copia | `src/datos/copia.ts` |
| Los sellos: el mínimo, el máximo y cómo crecen | `src/datos/sellos.ts` |
| Los ajustes que viajan y los «local.*» | `src/datos/ajustes.ts` |
| Las claves del catálogo y su versión | `src/datos/catalogo.ts` |
| Preparar, compartir y elegir los archivos | `src/copias/archivos.ts` |
| Los textos que dependen de los datos | `src/copias/textos.ts` |
| La pantalla «Tus datos» | `src/app/tus-datos.tsx` |
| El botón y la pista de Inicio | `src/app/(pestanas)/index.tsx` |
| Las pruebas | `src/datos/__tests__/copia.test.ts`, `src/datos/__tests__/sellos.test.ts`, `src/copias/__tests__/`, `src/__tests__/tus-datos.test.tsx` y, para el botón y la pista de Inicio, `src/__tests__/inicio.test.tsx` |
| Las copias fijadas de la versión 1, que no cambian nunca | `src/datos/__tests__/copia-v1*.json` |

## Al cambiar el formato

- Cualquier campo nuevo o distinto sube la versión del formato, y una Quimera no importa copias de una versión más nueva que la suya.
- Una Quimera nueva tiene que seguir leyendo las copias de la versión 1 que ya estén guardadas: las copias fijadas no cambian nunca, y sus pruebas solo añaden lo que pongan las migraciones nuevas.
- Una copia de una versión anterior nunca borra lo que no conoce: si una columna nueva viaja, importar una copia vieja conserva el valor que tiene el móvil.
- Las pruebas avisan si la base gana una columna o una tabla, y obligan a decidir si entra en la copia, con otra versión del formato.
- El esquema de la copia repite los límites de la base. Si una migración cambia lo que acepta una columna que viaja, como el largo de las notas, cambia también el formato, con otra versión. Si la base aceptara más que el esquema, la copia fallaría al hacerla en cuanto algo guardado no cupiera; si aceptara menos, las copias ya guardadas dejarían de importarse. Las copias fijadas, que llevan cada medida en su mínimo y en su máximo y unas notas de 4000 caracteres, avisan del segundo caso.
- Una clave del catálogo ya publicada y una disciplina no se cambian ni se quitan nunca, porque las copias guardadas las siguen nombrando. Para retirar un ejercicio del catálogo, se marca como retirado.
- Un ejercicio nuevo del catálogo llega con una `CATALOGO_VERSION` mayor, y una disciplina nueva, con una migración: así, una Quimera más vieja que reciba una copia que los usa dice que es de una Quimera más nueva, y no que está dañada.

## Cómo probarlo en un móvil

En Jest, la hoja de compartir y el selector de archivos van simulados, y el lector de pantalla no se oye. Por eso, en el móvil se mira sobre todo que la hoja guarda el archivo donde se elige, que el selector lo encuentra allí, también en Drive, y, con el lector de pantalla, que cada anuncio se oye entero y que el foco vuelve a «Hacer una copia» después de «No», y a «Importar una copia» después de «Cancelar» y al cerrar el selector sin elegir.

Lo que entra al importar solo se puede borrar, y sus marcas de borrado viajan para siempre en las copias. Por eso, en la base de verdad solo se prueba lo que no cambia nada: hacer la copia, guardarla e importarla otra vez.

Lo demás se prueba en una base aparte. Durante la prueba, y sin hacer commit, `src/app/_layout.tsx` abre `quimera-pruebas.db` en vez de `quimera.db`. Allí se restaura la copia de verdad, como en un móvil nuevo, y se importan copias inventadas: una de otra persona, una de otro móvil propio, la misma después de corregir, borrar y añadir entrenos, y archivos que no valen. Al acabar, `_layout.tsx` vuelve a abrir `quimera.db`.

Las copias inventadas no están en el repositorio. Se hacen con las funciones de la app sobre una base de prueba de node:sqlite, como `copiaDeOtroMovil` en `src/__tests__/tus-datos.test.tsx`, con ejercicios del catálogo y notas inventadas, sin datos de nadie. Los archivos que no valen salen de ellas: una copia con un campo estropeado, como una fecha que no existe, otra con una versión del formato más nueva y un archivo que no es JSON.

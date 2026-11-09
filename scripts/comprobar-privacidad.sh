#!/bin/sh
# Comprueba que lo que va a entrar en el repositorio no lleva nada privado. El
# repositorio es público, así que cualquier descuido queda a la vista de todos.
#
# Sin argumentos mira lo preparado para el commit; es lo que hace
# .githooks/pre-commit. Con --todo mira todos los ficheros y todos los commits,
# por ejemplo antes de subir; es lo que hace .githooks/pre-push.
#
# Reglas:
#   1. Autores y commits firman con la dirección noreply de GitHub.
#   2. Nunca entran los ficheros de herramientas locales y de agentes de IA
#      (.claude/, CLAUDE.md, AGENTS.md), la carpeta privado/, claves,
#      credenciales ni compilaciones.
#   3. El contenido no lleva correos (salvo noreply y dominios de ejemplo),
#      claves privadas, tokens de servicios ni rutas de una carpeta personal.
#   4. Ni el contenido, ni los nombres de los ficheros, ni los autores, ni los
#      mensajes de commit llevan ninguna de las palabras de
#      privado/palabras-prohibidas.txt. Ese fichero no se sube: cada uno pone
#      en él sus datos personales concretos, uno por línea.

set -u

modo=${1:-preparado}
raiz=$(git rev-parse --show-toplevel) || exit 2
cd "$raiz" || exit 2
tmp=$(mktemp -d) || exit 2
trap 'rm -rf "$tmp"' EXIT
fallos=0

fallo() {
  printf 'privacidad: %s\n' "$1" >&2
  fallos=$((fallos + 1))
}

# Las palabras prohibidas, sin líneas vacías, sin comentarios y sin el \r que
# deja el Bloc de notas.
prohibidas="$tmp/prohibidas"
if [ -f privado/palabras-prohibidas.txt ]; then
  tr -d '\r' < privado/palabras-prohibidas.txt | grep -v -e '^[[:space:]]*$' -e '^#' > "$prohibidas" || true
else
  : > "$prohibidas"
  printf 'privacidad: aviso: no existe privado/palabras-prohibidas.txt, así que no se buscan datos personales concretos\n' >&2
fi

# Lo que hay que mirar: las rutas, y cada línea de texto con su ruta delante,
# separadas por un tabulador.
if [ "$modo" = "--todo" ]; then
  git ls-files > "$tmp/rutas"
  git grep -I -n -e '' -- . 2>/dev/null | sed -E 's/^([^:]*):[0-9]+:/\1\t/' > "$tmp/lineas" || true
else
  git diff --cached --name-only --diff-filter=ACMR > "$tmp/rutas"
  git diff --cached -U0 --no-color --diff-filter=ACMR | awk '
    /^\+\+\+ b\// { f = substr($0, 7); next }
    /^\+\+\+ /    { f = ""; next }
    /^\+/ && f != "" { print f "\t" substr($0, 2) }
  ' > "$tmp/lineas"
fi

# Avisa una vez por cada ruta que aparezca en la columna 1 de un fichero.
avisar() {
  cut -f1 "$2" | sort -u > "$tmp/rutas_con_fallo"
  while IFS= read -r ruta; do
    fallo "$1 en $ruta"
  done < "$tmp/rutas_con_fallo"
}

# 1. Quién firma.
correo=$(git config user.email || true)
case "$correo" in
  *@users.noreply.github.com) ;;
  *) fallo "el correo del autor no es la dirección noreply de GitHub (git config user.email)" ;;
esac
if [ -s "$prohibidas" ] && git config user.name | grep -qiF -f "$prohibidas"; then
  fallo "el nombre del autor lleva un dato personal (git config user.name)"
fi

# 2. Ficheros que no entran nunca.
grep -E '(^|/)\.claude(/|$)|(^|/)CLAUDE(\.local)?\.md$|(^|/)AGENTS\.md$|(^|/)privado/|(^|/)\.env($|\.)|(^|/)credentials\.json$|\.(jks|keystore|p8|p12|pem|key|mobileprovision|apk|aab|ipa|jsonl)$' "$tmp/rutas" > "$tmp/rutas_mal" || true
while IFS= read -r ruta; do
  fallo "fichero que no puede subirse: $ruta"
done < "$tmp/rutas_mal"

# 3. Contenido.
# Correos, quitando antes los permitidos. El package-lock.json lo escribe npm
# con los datos públicos de los paquetes, que a veces traen el correo de quien
# los mantiene: ahí no se buscan correos sueltos, pero sí los datos personales
# del punto 4.
awk -F '\t' '$1 != "package-lock.json"' "$tmp/lineas" |
  sed -E 's/[A-Za-z0-9._%+-]+@(users\.noreply\.github\.com|github\.com|example\.(com|org|net)|ejemplo\.(com|es))//g' |
  grep -E '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}' > "$tmp/encontrado" || true
avisar "correo electrónico" "$tmp/encontrado"

grep -E 'BEGIN [A-Z ]*PRIVATE KEY' "$tmp/lineas" > "$tmp/encontrado" || true
avisar "clave privada" "$tmp/encontrado"

grep -E '(gh[pousr])_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|(^|[^A-Za-z0-9_-])sk-(ant-)?[A-Za-z0-9_-]{32,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[abprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.' "$tmp/lineas" > "$tmp/encontrado" || true
avisar "token o clave de un servicio" "$tmp/encontrado"

grep -E '[A-Za-z]:\\+Users\\+|/[cC]/Users/|/home/[a-z]|App[D]ata' "$tmp/lineas" > "$tmp/encontrado" || true
avisar "ruta de una carpeta personal" "$tmp/encontrado"

# 4. Datos personales concretos.
if [ -s "$prohibidas" ]; then
  grep -iF -f "$prohibidas" "$tmp/lineas" > "$tmp/encontrado" || true
  avisar "dato personal de privado/palabras-prohibidas.txt" "$tmp/encontrado"
  grep -iF -f "$prohibidas" "$tmp/rutas" > "$tmp/encontrado" || true
  while IFS= read -r ruta; do
    fallo "dato personal en el nombre del fichero $ruta"
  done < "$tmp/encontrado"
fi

# Con --todo, también la historia: autores, correos y mensajes de commit.
if [ "$modo" = "--todo" ] && git rev-parse -q --verify HEAD > /dev/null; then
  git log --format='%ae%n%ce' | sort -u | grep -v '@users\.noreply\.github\.com$' > "$tmp/correos_mal" || true
  if [ -s "$tmp/correos_mal" ]; then
    fallo "hay commits firmados con un correo que no es la dirección noreply de GitHub"
  fi
  if [ -s "$prohibidas" ]; then
    if git log --format='%an%n%cn%n%B' | grep -qiF -f "$prohibidas"; then
      fallo "un autor o un mensaje de commit lleva un dato personal"
    fi
  fi
fi

if [ "$fallos" -gt 0 ]; then
  if [ "$modo" = "--todo" ]; then
    printf 'privacidad: %s problema(s): corrígelos antes de subir nada\n' "$fallos" >&2
  else
    printf 'privacidad: %s problema(s): no se hace el commit hasta corregirlos\n' "$fallos" >&2
  fi
  exit 1
fi
if [ "$modo" = "--todo" ]; then
  printf 'privacidad: el repositorio y su historia están limpios\n'
fi
exit 0

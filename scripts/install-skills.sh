#!/usr/bin/env bash
# Liga a skill de vídeo ao Claude Code, para ele encontrá-la.
#   bash scripts/install-skills.sh               instala para o seu usuário (~/.claude/skills)
#   bash scripts/install-skills.sh /caminho/proj instala só naquele projeto (/caminho/proj/.claude/skills)
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
dest="${1:-$HOME}/.claude/skills"
mkdir -p "$dest"
# remove o atalho antigo (nome anterior da skill, pragma-video) se ficou quebrado
for link in "$dest"/pragma-video*; do
  [ -L "$link" ] && [ ! -e "$link" ] && rm "$link" && echo "removido atalho quebrado: ${link##*/}"
done
for dir in "$here"/skills/*/; do
  name="$(basename "$dir")"
  ln -sfn "${dir%/}" "$dest/$name"
  echo "ok: $dest/$name -> ${dir%/}"
done

#!/usr/bin/env bash
# Liga a skill de vídeo em .claude/skills da raiz do repositório, para o
# Claude Code encontrá-la. A pasta .claude/ não vai para o git, então cada
# pessoa do time roda isto uma vez:  bash Divulgacao/videos/scripts/install-skills.sh
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
repo="$(cd "$here/../.." && pwd)"
mkdir -p "$repo/.claude/skills"
# Tira atalhos antigos que apontavam para skills que não existem mais.
for link in "$repo"/.claude/skills/pragma-video*; do
  [ -L "$link" ] && [ ! -e "$link" ] && rm "$link" && echo "removido: ${link##*/}"
done
for dir in "$here"/skills/*/; do
  name="$(basename "$dir")"
  ln -sfn "../../Divulgacao/videos/skills/$name" "$repo/.claude/skills/$name"
  echo "ok: .claude/skills/$name"
done

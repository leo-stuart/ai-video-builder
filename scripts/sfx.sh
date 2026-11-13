#!/usr/bin/env bash
# Sintetiza os efeitos sonoros do canal com o ffmpeg (nada de arquivo de terceiros).
# Rode uma vez; o resultado em public/sfx vai para o git.
set -euo pipefail
out="$(cd "$(dirname "$0")/.." && pwd)/public/sfx"
mkdir -p "$out"
ff() { ffmpeg -y -loglevel error "$@"; }
ff -f lavfi -i "sine=f=520:d=0.09" -af "asetrate=44100*1.6,aresample=44100,afade=t=out:st=0.02:d=0.05,volume=0.9" "$out/pop.wav"
ff -f lavfi -i "sine=f=880:d=0.5" -f lavfi -i "sine=f=1320:d=0.5" -filter_complex "[1]adelay=90[b];[0][b]amix=2:normalize=0,afade=t=out:st=0.08:d=0.42,volume=0.8" "$out/ding.wav"
ff -f lavfi -i "sine=f=170:d=0.38" -af "afade=t=out:st=0.04:d=0.34,volume=1.2" "$out/bong.wav"
ff -f lavfi -i "anoisesrc=d=0.35:c=pink:a=0.6" -af "highpass=f=500,afade=t=in:d=0.12,afade=t=out:st=0.14:d=0.2,volume=0.7" "$out/whoosh.wav"
ff -f lavfi -i "sine=f=1500:d=0.03" -af "afade=t=out:st=0.005:d=0.025,volume=0.6" "$out/tick.wav"
ls "$out"

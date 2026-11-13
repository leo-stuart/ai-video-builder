# Vídeos curtos do Pragma

Builder de vídeos animados em 3D para Reels, TikTok e YouTube Shorts, gerados por código com [Remotion](https://www.remotion.dev). Cada vídeo ensina uma frase de inglês em 25 a 50 segundos e termina chamando para o app.

Um vídeo é um `episode.json`: um **formato** (sequência de cenas), uma **ficha** (as frases) e um **mundo** sorteado (lugar, elenco, câmera, metáfora) que muda a cada episódio.

```bash
pnpm install                                                  # uma vez
node scripts/vid.mjs pauta                                    # pautas prontas (→ = recomendada)
node scripts/vid.mjs new ep14-tema --pauta <id> --model sonnet   # cria o episódio
node scripts/vid.mjs check ep14-tema --script                 # confere o roteiro
node scripts/vid.mjs voice ep14-tema                          # voz (ElevenLabs) e tempos
node scripts/vid.mjs check ep14-tema                          # confere tudo
node scripts/vid.mjs sheet ep14-tema                          # folhas de revisão em .qa/
node scripts/vid.mjs render ep14-tema                         # render por cena, com cache
node scripts/vid.mjs pack ep14-tema                           # pacote: out/ep14-tema/ + out/calendar.csv
node scripts/vid.mjs batch ep14-a ep15-b ep16-c               # lote: voz + validação + render + pacote
pnpm studio                                                   # pré-visualização ao vivo
```

Outros comandos: `vid formats`, `vid scene` (editar uma cena sem abrir arquivo), `vid docs`, `vid forget`. `node scripts/vid.mjs` sem argumentos mostra a ajuda. Precisa de Node 20+ e `ffmpeg`.

## Níveis de liberdade

O Claude escolhe o nível pelo modelo (`builder.config.json`), e você pode forçar com `--freedom`:

| Nível | Modelo | O que pode |
|---|---|---|
| `recipe` | Haiku | pauta pronta ou ficha; ajustar textos |
| `guided` | Sonnet | reordenar, trocar, inserir e remover cenas; escrever cenas em dados |
| `free` | Opus, Fable | também escrever cenas novas em código, só para o episódio |

O validador (`vid check`) impõe o nível.

## Onde está cada coisa

* `skills/pragma-video/`: o passo a passo completo para um agente de IA. Comece por `SKILL.md`. Para o Claude Code enxergar a skill, rode `bash scripts/install-skills.sh` uma vez.
* `formats/`: os formatos (`*.json`), as fichas de exemplo (`examples/`), as pautas prontas com inglês conferido (`pautas/`) e as falas fixas variáveis (`variants.json`).
* `src/engine/`: o motor (lê o JSON e desenha) e os tipos de cena (`beats/`). `src/kit/`: cenários, bonecos, legenda e animações.
* `src/episodes/<slug>/`: `episode.json`, `script.json` (gerado), `timing.json` (gerado). `ep01` a `ep04` são episódios antigos, em código; o `catalogo` mostra todos os cenários e câmeras.
* `ledger.json`: histórico de variedade; o validador impede episódios parecidos demais com os últimos.
* `out/<slug>/`: pacote de postagem (`video.mp4`, `reels.txt`, `tiktok.txt`, `shorts.txt`, `thumb.jpg`, `meta.json`). `out/calendar.csv`: ordem e horário sugerido. **Nada é publicado: postar é com você.**
* `voice/<slug>/<id>.m4a`: narração gravada por uma pessoa, uma por cena, que substitui a voz sintética.

## Voz

Os áudios gerados (`public/audio/`) não vão para o git. Depois de clonar, rode `node scripts/vid.mjs voice <slug>` para regerar a voz de um episódio (gasta crédito do ElevenLabs, exceto falas em cache).

Ponha `ELEVENLABS_API_KEY=...` em `.env.local` (fora do git; veja `env.example`). As vozes dos personagens ficam em `builder.config.json`. Falas iguais em episódios diferentes ficam em cache e não gastam crédito. `--provider none` gera só os tempos, para rascunhar. O plano grátis do ElevenLabs não cobre uso comercial.

## Licenças

Fredoka e Nunito estão sob a SIL Open Font License. O Remotion é gratuito para pessoas e equipes pequenas; empresas com mais de três funcionários precisam de licença paga.

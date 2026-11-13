# Roadmap

Objetivo do MVP: um builder **local** de vídeos curtos animados, geral (não só Pragma), operado por **agente via MCP** e por **pessoa via UI web**, sobre o mesmo núcleo. Desenho em `docs/ARCHITECTURE.md`.

Legenda: ✅ feito · 🔨 em andamento · ⬜ falta · 💤 depois do MVP

## Feito

* ✅ Motor de cenas em dados (`ScenePlayer`): cenário, câmeras com corte, valores que mudam com a voz, rótulos, sons
* ✅ Kit 3D: 5 cenários (balcão com 7 lugares, rua, casa, escola, estúdio), boneco articulado, tutor, objetos de metáfora
* ✅ 24 tipos de cena e 4 formatos (`travou-e-treina`, `diz-vs-ouve`, `mito-vs-fato`, `mini-aula-quiz`)
* ✅ Mundo sorteado por episódio e histórico de variedade que barra repetição
* ✅ 23 pautas prontas (inglês conferido sem fonte externa)
* ✅ Voz por personagem (ElevenLabs) com tempo real por palavra e cache entre episódios
* ✅ Legenda palavra por palavra sincronizada
* ✅ Validador com ~50 regras e níveis de liberdade (`recipe`, `guided`; `free` não testado)
* ✅ Folhas de revisão rápidas, render por cena com cache, pacote por plataforma, calendário
* ✅ CLI `vid` e skill para agentes; testado com Haiku (`recipe`) e Sonnet (`guided`)

## MVP

### Etapa 1 — Rede de segurança
* ⬜ `scripts/golden.mjs`: quadros de referência e comparação automática

### Etapa 2 — Núcleo
* ⬜ `core/`: lógica dos scripts como funções que devolvem dados
* ⬜ CLI reescrita como cliente fino do core
* ⬜ Fila de tarefas longas com progresso (voz, render)

### Etapa 3 — Geral, não só Pragma
* ⬜ Espaço de trabalho separado do motor (`workspace.json`, `playbook/`, `episodes/`)
* ⬜ Pragma migrado para `workspaces/pragma` (fora do git público)
* ⬜ Composição única `Episode` que recebe o JSON (habilita prévia ao vivo)
* ⬜ Marca vinda de dados: tela final, pitch, menção obrigatória, regras do validador
* ⬜ `workspaces/demo`: marca de exemplo pública (o próprio builder), com 1 formato genérico e 3 pautas

### Etapa 4 — MCP
* ⬜ Servidor MCP (stdio) com uma ferramenta por função do core
* ⬜ Folhas de revisão devolvidas como imagem; voz só com confirmação
* ⬜ Instruções do servidor a partir da skill
* ⬜ Teste de ponta a ponta com um agente usando só o MCP

### Etapa 5 — UI
* ⬜ Servidor local + app web
* ⬜ Lista de episódios e quadro de pautas
* ⬜ Editor: cenas, falas, parâmetros, alertas do validador
* ⬜ Prévia ao vivo (Remotion Player)
* ⬜ Aprovar voz, renderizar, baixar pacote

### Etapa 6 — Fechamento
* ⬜ README e guia de início em 5 minutos
* ⬜ Um comando sobe tudo (`pnpm start`)

## Fora do MVP

* 💤 Câmera automática (enquadrar alvos) e validador de enquadramento
* 💤 Modelos 3D prontos (GLTF) e personagens com animação de esqueleto
* 💤 Cenários fora do balcão; finais alternativos
* 💤 Cores e fontes por marca; segundo estilo visual (2D)
* 💤 Cenas em código pelo MCP/UI (nível `free`)
* 💤 Chat com agente dentro da UI
* 💤 Cadastro de marca por entrevista
* 💤 Versão hospedada (login, render em nuvem, cobrança; exige rever licença do Remotion)

## Pendências que não são código

* Nenhum vídeo foi publicado ainda: falta sinal real de retenção
* Voz: plano grátis do ElevenLabs não cobre uso comercial nem o volume de 3 a 5 vídeos por dia
* Inglês das pautas sem conferência de nativo
* O histórico do repositório público ainda contém o conteúdo do Pragma do primeiro commit

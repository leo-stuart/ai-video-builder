# Revisão de direção — Pragma e ClippAI

Data: 13/11/2026. Pedido: voltar às referências, melhorar câmera do quiz e superar a falta de dinâmica dos dois anúncios da ClippAI. Esta revisão distingue feedback do usuário, dados/código inspecionados, notas históricas e hipóteses editoriais. Não medimos retenção nem inferimos desempenho de marketing.

## Evidência disponível

| Fonte | Situação | O que sustenta |
|---|---|---|
| [Reel DfqVuaIuIt0](https://www.instagram.com/reels/DfqVuaIuIt0/) | Link do pedido original; vídeo indisponível nesta revisão | Notas antigas citam metáforas físicas em 3D; falta decupagem nova |
| [Reel DflXHpWRrDy](https://www.instagram.com/reels/DflXHpWRrDy/) | Link do pedido original; vídeo indisponível nesta revisão | Notas antigas citam interfaces, etapas e contador; falta decupagem nova |
| [Reel DfgwuIqsFS0](https://www.instagram.com/reels/DfgwuIqsFS0/) | Link do pedido original; vídeo indisponível nesta revisão | Notas antigas citam progressão emocional e cor; falta decupagem nova |
| ep17, ep18 e dois MP4 da ClippAI | Arquivos locais, roteiro, timing, folhas e motor disponíveis | Diagnóstico abaixo; feedback visual do usuário é a evidência de aprovação/reprovação |

Tentativas novas: abertura pública dos três links (cache miss/429), download público via yt-dlp (rate limit/login) e abertura do primeiro no Arc (página preta, sem vídeo acessível). Não foram exportados cookies, lidas credenciais ou contornado login. As descrições em `skills/video-builder/referencias.md` foram herdadas do Claude. Não há base para dizer que estes três vídeos foram reassistidos nesta revisão, nem para dar novos timecodes ou estatísticas deles.

## O que o ep17 faz melhor

O usuário aprovou apenas o ep17 do lote. Sua cadeia é causal: intenção → pergunta → branco → consequência → treino → correção → tentativa → resultado. A narração aciona gelo, fila, saída da loja, contraste físico e retorno à conversa. Há alternância de rua, balcão, metáfora e casa. A mudança não depende só da legenda ou da câmera. É esse princípio que deve ser transportado para outro tema; copiar as 19 cenas torna a série repetitiva.

## Quiz: de onde vem o movimento estranho

No ep18 original, `world.camStyle` era `slide`. Em `ScenePlayer.tsx`, todo plano sem `to` recebia um deslocamento de 0,7 m na câmera e 0,35 m no alvo. A interpolação recomeça em cada cena (`useShots`, `world.tsx`). `quiz-question` e `quiz-answer` usam `studio.low` separadamente, então o personagem pode derivar e voltar ao enquadramento inicial quando a resposta começa. Os cartões, porém, são HTML em coordenadas fixas. Isso explica a sensação de duas camadas se movendo de forma desconectada; a intensidade percebida ainda exige reprodução.

Outro detalhe: `push` não significa câmera fixa. Sem `to`, `useShots` aproxima 10% automaticamente. Por isso só trocar slide por push não resolve leitura estável. O estilo global também não distingue conversa, tela de interface e quiz.

Correção de piloto, só no episódio: retirar slide global; sobrescrever quiz e gabarito com `shot: studio.low` e `to: studio.low`, preservando posições das opções e revelando a escolha sem deslocamento. Voz e palavras permanecem; a versão original é preservada como `ep18-quiz-aisle-v1.mp4`. A versão v2 é candidata a revisão, não aprovação presumida do usuário. Não foi alterada a câmera do ep17 nem o motor compartilhado.

## ClippAI: por que o formato ficou sem dinâmica

Os dois episódios têm cinco beats: quatro no estúdio e um fecho. `statement`, `compare` e `title-card` usam `studio.low`, um boneco no centro e cartões por cima. Trocar pose, tom de fundo, legenda e roupa mantém a mesma encenação. O produto só aparece como nome e promessa. Não há demonstração real do processo nem metáfora que se transforme até um resultado.

O sorteio declarou variedade em atributos, mas não percebeu essa repetição. O validador aprovou esquema, texto e tempos; as folhas mostraram estados diferentes, mas não foram suficientes para julgar o ritmo. A entrega anterior chamou esses arquivos de prontos cedo demais.

### Direções para refazer os dois anúncios

Estas são propostas próprias, não observações das referências nem recursos já implementados:

1. **Da ideia ao vídeo:** ideia soterrada em tarefas → roteiro vira unidades visuais → cenas ganham voz e legenda → vídeo vertical pronto → ClippAI. Usar objetos e transformação; caso se mostre a UI, capturar a ferramenta real. Não apresentar blocos fictícios como interface existente.
2. **Sem aparecer, com algo para mostrar:** enquadramento de câmera vazio → produto/objeto ocupa o foco → contexto vira cena → narração orienta a ação → resultado e marca. O mecanismo visual deve ser outro, não uma segunda sequência idêntica de cartões.

Primeiro produzir um piloto de 6–10 s do trecho de transformação para avaliar a linguagem; essa faixa é uma escolha editorial inicial, não duração medida nos Reels. Reutilizar voz existente se o piloto não mudar fala. Antes de gastar com nova voz, revisar plano visual e eventuais falas novas. O nome ClippAI e as promessas factuais devem permanecer.

## Workflow revisado

1. Pesquisa: conservar fonte e condição de acesso; decupar ação, foco e corte com evidência, separando observação e hipótese.
2. Direção: escrever `direction.md` com fala, ação concreta, plano, gatilho e resultado. Comparar mecanismos, não só aparência.
3. Piloto: testar o trecho difícil antes de multiplicar o formato em lote.
4. Voz: usar autorização já dada; alterações em câmera/encenação não exigem refazer áudio. Checar saldo e licença antes de gasto novo.
5. Folhas: composição, texto e enquadramento. Não chamar esta etapa de revisão do movimento.
6. Render de revisão: reproduzir inteiro a 1×; inspecionar os limites das cenas. `scripts/review-motion.mjs` cria player com trechos, tiras de 12 quadros e manifesto, sem TTS.
7. Registrar `motion-review.md` com trecho, método, defeito, ajuste e reteste. Sem reprodução ou com reprovação, a entrega é prévia.
8. Empacotar candidato aprovado; formato reprovado não volta ao lote automático sem novo piloto.

O `batch` ainda renderiza e empacota sem revisão visual/temporal. A skill agora explicita que isso é automação de produção, não selo de qualidade.

## Próxima decupagem das referências

Para cada vídeo original acessível, preencher: trecho/timecode, verbo da narração, ação que o torna visível, foco, plano antes/depois, motivo do corte, comportamento do texto, som e adaptação possível. Exemplo de registro vazio, não preenchido por suposição:

| Fonte e trecho | Ação observada | Câmera / corte | Texto / som | Adaptação e limites |
|---|---|---|---|---|
| Arquivo original + timecode a medir | A medir | A medir | A medir | Só depois de assistir |

Pendência externa: ter os três arquivos ou uma forma de reprodução que funcione. Até isso acontecer, nenhuma medida antiga vira regra universal de "corte a cada 0,7–1,5 s" ou "nenhuma cena acima de 8 s".

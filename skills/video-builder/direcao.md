# Direção antes de produção

Leia ao criar um vídeo, variar formato ou corrigir ritmo/câmera. `check` aprova dados; não aprova direção. Use [referencias.md](referencias.md) para a procedência das referências e [revisao.md](revisao.md) para evidências.

## O que aprendemos neste projeto

Feedback do usuário em 13/11/2026: ep17 aprovado; quiz ep18 com câmera estranha; dois primeiros vídeos da ClippAI pouco dinâmicos e rejeitados. Ep17 é referência interna de ação e progressão, não uma receita para copiar 19 cenas em todos os vídeos. Os outros três não são exemplos de qualidade aprovada.

No ep17, o personagem quer algo, recebe uma pergunta, trava, sofre uma consequência, treina e tenta de novo. O visual muda porque a situação muda. Na ClippAI, mito → fato → comparação → marca repetiu boneco pequeno e cartão no mesmo estúdio. Cor, palavra, zoom e gesto diferentes não substituem uma nova ação. O sorteio de mundo evita repetição de atributos, não de encenação.

## Planejar a fala junto com a imagem

Antes de voz paga, escreva `<workspace>/episodes/<slug>/direction.md` com uma linha por unidade narrativa:

| Fala / duração estimada | O que acontece de fato | Plano e foco | Gatilho / corte | O que muda depois |
|---|---|---|---|---|
| Ideia esquecida | Pauta some sob tarefas acumuladas | Objeto/mesa, foco na pauta | Pilha encobre a ideia | Problema fica visível |
| Roteiro vira vídeo | Texto dá lugar a cenas e uma prévia | Demonstração real ou metáfora identificada | Transformação acompanha a fala | Resultado é mostrado |

São exemplos de direção, não cenas já implementadas. Confira os tipos em `beats.md` e os dados aceitos em `guided.md`. Não prometa uma demonstração real se só há cartões. Se faltar peça de mídia, registre a lacuna e escolha uma metáfora executável ou proponha ampliar o motor; não desenhe uma interface inventada como se fosse o produto.

Cada plano precisa responder: **quem/que objeto deve ser olhado, qual ação acontece e por que cortar agora?** Texto ajuda a imagem; não deve ser a única prova da fala. Antes de um novo lote, produza um piloto curto que contenha o trecho mais difícil (quiz, demonstração, transformação ou transição), assista e revise. Uma reprovação visual interrompe a expansão daquele formato; não produzir mais do mesmo para preencher o lote.

## Câmera

- Cortar entre interlocutores quando a fala troca; conservar eixo e direção do olhar. Evitar passeio lateral sem alvo.
- Durante leitura, opções de quiz e explicação com interface, preferir câmera estável. Animar destaque, escolha ou resultado; não arrastar o cenário atrás do texto fixo.
- Quiz e gabarito devem conservar enquadramento e posição das opções. A revelação é a mudança, não um reinício de travelling.
- `camStyle` é global. `slide` desloca posição e alvo em TODO plano sem `to`. `push` também não é fixo: `useShots` aproxima automaticamente 10%. Cada cena reinicia a interpolação. Não usar sorteio global de câmera como decisão editorial.
- Para travar um plano sem alterar o motor, em `scene.parts[].shots` definir `shot` e `to` com o mesmo nome, por exemplo `{"at":0,"shot":"studio.low","to":"studio.low"}`. Um `to` explícito evita o estilo global e o push implícito.
- Dois planos próximos podem bastar numa conversa curta; uma leitura longa pode precisar ficar estável. Não impor corte a cada número fixo de segundos. Trocar plano por motivo narrativo e dar tempo de ler.
- Em cenas escritas em dados, o `at` usa o tempo da cena, inclusive nas partes posteriores. Conferir o instante do corte com `timing.json` e reproduzir atravessando a fronteira.

## Ritmo e produto

Como ponto de partida editorial (não medição das referências), busque uma nova ação/informação visual a cada 1–3 s em um anúncio enérgico. Uma pausa de leitura ou emoção pode durar mais. Não preencher pausas com zoom, flashes ou efeitos aleatórios. Uma ação pode durar vários planos; um plano pode conter várias ações.

Para ClippAI, partir de um problema concreto de criação e mostrar a transformação até o resultado. Alternar tarefa, objeto/metáfora e vídeo pronto; reservar marca e chamada para um fecho curto. Dois vídeos do lote devem explorar problemas e mecanismos visuais diferentes, não o mesmo texto em outra cor. Mito/fato pode organizar o roteiro, mas não decide a encenação inteira.

Rever sem som: entende-se problema → ação → resultado? Rever com a narração: os eventos respondem às palavras e deixam respirar? Um boneco falando sob cartões por quase todo o vídeo reprova o objetivo atual da ClippAI, mesmo que os dados validem.

## Pesquisa de referência

Conservar link original, autor, arquivo/trecho quando disponível, data e condição de acesso. Anotar por trecho o antes/depois, ação, câmera, corte, texto e som. Separar observação direta, notas herdadas e proposta de adaptação. Não inventar timecodes, frequência de cortes, métricas de retenção ou descrição de movimento quando só se viu thumbnail/transcrição. Quando login ou bloqueio impedir assistir, registrar a pendência e trabalhar nas melhorias que a evidência local sustenta.

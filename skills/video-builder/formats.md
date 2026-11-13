# Formatos

Gerado por `vid docs`. Cada formato é uma sequência de cenas; você só preenche a ficha. Fichas de exemplo completas em `playbook/examples/<formato>.json`.

## `mito-vs-fato`: Mito vs fato
Uma crença comum sobre criar vídeo curto é desmentida em um cartão, seguida da forma certa e da apresentação do Vidforge. 5 cenas, cerca de 20 s.

Sequência: mito → fato → comparar → virada → fim

| Campo | O que escrever | Exemplo |
|---|---|---|
| `myth` | O mito, em narração, começando com "Mito:" e com *ênfase*. | Mito: você *precisa* aparecer na câmera para criar vídeo. |
| `mythCard` | O mito para o cartão (até 60 caracteres). | Precisa aparecer na câmera? |
| `fact` | O fato, em narração, começando com "Fato:" e com *ênfase*. | Fato: dá para criar com *texto* e narração, sem mostrar o rosto. |
| `factCard` | O fato para o cartão (até 60 caracteres). | Não. Texto e narração bastam. |
| `compareSay` | Narração do errado e do certo, com dois-pontos antes do certo ("O certo é: ..."). | Quem espera o vídeo ficar perfeito nunca posta. O certo é: publicar todo dia. |
| `wrong` | O jeito errado, curto, para o cartão (até 30 caracteres). | Esperar o vídeo perfeito |
| `right` | O jeito certo, curto, para o cartão (até 30 caracteres). | Publicar todo dia |

## Mundo sorteado

`vid new` sorteia, fugindo do que os últimos episódios usaram: lugar (cafe, restaurante, hotel, imigracao, aeroporto, loja, farmacia), metáfora (scale, bars, pile), estilo de câmera (push, pull, slide), tom do estúdio, roupa e cabelo de "você" e do atendente, e uma variante de cada fala fixa (fim: 1).

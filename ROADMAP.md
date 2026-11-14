# Roadmap

**Aonde vamos:** um serviço hospedado em que donos de app e criadores de conteúdo cadastram a marca e geram vídeos curtos animados, com voz e modelo incluídos no plano e limitados por cota.

**Onde estamos:** um builder local que funciona para uma pessoa técnica, com uma marca real (privada) e uma de exemplo. Desenho atual em `docs/ARCHITECTURE.md`.

Marque cada entregável ao concluir (`- [x]`). Uma fase só fecha quando o critério de saída é cumprido.

## Princípios

- **Validar antes de escalar.** Nada de infraestrutura antes de haver vídeos publicados e métricas reais.
- **O núcleo não muda de forma.** `core/` devolve dados e recebe o espaço de trabalho; a nuvem troca o que está atrás dele (disco por banco e armazenamento de objetos), não a API.
- **Só dados, nunca código do cliente.** No serviço, um vídeo é JSON. Cenas em código ficam fora: é o que permite renderizar para vários clientes sem isolar execução.
- **Generalizar a partir de casos concretos.** Segunda marca e segundo estilo entram como casos reais; a abstração sai deles.

## Feito

- [x] Motor de cenas em dados, kit 3D (5 cenários, boneco articulado, tutor, objetos de metáfora)
- [x] 4 formatos, 24 tipos de cena, mundo sorteado e histórico que barra repetição
- [x] Voz por personagem com tempo por palavra e cache; legenda sincronizada
- [x] Validador com níveis de liberdade (`recipe`, `guided`)
- [x] Folhas de revisão, render por cena com cache, pacote por plataforma, calendário
- [x] Núcleo como biblioteca; espaço de trabalho por marca separado do motor
- [x] Composição única que recebe o JSON; marca (nome, logo, frase, chamada) vinda de dados
- [x] CLI `vid`, servidor MCP (15 ferramentas) e skill para agentes
- [x] UI web local: galeria, editor com prévia ao vivo, etapas de voz, revisão, render e pacote
- [x] Chat com o Claude no editor, com modelo e esforço escolhidos na tela
- [x] Marca de exemplo pública (`workspaces/demo`) e regressão visual por quadros de referência

## Fase 0 — Fechar e validar o MVP local

- [ ] Chat rodando contra a API real, nos quatro modelos oferecidos
- [ ] MCP registrado e usado por um agente real para criar um vídeo de ponta a ponta
- [ ] Voz paga, folhas, render e pacote disparados pela UI, com o vídeo assistido com som
- [ ] `vid batch` com 5 vídeos de uma vez
- [ ] Regressão (`golden`) e teste do MCP rodando na marca de exemplo, num clone limpo
- [ ] Elenco, nome da série e miniatura vindos do playbook, sem nada do Pragma no núcleo
- [ ] Vozes nativas em pt-BR (plano pago do ElevenLabs)
- [ ] Inglês das pautas conferido por um nativo
- [ ] 10 vídeos do Pragma publicados, com retenção nos 3 s, conclusão e salvamentos anotados
- [ ] Decidido: nome do produto
- [ ] Decidido: limpar ou não o conteúdo do Pragma no histórico público do repositório

**Saída:** 10 vídeos no ar com métricas, e todos os testes verdes num clone limpo.

## Fase 1 — Produto geral: qualquer marca, sem engenheiro

- [ ] Tema por marca: cores, fonte e logo em cartões, legenda e tela final
- [ ] Cadastro de marca por entrevista: o Claude gera marca, tom, formatos sugeridos e 10 pautas
- [ ] Criar vídeo a partir de um tema na UI, com a ficha escrita pelo Claude e validada
- [ ] Gerador de pautas em lote, com afirmações e idioma estrangeiro marcados para revisão humana
- [ ] Peça de mídia: imagem e gravação de tela dentro da cena, para demonstrar o produto
- [ ] 6 formatos genéricos: problema → produto, antes e depois, 3 erros, mito ou fato, quiz, demonstração
- [ ] Cenários fora do balcão: escritório, casa de dia, rua de dia, palco de produto
- [ ] Câmera automática: enquadrar alvos em vez de coordenadas à mão
- [ ] Validador de enquadramento: acusa boneco cortado e cartão sobre rosto antes do render
- [ ] Câmera e enquadramento por cena editáveis na UI
- [ ] Seletor de marca na UI e layout para telas abaixo de 1180 px
- [x] A UI recarrega sozinha quando um agente altera o vídeo por fora
- [ ] Segunda marca real de ponta a ponta (o próprio produto), com 5 vídeos publicados

**Saída:** uma pessoa sem código cadastra a marca e publica um vídeo em menos de 30 minutos.

## Fase 2 — Fundação para vários clientes

- [ ] Experimento de render em nuvem: contêiner com WebGL por software contra Remotion Lambda, com custo e tempo por vídeo medidos
- [ ] Camada de armazenamento no núcleo (disco ou nuvem), com os testes atuais passando nas duas
- [ ] Banco: organização, membro, marca, playbook, vídeo, tarefa e uso
- [ ] Isolamento por organização, com teste automático de vazamento entre clientes
- [ ] Login (e-mail e Google), organizações e convites
- [ ] Servidor de API de produção, separado do servidor de desenvolvimento, com limites por cliente
- [ ] Fila e workers para voz, folhas, render e pacote, com retomada, cancelamento e progresso ao vivo
- [ ] Chaves de voz e de modelo só no servidor; chat e voz passando por ele
- [ ] Cache de voz e de segmentos por organização; política de retenção de arquivos
- [ ] Monitoramento: erros, tempo e custo por tarefa, com alertas
- [ ] Ambiente de homologação e implantação automatizada

**Saída:** dois clientes de teste gerando vídeos em nuvem, sem acesso um aos dados do outro.

## Fase 3 — Cotas e cobrança

- [ ] Medição por organização: caracteres de voz, tokens do chat, segundos de render, armazenamento
- [ ] Custo real por vídeo medido, e crédito por vídeo definido com margem conhecida
- [ ] Planos e período de teste; limites rígidos e aviso de consumo na UI
- [ ] Stripe: assinatura, pacotes de crédito, portal do cliente, webhooks e inadimplência
- [ ] Painel interno com uso, custo e margem por cliente

**Saída:** um cliente assina, consome, estoura a cota e é bloqueado ou faz upgrade, sem intervenção manual.

## Fase 4 — Beta fechado

- [ ] Licença do Remotion para empresa e para serviço conferida e contratada
- [ ] Plano comercial do ElevenLabs contratado
- [ ] Termos de uso, privacidade (LGPD) e política de conteúdo
- [ ] Moderação de pedidos: recusa de conteúdo proibido e de uso de marca de terceiros
- [ ] Onboarding guiado e vídeos de exemplo por nicho
- [ ] Página de vendas e lista de espera, anunciada com vídeos feitos no próprio produto
- [ ] Suporte: canal de contato e relato de erro pela UI com o vídeo anexado
- [ ] Backups, plano de incidentes e teste de carga com 20 renders simultâneos
- [ ] 10 clientes beta entrevistados; ativação medida (primeiro vídeo em 24 h)

**Saída:** 10 clientes ativos, 5 pagantes, custo por vídeo dentro da margem.

## Fase 5 — Lançamento e crescimento

- [ ] Agendamento e publicação direta em Instagram, TikTok e YouTube, com aprovação por post
- [ ] Métricas das plataformas orientando a escolha de formato e gancho
- [ ] MCP remoto com login, para clientes que usam agentes
- [ ] Modelos 3D prontos e personagens com animação de esqueleto
- [ ] Segundo estilo visual (2D)
- [ ] Equipes: papéis, aprovação por link para o cliente final, várias marcas por conta
- [ ] Biblioteca compartilhável de formatos e cenários
- [ ] API pública e webhooks

## Decisões em aberto

- Nome do produto.
- Provedor de render, depois do experimento da fase 2.
- Preço e tamanho dos créditos, depois da medição de custo da fase 3.
- Conteúdo do Pragma no histórico público do repositório.
- Idiomas além de pt-BR.

## Riscos

- **Licença do Remotion:** oferecer render como serviço pode exigir um plano específico; conferir antes da fase 2.
- **Custo por vídeo:** render 3D em nuvem, voz e modelo somados podem não caber no preço que o cliente aceita.
- **Alcance:** as plataformas reduzem a entrega de conteúdo repetitivo feito em série; a variedade da fase 1 é a defesa.
- **Qualidade de voz:** hoje as vozes são estrangeiras falando português.
- **Conteúdo gerado sem revisão:** fatos e frases em outro idioma podem sair errados.
- **Dependência de fornecedor:** um único provedor de voz e um de modelo.

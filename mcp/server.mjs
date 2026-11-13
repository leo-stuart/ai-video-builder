#!/usr/bin/env node
// Servidor MCP do builder (stdio): cliente fino do core. Uma ferramenta por função relevante a um agente.
// Nada além do protocolo pode sair no stdout; todo log vai para o stderr.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as core from "../core/index.mjs";
import { TOOLS, defaultSerial, toolMessage } from "./tools.mjs";

// Proteção: qualquer console.log perdido (nosso ou de biblioteca) iria para o stdout e quebraria o protocolo.
console.log = console.info = console.debug = (...a) => console.error(...a);
const log = (...a) => console.error("[vb-mcp]", ...a);

const argv = process.argv.slice(2);
const wi = argv.indexOf("--workspace");
const wsArg = wi >= 0 ? argv[wi + 1] : argv.find((a) => a.startsWith("--workspace="))?.slice(12);
let WS;
try {
  WS = core.resolveWorkspace(wsArg);
} catch (e) {
  log(e.message);
  process.exit(1);
}

/* ───────────── instruções para o agente ───────────── */

const INSTRUCTIONS = `Builder de vídeos curtos animados (Reels, TikTok, Shorts) que ensinam uma frase de inglês e vendem o app da marca. Um vídeo é um episódio: formato (sequência de cenas) + ficha (as frases) + mundo sorteado (lugar, câmera, metáfora). Ninguém escreve código de cena.

FLUXO
1. get_workspace (marca, regras) e list_pautas: escolha a pauta marcada recommended, salvo pedido do usuário. Se ele deu um tema, use list_formats e monte a ficha.
2. create_episode (slug epNN-tema; passe model com o seu nome: haiku, sonnet ou opus). Número: o próximo livre em list_episodes.
3. validate com scriptOnly=true. Corrija os erros com edit_scene.
4. PARE: mostre ao usuário todas as falas (get_episode) e a legenda do post, e espere o sim. A voz gasta crédito pago.
5. generate_voice com confirm=true (só depois do sim). Veja voice_balance antes e depois e diga o gasto. Para só estimar tempos sem custo: provider="none".
6. validate sem scriptOnly. Sem erros, siga.
7. review_frames: você recebe as imagens; OLHE cada folha (cada quadro traz o id da cena e o segundo). Confira: cenário certo, quem fala no quadro, humor da cena, dois quadros diferentes, texto da tela é do episódio, inglês letra por letra, legenda legível, cartões inteiros e fora do rosto, X no erro e certo no acerto, última cena com logo e chamada. Para uma cena de perto: review_frames com scene.
8. Qualquer problema: edit_scene, e review_frames só da cena. Mudou narração: generate_voice de novo (só as falas mudadas gastam).
9. render (só refaz o que mudou) e depois pack. Entregue o caminho do vídeo e do pacote.

NÍVEIS DE LIBERDADE (gravados no episódio; o validador impõe)
- recipe (modelos pequenos): pauta pronta ou ficha de um formato; só a operação set (narration, sub, hold, params.campo). Na dúvida, fique aqui.
- guided (médios): também replace, insert, move, remove, world e scene (cena descrita em dados). Tipos de cena e campos: list_beats.
- free (grandes): nas mesmas regras; cenas em código ficam fora desta versão.
Se um conserto exige nível acima do seu, diga ao usuário e proponha outra pauta ou outro nível.

REGRAS QUE NÃO SE QUEBRAM
- Nada é publicado nem enviado a lugar nenhum: postar é do usuário, na conta dele.
- Inglês correto, como um nativo diria. Pautas prontas já foram conferidas; fichas novas não. Sem certeza, use pauta pronta e avise.
- As falas fixas do fecho e do pitch da série não se reescrevem. Só prometa o que o app faz (lições curtas, tutor de IA por voz, mapa de fluência); nada de preço, "grátis", prazo para fluência ou porcentagem.
- Nunca peça nem mostre chaves de API; elas ficam no arquivo de ambiente do espaço de trabalho.
- Não copie roteiro, personagem ou arte de outro canal ou app.
- Marcação da narração: *palavra* dá ênfase, [en]…[/en] envolve todo trecho em inglês, "…" para reticências. Rótulos até 16 caracteres, cartões até 60. Não cite preço.
- Se ninguém puder autorizar a voz, entregue só o roteiro e diga que a voz aguarda aprovação.

O QUE VOCÊ NÃO CONSEGUE VERIFICAR (diga na entrega)
O som (pronúncia, sotaque, volume), o movimento (as folhas são quadros parados), a sincronia fina entre boca, legenda e voz, e o inglês fora das pautas prontas. Peça ao usuário para assistir uma vez inteiro, com som.

Erro de ferramenta traz a mensagem do problema em português: leia, conserte e tente de novo; não insista cegamente.`;

/* ───────────── ferramentas (definição única em mcp/tools.mjs) ───────────── */

const progressOf = (extra) => {
  const token = extra?._meta?.progressToken;
  if (token === undefined) return undefined;
  let n = 0;
  return ({ step, done, total, label }) => {
    const message = [step, total ? `${done}/${total}` : "", label].filter(Boolean).join(" ");
    extra.sendNotification({ method: "notifications/progress", params: { progressToken: token, progress: ++n, message } }).catch(() => {});
  };
};

const server = new McpServer({ name: "video-builder", version: "1.0.0" }, { instructions: INSTRUCTIONS });

for (const t of TOOLS) {
  server.registerTool(t.name, { title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations }, async (args, extra) => {
    try {
      const r = await t.run(args ?? {}, { ws: WS, serial: defaultSerial, onProgress: progressOf(extra) });
      if (r.error) return { isError: true, content: [{ type: "text", text: r.error }] };
      return { content: [{ type: "text", text: r.text }, ...(r.images ?? []).map((i) => ({ type: "image", data: i.data, mimeType: i.mimeType }))] };
    } catch (e) {
      if (!(e instanceof core.VbError)) log(`erro em ${t.name}:`, e?.stack ?? e);
      return { isError: true, content: [{ type: "text", text: toolMessage(t.name, e) }] };
    }
  });
}

/* ───────────── prompt ───────────── */

server.registerPrompt(
  "novo_video",
  {
    title: "Novo vídeo",
    description: "Cria um vídeo novo do roteiro ao pacote de postagem, seguindo o fluxo do builder.",
    argsSchema: { tema: z.string().optional().describe("Tema ou frase de inglês do vídeo. Vazio: escolher uma pauta pronta."), modelo: z.string().optional().describe("Seu nome de modelo (haiku, sonnet, opus), para fixar o nível de liberdade.") },
  },
  ({ tema, modelo }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Crie um vídeo novo com o builder.${tema ? ` Tema pedido pelo usuário: ${tema}.` : " Sem tema: use a pauta recomendada."}${modelo ? ` Meu modelo: ${modelo}.` : ""}

Siga as instruções do servidor, nesta ordem: list_pautas (ou list_formats, se há tema) → create_episode → validate (scriptOnly) → mostrar as falas e a legenda ao usuário e esperar o sim → generate_voice com confirm → validate → review_frames, olhando cada imagem → corrigir com edit_scene → render → pack.
Não gaste voz sem o sim. Não publique nada. Na entrega, diga o gasto de voz, o que você não consegue verificar (som, movimento, sincronia, inglês fora das pautas) e peça para o usuário assistir com som.`,
        },
      },
    ],
  }),
);

await server.connect(new StdioServerTransport());
log(`pronto. Espaço de trabalho: ${WS}`);

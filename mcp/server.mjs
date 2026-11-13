#!/usr/bin/env node
// Servidor MCP do builder (stdio): cliente fino do core. Uma ferramenta por função relevante a um agente.
// Nada além do protocolo pode sair no stdout; todo log vai para o stderr.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as core from "../core/index.mjs";

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

/* ───────────── utilidades ───────────── */

const sh = promisify(execFile);
const text = (obj) => ({ content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj) }] });
const fail = (msg) => ({ isError: true, content: [{ type: "text", text: msg }] });

// Mensagens do core citam comandos do terminal; no MCP o equivalente é uma ferramenta.
const TOOL_OF = { voice: "generate_voice", new: "create_episode", pauta: "list_pautas", formats: "list_formats", check: "validate", sheet: "review_frames", render: "render", pack: "pack", scene: "edit_scene", forget: "delete_episode" };
const speak = (m) => String(m).replace(/\bvid (?:--workspace \S+ )?(\w+)/g, (all, c) => (TOOL_OF[c] ? `a ferramenta ${TOOL_OF[c]}` : all));

// Tarefas pesadas (Chromium, ffmpeg, voz) uma de cada vez.
let queue = Promise.resolve();
const serial = (fn) => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
};

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

const slugZ = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "slug: minúsculas, números e hífen").describe("Slug do episódio, ex.: ep14-for-here-or-to-go.");
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const WR = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

function tool(name, title, description, inputSchema, annotations, handler) {
  server.registerTool(name, { title, description, inputSchema, annotations }, async (args, extra) => {
    try {
      return await handler(args ?? {}, extra);
    } catch (e) {
      if (e instanceof core.VbError) return fail(speak(e.message));
      log(`erro em ${name}:`, e?.stack ?? e);
      return fail(`Erro inesperado em ${name}: ${speak(e?.message ?? e)}`);
    }
  });
}

/* ───────────── consulta ───────────── */

tool("get_workspace", "Espaço de trabalho", "Mostra a marca, as vozes, o nível de liberdade padrão, as regras e os horários do espaço de trabalho. Use no começo da sessão para saber a marca e as regras que o validador aplica.", {}, RO, async () => text({ path: WS, config: await core.getWorkspace(WS) }));

tool("list_formats", "Formatos", "Lista os formatos de vídeo (sequência de cenas) e os campos da ficha que cada um pede, com pergunta e exemplo. Use quando o usuário deu um tema próprio e não há pauta pronta: escolha o formato e monte a ficha para create_episode.", {}, RO, async () => text(await core.listFormats(WS)));

tool("list_beats", "Tipos de cena", "Lista os tipos de cena e os parâmetros de cada um (obrigatórios e opcionais). Use ao inserir ou trocar uma cena (edit_scene com replace ou insert) ou ao ajustar params.<campo>.", {}, RO, async () => text(await core.listBeats()));

tool(
  "list_pautas",
  "Pautas prontas",
  "Lista as pautas prontas ainda não usadas (ficha completa, inglês conferido); a primeira, com recommended=true, é a do formato menos usado nos últimos episódios. Use primeiro, antes de criar um episódio, e escolha a recomendada salvo pedido do usuário.",
  { format: z.string().optional().describe("Filtra por formato (id de list_formats).") },
  RO,
  async ({ format }) => text(await core.listPautas(WS, { format })),
);

tool("list_episodes", "Episódios", "Lista os episódios do espaço de trabalho com título, formato, nível de liberdade e status (draft, voiced, rendered, packed). Use para achar o próximo número livre (epNN) e para retomar um episódio.", {}, RO, async () => text(await core.listEpisodes(WS)));

tool(
  "get_episode",
  "Ver episódio",
  "Devolve um episódio: status, a especificação completa (mundo, cenas, parâmetros, legenda do post) e, por cena, a narração e a duração da voz (se já gerada). Use para mostrar as falas ao usuário antes de gastar voz e para conferir o estado depois de editar.",
  { slug: slugZ },
  RO,
  async ({ slug }) => {
    const { spec, timing, status } = await core.getEpisode(WS, slug);
    const scenes = spec.beats.map((b) => ({ id: b.id, type: b.type, speaker: b.speaker ?? "narrador", narration: b.narration, sub: b.sub, dur: timing.scenes?.[b.id]?.dur }));
    return text({ slug, status, voice: timing.provider, scenes, spec });
  },
);

tool(
  "voice_balance",
  "Saldo de voz",
  "Mostra o plano e os créditos de voz paga usados e disponíveis (ElevenLabs). Devolve null sem chave. Use antes e depois de generate_voice para dizer ao usuário quanto o episódio gastou.",
  {},
  RO,
  async () => text({ balance: await core.voiceBalance(WS) }),
);

/* ───────────── criação e edição ───────────── */

tool(
  "create_episode",
  "Criar episódio",
  "Cria um episódio (sorteia o mundo, expande as cenas, o elenco e a legenda do post). Use depois de escolher a pauta (pauta=<id> de list_pautas) ou, para tema próprio, com title + format + ficha. Informe model com o seu nome (haiku, sonnet, opus) para fixar o nível de liberdade. Devolve o episódio criado.",
  {
    slug: z.string().regex(/^ep\d\d-[a-z0-9-]+$/, "slug no padrão epNN-tema-curto").describe("epNN-tema-curto, minúsculas e hífens; NN é o próximo número livre."),
    pauta: z.string().optional().describe("Id de uma pauta de list_pautas. Traz título, formato, lugar e ficha."),
    title: z.string().optional().describe("Título do episódio. Obrigatório sem pauta."),
    format: z.string().optional().describe("Id do formato (list_formats). Obrigatório sem pauta."),
    ficha: z.record(z.string(), z.any()).optional().describe("Campos da ficha do formato; com pauta, só o que sobrescreve."),
    place: z.enum(["cafe", "restaurante", "hotel", "imigracao", "aeroporto", "loja", "farmacia"]).optional().describe("Lugar; se omitido, é sorteado."),
    freedom: z.enum(["recipe", "guided", "free"]).optional().describe("Nível de liberdade; se omitido, vem de model e do workspace."),
    model: z.string().optional().describe("Seu nome de modelo (haiku, sonnet, opus); define o nível quando freedom não é passado."),
  },
  WR,
  async (a) => {
    const { spec } = await core.createEpisode(WS, a);
    const scenes = spec.beats.map((b) => ({ id: b.id, type: b.type, speaker: b.speaker ?? "narrador", narration: b.narration }));
    return text({ slug: spec.slug, title: spec.title, format: spec.format, freedom: spec.freedom, world: spec.world, post: spec.post, scenes, proximo: "validate com scriptOnly=true; depois mostre as falas ao usuário" });
  },
);

const fieldsZ = z.record(z.string(), z.any()).describe('Campos a gravar: narration, sub, speaker, hold, banner, captions ou "params.<campo>".');
const opZ = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set"), id: z.string().describe("Id da cena."), fields: fieldsZ }).describe("Ajusta textos e parâmetros de uma cena (único permitido em recipe)."),
  z.object({
    type: z.literal("world"),
    fields: z.object({ place: z.enum(["cafe", "restaurante", "hotel", "imigracao", "aeroporto", "loja", "farmacia"]).optional(), metaphor: z.enum(["scale", "bars", "pile"]).optional(), camStyle: z.enum(["push", "pull", "slide"]).optional(), studioTone: z.enum(["indigo", "noite", "menta", "coral"]).optional() }).describe("Parte do mundo a trocar."),
  }).describe("Muda o mundo sorteado (guided)."),
  z.object({ type: z.literal("replace"), id: z.string(), beatType: z.string().optional().describe("Novo tipo de cena (list_beats); zera os parâmetros."), narration: z.string().optional(), fields: fieldsZ.optional() }).describe("Troca o tipo e/ou a narração de uma cena (guided)."),
  z.object({
    type: z.literal("insert"),
    after: z.string().describe("Id da cena anterior."),
    id: z.string().regex(/^[a-z][a-z0-9]*$/).describe("Id novo: uma palavra minúscula sem acento."),
    beatType: z.string().describe("Tipo de cena (list_beats); scene-data para descrever a cena em dados."),
    narration: z.string(),
    speaker: z.enum(["voce", "atendente", "tutor"]).optional().describe("Quem fala; sem isso é o narrador. Atendente e tutor falam inglês em [en]…[/en]."),
    sub: z.string().optional(),
    banner: z.string().optional(),
    hold: z.number().optional().describe("Segundos extras de pausa depois da fala."),
    fields: fieldsZ.optional(),
  }).describe("Insere uma cena nova depois de outra (guided)."),
  z.object({ type: z.literal("move"), id: z.string(), after: z.string() }).describe("Move uma cena para depois de outra (guided)."),
  z.object({ type: z.literal("remove"), id: z.string() }).describe("Remove uma cena; a tela final não pode sair (guided)."),
  z.object({
    type: z.literal("scene"),
    id: z.string().describe("Cena do tipo scene-data a preencher."),
    scene: z.object({ parts: z.array(z.record(z.string(), z.any())).min(1), overlays: z.array(z.record(z.string(), z.any())).optional() }).describe("Cena em dados: parts (cenários, objetos, câmeras) e overlays (pin, plate, stamp, mark, verdict, phone, sfx)."),
  }).describe("Escreve uma cena em dados (guided)."),
]);

tool(
  "edit_scene",
  "Editar cena",
  "Edita o episódio sem abrir arquivos: set (textos e params.<campo>), world, replace, insert, move, remove, scene. O nível de liberdade do episódio manda: em recipe só set. Use para corrigir erros do validador e problemas vistos nas folhas. Mudou narração? Gere a voz de novo (só as falas mudadas gastam).",
  { slug: slugZ, op: opZ },
  WR,
  async ({ slug, op }) => {
    const { spec } = await core.editScene(WS, slug, op);
    return text({ ok: true, slug, freedom: spec.freedom, scenes: spec.beats.map((b) => b.id), nota: "Se mudou a narração, gere a voz de novo; depois valide." });
  },
);

tool(
  "validate",
  "Validar",
  "Confere o episódio: erros impedem o render, avisos pedem uma olhada. Use com scriptOnly=true logo depois de criar ou editar o roteiro (antes da voz) e sem scriptOnly depois da voz, antes de revisar e renderizar.",
  { slug: slugZ, scriptOnly: z.boolean().optional().describe("true: só o roteiro (antes de gerar a voz).") },
  RO,
  async ({ slug, scriptOnly }) => text(await core.validate(WS, slug, { scriptOnly: !!scriptOnly })),
);

/* ───────────── tarefas longas ───────────── */

const noAudio = (name) => `${name}: sem voz (provider none) os tempos são estimados e o vídeo sai mudo.`;

tool(
  "generate_voice",
  "Gerar voz",
  'GASTA CRÉDITOS PAGOS (ElevenLabs/OpenAI) quando o provedor é pago. Gera a voz e os tempos de cada cena (só as falas novas ou mudadas gastam; o resto vem do cache). Exige confirm=true, e só depois de mostrar as falas ao usuário e ouvir o sim. provider="none" gera tempos estimados sem custo nem confirmação, para revisar as cenas; o render final precisa da voz de verdade.',
  {
    slug: slugZ,
    confirm: z.boolean().optional().describe("true somente depois de o usuário ter visto as falas e autorizado o gasto de voz neste episódio."),
    provider: z.enum(["elevenlabs", "openai", "say", "none"]).optional().describe('Provedor; omitido usa o padrão do espaço de trabalho (pago se houver chave). "none" = tempos estimados, sem custo.'),
    force: z.boolean().optional().describe("Refaz até as falas em cache (gasta de novo)."),
  },
  { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  async ({ slug, confirm, provider, force }, extra) => {
    if (provider !== "none" && confirm !== true) {
      let falas = "";
      try {
        const { spec } = await core.getEpisode(WS, slug);
        falas = "\n\nFalas do episódio:\n" + spec.beats.map((b) => `- ${b.id} (${b.speaker ?? "narrador"}): ${b.narration}`).join("\n");
      } catch {}
      return fail(`A voz gasta créditos pagos e precisa de autorização. Mostre ao usuário as falas do episódio e a legenda do post, peça o sim e só então chame generate_voice de novo com confirm=true. Para só estimar tempos, sem custo, use provider="none".${falas}`);
    }
    const r = await serial(() => core.voice(WS, slug, { provider, force: !!force, onProgress: progressOf(extra) }));
    const out = { slug, provider: r.provider, seconds: r.seconds, scenes: r.scenes, warnings: r.warnings ?? [] };
    if (r.provider === "none") out.warnings.push(noAudio(slug));
    return text(out);
  },
);

const sheetJpeg = async (file) => {
  const { stdout } = await sh("ffmpeg", ["-v", "error", "-i", file, "-vf", "scale='min(1500,iw)':-2", "-q:v", "5", "-f", "image2pipe", "-c:v", "mjpeg", "-"], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
  return stdout;
};

tool(
  "review_frames",
  "Revisar quadros",
  "Gera as folhas de revisão (quadros do episódio lado a lado, com o id da cena e o segundo) e as devolve como IMAGENS. Use depois da voz e da validação, antes do render: OLHE cada folha, é a única forma de ver o vídeo. Sem scene, dois quadros por cena do episódio todo; com scene, seis quadros maiores só daquela cena (use depois de consertar uma cena).",
  {
    slug: slugZ,
    scene: z.string().optional().describe("Id de uma cena para olhar de perto."),
    per: z.number().int().min(1).max(8).optional().describe("Quadros por cena (padrão 2 no episódio todo, 6 numa cena)."),
  },
  WR,
  async ({ slug, scene, per }, extra) => {
    const r = await serial(() => core.frames(WS, slug, { scene, per, onProgress: progressOf(extra) }));
    const images = [];
    const sizes = [];
    for (const f of r.sheets) {
      const buf = await sheetJpeg(f);
      sizes.push(buf.length);
      images.push({ type: "image", data: buf.toString("base64"), mimeType: "image/jpeg" });
    }
    const meta = { slug, scene: scene ?? null, folhas: r.sheets.length, bytes: sizes, quadros: r.frames, arquivos: r.sheets, nota: "Cada folha traz seus quadros em ordem, com o id da cena e o segundo no canto. Percorra a lista de revisão cena por cena." };
    return { content: [{ type: "text", text: JSON.stringify(meta) }, ...images] };
  },
);

tool(
  "render",
  "Renderizar",
  "Renderiza o vídeo final (1080x1920) por segmentos em cache: só as cenas mudadas são refeitas. Nunca gera voz; exige tempos de voz em todas as cenas. Use depois de revisar as folhas sem pendências. Pode levar minutos num episódio novo. Devolve o caminho do arquivo local.",
  { slug: slugZ, force: z.boolean().optional().describe("Ignora o cache e refaz todas as cenas.") },
  WR,
  async ({ slug, force }, extra) => text(await serial(() => core.render(WS, slug, { force: !!force, onProgress: progressOf(extra) }))),
);

tool(
  "pack",
  "Pacote de postagem",
  "Monta o pacote de postagem do vídeo renderizado: legenda por plataforma (Reels, TikTok, Shorts), miniatura e metadados, em uma pasta local. Não publica nem envia nada; postar é do usuário. Use depois do render.",
  { slug: slugZ },
  WR,
  async ({ slug }) => text(await core.pack(WS, slug)),
);

tool(
  "delete_episode",
  "Apagar episódio",
  "APAGA o episódio e o que ele gerou (voz, vídeo, pacote) e o tira do histórico de variedade. Irreversível. Use só quando o usuário pedir, ou para limpar um episódio de teste que você mesmo criou.",
  { slug: slugZ },
  { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  async ({ slug }) => text(await core.deleteEpisode(WS, slug)),
);

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

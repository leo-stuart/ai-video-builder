// Definição única das ferramentas do builder. Usada pelo servidor MCP (mcp/server.mjs) e pelo chat da UI (ui/chat.mjs).
// Cada ferramenta: { name, title, description, inputSchema (forma zod), annotations, run(args, ctx) }.
//   ctx = { ws, serial(fn), onProgress }   ·   run devolve { text, images? } ou { error } (ou lança; veja toolMessage).
//   images = [{ data (base64), mimeType }]
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import * as core from "../core/index.mjs";

const sh = promisify(execFile);
const text = (obj) => ({ text: typeof obj === "string" ? obj : JSON.stringify(obj) });
const fail = (msg) => ({ error: msg });

// Mensagens do core citam comandos do terminal; aqui o equivalente é uma ferramenta.
const TOOL_OF = { voice: "generate_voice", new: "create_episode", pauta: "list_pautas", formats: "list_formats", check: "validate", sheet: "review_frames", render: "render", pack: "pack", scene: "edit_scene", forget: "delete_episode" };
export const speak = (m) => String(m).replace(/\bvid (?:--workspace \S+ )?(\w+)/g, (all, c) => (TOOL_OF[c] ? `a ferramenta ${TOOL_OF[c]}` : all));

/** Mensagem de erro em português para qualquer exceção de ferramenta. */
export const toolMessage = (name, e) => (e instanceof core.VbError ? speak(e.message) : `Erro inesperado em ${name}: ${speak(e?.message ?? e)}`);

// Tarefas pesadas (Chromium, ffmpeg, voz) uma de cada vez, quando o cliente não traz a própria fila.
let queue = Promise.resolve();
export const defaultSerial = (fn) => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
};

export const TOOLS = [];
function def(name, title, description, inputSchema, annotations, run) {
  TOOLS.push({ name, title, description, inputSchema, annotations, run });
}

const slugZ = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "slug: minúsculas, números e hífen").describe("Slug do episódio, ex.: ep14-for-here-or-to-go.");
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const WR = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

/* ───────────── consulta ───────────── */

def("get_workspace", "Espaço de trabalho", "Mostra a marca, as vozes, o nível de liberdade padrão, as regras e os horários do espaço de trabalho. Use no começo da sessão para saber a marca e as regras que o validador aplica.", {}, RO, async (_a, ctx) => text({ path: ctx.ws, config: await core.getWorkspace(ctx.ws) }));

def("list_formats", "Formatos", "Lista os formatos de vídeo (sequência de cenas) e os campos da ficha que cada um pede, com pergunta e exemplo. Use quando o usuário deu um tema próprio e não há pauta pronta: escolha o formato e monte a ficha para create_episode.", {}, RO, async (_a, ctx) => text(await core.listFormats(ctx.ws)));

def("list_beats", "Tipos de cena", "Lista os tipos de cena e os parâmetros de cada um (obrigatórios e opcionais). Use ao inserir ou trocar uma cena (edit_scene com replace ou insert) ou ao ajustar params.<campo>.", {}, RO, async (_a, ctx) => text(await core.listBeats()));

def(
  "list_pautas",
  "Pautas prontas",
  "Lista as pautas prontas ainda não usadas (ficha completa, inglês conferido); a primeira, com recommended=true, é a do formato menos usado nos últimos episódios. Use primeiro, antes de criar um episódio, e escolha a recomendada salvo pedido do usuário.",
  { format: z.string().optional().describe("Filtra por formato (id de list_formats).") },
  RO,
  async ({ format }, ctx) => text(await core.listPautas(ctx.ws, { format })),
);

def("list_episodes", "Episódios", "Lista os episódios do espaço de trabalho com título, formato, nível de liberdade e status (draft, voiced, rendered, packed). Use para achar o próximo número livre (epNN) e para retomar um episódio.", {}, RO, async (_a, ctx) => text(await core.listEpisodes(ctx.ws)));

def(
  "get_episode",
  "Ver episódio",
  "Devolve um episódio: status, a especificação completa (mundo, cenas, parâmetros, legenda do post) e, por cena, a narração e a duração da voz (se já gerada). Use para mostrar as falas ao usuário antes de gastar voz e para conferir o estado depois de editar.",
  { slug: slugZ },
  RO,
  async ({ slug }, ctx) => {
    const { spec, timing, status } = await core.getEpisode(ctx.ws, slug);
    const scenes = spec.beats.map((b) => ({ id: b.id, type: b.type, speaker: b.speaker ?? "narrador", narration: b.narration, sub: b.sub, dur: timing.scenes?.[b.id]?.dur }));
    return text({ slug, status, voice: timing.provider, scenes, spec });
  },
);

def(
  "voice_balance",
  "Saldo de voz",
  "Mostra o plano e os créditos de voz paga usados e disponíveis (ElevenLabs). Devolve null sem chave. Use antes e depois de generate_voice para dizer ao usuário quanto o episódio gastou.",
  {},
  RO,
  async (_a, ctx) => text({ balance: await core.voiceBalance(ctx.ws) }),
);

/* ───────────── criação e edição ───────────── */

def(
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
  async (a, ctx) => {
    const { spec } = await core.createEpisode(ctx.ws, a);
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

def(
  "edit_scene",
  "Editar cena",
  "Edita o episódio sem abrir arquivos: set (textos e params.<campo>), world, replace, insert, move, remove, scene. O nível de liberdade do episódio manda: em recipe só set. Use para corrigir erros do validador e problemas vistos nas folhas. Mudou narração? Gere a voz de novo (só as falas mudadas gastam).",
  { slug: slugZ, op: opZ },
  WR,
  async ({ slug, op }, ctx) => {
    const { spec } = await core.editScene(ctx.ws, slug, op);
    return text({ ok: true, slug, freedom: spec.freedom, scenes: spec.beats.map((b) => b.id), nota: "Se mudou a narração, gere a voz de novo; depois valide." });
  },
);

def(
  "validate",
  "Validar",
  "Confere o episódio: erros impedem o render, avisos pedem uma olhada. Use com scriptOnly=true logo depois de criar ou editar o roteiro (antes da voz) e sem scriptOnly depois da voz, antes de revisar e renderizar.",
  { slug: slugZ, scriptOnly: z.boolean().optional().describe("true: só o roteiro (antes de gerar a voz).") },
  RO,
  async ({ slug, scriptOnly }, ctx) => text(await core.validate(ctx.ws, slug, { scriptOnly: !!scriptOnly })),
);

/* ───────────── tarefas longas ───────────── */

const noAudio = (name) => `${name}: sem voz (provider none) os tempos são estimados e o vídeo sai mudo.`;

def(
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
  async ({ slug, confirm, provider, force }, ctx) => {
    if (provider !== "none" && confirm !== true) {
      let falas = "";
      try {
        const { spec } = await core.getEpisode(ctx.ws, slug);
        falas = "\n\nFalas do episódio:\n" + spec.beats.map((b) => `- ${b.id} (${b.speaker ?? "narrador"}): ${b.narration}`).join("\n");
      } catch {}
      return fail(`A voz gasta créditos pagos e precisa de autorização. Mostre ao usuário as falas do episódio e a legenda do post, peça o sim e só então chame generate_voice de novo com confirm=true. Para só estimar tempos, sem custo, use provider="none".${falas}`);
    }
    const r = await ctx.serial(() => core.voice(ctx.ws, slug, { provider, force: !!force, onProgress: ctx.onProgress }));
    const out = { slug, provider: r.provider, seconds: r.seconds, scenes: r.scenes, warnings: r.warnings ?? [] };
    if (r.provider === "none") out.warnings.push(noAudio(slug));
    return text(out);
  },
);

const sheetJpeg = async (file) => {
  const { stdout } = await sh("ffmpeg", ["-v", "error", "-i", file, "-vf", "scale='min(1500,iw)':-2", "-q:v", "5", "-f", "image2pipe", "-c:v", "mjpeg", "-"], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
  return stdout;
};

def(
  "review_frames",
  "Revisar quadros",
  "Gera as folhas de revisão (quadros do episódio lado a lado, com o id da cena e o segundo) e as devolve como IMAGENS. Use depois da voz e da validação, antes do render: OLHE cada folha, é a única forma de ver o vídeo. Sem scene, dois quadros por cena do episódio todo; com scene, seis quadros maiores só daquela cena (use depois de consertar uma cena).",
  {
    slug: slugZ,
    scene: z.string().optional().describe("Id de uma cena para olhar de perto."),
    per: z.number().int().min(1).max(8).optional().describe("Quadros por cena (padrão 2 no episódio todo, 6 numa cena)."),
  },
  WR,
  async ({ slug, scene, per }, ctx) => {
    const r = await ctx.serial(() => core.frames(ctx.ws, slug, { scene, per, onProgress: ctx.onProgress }));
    const images = [];
    const sizes = [];
    for (const f of r.sheets) {
      const buf = await sheetJpeg(f);
      sizes.push(buf.length);
      images.push({ data: buf.toString("base64"), mimeType: "image/jpeg" });
    }
    const meta = { slug, scene: scene ?? null, folhas: r.sheets.length, bytes: sizes, quadros: r.frames, arquivos: r.sheets, nota: "Cada folha traz seus quadros em ordem, com o id da cena e o segundo no canto. Percorra a lista de revisão cena por cena." };
    return { text: JSON.stringify(meta), images };
  },
);

def(
  "render",
  "Renderizar",
  "Renderiza o vídeo final (1080x1920) por segmentos em cache: só as cenas mudadas são refeitas. Nunca gera voz; exige tempos de voz em todas as cenas. Use depois de revisar as folhas sem pendências. Pode levar minutos num episódio novo. Devolve o caminho do arquivo local.",
  { slug: slugZ, force: z.boolean().optional().describe("Ignora o cache e refaz todas as cenas.") },
  WR,
  async ({ slug, force }, ctx) => text(await ctx.serial(() => core.render(ctx.ws, slug, { force: !!force, onProgress: ctx.onProgress }))),
);

def(
  "pack",
  "Pacote de postagem",
  "Monta o pacote de postagem do vídeo renderizado: legenda por plataforma (Reels, TikTok, Shorts), miniatura e metadados, em uma pasta local. Não publica nem envia nada; postar é do usuário. Use depois do render.",
  { slug: slugZ },
  WR,
  async ({ slug }, ctx) => text(await core.pack(ctx.ws, slug)),
);

def(
  "delete_episode",
  "Apagar episódio",
  "APAGA o episódio e o que ele gerou (voz, vídeo, pacote) e o tira do histórico de variedade. Irreversível. Use só quando o usuário pedir, ou para limpar um episódio de teste que você mesmo criou.",
  { slug: slugZ },
  { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  async ({ slug }, ctx) => text(await core.deleteEpisode(ctx.ws, slug)),
);


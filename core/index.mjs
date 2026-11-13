// Núcleo do builder: toda a lógica. Devolve dados; nunca imprime nem encerra o processo.
// Erros de uso lançam VbError (code + message em português).
export { VbError } from "./errors.mjs";
export { resolveWorkspace, initWorkspace, getWorkspace } from "./workspace.mjs";
export { listFormats, listBeats, listPautas } from "./playbook.mjs";
export { listEpisodes, getEpisode, createEpisode, editScene, forget, deleteEpisode } from "./episodes.mjs";
export { validate } from "./validate.mjs";
export { voice, voiceBalance, listVoices } from "./voice.mjs";
export { frames, render, inputPropsOf, preparePublic, makeBundle } from "./remotion.mjs";
export { pack } from "./pack.mjs";
export { batch } from "./batch.mjs";
export { generateDocs } from "./docs.mjs";

/** Erro de uso do core: `code` estável para máquinas, `message` em português para pessoas. */
export class VbError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "VbError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

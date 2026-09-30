/**
 * LPreco — contrato do item de precificação.
 * Única porta de entrada do payload externo desta entidade.
 * Fail-closed: campo ausente, tipo inválido ou enum fora do conjunto lança.
 * Sem rede, disco ou estado em memória.
 */

/** @typedef {'BRL' | 'USD' | 'EUR'} Moeda */

/** @typedef {'UN' | 'KG' | 'M' | 'L' | 'CX'} UnidadeMedida */

/**
 * @typedef {{
 *   codigo: string,
 *   descricao: string,
 *   custoUnitario: number,
 *   margemPercentual: number,
 *   moeda: Moeda,
 *   unidade: UnidadeMedida,
 *   ativo: boolean,
 * }} ItemPreco
 */

/** @type {readonly Moeda[]} */
export const MOEDAS = Object.freeze(["BRL", "USD", "EUR"]);

/** @type {readonly UnidadeMedida[]} */
export const UNIDADES = Object.freeze(["UN", "KG", "M", "L", "CX"]);

export class ContratoInvalidoError extends Error {
  /**
   * @param {string} message
   * @param {string} campo
   */
  constructor(message, campo) {
    super(message);
    this.name = "ContratoInvalidoError";
    this.campo = campo;
  }
}

/**
 * @param {unknown} raw
 * @returns {ItemPreco}
 */
export function parseItemPreco(raw) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ContratoInvalidoError(
      "payload de item de preço ausente ou inválido",
      "item",
    );
  }

  const src = /** @type {Record<string, unknown>} */ (raw);

  const item = {
    codigo: exigirCodigo(src.codigo),
    descricao: exigirTexto(src.descricao, "descricao"),
    custoUnitario: exigirNumero(src.custoUnitario, "custoUnitario", 0),
    margemPercentual: exigirNumero(src.margemPercentual, "margemPercentual", 0),
    moeda: exigirEnum(src.moeda, "moeda", MOEDAS),
    unidade: exigirEnum(src.unidade, "unidade", UNIDADES),
    ativo: exigirBooleano(src.ativo, "ativo"),
  };

  return Object.freeze(item);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function exigirCodigo(value) {
  const codigo = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!codigo) {
    throw new ContratoInvalidoError("codigo vazio", "codigo");
  }
  return codigo;
}

/**
 * @param {unknown} value
 * @param {string} campo
 * @returns {string}
 */
function exigirTexto(value, campo) {
  if (typeof value !== "string") {
    throw new ContratoInvalidoError(`${campo} deve ser texto`, campo);
  }
  const texto = value.trim();
  if (!texto) {
    throw new ContratoInvalidoError(`${campo} vazio`, campo);
  }
  return texto;
}

/**
 * @param {unknown} value
 * @param {string} campo
 * @param {number} minimo
 * @returns {number}
 */
function exigirNumero(value, campo, minimo) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimo) {
    throw new ContratoInvalidoError(
      `${campo} deve ser número finito >= ${minimo}`,
      campo,
    );
  }
  return value;
}

/**
 * @template {string} T
 * @param {unknown} value
 * @param {string} campo
 * @param {readonly T[]} permitidos
 * @returns {T}
 */
function exigirEnum(value, campo, permitidos) {
  const normalizado = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!permitidos.includes(/** @type {T} */ (normalizado))) {
    throw new ContratoInvalidoError(
      `${campo} fora do contrato: ${normalizado || "(vazio)"}`,
      campo,
    );
  }
  return /** @type {T} */ (normalizado);
}

/**
 * @param {unknown} value
 * @param {string} campo
 * @returns {boolean}
 */
function exigirBooleano(value, campo) {
  if (typeof value !== "boolean") {
    throw new ContratoInvalidoError(`${campo} deve ser booleano`, campo);
  }
  return value;
}

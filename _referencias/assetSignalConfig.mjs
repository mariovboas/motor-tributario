/**
 * Spec 039 — lê asset_signal_config (cache curto).
 * Sem linha → default: enabled + API_OMQS (compat).
 */

import { dnaFromStrategyCode } from "./engine/strategies/estrategiaBlock.mjs";

const CACHE_TTL_MS = 5_000;

/** @type {Map<string, { at: number, value: ResolvedAssetSignalConfig }>} */
const cache = new Map();

/**
 * @typedef {{
 *   isSignalEnabled: boolean,
 *   strategyCode: string,
 *   strategyId: string | null,
 *   strategyName: string,
 *   dnaObjetivo: string,
 *   marketGroup: 'FOREX'|'B3'|'CRIPTO',
 *   parameters: Record<string, unknown>,
 *   lotSize: number | null,
 *   penduloPerAsset: boolean,
 * }} ResolvedAssetSignalConfig
 */

const DEFAULT_OMQS = Object.freeze({
  isSignalEnabled: true,
  strategyCode: "API_OMQS",
  strategyId: null,
  strategyName: "API OM-QS",
  dnaObjetivo: "SEGUIDOR_TENDENCIA",
  marketGroup: /** @type {'FOREX'} */ ("FOREX"),
  parameters: {},
  lotSize: null,
  penduloPerAsset: false,
});

/**
 * @param {string} ticker
 * @returns {'FOREX'|'B3'|'CRIPTO'}
 */
export function inferMarketGroup(ticker) {
  const t = String(ticker ?? "")
    .trim()
    .toUpperCase();
  if (
    t.startsWith("WIN") ||
    t.startsWith("WDO") ||
    t.startsWith("BIT") ||
    t.includes("FUT") ||
    t.includes("IND")
  ) {
    return "B3";
  }
  if (
    t.includes("BTC") ||
    t.includes("ETH") ||
    t.includes("USDT") ||
    t.startsWith("CRYPTO")
  ) {
    return "CRIPTO";
  }
  return "FOREX";
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} companyId
 * @param {string} ticker
 * @returns {Promise<ResolvedAssetSignalConfig>}
 */
export async function resolveAssetSignalConfig(supabase, companyId, ticker) {
  const key = `${companyId}:${String(ticker).trim().toUpperCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const normalized = String(ticker).trim().toUpperCase();
  const fullSelect =
    "is_signal_enabled, strategy_parameters, active_strategy_id, lot_size, market_group, pendulo_per_asset, strategy:strategy_registry(id, strategy_code, name, dna_objetivo)";
  const legacySelect =
    "is_signal_enabled, strategy_parameters, active_strategy_id, lot_size, strategy:strategy_registry(id, strategy_code, name)";

  let data = null;
  let { data: fullData, error } = await supabase
    .from("asset_signal_config")
    .select(fullSelect)
    .eq("company_id", companyId)
    .eq("asset_ticker", normalized)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    const msg = String(error.message ?? "");
    if (/market_group|pendulo_per_asset|dna_objetivo|schema cache|PGRST/i.test(msg)) {
      const legacy = await supabase
        .from("asset_signal_config")
        .select(legacySelect)
        .eq("company_id", companyId)
        .eq("asset_ticker", normalized)
        .is("deleted_at", null)
        .maybeSingle();
      if (legacy.error) {
        console.warn("[asset-signal-config]", legacy.error.message ?? legacy.error);
      } else {
        data = legacy.data;
      }
    } else {
      console.warn("[asset-signal-config]", error.message ?? error);
    }
  } else {
    data = fullData;
  }

  /** @type {ResolvedAssetSignalConfig} */
  let value = {
    ...DEFAULT_OMQS,
    marketGroup: inferMarketGroup(normalized),
  };

  if (data) {
    const strat = data.strategy;
    const stratObj =
      strat && typeof strat === "object" && !Array.isArray(strat)
        ? /** @type {{ id?: string, strategy_code?: string, name?: string, dna_objetivo?: string }} */ (
            strat
          )
        : null;
    const code = String(stratObj?.strategy_code ?? "API_OMQS").trim() || "API_OMQS";
    const lotRaw = Number(data.lot_size);
    const groupRaw = String(data.market_group ?? "")
      .trim()
      .toUpperCase();
    const marketGroup =
      groupRaw === "B3" || groupRaw === "CRIPTO" || groupRaw === "FOREX"
        ? groupRaw
        : inferMarketGroup(normalized);
    value = {
      isSignalEnabled: data.is_signal_enabled !== false,
      strategyCode: code,
      strategyId:
        typeof data.active_strategy_id === "string"
          ? data.active_strategy_id
          : typeof stratObj?.id === "string"
            ? stratObj.id
            : null,
      strategyName:
        String(stratObj?.name ?? "").trim() ||
        (code === "API_OMQS" ? "API OM-QS" : code),
      dnaObjetivo: dnaFromStrategyCode(
        code,
        String(stratObj?.dna_objetivo ?? "").trim() || undefined,
      ),
      marketGroup,
      parameters:
        data.strategy_parameters &&
        typeof data.strategy_parameters === "object" &&
        !Array.isArray(data.strategy_parameters)
          ? /** @type {Record<string, unknown>} */ (data.strategy_parameters)
          : {},
      lotSize: Number.isFinite(lotRaw) && lotRaw > 0 ? lotRaw : null,
      penduloPerAsset: data.pendulo_per_asset === true,
    };
  }

  cache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * Bloco origem_sinal — contrato multi-estratégia.
 * @param {ResolvedAssetSignalConfig} cfg
 * @param {Record<string, unknown>} [extraParams]
 */
export function buildOrigemSinal(cfg, extraParams = {}) {
  const parametros = { ...cfg.parameters, ...extraParams };
  const strategyCode =
    String(cfg.strategyCode ?? "API_OMQS").trim() || "API_OMQS";
  const dna_objetivo = dnaFromStrategyCode(
    strategyCode,
    cfg.dnaObjetivo,
  );
  return {
    strategy_id: strategyCode,
    strategy_name:
      String(cfg.strategyName ?? "").trim() ||
      (strategyCode === "API_OMQS" ? "API OM-QS" : strategyCode),
    dna_objetivo,
    parametros,
    /** Compat Spec 039 / Payload v8 */
    provedor: strategyCode,
    estrategia_id: cfg.strategyId ?? strategyCode,
    parametros_aplicados: parametros,
  };
}

/** @param {string} companyId */
export function clearAssetSignalConfigCache(companyId) {
  for (const key of cache.keys()) {
    if (key.startsWith(`${companyId}:`)) cache.delete(key);
  }
}

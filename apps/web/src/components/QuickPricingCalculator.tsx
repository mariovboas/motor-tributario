import {
  anoCenarioSchema,
  productPurposeSchema,
  simulationRequestSchema,
  tributoCodigoSchema,
  ufSchema,
  type AnoCenario,
  type ApuracaoAno,
  type SimulationRequest,
} from "contracts/src/simulation.schema";
import { type FormEvent, useState } from "react";
import { simulateTaxes } from "../api/client";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type AnoBase = Exclude<AnoCenario, "ATUAL">;

const ufTravada = ufSchema.enum.MG;
const finalidadeTravada = productPurposeSchema.enum.CORRETIVO_SOLO;
const anosBase = anoCenarioSchema.options.filter(
  (ano): ano is AnoBase => ano !== "ATUAL",
);
const anoInicial = anosBase[0];
if (anoInicial === undefined) {
  throw new Error("ano-base ausente no contrato");
}

const campoTravado =
  "pointer-events-none h-11 rounded-lg border border-neutral-300 bg-gray-50 px-3 opacity-70 outline-none";

export function QuickPricingCalculator() {
  const [preco, setPreco] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [ano, setAno] = useState<AnoBase>(anoInicial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apuracao, setApuracao] = useState<ApuracaoAno | null>(null);

  const precoBase = numeroComercial(preco);
  const quantidadeToneladas = numeroComercial(quantidade);
  const blocosDe100 = Math.floor(quantidadeToneladas / 100);
  const percentualDesconto = Math.min(blocosDe100 * 1, 10);
  const valorTotalSemDesconto = precoBase * quantidadeToneladas;
  const valorDesconto = valorTotalSemDesconto * (percentualDesconto / 100);
  const valorLiquido = valorTotalSemDesconto - valorDesconto;
  const impostos = apuracao === null ? null : somaTributos(apuracao);
  const precoFinal = impostos === null ? null : valorLiquido + impostos;

  function limparImpostos() {
    setApuracao(null);
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const precoLiquidoUnitario =
        precoBase * (1 - percentualDesconto / 100);
      const request: SimulationRequest = simulationRequestSchema.parse({
        preco: precoLiquidoUnitario,
        quantidade: quantidadeToneladas,
        origem: ufTravada,
        destino: ufTravada,
        finalidade: finalidadeTravada,
      });
      const resposta = await simulateTaxes(request);
      const doAno = resposta.calculo.anos.find((item) => item.ano === ano);
      if (!doAno) {
        throw new Error("regra do ano ausente");
      }
      for (const codigo of tributoCodigoSchema.options) {
        const valor = doAno.tributos[codigo];
        if (!valor || !Number.isFinite(valor.valorTotal)) {
          throw new Error("tributo ausente na resposta");
        }
      }
      setApuracao(doAno);
    } catch (caught) {
      setApuracao(null);
      setError(mensagemErro(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-w-0 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold tracking-tight">
        Cálculo Rápido Comercial
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        O desconto comercial é de 1% a cada 100 t, com teto de 10%. Os impostos
        são os do ano-base, calculados pelo motor sobre o preço já com desconto.
      </p>

      <form className="mt-6 flex flex-col gap-6" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo
            id="comercial-preco"
            label="Preço base (R$)"
            value={preco}
            placeholder="100,00"
            onChange={(valor) => {
              setPreco(valor);
              limparImpostos();
            }}
          />
          <Campo
            id="comercial-quantidade"
            label="Quantidade (toneladas)"
            value={quantidade}
            placeholder="250"
            onChange={(valor) => {
              setQuantidade(valor);
              limparImpostos();
            }}
          />
          <label className="flex flex-col gap-1.5 text-sm" htmlFor="comercial-ano">
            <span className="font-medium text-neutral-700">
              Ano-base do imposto
            </span>
            <select
              id="comercial-ano"
              value={ano}
              onChange={(event) => {
                const parsed = anoCenarioSchema.safeParse(event.target.value);
                if (parsed.success && parsed.data !== "ATUAL") {
                  setAno(parsed.data);
                  limparImpostos();
                }
              }}
              className="h-11 rounded-lg border border-neutral-300 bg-white px-3 outline-none focus:border-neutral-900"
            >
              {anosBase.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </select>
          </label>
          <SelectTravado id="comercial-origem" label="UF origem" valor={ufTravada} />
          <SelectTravado id="comercial-destino" label="UF destino" valor={ufTravada} />
          <SelectTravado
            id="comercial-finalidade"
            label="Finalidade"
            valor={finalidadeTravada}
            rotulo="Corretivo de Solo"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="h-11 rounded-lg bg-neutral-900 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          {loading ? "Calculando…" : "Calcular preço com impostos"}
        </button>
      </form>

      <div className="mt-6 flex min-w-0 flex-col gap-4">
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4">
            <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
              Desconto aplicado
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
              {moeda.format(valorDesconto)}
            </p>
            <p className="mt-1 text-sm text-neutral-600 tabular-nums">
              {percentualDesconto}%
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4">
            <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
              Impostos {ano}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
              {impostos === null ? "—" : moeda.format(impostos)}
            </p>
          </div>
          <div className="rounded-xl bg-neutral-900 px-4 py-4 text-white">
            <p className="text-xs font-medium tracking-wide text-neutral-300 uppercase">
              Preço final
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
              {precoFinal === null ? "—" : moeda.format(precoFinal)}
            </p>
          </div>
        </div>

        {apuracao ? (
          <div className="w-full min-w-0 overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500">
                  <th scope="col" className="py-3 pr-4 font-medium whitespace-nowrap">
                    Tributo
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium whitespace-nowrap">
                    Total
                  </th>
                  <th scope="col" className="px-3 py-3 font-medium whitespace-nowrap">
                    Por tonelada
                  </th>
                </tr>
              </thead>
              <tbody>
                {tributoCodigoSchema.options.map((codigo) => {
                  const valor = apuracao.tributos[codigo];
                  return (
                    <tr key={codigo} className="border-b border-neutral-100">
                      <th scope="row" className="py-3 pr-4 font-medium whitespace-nowrap">
                        {codigo}
                      </th>
                      <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                        {valor ? moeda.format(valor.valorTotal) : "—"}
                      </td>
                      <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                        {valor ? moeda.format(valor.valorUnitario) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Campo({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm" htmlFor={id}>
      <span className="font-medium text-neutral-700">{label}</span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-lg border border-neutral-300 px-3 outline-none focus:border-neutral-900"
      />
    </label>
  );
}

function SelectTravado({
  id,
  label,
  valor,
  rotulo = valor,
}: {
  id: string;
  label: string;
  valor: string;
  rotulo?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm" htmlFor={id}>
      <span className="font-medium text-neutral-700">{label}</span>
      <select id={id} disabled value={valor} className={campoTravado}>
        <option value={valor}>{rotulo}</option>
      </select>
    </label>
  );
}

function numeroComercial(valor: string): number {
  const numero = Number(valor.trim().replace(",", "."));
  if (!Number.isFinite(numero) || numero < 0) return 0;
  return numero;
}

function somaTributos(apuracao: ApuracaoAno): number {
  let soma = 0;
  for (const codigo of tributoCodigoSchema.options) {
    const valor = apuracao.tributos[codigo];
    if (!valor || !Number.isFinite(valor.valorTotal)) {
      throw new Error("tributo ausente na resposta");
    }
    soma += valor.valorTotal;
  }
  return soma;
}

function mensagemErro(caught: unknown): string {
  if (caught instanceof Error && caught.name === "ZodError") {
    return "Preço e quantidade precisam ser maiores que zero. Os dados digitados foram mantidos.";
  }
  if (caught instanceof Error && caught.message === "regra do ano ausente") {
    return "O motor não devolveu a regra desse ano. Os dados digitados foram mantidos.";
  }
  if (caught instanceof Error && caught.message.startsWith("simulação recusada")) {
    return "O motor recusou o cálculo. Os dados digitados foram mantidos.";
  }
  return "Não foi possível consultar o motor. Os dados digitados foram mantidos.";
}

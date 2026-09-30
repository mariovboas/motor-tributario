import {
  anoCenarioSchema,
  productPurposeSchema,
  simulationRequestSchema,
  tributoCodigoSchema,
  ufSchema,
  type AnoCenario,
  type ProductPurpose,
  type SimulationRequest,
  type SimulationResponse,
  type TributoCodigo,
  type ValorTributoCalculado,
} from "contracts/src/simulation.schema";
import { type FormEvent, useState } from "react";
import { simulateTaxes } from "../api/client";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const ROTULO_FINALIDADE: Record<ProductPurpose, string> = {
  CORRETIVO_SOLO: "Corretivo de Solo",
  ALIMENTACAO_ANIMAL: "Alimentação Animal",
  CONSTRUCAO_CIVIL: "Construção Civil",
  USO_INDUSTRIAL: "Uso Industrial",
};

const ROTULO_ANO: Record<AnoCenario, string> = {
  ATUAL: "Cenário Atual",
  "2026": "Transição 2026",
  "2027": "Transição 2027",
};

const finalidadeInicial = productPurposeSchema.options[0];
if (finalidadeInicial === undefined) {
  throw new Error("ProductPurpose vazio");
}

const ufTravada = ufSchema.enum.MG;

const campoTravado =
  "pointer-events-none h-11 rounded-lg border border-neutral-300 bg-gray-50 px-3 opacity-70 outline-none";

export function TaxSimulation() {
  const [preco, setPreco] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [finalidade, setFinalidade] = useState<ProductPurpose>(finalidadeInicial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SimulationResponse | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const request: SimulationRequest = simulationRequestSchema.parse({
        preco: numeroDigitado(preco),
        quantidade: numeroDigitado(quantidade),
        origem: ufTravada,
        destino: ufTravada,
        finalidade,
      });
      const resposta = await simulateTaxes(request);
      setData(resposta);
    } catch (caught) {
      setData(null);
      setError(mensagemErro(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold tracking-tight">
          Configuração da Simulação
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Compara o cenário atual com as regras de 2026 e 2027.
        </p>
        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          <Campo
            id="simulacao-preco"
            label="Preço unitário (R$)"
            value={preco}
            onChange={setPreco}
            placeholder="120,00"
          />
          <Campo
            id="simulacao-quantidade"
            label="Quantidade (toneladas)"
            value={quantidade}
            onChange={setQuantidade}
            placeholder="10"
          />
          <label className="flex flex-col gap-1.5 text-sm" htmlFor="simulacao-finalidade">
            <span className="font-medium text-neutral-700">Finalidade</span>
            <select
              id="simulacao-finalidade"
              className="h-11 rounded-lg border border-neutral-300 bg-white px-3 outline-none focus:border-neutral-900"
              value={finalidade}
              onChange={(event) => {
                const parsed = productPurposeSchema.safeParse(event.target.value);
                if (parsed.success) setFinalidade(parsed.data);
              }}
            >
              {productPurposeSchema.options.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {ROTULO_FINALIDADE[opcao]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <SelectTravado id="simulacao-origem" label="UF origem" />
            <SelectTravado id="simulacao-destino" label="UF destino" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-11 rounded-lg bg-neutral-900 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
          >
            {loading ? "Simulando…" : "Simular Impacto Tributário"}
          </button>
        </form>
      </section>

      <section
        className="min-w-0 w-full rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
        aria-busy={loading}
      >
        <h2 className="text-base font-semibold tracking-tight">Resultado</h2>
        <div className="mt-6 flex min-w-0 flex-col gap-4">
          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </div>
          ) : null}
          {loading ? <p className="text-sm text-neutral-500">Consultando o motor…</p> : null}
          {data ? <Resultado resposta={data} /> : null}
          {!data && !error && !loading ? (
            <p className="text-sm text-neutral-500">
              O comparativo dos tributos aparece aqui depois da simulação.
            </p>
          ) : null}
        </div>
      </section>
    </div>
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

function SelectTravado({ id, label }: { id: string; label: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm" htmlFor={id}>
      <span className="font-medium text-neutral-700">{label}</span>
      <select id={id} disabled value={ufTravada} className={campoTravado}>
        <option value={ufTravada}>{ufTravada}</option>
      </select>
    </label>
  );
}

function Resultado({ resposta }: { resposta: SimulationResponse }) {
  const anos = ordemAnos();

  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-neutral-500">
            <th scope="col" className="py-3 pr-4 font-medium whitespace-nowrap">
              Tributo
            </th>
            {anos.map((ano) => (
              <th key={ano} scope="col" className="px-3 py-3 font-medium whitespace-nowrap">
                {ROTULO_ANO[ano]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tributoCodigoSchema.options.map((tributo) => (
            <tr key={tributo} className="border-b border-neutral-100">
              <th scope="row" className="py-4 pr-4 font-medium whitespace-nowrap">
                {tributo}
              </th>
              {anos.map((ano) => (
                <td key={ano} className="px-3 py-4 align-top whitespace-nowrap">
                  <ValorCelula valor={valorDo(resposta, ano, tributo)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValorCelula({ valor }: { valor: ValorTributoCalculado | undefined }) {
  if (!valor) {
    return <span className="text-neutral-400">—</span>;
  }

  return (
    <div className="flex flex-col gap-1 tabular-nums">
      <span className="font-medium">{moeda.format(valor.valorTotal)}</span>
      <span className="text-xs text-neutral-500">
        {moeda.format(valor.valorUnitario)} / t
      </span>
    </div>
  );
}

function valorDo(
  resposta: SimulationResponse,
  ano: AnoCenario,
  tributo: TributoCodigo,
): ValorTributoCalculado | undefined {
  return resposta.calculo.anos.find((item) => item.ano === ano)?.tributos[tributo];
}

function ordemAnos(): AnoCenario[] {
  return anoCenarioSchema.options.slice().sort((a, b) => chaveAno(a) - chaveAno(b));
}

function chaveAno(ano: AnoCenario): number {
  if (ano === "ATUAL") return 0;
  const numero = Number(ano);
  if (!Number.isFinite(numero)) return Number.MAX_SAFE_INTEGER;
  return numero;
}

function numeroDigitado(valor: string): number {
  const numero = Number(valor.trim().replace(",", "."));
  if (!Number.isFinite(numero)) return numero;
  return numero;
}

function mensagemErro(caught: unknown): string {
  if (caught instanceof Error && caught.name === "ZodError") {
    return "Os dados informados não fecham com o contrato da simulação. Preço e quantidade precisam ser maiores que zero.";
  }
  if (caught instanceof Error && caught.message.startsWith("simulação recusada")) {
    return "O motor recusou a simulação. Os dados digitados foram mantidos.";
  }
  return "Não foi possível consultar o motor. Os dados digitados foram mantidos.";
}

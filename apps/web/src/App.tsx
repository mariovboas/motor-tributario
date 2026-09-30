import { useState } from "react";
import { QuickPricingCalculator } from "./components/QuickPricingCalculator";
import { TaxSimulation } from "./components/TaxSimulation";

const TELAS = [
  { id: "comercial", rotulo: "Cálculo rápido" },
  { id: "simulacao", rotulo: "Simulação" },
] as const;

type Tela = (typeof TELAS)[number]["id"];

export function App() {
  const [tela, setTela] = useState<Tela>("comercial");

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-[0.16em] text-neutral-500 uppercase">
              LPreco
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Motor de Enquadramento Tributário
            </h1>
          </div>
          <div className="flex w-full gap-2 rounded-xl bg-neutral-200/70 p-1 sm:w-fit" role="tablist">
            {TELAS.map((item) => {
              const ativa = tela === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={ativa}
                  onClick={() => setTela(item.id)}
                  className={
                    ativa
                      ? "h-10 flex-1 rounded-lg bg-white px-4 text-sm font-medium text-neutral-900 shadow-sm sm:flex-none"
                      : "h-10 flex-1 rounded-lg px-4 text-sm font-medium text-neutral-600 sm:flex-none"
                  }
                >
                  {item.rotulo}
                </button>
              );
            })}
          </div>
        </header>

        {tela === "comercial" ? <QuickPricingCalculator /> : <TaxSimulation />}
      </main>
    </div>
  );
}

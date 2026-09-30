import {
  simulationResponseSchema,
  type SimulationRequest,
  type SimulationResponse,
} from "contracts/src/simulation.schema";

export async function simulateTaxes(
  request: SimulationRequest,
): Promise<SimulationResponse> {
  const baseUrl = import.meta.env.VITE_API_URL;
  if (typeof baseUrl !== "string" || baseUrl.trim() === "") {
    throw new Error("VITE_API_URL ausente");
  }

  try {
    const response = await fetch(`${baseUrl}/simulate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`simulação recusada: HTTP ${response.status}`);
    }

    return simulationResponseSchema.parse(await response.json());
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("falha de rede ao simular");
  }
}

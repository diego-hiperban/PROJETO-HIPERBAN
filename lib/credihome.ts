export type CredihomeSimulationPayload = {
  channel?: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    document: string;
  };
  property: {
    value: number;
    state: string;
    city: string;
    type: 'residential' | 'commercial';
  };
  financing: {
    goal: 'purchase' | 'refinancing';
    entryValue: number;
    creditValue: number;
    monthlyIncome: number;
    term?: number;
  };
};

export type CredihomeSimulationResponse = {
  id: string;
  status: string;
  createdAt?: string;
  [key: string]: unknown;
};

export class CredihomeError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'CredihomeError';
  }
}

export async function submitCredihomeSimulation(payload: CredihomeSimulationPayload) {
  const response = await fetch('/api/credihome/simulations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorDetails: unknown;
    try {
      errorDetails = await response.json();
    } catch (error) {
      errorDetails = await response.text();
    }
    throw new CredihomeError('Erro ao enviar simulação para a Credihome.', errorDetails);
  }

  return (await response.json()) as CredihomeSimulationResponse;
}

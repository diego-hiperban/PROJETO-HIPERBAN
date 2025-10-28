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
  proposals?: unknown;
  [key: string]: unknown;
};

export type CredihomeProposalTimelineEntry = {
  id: string;
  label: string;
  date?: string;
  description?: string;
};

export type CredihomeProposalSummary = {
  id: string;
  institution: string;
  status: string;
  stage?: string;
  updatedAt?: string;
  offerValue?: number | string;
  rate?: number | string;
  timeline: CredihomeProposalTimelineEntry[];
  raw: unknown;
};

export type CredihomeProposalsResponse = {
  proposals: CredihomeProposalSummary[];
  meta?: Record<string, unknown>;
  raw: unknown;
};

export class CredihomeError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'CredihomeError';
  }
}

function coerceString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function normalizeTimelineEntries(source: unknown): CredihomeProposalTimelineEntry[] {
  if (!Array.isArray(source)) return [];
  return source
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const value = entry as Record<string, unknown>;
      const idCandidate =
        value.id ??
        value.eventId ??
        value.code ??
        value.identifier ??
        index;

      const labelCandidate =
        value.status && typeof value.status === 'object'
          ? (value.status as Record<string, unknown>).name ?? (value.status as Record<string, unknown>).description
          : undefined;

      const label =
        coerceString(labelCandidate) ??
        coerceString(value.label) ??
        coerceString(value.description) ??
        coerceString(value.event) ??
        coerceString(value.stage) ??
        coerceString(value.message) ??
        'Atualização';

      const date =
        coerceString(value.date) ??
        coerceString(value.createdAt) ??
        coerceString(value.updatedAt) ??
        coerceString(value.timestamp) ??
        coerceString(value.occurredAt) ??
        coerceString(value.occurred_at) ??
        coerceString(value.eventDate) ??
        coerceString(value.data);

      const description =
        coerceString(value.notes) ??
        coerceString(value.detail) ??
        coerceString(value.details) ??
        coerceString(value.comment) ??
        coerceString(value.observation) ??
        coerceString(value.observacao) ??
        coerceString(value.info);

      return {
        id: coerceString(idCandidate) ?? `${index}`,
        label,
        date: date ?? undefined,
        description: description ?? undefined,
      } satisfies CredihomeProposalTimelineEntry;
    })
    .filter((entry): entry is CredihomeProposalTimelineEntry => Boolean(entry));
}

function collectProposalCandidates(payload: unknown): Record<string, unknown>[] {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
  }

  if (typeof payload !== 'object') return [];
  const source = payload as Record<string, unknown>;
  const candidateKeys = [
    'proposals',
    'data',
    'items',
    'banks',
    'institutions',
    'results',
    'offers',
    'content',
    'lista',
  ];

  for (const key of candidateKeys) {
    if (Array.isArray(source[key])) {
      return (source[key] as unknown[]).filter(
        (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object',
      );
    }
  }

  return [source];
}

export function normalizeCredihomeProposals(payload: unknown): CredihomeProposalSummary[] {
  const candidates = collectProposalCandidates(payload);

  return candidates.map((candidate, index) => {
    const institutionCandidate =
      candidate.institution && typeof candidate.institution === 'object'
        ? (candidate.institution as Record<string, unknown>).name ??
          (candidate.institution as Record<string, unknown>).description
        : undefined;

    const statusCandidate =
      candidate.status && typeof candidate.status === 'object'
        ? (candidate.status as Record<string, unknown>).name ??
          (candidate.status as Record<string, unknown>).description
        : undefined;

    const stageCandidate =
      candidate.stage && typeof candidate.stage === 'object'
        ? (candidate.stage as Record<string, unknown>).name ??
          (candidate.stage as Record<string, unknown>).description
        : undefined;

    const institution =
      coerceString(institutionCandidate) ??
      coerceString(candidate.institutionName) ??
      (candidate.bank && typeof candidate.bank === 'object'
        ? coerceString((candidate.bank as Record<string, unknown>).name) ??
          coerceString((candidate.bank as Record<string, unknown>).description)
        : coerceString(candidate.bank)) ??
      coerceString(candidate.bankName) ??
      coerceString(candidate.partner) ??
      coerceString(candidate.partnerName) ??
      coerceString(candidate.financialInstitution) ??
      coerceString(candidate.correspondent) ??
      'Instituição';

    const status =
      coerceString(statusCandidate) ??
      coerceString(candidate.status) ??
      coerceString(candidate.statusDescription) ??
      coerceString(candidate.currentStatus) ??
      (candidate.stage && typeof candidate.stage === 'object'
        ? coerceString((candidate.stage as Record<string, unknown>).name)
        : undefined) ??
      coerceString(candidate.stage) ??
      coerceString(candidate.situation) ??
      coerceString(candidate.situacao) ??
      coerceString(candidate.state) ??
      coerceString(candidate.phase) ??
      'Em análise';

    const stage =
      coerceString(stageCandidate) ??
      coerceString(candidate.stage) ??
      coerceString(candidate.etapa) ??
      coerceString(candidate.step) ??
      coerceString(candidate.fase) ??
      undefined;

    const updatedAt =
      coerceString(candidate.updatedAt) ??
      coerceString(candidate.lastUpdate) ??
      coerceString(candidate.lastStatusAt) ??
      coerceString(candidate.statusDate) ??
      coerceString(candidate.dataAtualizacao) ??
      coerceString(candidate.updated_at) ??
      coerceString(candidate.modifiedAt) ??
      coerceString(candidate.ultimaAtualizacao) ??
      undefined;

    const offerValue =
      candidate.offer && typeof candidate.offer === 'object'
        ? (candidate.offer as Record<string, unknown>).value ??
          (candidate.offer as Record<string, unknown>).amount
        : undefined;

    const offerCandidate =
      offerValue ??
      candidate.value ??
      candidate.amount ??
      candidate.creditValue ??
      candidate.loanValue ??
      candidate.loanAmount ??
      candidate.financingAmount ??
      candidate.valor ??
      candidate.valorCredito ??
      candidate.totalValue ??
      undefined;

    const rateCandidate =
      candidate.offer && typeof candidate.offer === 'object'
        ? (candidate.offer as Record<string, unknown>).rate
        : undefined;

    const rate =
      rateCandidate ??
      candidate.rate ??
      candidate.interestRate ??
      candidate.tax ??
      candidate.taxa ??
      candidate.taxaJuros ??
      candidate.juros ??
      undefined;

    const timelineSource =
      (candidate.history as unknown) ??
      (candidate.statusHistory as unknown) ??
      (candidate.timeline as unknown) ??
      (candidate.events as unknown) ??
      (candidate.tracking as unknown);

    const timeline = normalizeTimelineEntries(timelineSource);

    const idCandidate =
      candidate.id ??
      candidate.protocol ??
      candidate.proposalId ??
      candidate.uuid ??
      candidate.identifier ??
      candidate.code ??
      candidate.codigo ??
      (candidate.bank && typeof candidate.bank === 'object'
        ? (candidate.bank as Record<string, unknown>).id
        : undefined);

    const id = coerceString(idCandidate) ?? `proposal-${index}`;

    return {
      id,
      institution,
      status,
      stage,
      updatedAt,
      offerValue: offerCandidate,
      rate,
      timeline,
      raw: candidate,
    } satisfies CredihomeProposalSummary;
  });
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

export async function fetchCredihomeProposals(params: {
  document?: string;
  protocol?: string;
  email?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params.document) searchParams.set('document', params.document);
  if (params.protocol) searchParams.set('protocol', params.protocol);
  if (params.email) searchParams.set('email', params.email);

  const response = await fetch(`/api/credihome/proposals?${searchParams.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    let errorDetails: unknown;
    try {
      errorDetails = await response.json();
    } catch (error) {
      errorDetails = await response.text();
    }
    throw new CredihomeError('Erro ao consultar propostas na Credihome.', errorDetails);
  }

  return (await response.json()) as CredihomeProposalsResponse;
}

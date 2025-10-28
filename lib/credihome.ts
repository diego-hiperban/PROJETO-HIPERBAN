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

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

function normalizeTimelineEntries(source: unknown): CredihomeProposalTimelineEntry[] {
  if (!Array.isArray(source)) return [];

  const timeline: CredihomeProposalTimelineEntry[] = [];

  source.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      return;
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

    timeline.push({
      id: coerceString(idCandidate) ?? `${index}`,
      label,
      date: date ?? undefined,
      description: description ?? undefined,
    });
  });

  return timeline;
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

    const rawOfferCandidate =
      (candidate.offer && typeof candidate.offer === 'object'
        ? (candidate.offer as Record<string, unknown>).value ??
          (candidate.offer as Record<string, unknown>).amount
        : undefined) ??
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

    const offerValue =
      coerceNumber(rawOfferCandidate) ?? coerceString(rawOfferCandidate);

    const rawRateCandidate =
      (candidate.offer && typeof candidate.offer === 'object'
        ? (candidate.offer as Record<string, unknown>).rate
        : undefined) ??
      candidate.rate ??
      candidate.interestRate ??
      candidate.tax ??
      candidate.taxa ??
      candidate.taxaJuros ??
      candidate.juros ??
      undefined;

    const rate = coerceNumber(rawRateCandidate) ?? coerceString(rawRateCandidate);

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
      offerValue,
      rate,
      timeline,
      raw: candidate,
    } satisfies CredihomeProposalSummary;
  });
}

type CachedCredihomeToken = {
  token: string;
  expiresAt: number;
};

let cachedCredihomeToken: CachedCredihomeToken | null = null;

export function getCredihomeBaseUrl() {
  return (process.env.CREDIHOME_API_BASE_URL ?? 'https://api.credihome.com.br').replace(/\/$/, '');
}

function getRequiredCredihomeApiKey() {
  const apiKey = process.env.CREDIHOME_API_KEY?.trim();
  if (!apiKey) {
    throw new CredihomeError(
      'Variável CREDIHOME_API_KEY não configurada. Cadastre as credenciais da Credihome na aba Segurança ou defina a variável de ambiente antes de usar a integração.',
    );
  }

  return apiKey;
}

function getCredihomeTokenHeaders() {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const basicAuth = process.env.CREDIHOME_BASIC_AUTH;
  if (basicAuth) {
    headers.Authorization = `Basic ${basicAuth}`;
  } else if (process.env.CREDIHOME_CLIENT_ID && process.env.CREDIHOME_CLIENT_SECRET) {
    const encoded = Buffer.from(
      `${process.env.CREDIHOME_CLIENT_ID}:${process.env.CREDIHOME_CLIENT_SECRET}`,
      'utf-8',
    ).toString('base64');
    headers.Authorization = `Basic ${encoded}`;
  }

  const apiKey = getRequiredCredihomeApiKey();
  const authHeader = process.env.CREDIHOME_AUTH_HEADER ?? 'Authorization';
  const authScheme = process.env.CREDIHOME_AUTH_SCHEME ?? 'Bearer';

  if (!headers[authHeader]) {
    headers[authHeader] = authScheme ? `${authScheme} ${apiKey}`.trim() : apiKey;
  }

  const fallbackHeader = process.env.CREDIHOME_FALLBACK_HEADER ?? 'x-api-key';
  if (!headers[fallbackHeader]) {
    headers[fallbackHeader] = apiKey;
  }

  return headers;
}

async function requestCredihomeToken() {
  const username = process.env.CREDIHOME_API_USERNAME;
  const password = process.env.CREDIHOME_API_PASSWORD;
  const grantType = process.env.CREDIHOME_AUTH_GRANT_TYPE ?? 'password';
  const authPath = process.env.CREDIHOME_AUTH_PATH ?? '/oauth/token';

  if (!username || !password) {
    throw new CredihomeError(
      'Variáveis CREDIHOME_API_USERNAME e CREDIHOME_API_PASSWORD não configuradas. Configure as credenciais da Credihome.',
    );
  }

  const body = new URLSearchParams();
  body.set('grant_type', grantType);

  if (grantType === 'password') {
    body.set('username', username);
    body.set('password', password);
  }

  if (process.env.CREDIHOME_CLIENT_ID) {
    body.set('client_id', process.env.CREDIHOME_CLIENT_ID);
  }
  if (process.env.CREDIHOME_CLIENT_SECRET) {
    body.set('client_secret', process.env.CREDIHOME_CLIENT_SECRET);
  }

  const extraParams = process.env.CREDIHOME_AUTH_EXTRA_PARAMS;
  if (extraParams) {
    try {
      const parsed = JSON.parse(extraParams) as Record<string, string>;
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== undefined && value !== null) {
          body.set(key, String(value));
        }
      }
    } catch (error) {
      throw new CredihomeError('CREDIHOME_AUTH_EXTRA_PARAMS não é um JSON válido.');
    }
  }

  const response = await fetch(`${getCredihomeBaseUrl()}${authPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...getCredihomeTokenHeaders(),
    },
    body: body.toString(),
  });

  const responseText = await response.text();
  let parsedResponse: unknown = null;

  try {
    parsedResponse = responseText ? JSON.parse(responseText) : null;
  } catch (error) {
    parsedResponse = responseText;
  }

  if (!response.ok) {
    throw new CredihomeError(
      `Falha ao gerar token na Credihome. Status ${response.status}. Detalhes: ${JSON.stringify(parsedResponse)}`,
      parsedResponse,
    );
  }

  const token =
    (parsedResponse as Record<string, unknown> | null)?.access_token ??
    (parsedResponse as Record<string, unknown> | null)?.token ??
    (parsedResponse as Record<string, unknown> | null)?.id_token;
  const expiresIn = Number(
    (parsedResponse as Record<string, unknown> | null)?.expires_in ??
      (parsedResponse as Record<string, unknown> | null)?.expires ??
      1800,
  );

  if (!token || typeof token !== 'string') {
    throw new CredihomeError('Resposta da Credihome não contém token válido.');
  }

  cachedCredihomeToken = {
    token,
    expiresAt: Date.now() + (Number.isFinite(expiresIn) ? expiresIn * 1000 : 15 * 60 * 1000),
  };

  return token;
}

export async function getCredihomeToken() {
  if (cachedCredihomeToken && cachedCredihomeToken.expiresAt - Date.now() > 60_000) {
    return cachedCredihomeToken.token;
  }

  return requestCredihomeToken();
}

export async function fetchCredihome<T = unknown>(path: string, init?: RequestInit) {
  const token = await getCredihomeToken();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init?.headers as Record<string, string>),
  };

  if (!headers['Content-Type'] && init?.body) {
    headers['Content-Type'] = 'application/json';
  }

  headers.Authorization = `Bearer ${token}`;

  const apiKey = getRequiredCredihomeApiKey();
  const fallbackHeader = process.env.CREDIHOME_FALLBACK_HEADER ?? 'x-api-key';
  if (!headers[fallbackHeader]) {
    headers[fallbackHeader] = apiKey;
  }

  const customAuthHeader = process.env.CREDIHOME_AUTH_HEADER;
  const authScheme = process.env.CREDIHOME_AUTH_SCHEME ?? 'Bearer';
  if (
    customAuthHeader &&
    customAuthHeader !== 'Authorization' &&
    !headers[customAuthHeader]
  ) {
    headers[customAuthHeader] = authScheme ? `${authScheme} ${apiKey}`.trim() : apiKey;
  }

  const response = await fetch(`${getCredihomeBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  let parsed: unknown = null;

  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (error) {
    parsed = text;
  }

  if (!response.ok) {
    throw new CredihomeError(
      `Erro ao consultar dados na Credihome. Status ${response.status}.`,
      parsed,
    );
  }

  return parsed as T;
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

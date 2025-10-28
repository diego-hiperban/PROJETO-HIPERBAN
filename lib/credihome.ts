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

export const CREDIHOME_API_KEY_HEADER = 'x-credihome-api-key';
export const CREDIHOME_USERNAME_HEADER = 'x-credihome-username';
export const CREDIHOME_PASSWORD_HEADER = 'x-credihome-password';
export const CREDIHOME_PARTNER_CODE_HEADER = 'x-credihome-partner-code';
export const CREDIHOME_BASE_URL_HEADER = 'x-credihome-base-url';

export type CredihomeCredentialInput = {
  apiKey?: string | null;
  username?: string | null;
  password?: string | null;
  partnerCode?: string | null;
  baseUrl?: string | null;
};

type CredihomeResolvedCredentials = {
  apiKey: string;
  username: string;
  password: string;
  partnerCode?: string;
  baseUrl: string;
};

export function readCredihomeCredentialHeaders(headers?: Headers | null): CredihomeCredentialInput {
  if (!headers) {
    return {};
  }

  return {
    apiKey: headers.get(CREDIHOME_API_KEY_HEADER),
    username: headers.get(CREDIHOME_USERNAME_HEADER),
    password: headers.get(CREDIHOME_PASSWORD_HEADER),
    partnerCode: headers.get(CREDIHOME_PARTNER_CODE_HEADER),
    baseUrl: headers.get(CREDIHOME_BASE_URL_HEADER),
  };
}

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

const credihomeTokenCache = new Map<string, CachedCredihomeToken>();

function normalizeCredentialValue(value?: string | null) {
  return value?.trim() ? value.trim() : undefined;
}

function normalizeBaseUrl(value?: string | null) {
  const normalized = normalizeCredentialValue(value);
  return normalized ? normalized.replace(/\/$/, '') : undefined;
}

export function getCredihomeBaseUrl(context?: { baseUrl?: string | null }) {
  return (
    normalizeBaseUrl(context?.baseUrl) ??
    normalizeBaseUrl(process.env.CREDIHOME_API_BASE_URL) ??
    'https://api-partner.credihome.com.br'
  );
}

function resolveCredihomeCredentials(input?: CredihomeCredentialInput): CredihomeResolvedCredentials {
  const apiKey = normalizeCredentialValue(input?.apiKey) ?? normalizeCredentialValue(process.env.CREDIHOME_API_KEY);
  if (!apiKey) {
    throw new CredihomeError(
      'Cadastre a chave de API da Credihome na aba Segurança ou defina a variável de ambiente CREDIHOME_API_KEY antes de usar a integração.',
    );
  }

  const username =
    normalizeCredentialValue(input?.username) ?? normalizeCredentialValue(process.env.CREDIHOME_API_USERNAME);
  const password = normalizeCredentialValue(input?.password) ?? normalizeCredentialValue(process.env.CREDIHOME_API_PASSWORD);

  if (!username || !password) {
    throw new CredihomeError(
      'Informe usuário e senha da Credihome na aba Segurança ou defina CREDIHOME_API_USERNAME e CREDIHOME_API_PASSWORD.',
    );
  }

  const partnerCode =
    normalizeCredentialValue(input?.partnerCode) ?? normalizeCredentialValue(process.env.CREDIHOME_PARTNER_CODE);

  const baseUrl = getCredihomeBaseUrl({ baseUrl: input?.baseUrl });

  return { apiKey, username, password, partnerCode, baseUrl } satisfies CredihomeResolvedCredentials;
}

function getCredihomeTokenHeaders(credentials: CredihomeResolvedCredentials) {
  const headers = new Headers({ Accept: 'application/json' });

  const basicAuth = process.env.CREDIHOME_BASIC_AUTH;
  if (basicAuth) {
    headers.set('Authorization', `Basic ${basicAuth}`);
  } else if (process.env.CREDIHOME_CLIENT_ID && process.env.CREDIHOME_CLIENT_SECRET) {
    const encoded = Buffer.from(
      `${process.env.CREDIHOME_CLIENT_ID}:${process.env.CREDIHOME_CLIENT_SECRET}`,
      'utf-8',
    ).toString('base64');
    headers.set('Authorization', `Basic ${encoded}`);
  }

  const authHeader = process.env.CREDIHOME_AUTH_HEADER ?? 'Authorization';
  const authScheme = process.env.CREDIHOME_AUTH_SCHEME ?? 'Bearer';

  if (!headers.has(authHeader)) {
    headers.set(authHeader, authScheme ? `${authScheme} ${credentials.apiKey}`.trim() : credentials.apiKey);
  }

  const fallbackHeader = process.env.CREDIHOME_FALLBACK_HEADER ?? 'x-api-key';
  if (!headers.has(fallbackHeader)) {
    headers.set(fallbackHeader, credentials.apiKey);
  }

  return headers;
}

function getTokenCacheKey(credentials: CredihomeResolvedCredentials) {
  return JSON.stringify({
    username: credentials.username,
    password: credentials.password,
    clientId: normalizeCredentialValue(process.env.CREDIHOME_CLIENT_ID) ?? '',
    clientSecret: normalizeCredentialValue(process.env.CREDIHOME_CLIENT_SECRET) ?? '',
    grantType: normalizeCredentialValue(process.env.CREDIHOME_AUTH_GRANT_TYPE) ?? 'password',
    authPath: normalizeCredentialValue(process.env.CREDIHOME_AUTH_PATH) ?? '/oauth/token',
    baseUrl: credentials.baseUrl,
    extra: normalizeCredentialValue(process.env.CREDIHOME_AUTH_EXTRA_PARAMS) ?? '',
  });
}

async function requestCredihomeToken(credentials: CredihomeResolvedCredentials) {
  const grantType = process.env.CREDIHOME_AUTH_GRANT_TYPE ?? 'password';
  const authPath = process.env.CREDIHOME_AUTH_PATH ?? '/oauth/token';

  const body = new URLSearchParams();
  body.set('grant_type', grantType);

  if (grantType === 'password') {
    body.set('username', credentials.username);
    body.set('password', credentials.password);
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

  const tokenHeaders = getCredihomeTokenHeaders(credentials);
  tokenHeaders.set('Content-Type', 'application/x-www-form-urlencoded');

  const response = await fetch(`${credentials.baseUrl}${authPath}`, {
    method: 'POST',
    headers: Object.fromEntries(tokenHeaders.entries()),
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

  const cacheKey = getTokenCacheKey(credentials);
  credihomeTokenCache.set(cacheKey, {
    token,
    expiresAt: Date.now() + (Number.isFinite(expiresIn) ? expiresIn * 1000 : 15 * 60 * 1000),
  });

  return token;
}

async function getCredihomeToken(credentials: CredihomeResolvedCredentials) {
  const cacheKey = getTokenCacheKey(credentials);
  const cached = credihomeTokenCache.get(cacheKey);
  if (cached && cached.expiresAt - Date.now() > 60_000) {
    return cached.token;
  }

  return requestCredihomeToken(credentials);
}

type CredihomeFetchOptions = {
  credentials?: CredihomeCredentialInput;
};

export async function fetchCredihome<T = unknown>(path: string, init?: RequestInit, options?: CredihomeFetchOptions) {
  const resolvedCredentials = resolveCredihomeCredentials(options?.credentials);
  const token = await getCredihomeToken(resolvedCredentials);

  const headers = new Headers(init?.headers ?? {});
  headers.set('Accept', 'application/json');

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  headers.set('Authorization', `Bearer ${token}`);

  const fallbackHeader = process.env.CREDIHOME_FALLBACK_HEADER ?? 'x-api-key';
  if (!headers.has(fallbackHeader)) {
    headers.set(fallbackHeader, resolvedCredentials.apiKey);
  }

  const customAuthHeader = process.env.CREDIHOME_AUTH_HEADER;
  const authScheme = process.env.CREDIHOME_AUTH_SCHEME ?? 'Bearer';
  if (customAuthHeader && customAuthHeader !== 'Authorization' && !headers.has(customAuthHeader)) {
    headers.set(customAuthHeader, authScheme ? `${authScheme} ${resolvedCredentials.apiKey}`.trim() : resolvedCredentials.apiKey);
  }

  const response = await fetch(`${resolvedCredentials.baseUrl}${path}`, {
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

function buildClientCredentialHeaders(credentials?: CredihomeCredentialInput) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const apiKey = normalizeCredentialValue(credentials?.apiKey);
  const username = normalizeCredentialValue(credentials?.username);
  const password = normalizeCredentialValue(credentials?.password);
  const partnerCode = normalizeCredentialValue(credentials?.partnerCode);
  const baseUrl = normalizeBaseUrl(credentials?.baseUrl);

  if (apiKey) headers[CREDIHOME_API_KEY_HEADER] = apiKey;
  if (username) headers[CREDIHOME_USERNAME_HEADER] = username;
  if (password) headers[CREDIHOME_PASSWORD_HEADER] = password;
  if (partnerCode) headers[CREDIHOME_PARTNER_CODE_HEADER] = partnerCode;
  if (baseUrl) headers[CREDIHOME_BASE_URL_HEADER] = baseUrl;

  return headers;
}

export async function submitCredihomeSimulation(
  payload: CredihomeSimulationPayload,
  options?: CredihomeFetchOptions,
) {
  const response = await fetch('/api/credihome/simulations', {
    method: 'POST',
    headers: buildClientCredentialHeaders(options?.credentials),
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

export async function fetchCredihomeProposals(
  params: {
    document?: string;
    protocol?: string;
    email?: string;
  },
  options?: CredihomeFetchOptions,
) {
  const searchParams = new URLSearchParams();
  if (params.document) searchParams.set('document', params.document);
  if (params.protocol) searchParams.set('protocol', params.protocol);
  if (params.email) searchParams.set('email', params.email);

  const response = await fetch(`/api/credihome/proposals?${searchParams.toString()}`, {
    method: 'GET',
    headers: buildClientCredentialHeaders(options?.credentials),
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

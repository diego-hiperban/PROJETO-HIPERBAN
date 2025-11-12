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

export const CREDIHOME_USERNAME_HEADER = 'x-credihome-username';
export const CREDIHOME_PASSWORD_HEADER = 'x-credihome-password';
export const CREDIHOME_PARTNER_CODE_HEADER = 'x-credihome-partner-code';
export const CREDIHOME_BASE_URL_HEADER = 'x-credihome-base-url';
export const CREDIHOME_PROPOSALS_PATH_HEADER = 'x-credihome-proposals-path';
export const CREDIHOME_SIMULATIONS_PATH_HEADER = 'x-credihome-simulations-path';
export const CREDIHOME_API_KEY_HEADER = 'x-credihome-api-key';

export type CredihomeCredentialInput = {
  apiKey?: string | null;
  username?: string | null;
  password?: string | null;
  partnerCode?: string | null;
  baseUrl?: string | null;
  proposalsPath?: string | null;
  simulationsPath?: string | null;
};

export class CredihomeError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'CredihomeError';
  }
}

type CredihomeResolvedCredentials = {
  apiKey?: string;
  username: string;
  password: string;
  partnerCode?: string;
  baseUrl: string;
  proposalsPath: string;
  simulationsPath: string;
  authPath: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
};

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

function normalizePath(value?: string | null) {
  const normalized = normalizeCredentialValue(value);
  if (!normalized) return undefined;
  if (/^https?:\/\//i.test(normalized)) {
    return normalized.replace(/\/$/, '');
  }
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function encodeToBase64(value: string) {
  if (typeof globalThis.btoa === 'function') {
    try {
      return globalThis.btoa(value);
    } catch (error) {
      // ignore and fall back to Buffer when available
    }
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf-8').toString('base64');
  }

  return '';
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
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
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
        ? (value.status as Record<string, unknown>).name ??
          (value.status as Record<string, unknown>).description
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

    const offerValue = coerceNumber(rawOfferCandidate) ?? coerceString(rawOfferCandidate);

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
    proposalsPath: headers.get(CREDIHOME_PROPOSALS_PATH_HEADER),
    simulationsPath: headers.get(CREDIHOME_SIMULATIONS_PATH_HEADER),
  };
}

function getCredihomeBaseUrl(context?: { baseUrl?: string | null }) {
  return (
    normalizeBaseUrl(context?.baseUrl) ??
    normalizeBaseUrl(process.env.CREDIHOME_BASE_URL) ??
    normalizeBaseUrl(process.env.CREDIHOME_API_BASE_URL) ??
    'https://api-partner.credihome.com.br/v1/production'
  );
}

function getCredihomeAuthPath() {
  return (
    normalizePath(process.env.CREDIHOME_AUTH_PATH) ??
    normalizePath(process.env.CREDIHOME_LOGIN_PATH) ??
    '/login'
  );
}

export function getCredihomeSimulationsPath(context?: { simulationsPath?: string | null }) {
  return normalizePath(context?.simulationsPath) ?? normalizePath(process.env.CREDIHOME_SIMULATIONS_PATH) ?? '/simulador';
}

export function getCredihomeProposalsPath(context?: { proposalsPath?: string | null }) {
  return normalizePath(context?.proposalsPath) ?? normalizePath(process.env.CREDIHOME_PROPOSALS_PATH) ?? '/proposta';
}

function resolveCredihomeCredentials(input?: CredihomeCredentialInput): CredihomeResolvedCredentials {
  const username =
    normalizeCredentialValue(input?.username) ??
    normalizeCredentialValue(process.env.CREDIHOME_API_USERNAME) ??
    normalizeCredentialValue(process.env.CREDIHOME_LOGIN);
  const password =
    normalizeCredentialValue(input?.password) ??
    normalizeCredentialValue(process.env.CREDIHOME_API_PASSWORD) ??
    normalizeCredentialValue(process.env.CREDIHOME_PASSWORD);

  if (!username || !password) {
    throw new CredihomeError(
      'Informe usuário e senha da Credihome na aba Segurança ou defina CREDIHOME_LOGIN e CREDIHOME_PASSWORD (ou as variáveis legadas CREDIHOME_API_USERNAME e CREDIHOME_API_PASSWORD).',
    );
  }

  const apiKey =
    normalizeCredentialValue(input?.apiKey) ??
    normalizeCredentialValue(process.env.CREDIHOME_API_KEY) ??
    normalizeCredentialValue(process.env.CREDIHOME_TOKEN);

  const partnerCode =
    normalizeCredentialValue(input?.partnerCode) ??
    normalizeCredentialValue(process.env.CREDIHOME_PARTNER_CODE) ??
    normalizeCredentialValue(process.env.CREDIHOME_CHANNEL);

  const baseUrl = getCredihomeBaseUrl({ baseUrl: input?.baseUrl });
  const authPath = getCredihomeAuthPath();
  const proposalsPath = getCredihomeProposalsPath({ proposalsPath: input?.proposalsPath });
  const simulationsPath = getCredihomeSimulationsPath({ simulationsPath: input?.simulationsPath });

  const clientId = normalizeCredentialValue(process.env.CREDIHOME_CLIENT_ID);
  const clientSecret = normalizeCredentialValue(process.env.CREDIHOME_CLIENT_SECRET);
  const scope = normalizeCredentialValue(process.env.CREDIHOME_AUTH_SCOPE);

  return {
    apiKey,
    username,
    password,
    partnerCode,
    baseUrl,
    proposalsPath,
    simulationsPath,
    authPath,
    clientId,
    clientSecret,
    scope,
  } satisfies CredihomeResolvedCredentials;
}

function getTokenCacheKey(credentials: CredihomeResolvedCredentials) {
  return `${credentials.baseUrl}|${credentials.authPath}|${credentials.username}`;
}

async function requestCredihomeToken(credentials: CredihomeResolvedCredentials, forceRefresh = false) {
  const cacheKey = getTokenCacheKey(credentials);
  const cached = forceRefresh ? undefined : credihomeTokenCache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now + 30_000) {
    return cached.token;
  }

  const tokenUrl = credentials.authPath.startsWith('http')
    ? credentials.authPath
    : `${credentials.baseUrl}${credentials.authPath.startsWith('/') ? credentials.authPath : `/${credentials.authPath}`}`;

  const headers = new Headers({
    'Content-Type': 'application/json',
    Accept: 'application/json',
  });

  if (credentials.apiKey) {
    headers.set('x-api-key', credentials.apiKey);
  }

  if (credentials.partnerCode) {
    headers.set('channel', credentials.partnerCode);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ login: credentials.username, password: credentials.password }),
  });

  const text = await response.text();
  let parsed: any = null;

  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (error) {
    parsed = text;
  }

  if (!response.ok) {
    throw new CredihomeError(`Falha ao gerar token na Credihome. Status ${response.status}.`, {
      status: response.status,
      body: parsed,
    });
  }

  const token = parsed?.token ?? parsed?.access_token;
  const expiresInCandidate =
    typeof parsed?.expiresIn === 'number'
      ? parsed.expiresIn
      : typeof parsed?.expires_in === 'number'
        ? parsed.expires_in
        : Number(parsed?.expiresIn ?? parsed?.expires_in ?? 0);
  const expiresIn = Number.isFinite(expiresInCandidate) && expiresInCandidate > 0 ? expiresInCandidate : 600;

  if (!token) {
    throw new CredihomeError('A resposta da Credihome não trouxe o token esperado.', parsed);
  }

  const expiresAt = now + Math.max(expiresIn * 1000, 5 * 60 * 1000);
  credihomeTokenCache.set(cacheKey, { token, expiresAt });
  return token;
}

export type CredihomeFetchOptions = {
  credentials?: CredihomeCredentialInput;
};

export async function fetchCredihome<T = unknown>(
  path: string,
  init?: RequestInit,
  options?: CredihomeFetchOptions,
): Promise<T> {
  const resolved = resolveCredihomeCredentials(options?.credentials);
  const targetUrl = path.startsWith('http')
    ? path
    : `${resolved.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const cacheKey = getTokenCacheKey(resolved);

  const executeRequest = async (token: string) => {
    const headers = new Headers(init?.headers ?? {});
    headers.set('Accept', 'application/json');
    headers.set('Authorization', `Bearer ${token}`);
    if (resolved.apiKey && !headers.has('x-api-key')) {
      headers.set('x-api-key', resolved.apiKey);
    }
    if (resolved.partnerCode && !headers.has('channel')) {
      headers.set('channel', resolved.partnerCode);
    }
    if (!headers.has('Content-Type') && init?.body) {
      headers.set('Content-Type', 'application/json');
    }

    return fetch(targetUrl, {
      ...init,
      headers,
    });
  };

  let token = await requestCredihomeToken(resolved);
  let response = await executeRequest(token);

  if (response.status === 401 || response.status === 403) {
    credihomeTokenCache.delete(cacheKey);
    token = await requestCredihomeToken(resolved, true);
    response = await executeRequest(token);
  }

  const text = await response.text();
  let parsed: unknown = null;

  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (error) {
    parsed = text;
  }

  if (!response.ok) {
    throw new CredihomeError(`Erro ao consultar dados na Credihome. Status ${response.status}.`, {
      status: response.status,
      body: parsed,
    });
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
  const proposalsPath = normalizePath(credentials?.proposalsPath);
  const simulationsPath = normalizePath(credentials?.simulationsPath);

  if (apiKey) headers[CREDIHOME_API_KEY_HEADER] = apiKey;
  if (username) headers[CREDIHOME_USERNAME_HEADER] = username;
  if (password) headers[CREDIHOME_PASSWORD_HEADER] = password;
  if (partnerCode) headers[CREDIHOME_PARTNER_CODE_HEADER] = partnerCode;
  if (baseUrl) headers[CREDIHOME_BASE_URL_HEADER] = baseUrl;
  if (proposalsPath) headers[CREDIHOME_PROPOSALS_PATH_HEADER] = proposalsPath;
  if (simulationsPath) headers[CREDIHOME_SIMULATIONS_PATH_HEADER] = simulationsPath;

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

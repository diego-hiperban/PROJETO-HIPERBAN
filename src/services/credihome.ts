const BASE = process.env.CREDIHOME_BASE_URL || "https://api-partner.credihome.com.br/v1/production";
const LOGIN = process.env.CREDIHOME_LOGIN!;
const PASSWORD = process.env.CREDIHOME_PASSWORD!;
const CHANNEL = process.env.CREDIHOME_CHANNEL || "";

type CredihomeHttpError = Error & {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
};

let jwt: string | null = null;

function buildHeaders(includeAuth = true, includeChannel = true): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (includeAuth && jwt) {
    headers.Authorization = `Bearer ${jwt}`;
  }

  if (includeChannel && CHANNEL) {
    headers.channel = CHANNEL;
  }

  return headers;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    // If JSON parsing fails, return the raw text so callers can inspect it.
    return text as unknown as T;
  }
}

type CredihomeRequestInit = Omit<RequestInit, "body" | "headers"> & {
  includeAuth?: boolean;
  includeChannel?: boolean;
  headers?: HeadersInit;
  body?: unknown;
};

async function request<T>(
  path: string,
  init: CredihomeRequestInit = {}
): Promise<T> {
  const { includeAuth = true, includeChannel = true, headers, body, ...rest } = init;

  const additionalHeaders = headers instanceof Headers
    ? Object.fromEntries(headers.entries())
    : ((headers as Record<string, string> | undefined) ?? {});

  const mergedHeaders: Record<string, string> = {
    ...buildHeaders(includeAuth, includeChannel),
    ...additionalHeaders,
  };

  const requestInit: RequestInit = {
    ...rest,
    headers: mergedHeaders,
  };

  if (body !== undefined) {
    requestInit.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const response = await fetch(`${BASE}${path}`, requestInit);

  if (!response.ok) {
    const errorBody = await parseResponse<unknown>(response);
    const headersRecord = Object.fromEntries(response.headers.entries());
    const error: CredihomeHttpError = Object.assign(new Error(`Credihome request failed with status ${response.status}`), {
      status: response.status,
      body: errorBody,
      headers: headersRecord,
    });
    throw error;
  }

  return parseResponse<T>(response);
}

async function login(): Promise<void> {
  const data = await request<{ token?: string }>("/login", {
    method: "POST",
    includeAuth: false,
    includeChannel: false,
    body: { login: LOGIN, password: PASSWORD },
  });

  if (!data?.token) {
    throw new Error("Credihome: token ausente no /login");
  }

  jwt = data.token;
}

function isAuthError(error: unknown): error is CredihomeHttpError {
  const status = typeof (error as CredihomeHttpError)?.status === "number" ? (error as CredihomeHttpError).status : undefined;
  return status === 401 || status === 403;
}

async function withAuth<T>(fn: () => Promise<T>): Promise<T> {
  if (!jwt) {
    await login();
  }

  try {
    return await fn();
  } catch (error) {
    if (isAuthError(error)) {
      await login();
      return fn();
    }
    throw error;
  }
}

/**
 * Simulação recomendada (básico)
 */
export async function simularBasico(input: {
  valorImovel: number;
  valorEntrada: number;
  valorFinanciamento: number;
  prazoPagamento: number;
  sistema?: string; // default "API"
}) {
  return withAuth(() =>
    request(`/simulador`, {
      method: "POST",
      body: {
        valorImovel: input.valorImovel,
        valorEntrada: input.valorEntrada,
        valorFinanciamento: input.valorFinanciamento,
        prazoPagamento: input.prazoPagamento,
        sistema: input.sistema ?? "API",
      },
    })
  );
}

/**
 * Simulação mínima (caso a conta aceite o mínimo)
 */
export async function simularMinimo(input: {
  valorFinanciamento: number;
  prazoPagamento: number;
  sistema?: string;
}) {
  return withAuth(() =>
    request(`/simulador`, {
      method: "POST",
      body: {
        valorFinanciamento: input.valorFinanciamento,
        prazoPagamento: input.prazoPagamento,
        sistema: input.sistema ?? "API",
      },
    })
  );
}

/**
 * Efetivação de proposta (mantido flexível — campos variam por conta)
 * Mapeie os campos a partir do retorno da simulação da sua conta.
 */
export async function efetivarProposta(req: {
  idSimulacao: string;
  documentos?: any[];
  endereco?: any;
  renda?: any;
  ocupacao?: any;
  estadoCivil?: string;
}) {
  return withAuth(() =>
    request(`/proposta`, {
      method: "POST",
      body: req,
    })
  );
}

/**
 * Consulta de proposta
 */
export async function consultarProposta(id: string) {
  return withAuth(() => request(`/proposta/${id}`, { method: "GET" }));
}

/**
 * Utilitário para logar erros com x-amzn-RequestId
 */
export function parseCredihomeError(err: any) {
  const status = err?.status ?? err?.response?.status;

  const headers: Record<string, string> | undefined = err?.headers
    ? err.headers
    : err?.response?.headers;

  const requestId = headers?.["x-amzn-requestid"] ?? headers?.["x-amzn-request-id"];
  const body = err?.body ?? err?.response?.data;

  return { status, requestId, body };
}

import axios from "axios";

const BASE = process.env.CREDIHOME_BASE_URL || "https://api-partner.credihome.com.br/v1/production";
const LOGIN = process.env.CREDIHOME_LOGIN!;
const PASSWORD = process.env.CREDIHOME_PASSWORD!;
const CHANNEL = process.env.CREDIHOME_CHANNEL || "";

let jwt: string | null = null;

function buildHeaders() {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (jwt) h["Authorization"] = `Bearer ${jwt}`;
  if (CHANNEL) h["channel"] = CHANNEL; // opcional por conta
  return h;
}

async function login(): Promise<void> {
  const { data } = await axios.post(
    `${BASE}/login`,
    { login: LOGIN, password: PASSWORD },
    { headers: buildHeaders() }
  );
  if (!data?.token) throw new Error("Credihome: token ausente no /login");
  jwt = data.token;
}

async function withAuth<T>(fn: () => Promise<T>): Promise<T> {
  try {
    if (!jwt) await login();
    return await fn();
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 401 ||  status === 403) {
      await login();
      return await fn();
    }
    throw err;
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
  return withAuth(async () => {
    const body = {
      valorImovel: input.valorImovel,
      valorEntrada: input.valorEntrada,
      valorFinanciamento: input.valorFinanciamento,
      prazoPagamento: input.prazoPagamento,
      sistema: input.sistema ?? "API",
    };
    const resp = await axios.post(`${BASE}/simulador`, body, { headers: buildHeaders() });
    return resp.data;
  });
}

/**
 * Simulação mínima (caso a conta aceite o mínimo)
 */
export async function simularMinimo(input: {
  valorFinanciamento: number;
  prazoPagamento: number;
  sistema?: string;
}) {
  return withAuth(async () => {
    const body = {
      valorFinanciamento: input.valorFinanciamento,
      prazoPagamento: input.prazoPagamento,
      sistema: input.sistema ?? "API",
    };
    const resp = await axios.post(`${BASE}/simulador`, body, { headers: buildHeaders() });
    return resp.data;
  });
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
  return withAuth(async () => {
    const resp = await axios.post(`${BASE}/proposta`, req, { headers: buildHeaders() });
    return resp.data;
  });
}

/**
 * Consulta de proposta
 */
export async function consultarProposta(id: string) {
  return withAuth(async () => {
    const resp = await axios.get(`${BASE}/proposta/${id}`, { headers: buildHeaders() });
    return resp.data;
  });
}

/**
 * Utilitário para logar erros com x-amzn-RequestId
 */
export function parseCredihomeError(err: any) {
  const status = err?.response?.status;
  const reqId = err?.response?.headers?.["x-amzn-requestid"];
  const body = err?.response?.data;
  return { status, requestId: reqId, body };
}

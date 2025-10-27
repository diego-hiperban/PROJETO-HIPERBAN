export const DEFAULT_ASAAS_BASE_URL = 'https://api.asaas.com/v3';

export const sanitizeDocument = (value?: string | null) => (value ? value.replace(/\D+/g, '') : undefined);

export const normalizeAsaasBaseUrl = (raw?: string | null) => {
  if (!raw) return DEFAULT_ASAAS_BASE_URL;

  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_ASAAS_BASE_URL;

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');

  try {
    const url = new URL(withoutTrailingSlash);
    const segments = url.pathname
      .split('/')
      .map((segment) => segment.trim().toLowerCase())
      .filter(Boolean);
    const hasVersionSegment = segments.includes('v3');

    if (!hasVersionSegment) {
      const basePath = url.pathname.replace(/\/+$/, '');
      url.pathname = `${basePath}${basePath.endsWith('/') || !basePath ? '' : '/'}v3`;
    }

    url.pathname = url.pathname.replace(/\/+$/, '');

    return url.toString().replace(/\/+$/, '');
  } catch (error) {
    console.warn('URL base inválida para o Asaas, aplicando fallback.', error, raw);
    if (/\/v3(\/|$)/i.test(withoutTrailingSlash)) {
      return withoutTrailingSlash;
    }
    return `${withoutTrailingSlash}/v3`;
  }
};

export class AsaasError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function readAsaasResponse(response: Response) {
  const text = await response.clone().text().catch(() => '');
  let json: any;

  if (text) {
    try {
      json = JSON.parse(text);
    } catch (error) {
      console.warn('Resposta não estruturada do Asaas', error, text);
    }
  }

  return { json, text };
}

export async function asaasFetch(path: string, init: RequestInit, apiKey: string, baseUrl: string) {
  if (!apiKey) {
    throw new Error('As credenciais do Asaas não foram configuradas.');
  }

  const headers = new Headers(init.headers ?? {});
  headers.set('Content-Type', 'application/json');
  headers.set('access_token', apiKey);
  headers.set('Authorization', `Bearer ${apiKey}`);

  const baseWithSlash = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const targetUrl = new URL(normalizedPath, baseWithSlash).toString();

  return fetch(targetUrl, {
    ...init,
    headers,
    cache: 'no-store',
  });
}

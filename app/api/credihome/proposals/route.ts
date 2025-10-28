import { NextRequest, NextResponse } from 'next/server';
import { normalizeCredihomeProposals } from '@/lib/credihome';

type CachedToken = {
  token: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

function getBaseUrl() {
  return (process.env.CREDIHOME_API_BASE_URL ?? 'https://api.credihome.com.br').replace(/\/$/, '');
}

function getAuthHeaders() {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const apiKey = process.env.CREDIHOME_API_KEY;
  if (apiKey) {
    const authHeader = process.env.CREDIHOME_AUTH_HEADER ?? 'Authorization';
    const authScheme = process.env.CREDIHOME_AUTH_SCHEME ?? 'Bearer';
    if (!headers[authHeader]) {
      headers[authHeader] = `${authScheme} ${apiKey}`.trim();
    }

    const fallbackHeader = process.env.CREDIHOME_FALLBACK_HEADER ?? 'x-api-key';
    if (!headers[fallbackHeader]) {
      headers[fallbackHeader] = apiKey;
    }
  }

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

  return headers;
}

async function requestToken() {
  const username = process.env.CREDIHOME_API_USERNAME;
  const password = process.env.CREDIHOME_API_PASSWORD;
  const grantType = process.env.CREDIHOME_AUTH_GRANT_TYPE ?? 'password';
  const authPath = process.env.CREDIHOME_AUTH_PATH ?? '/oauth/token';

  if (!username || !password) {
    throw new Error(
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
      throw new Error('CREDIHOME_AUTH_EXTRA_PARAMS não é um JSON válido.');
    }
  }

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    ...getAuthHeaders(),
  } as Record<string, string>;

  const response = await fetch(`${getBaseUrl()}${authPath}`, {
    method: 'POST',
    headers,
    body: body.toString(),
  });

  const responseText = await response.text();
  let parsedResponse: any = null;

  try {
    parsedResponse = responseText ? JSON.parse(responseText) : null;
  } catch (error) {
    parsedResponse = responseText;
  }

  if (!response.ok) {
    throw new Error(
      `Falha ao gerar token na Credihome. Status ${response.status}. Detalhes: ${JSON.stringify(parsedResponse)}`,
    );
  }

  const token = parsedResponse?.access_token ?? parsedResponse?.token ?? parsedResponse?.id_token;
  const expiresIn = Number(parsedResponse?.expires_in ?? parsedResponse?.expires ?? 1800);

  if (!token) {
    throw new Error('Resposta da Credihome não contém token válido.');
  }

  cachedToken = {
    token,
    expiresAt: Date.now() + (Number.isFinite(expiresIn) ? expiresIn * 1000 : 15 * 60 * 1000),
  };

  return token;
}

async function getToken() {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) {
    return cachedToken.token;
  }

  return requestToken();
}

async function fetchCredihome(path: string, init?: RequestInit) {
  const token = await getToken();

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...(init?.headers as Record<string, string>),
  } as Record<string, string>;

  headers.Authorization = `Bearer ${token}`;

  const apiKey = process.env.CREDIHOME_API_KEY;
  if (apiKey) {
    const fallbackHeader = process.env.CREDIHOME_FALLBACK_HEADER ?? 'x-api-key';
    if (!headers[fallbackHeader]) {
      headers[fallbackHeader] = apiKey;
    }
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
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
    throw new Error(
      `Erro ao consultar dados na Credihome. Status ${response.status}. Resposta: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`,
    );
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const protocol = url.searchParams.get('protocol') ?? undefined;
  const document = url.searchParams.get('document') ?? undefined;
  const email = url.searchParams.get('email') ?? undefined;

  if (!protocol && !document && !email) {
    return NextResponse.json(
      { error: 'Informe pelo menos protocolo, CPF ou e-mail para buscar as propostas na Credihome.' },
      { status: 400 },
    );
  }

  const searchParams = new URLSearchParams();
  if (protocol) searchParams.set('protocol', protocol);
  if (document) searchParams.set('document', document);
  if (email) searchParams.set('email', email);

  const proposalsPath = process.env.CREDIHOME_PROPOSALS_PATH ?? '/proposals';

  try {
    const data = await fetchCredihome(`${proposalsPath}?${searchParams.toString()}`, {
      method: 'GET',
    });

    const proposals = normalizeCredihomeProposals(data);

    return NextResponse.json({
      proposals,
      meta: {
        protocol,
        document,
        email,
        total: proposals.length,
      },
      raw: data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

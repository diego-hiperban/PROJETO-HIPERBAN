import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  let body: any;

  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Não foi possível ler os dados enviados.' }, { status: 400 });
  }

  if (
    !body?.customer?.name ||
    !body?.customer?.email ||
    !body?.customer?.phone ||
    !body?.customer?.document
  ) {
    return NextResponse.json(
      { error: 'Dados obrigatórios ausentes. Informe nome, e-mail, telefone e documento do cliente.' },
      { status: 400 },
    );
  }

  const baseUrl = (process.env.CREDIHOME_API_BASE_URL ?? 'https://api.credihome.com.br').replace(/\/$/, '');
  const apiKey = process.env.CREDIHOME_API_KEY;
  const partnerCode = process.env.CREDIHOME_PARTNER_CODE;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'Variável CREDIHOME_API_KEY não configurada. Defina as credenciais no ambiente antes de ativar a integração.',
      },
      { status: 500 },
    );
  }

  if (!body.channel && partnerCode) {
    body.channel = partnerCode;
  }

  if (!body?.financing?.creditValue && body?.property?.value && body?.financing?.entryValue !== undefined) {
    body.financing = {
      ...body.financing,
      creditValue: Number(body.property.value) - Number(body.financing.entryValue ?? 0),
    };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const authHeader = process.env.CREDIHOME_AUTH_HEADER ?? 'Authorization';
  const authScheme = process.env.CREDIHOME_AUTH_SCHEME ?? 'Bearer';
  headers[authHeader] = `${authScheme} ${apiKey}`.trim();

  const fallbackHeader = process.env.CREDIHOME_FALLBACK_HEADER ?? 'x-api-key';
  if (!headers[fallbackHeader]) {
    headers[fallbackHeader] = apiKey;
  }

  try {
    const upstreamResponse = await fetch(`${baseUrl}/simulations`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const responseText = await upstreamResponse.text();
    let parsedResponse: unknown;

    try {
      parsedResponse = responseText ? JSON.parse(responseText) : null;
    } catch (error) {
      parsedResponse = responseText;
    }

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { error: 'Erro retornado pela Credihome.', details: parsedResponse },
        { status: upstreamResponse.status },
      );
    }

    return NextResponse.json(parsedResponse ?? {});
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Falha ao conectar com a API da Credihome.',
        details: error instanceof Error ? error.message : error,
      },
      { status: 502 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { CredihomeError, fetchCredihome, readCredihomeCredentialHeaders } from '@/lib/credihome';

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

  const credentialOverrides = readCredihomeCredentialHeaders(request.headers);

  const partnerCode = credentialOverrides.partnerCode ?? process.env.CREDIHOME_PARTNER_CODE;

  if (!body.channel && partnerCode) {
    body.channel = partnerCode;
  }

  if (!body?.financing?.creditValue && body?.property?.value && body?.financing?.entryValue !== undefined) {
    body.financing = {
      ...body.financing,
      creditValue: Number(body.property.value) - Number(body.financing.entryValue ?? 0),
    };
  }

  try {
    const response = await fetchCredihome(
      '/simulations',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      { credentials: credentialOverrides },
    );

    return NextResponse.json(response ?? {});
  } catch (error) {
    if (error instanceof CredihomeError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        error: 'Falha ao conectar com a API da Credihome.',
        details: error instanceof Error ? error.message : error,
      },
      { status: 502 },
    );
  }
}

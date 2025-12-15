import { NextRequest, NextResponse } from 'next/server';
import {
  CredihomeError,
  fetchCredihome,
  getCredihomeProposalsPath,
  normalizeCredihomeProposals,
  readCredihomeCredentialHeaders,
} from '@/lib/credihome';

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

  const credentialOverrides = readCredihomeCredentialHeaders(request.headers);
  const proposalsPath = getCredihomeProposalsPath(credentialOverrides);

  try {
    const data = await fetchCredihome(
      `${proposalsPath}?${searchParams.toString()}`,
      {
        method: 'GET',
      },
      { credentials: credentialOverrides },
    );

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
    if (error instanceof CredihomeError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: 502 });
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

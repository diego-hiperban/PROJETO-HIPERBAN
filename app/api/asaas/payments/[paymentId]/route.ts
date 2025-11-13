import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_ASAAS_BASE_URL,
  AsaasError,
  asaasFetch,
  normalizeAsaasBaseUrl,
  readAsaasResponse,
} from '@/lib/server/asaas';

export async function DELETE(
  request: NextRequest,
  context: { params: { paymentId: string } },
) {
  try {
    const paymentId = context?.params?.paymentId;
    if (!paymentId) {
      return NextResponse.json({ error: 'Informe o identificador da cobrança.' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { apiKey, apiUrl } = (body ?? {}) as { apiKey?: string; apiUrl?: string };

    const token = (typeof apiKey === 'string' ? apiKey.trim() : '') || process.env.ASAAS_API_KEY;
    const baseUrl = normalizeAsaasBaseUrl(
      (typeof apiUrl === 'string' && apiUrl) || process.env.ASAAS_API_URL || DEFAULT_ASAAS_BASE_URL,
    );

    if (!token) {
      return NextResponse.json(
        { error: 'Configure a chave de API do Asaas antes de remover cobranças.' },
        { status: 400 },
      );
    }

    const response = await asaasFetch(`/payments/${paymentId}`, { method: 'DELETE' }, token, baseUrl);

    if (response.status === 404) {
      return NextResponse.json({ status: 'missing', message: 'Cobrança não encontrada no Asaas.' });
    }

    if (!response.ok) {
      const { json, text } = await readAsaasResponse(response);
      throw new AsaasError('Não foi possível excluir a cobrança no Asaas.', response.status, json ?? text);
    }

    return NextResponse.json({ status: 'deleted' });
  } catch (error) {
    if (error instanceof AsaasError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
    }
    console.error('Erro ao excluir cobrança no Asaas', error);
    return NextResponse.json(
      { error: 'Não foi possível excluir a cobrança no Asaas. Verifique as credenciais e tente novamente.' },
      { status: 500 },
    );
  }
}

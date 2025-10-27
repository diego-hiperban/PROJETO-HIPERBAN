import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_ASAAS_BASE_URL,
  AsaasError,
  asaasFetch,
  normalizeAsaasBaseUrl,
  readAsaasResponse,
} from '@/lib/server/asaas';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, subscriptionId, apiKey, apiUrl } = body ?? {};

    const token = (typeof apiKey === 'string' ? apiKey.trim() : '') || process.env.ASAAS_API_KEY;
    const baseUrl = normalizeAsaasBaseUrl(
      (typeof apiUrl === 'string' ? apiUrl : process.env.ASAAS_API_URL) || DEFAULT_ASAAS_BASE_URL,
    );

    if (!token) {
      return NextResponse.json(
        { error: 'Configure a chave de API do Asaas antes de sincronizar pagamentos.' },
        { status: 400 },
      );
    }

    if (!customerId && !subscriptionId) {
      return NextResponse.json(
        { error: 'Informe o cliente ou a assinatura para consultar os pagamentos.' },
        { status: 400 },
      );
    }

    const paymentsPath = subscriptionId
      ? `/subscriptions/${subscriptionId}/payments`
      : `/payments?customer=${customerId}&limit=50`;

    const paymentsResponse = await asaasFetch(paymentsPath, { method: 'GET' }, token, baseUrl);
    const { json: paymentsJson, text: paymentsText } = await readAsaasResponse(paymentsResponse);

    if (!paymentsResponse.ok) {
      throw new AsaasError(
        'Não foi possível consultar os pagamentos no Asaas.',
        paymentsResponse.status,
        paymentsJson ?? paymentsText,
      );
    }

    const payments = Array.isArray(paymentsJson?.data)
      ? paymentsJson.data
      : Array.isArray(paymentsJson)
        ? paymentsJson
        : [];

    return NextResponse.json({ payments, raw: paymentsJson });
  } catch (error) {
    if (error instanceof AsaasError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
    }
    console.error('Erro ao consultar pagamentos do Asaas', error);
    return NextResponse.json(
      { error: 'Não foi possível consultar os pagamentos no Asaas. Verifique as credenciais e tente novamente.' },
      { status: 500 },
    );
  }
}

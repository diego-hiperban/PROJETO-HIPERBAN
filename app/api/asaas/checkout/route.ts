import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_ASAAS_BASE_URL,
  AsaasError,
  asaasFetch,
  normalizeAsaasBaseUrl,
  readAsaasResponse,
  sanitizeDocument,
} from '@/lib/server/asaas';
const cycleMap: Record<string, string> = {
  monthly: 'MONTHLY',
  quarterly: 'QUARTERLY',
  semiannual: 'SEMIANNUAL',
  annual: 'YEARLY',
};

type EnsureCustomerInput = {
  customerId?: string;
  customer?: {
    name?: string;
    email?: string;
    document?: string;
    phone?: string;
  };
};

const REMOVED_CUSTOMER_KEYWORDS = ['cliente removido', 'cliente foi removido', 'customer removed'];

const includesRemovedKeyword = (value?: string | null) => {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return REMOVED_CUSTOMER_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const isRemovedCustomerPayload = (payload: any) => {
  if (!payload) return false;
  if (payload?.deleted === true) return true;
  const status = typeof payload?.status === 'string' ? payload.status.toLowerCase() : '';
  if (status.includes('removed') || status.includes('deleted')) {
    return true;
  }
  const situacao = typeof payload?.situacao === 'string' ? payload.situacao.toLowerCase() : '';
  if (situacao.includes('remov') || situacao.includes('inativo')) {
    return true;
  }
  const description =
    typeof payload?.description === 'string'
      ? payload.description
      : typeof payload?.message === 'string'
        ? payload.message
        : undefined;
  return includesRemovedKeyword(description ?? undefined);
};

const isRemovedCustomerError = (payload: any): boolean => {
  if (!payload) return false;
  if (typeof payload === 'string') {
    return includesRemovedKeyword(payload);
  }

  const candidates: (string | undefined)[] = [];
  if (typeof payload?.message === 'string') candidates.push(payload.message);
  if (typeof payload?.error === 'string') candidates.push(payload.error);
  if (typeof payload?.description === 'string') candidates.push(payload.description);

  if (Array.isArray(payload?.errors)) {
    for (const entry of payload.errors) {
      if (typeof entry?.description === 'string') {
        candidates.push(entry.description);
      }
      if (typeof entry?.message === 'string') {
        candidates.push(entry.message);
      }
    }
  }

  return candidates.some((candidate) => includesRemovedKeyword(candidate));
};

const extractCustomerFromPayload = (payload: any) => {
  if (!payload) return undefined;
  if (Array.isArray(payload) && payload.length > 0) return payload[0];
  if (Array.isArray(payload?.data) && payload.data.length > 0) return payload.data[0];
  if (payload?.id) return payload;
  return undefined;
};

async function ensureCustomer({
  customerId,
  customer,
  apiKey,
  baseUrl,
  forceCreate = false,
}: EnsureCustomerInput & { apiKey: string; baseUrl: string; forceCreate?: boolean }) {
  if (customerId && !forceCreate) {
    const lookup = await asaasFetch(`/customers/${customerId}`, { method: 'GET' }, apiKey, baseUrl);
    const { json: lookupBody } = await readAsaasResponse(lookup);

    if (lookup.ok && lookupBody && !isRemovedCustomerPayload(lookupBody)) {
      return lookupBody;
    }

    if (lookup.ok && lookupBody && isRemovedCustomerPayload(lookupBody)) {
      console.warn('Cliente do Asaas encontrado porém removido. Novo cadastro será solicitado.', lookupBody?.id);
    }
  }

  if (!customer?.name || !customer.email) {
    throw new Error('Informe nome e e-mail para criar o cliente no Asaas.');
  }

  const payload = {
    name: customer.name,
    email: customer.email,
    cpfCnpj: sanitizeDocument(customer.document),
    mobilePhone: sanitizeDocument(customer.phone),
  };

  const createResponse = await asaasFetch(
    '/customers',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    apiKey,
    baseUrl,
  );

  const { json: responseBody, text: responseText } = await readAsaasResponse(createResponse);

  if (createResponse.ok) {
    if (!responseBody) {
      throw new AsaasError(
        'Resposta inválida do Asaas ao registrar o cliente.',
        createResponse.status,
        responseText,
      );
    }
    return responseBody;
  }

  const isConflict =
    createResponse.status === 409 ||
    responseBody?.errors?.some((error: { code?: string }) => error.code === 'customer_conflict');

  if (isConflict) {
    const searchQueries = new Set<string>();
    if (customer.email) {
      searchQueries.add(`/customers?email=${encodeURIComponent(customer.email)}`);
    }
    const sanitizedDocument = sanitizeDocument(customer.document);
    if (sanitizedDocument) {
      searchQueries.add(`/customers?cpfCnpj=${sanitizedDocument}`);
    }

    for (const query of searchQueries) {
      const searchResponse = await asaasFetch(
        query,
        {
          method: 'GET',
        },
        apiKey,
        baseUrl,
      );

      const { json: searchBody, text: searchText } = await readAsaasResponse(searchResponse);

      if (!searchResponse.ok) {
        const description =
          searchBody?.errors?.[0]?.description ||
          searchBody?.message ||
          searchText ||
          'Não foi possível localizar o cliente no Asaas.';
        throw new AsaasError(description, searchResponse.status, searchBody ?? searchText);
      }

      const found = extractCustomerFromPayload(searchBody);
      if (found && !isRemovedCustomerPayload(found)) {
        return found;
      }
    }

    throw new AsaasError('Cliente não encontrado no Asaas.', createResponse.status, responseBody ?? responseText);
  }

  const description =
    responseBody?.errors?.[0]?.description ||
    responseBody?.message ||
    responseBody?.error ||
    responseText ||
    'Não foi possível registrar o cliente no Asaas.';
  throw new AsaasError(description, createResponse.status, responseBody ?? responseText);
}

type PaymentLinkInput = {
  apiKey: string;
  baseUrl: string;
  payload: Record<string, unknown>;
};

const pickCheckoutUrl = (candidate: any) =>
  candidate?.invoiceUrl ||
  candidate?.bankSlipUrl ||
  candidate?.paymentLink ||
  candidate?.checkoutUrl ||
  candidate?.url ||
  undefined;

async function createPaymentLink({ apiKey, baseUrl, payload }: PaymentLinkInput) {
  const response = await asaasFetch(
    '/paymentLinks',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    apiKey,
    baseUrl,
  );

  const { json, text } = await readAsaasResponse(response);

  if (!response.ok) {
    console.warn('Falha ao gerar link de pagamento do Asaas', response.status, json ?? text);
    return undefined;
  }

  const linkCandidate: any = json ?? {};
  return pickCheckoutUrl(linkCandidate);
}

const extractFirstItem = (payload: any) => {
  if (!payload) return undefined;
  if (Array.isArray(payload) && payload.length > 0) return payload[0];
  if (Array.isArray(payload?.data) && payload.data.length > 0) return payload.data[0];
  if (payload?.id) return payload;
  return undefined;
};

type SubscriptionCheckoutInput = {
  apiKey: string;
  baseUrl: string;
  subscriptionId: string;
  customerId: string;
  value: number;
  description?: string;
  dueDate: string;
  planName?: string;
  planId?: string;
};

async function ensureSubscriptionCheckout({
  apiKey,
  baseUrl,
  subscriptionId,
  customerId,
  value,
  description,
  dueDate,
  planName,
  planId,
}: SubscriptionCheckoutInput) {
  let checkoutUrl: string | undefined;
  let paymentId: string | undefined;

  try {
    const paymentsResponse = await asaasFetch(
      `/subscriptions/${subscriptionId}/payments?status=PENDING&limit=1`,
      { method: 'GET' },
      apiKey,
      baseUrl,
    );

    const { json: paymentsBody, text: paymentsText } = await readAsaasResponse(paymentsResponse);

    if (paymentsResponse.ok) {
      const firstPayment = extractFirstItem(paymentsBody);
      if (firstPayment) {
        checkoutUrl = pickCheckoutUrl(firstPayment);
        paymentId = firstPayment?.id ?? paymentId;
      }
    } else {
      console.warn(
        'Falha ao consultar pagamentos da assinatura no Asaas',
        paymentsResponse.status,
        paymentsBody ?? paymentsText,
      );
    }
  } catch (error) {
    console.warn('Erro ao buscar pagamentos vinculados à assinatura no Asaas', error);
  }

  if (!checkoutUrl) {
    const paymentResponse = await asaasFetch(
      '/payments',
      {
        method: 'POST',
        body: JSON.stringify({
          customer: customerId,
          subscription: subscriptionId,
          billingType: 'UNDEFINED',
          value,
          dueDate,
          description: description ?? `Assinatura ${planName ?? planId ?? subscriptionId}`,
        }),
      },
      apiKey,
      baseUrl,
    );

    const { json: paymentData, text: paymentText } = await readAsaasResponse(paymentResponse);

    if (paymentResponse.ok) {
      const linkCandidate = paymentData ?? {};
      checkoutUrl = pickCheckoutUrl(linkCandidate);
      paymentId = linkCandidate?.id ?? paymentId;
    } else {
      console.warn(
        'Falha ao criar pagamento vinculado à assinatura no Asaas',
        paymentResponse.status,
        paymentData ?? paymentText,
      );
    }
  }

  if (!checkoutUrl) {
    if (paymentId) {
      checkoutUrl = await createPaymentLink({
        apiKey,
        baseUrl,
        payload: {
          name: planName ?? `Assinatura ${planId ?? subscriptionId}`,
          description:
            description ??
            (planName || planId
              ? `Cobrança da assinatura ${planName ?? planId}`
              : 'Cobrança da assinatura contratada'),
          chargeType: 'DETACHED',
          billingType: 'UNDEFINED',
          payment: paymentId,
          value,
          dueDate,
        },
      });
    }

    if (!checkoutUrl) {
      checkoutUrl = await createPaymentLink({
        apiKey,
        baseUrl,
        payload: {
          name: planName ?? `Plano ${planId ?? subscriptionId}`,
          description:
            planName || planId
              ? `Checkout do plano ${planName ?? planId}`
              : 'Checkout do plano contratado',
          chargeType: 'SUBSCRIPTION',
          subscription: subscriptionId,
          billingType: 'UNDEFINED',
          value,
          dueDate,
        },
      });
    }
  }

  return { checkoutUrl, paymentId };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,
      customerId,
      customer,
      amount,
      planId,
      planName,
      period,
      durationInDays,
      quantity,
      seatPrice,
      apiKey: providedApiKey,
      apiUrl: providedApiUrl,
    } = body as {
      type: 'plan' | 'seat';
      customerId?: string;
      customer?: { name?: string; email?: string; document?: string; phone?: string };
      amount?: number;
      planId?: string;
      planName?: string;
      period?: string;
      durationInDays?: number;
      quantity?: number;
      seatPrice?: number;
      apiKey?: string;
      apiUrl?: string;
    };

    const apiKey = (process.env.ASAAS_API_KEY ?? providedApiKey ?? '').trim();
    const baseUrl = normalizeAsaasBaseUrl(
      (process.env.ASAAS_API_URL ?? providedApiUrl) || DEFAULT_ASAAS_BASE_URL,
    );

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Configure a variável de ambiente ASAAS_API_KEY antes de gerar cobranças.' },
        { status: 500 },
      );
    }

    const sanitizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    if (!type) {
      return NextResponse.json({ error: 'Informe o tipo de checkout solicitado.' }, { status: 400 });
    }

    const asaasCustomer = await ensureCustomer({ customerId, customer, apiKey, baseUrl: sanitizedBaseUrl });
    let resolvedCustomer = asaasCustomer;
    const cycle = cycleMap[period ?? 'monthly'] ?? 'MONTHLY';
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 2);
    const dueDateIso = dueDate.toISOString().slice(0, 10);

    if (type === 'plan') {
      const value = typeof amount === 'number' && amount > 0 ? amount : undefined;
      if (!value) {
        return NextResponse.json(
          { error: 'Informe o valor da assinatura para gerar o checkout do plano.' },
          { status: 400 },
        );
      }

      const createSubscription = (customerRecord: any) =>
        asaasFetch(
          '/subscriptions',
          {
            method: 'POST',
            body: JSON.stringify({
              customer: customerRecord.id,
              billingType: 'UNDEFINED',
              value,
              cycle,
              description: planName ?? `Plano ${planId}`,
              maxPayments: undefined,
              endDate: durationInDays
                ? new Date(now.getTime() + durationInDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
                : undefined,
            }),
          },
          apiKey,
          sanitizedBaseUrl,
        );

      let subscriptionResponse = await createSubscription(resolvedCustomer);
      let { json: subscriptionData, text: subscriptionText } = await readAsaasResponse(subscriptionResponse);

      if (
        !subscriptionResponse.ok &&
        customer?.name &&
        customer?.email &&
        isRemovedCustomerError(subscriptionData ?? subscriptionText)
      ) {
        resolvedCustomer = await ensureCustomer({
          customer,
          apiKey,
          baseUrl: sanitizedBaseUrl,
          forceCreate: true,
        });

        subscriptionResponse = await createSubscription(resolvedCustomer);
        ({ json: subscriptionData, text: subscriptionText } = await readAsaasResponse(subscriptionResponse));
      }

      if (!subscriptionResponse.ok) {
        return NextResponse.json(
          {
            error:
              subscriptionData?.errors?.[0]?.description ||
              subscriptionData?.message ||
              subscriptionText ||
              'Falha ao criar assinatura no Asaas.',
            details: subscriptionData ?? subscriptionText,
          },
          { status: subscriptionResponse.status },
        );
      }

      const initialCheckoutUrl = pickCheckoutUrl(subscriptionData);

      let checkoutUrl = initialCheckoutUrl;
      let paymentId: string | undefined;

        if ((!checkoutUrl || typeof checkoutUrl !== 'string') && subscriptionData?.id) {
          const resolution = await ensureSubscriptionCheckout({
            apiKey,
            baseUrl: sanitizedBaseUrl,
            subscriptionId: subscriptionData.id,
            customerId: resolvedCustomer.id,
            value,
            description: planName ?? `Plano ${planId ?? subscriptionData.id}`,
            dueDate: dueDateIso,
            planName,
            planId,
        });

        checkoutUrl = resolution.checkoutUrl ?? checkoutUrl;
        paymentId = resolution.paymentId;
      }

      return NextResponse.json({
        checkoutUrl,
        message: checkoutUrl
          ? 'Assinatura criada com sucesso no Asaas.'
          : 'Assinatura criada. Consulte o painel do Asaas para compartilhar a cobrança.',
          subscriptionId: subscriptionData?.id,
          customerId: resolvedCustomer?.id,
          paymentId,
        });
      }

    const totalSeats = typeof quantity === 'number' ? quantity : 1;
    const baseSeatPrice = typeof seatPrice === 'number' ? seatPrice : 0;
    const value = baseSeatPrice * totalSeats;

    if (!value || value <= 0) {
      return NextResponse.json(
        { error: 'Informe o valor para contratar usuários adicionais.' },
        { status: 400 },
      );
    }

    const createPayment = (customerRecord: any) =>
      asaasFetch(
        '/payments',
        {
          method: 'POST',
          body: JSON.stringify({
            customer: customerRecord.id,
            billingType: 'UNDEFINED',
            value,
            dueDate: dueDateIso,
            description: `Usuários adicionais (${totalSeats}) - ${planName ?? planId ?? 'Plano'}`,
          }),
        },
        apiKey,
        sanitizedBaseUrl,
      );

    let paymentResponse = await createPayment(resolvedCustomer);
    let { json: paymentData, text: paymentText } = await readAsaasResponse(paymentResponse);

    if (
      !paymentResponse.ok &&
      customer?.name &&
      customer?.email &&
      isRemovedCustomerError(paymentData ?? paymentText)
    ) {
      resolvedCustomer = await ensureCustomer({
        customer,
        apiKey,
        baseUrl: sanitizedBaseUrl,
        forceCreate: true,
      });

      paymentResponse = await createPayment(resolvedCustomer);
      ({ json: paymentData, text: paymentText } = await readAsaasResponse(paymentResponse));
    }

    if (!paymentResponse.ok) {
      return NextResponse.json(
        {
          error:
            paymentData?.errors?.[0]?.description ||
            paymentData?.message ||
            paymentText ||
            'Falha ao gerar pagamento de usuários adicionais.',
          details: paymentData ?? paymentText,
        },
        { status: paymentResponse.status },
      );
    }

    let checkoutUrl =
      paymentData?.invoiceUrl ||
      paymentData?.bankSlipUrl ||
      paymentData?.paymentLink ||
      paymentData?.checkoutUrl;

    if (!checkoutUrl && paymentData?.id) {
      checkoutUrl = await createPaymentLink({
        apiKey,
        baseUrl: sanitizedBaseUrl,
        payload: {
          name: `Usuários adicionais (${totalSeats})`,
          description: `Cobrança de licenças extras vinculada ao pagamento ${paymentData.id}`,
          chargeType: 'DETACHED',
          billingType: 'UNDEFINED',
          value,
          payment: paymentData.id,
          dueDate: dueDateIso,
        },
      });
    }

    return NextResponse.json({
      checkoutUrl,
      message: checkoutUrl
        ? 'Cobrança de usuários adicionais criada no Asaas.'
        : 'Cobrança criada. Consulte o painel do Asaas para compartilhar o pagamento.',
      paymentId: paymentData?.id,
      customerId: resolvedCustomer?.id,
    });
  } catch (error) {
    console.error('Erro na integração com o Asaas', error);
    if (error instanceof AsaasError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status || 500 },
      );
    }
    const message =
      error instanceof Error ? error.message : 'Não foi possível comunicar com o Asaas. Verifique as credenciais.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedPage } from '../components/ProtectedPage';
import { useAuth } from '../context/AuthContext';
import { BillingStatus, Plan, PaymentRecord, User } from '@/lib/data';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

const STATUS_LABELS: Record<BillingStatus, string> = {
  active: 'Ativo',
  trial: 'Teste',
  pending: 'Pagamento pendente',
  overdue: 'Em atraso',
  expired: 'Expirado',
  cancelled: 'Cancelado',
};

const STATUS_CLASSES: Record<BillingStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  trial: 'bg-sky-100 text-sky-700',
  pending: 'bg-amber-100 text-amber-700',
  overdue: 'bg-rose-100 text-rose-700',
  expired: 'bg-rose-200 text-rose-700',
  cancelled: 'bg-slate-200 text-slate-600',
};

function collectTeam(userId: string, users: User[]): User[] {
  const direct = users.filter((user) => user.parentId === userId);
  const indirect = direct.flatMap((child) => collectTeam(child.id, users));
  return [...direct, ...indirect];
}

export default function BillingPage() {
  const {
    currentUser,
    users,
    plans,
    requestCheckout,
    getPlanById,
    getRemainingTrialDays,
    isBillingRestricted,
    settings,
    createPlan,
    updatePlan,
    recordPayment,
  } = useAuth();
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(currentUser?.billing?.planId);
  const [customPrice, setCustomPrice] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [seatQuantity, setSeatQuantity] = useState(1);
  const [showCheckout, setShowCheckout] = useState(false);
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState<string | null>(null);
  const [autoOpenBlocked, setAutoOpenBlocked] = useState(false);
  const lastCheckoutUrlRef = useRef<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'overview' | 'plans'>('overview');
  const [syncing, setSyncing] = useState(false);
  const [highlightSeats, setHighlightSeats] = useState(false);
  const router = useRouter();
  const [focusParam, setFocusParam] = useState<string | null>(null);
  const seatFocusHandledRef = useRef(false);

  if (!currentUser) {
    return null;
  }

  const billing = currentUser.billing;
  const isAdmin = currentUser.role === 'admin';
  const plan = selectedPlanId ? getPlanById(selectedPlanId) : undefined;
  const restricted = isBillingRestricted(currentUser);
  const remainingTrialDays = getRemainingTrialDays(currentUser.id);
  const checkoutUrl = billing?.checkoutUrl;
  const hasAsaasKey = Boolean(settings.asaasApiKey);
  const canCustomizePrice = isAdmin && Boolean(plan?.allowCustomPrice);

  useEffect(() => {
    if (!isAdmin && activeTab !== 'overview') {
      setActiveTab('overview');
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (billing?.planId && billing.planId !== selectedPlanId) {
      setSelectedPlanId(billing.planId);
    }
  }, [billing?.planId, selectedPlanId]);

  useEffect(() => {
    if (!isAdmin) {
      setCustomPrice('');
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!checkoutUrl) {
      setShowCheckout(false);
      setAutoOpenBlocked(false);
      lastCheckoutUrlRef.current = undefined;
      return;
    }

    if (lastCheckoutUrlRef.current === undefined) {
      lastCheckoutUrlRef.current = checkoutUrl;
      return;
    }

    if (checkoutUrl !== lastCheckoutUrlRef.current) {
      setShowCheckout(true);
      setPendingCheckoutUrl(checkoutUrl);
    }

    lastCheckoutUrlRef.current = checkoutUrl;
  }, [checkoutUrl]);

  useEffect(() => {
    if (!pendingCheckoutUrl) {
      return;
    }

    const newWindow = window.open(pendingCheckoutUrl, '_blank', 'noopener,noreferrer');

    if (newWindow) {
      setAutoOpenBlocked(false);
      newWindow.focus();
    } else {
      setAutoOpenBlocked(true);
    }

    setPendingCheckoutUrl(null);
  }, [pendingCheckoutUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    const focusValue = url.searchParams.get('focus');
    if (focusValue) {
      setFocusParam(focusValue);
    }
  }, []);

  useEffect(() => {
    if (focusParam !== 'seats' || seatFocusHandledRef.current) {
      return;
    }

    seatFocusHandledRef.current = true;
    let timeout: number | undefined;

    if (currentUser.role === 'master') {
      const highlight = Boolean(billing?.additionalSeatPrice);
      const message = highlight
        ? 'Você atingiu o limite de usuários do seu plano. Contrate licenças adicionais para continuar cadastrando a equipe.'
        : 'Seu plano atual não permite contratar usuários adicionais. Solicite ao administrador a configuração da oferta adequada.';
      setFeedback(message);

      if (highlight) {
        setHighlightSeats(true);
        if (typeof window !== 'undefined') {
          window.requestAnimationFrame(() => {
            const target = document.getElementById('additional-seats');
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
          timeout = window.setTimeout(() => setHighlightSeats(false), 6000);
        }
      }
    }

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('focus');
      const next = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''}`;
      router.replace(next);
      setFocusParam(null);
    }

    return () => {
      if (timeout) {
        window.clearTimeout(timeout);
      }
    };
  }, [focusParam, currentUser.role, billing?.additionalSeatPrice, router]);

  const team = useMemo(() => {
    if (currentUser.role !== 'master') return [];
    return collectTeam(currentUser.id, users);
  }, [currentUser, users]);

  const seatsIncluded = billing?.seatsIncluded ?? 0;
  const additionalSeats = billing?.additionalSeats ?? 0;
  const totalSeats = seatsIncluded + additionalSeats;
  const teamUsage = currentUser.role === 'master' ? team.length + 1 : 1;
  const availableSeats = totalSeats - teamUsage;

  const selectablePlans = useMemo(() => {
    if (currentUser.role === 'admin') {
      return plans;
    }
    return plans.filter((item) => item.id !== 'plan-enterprise');
  }, [currentUser.role, plans]);

  const handlePlanChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (!isAdmin) {
      return;
    }
    const value = event.target.value;
    setSelectedPlanId(value || undefined);
    setFeedback('');
  };

  const handleGenerateCheckout = async () => {
    if (!selectedPlanId) {
      setFeedback('Selecione um plano para continuar.');
      return;
    }

    setLoading(true);
    const payload = await requestCheckout({
      type: 'plan',
      userId: currentUser.id,
      planId: selectedPlanId,
      customPrice: customPrice ? Number(customPrice) : undefined,
    });

    if (payload.error) {
      setFeedback(payload.error);
    } else if (payload.checkoutUrl) {
      setFeedback('Link de pagamento gerado com sucesso. Acesse para concluir a contratação.');
      setShowCheckout(true);
      setAutoOpenBlocked(false);
      setPendingCheckoutUrl(payload.checkoutUrl);
    } else {
      setFeedback(payload.message ?? 'Solicitação enviada.');
    }
    setLoading(false);
  };

  const handleSeatCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!billing?.planId || !billing.additionalSeatPrice) {
      setFeedback('O plano atual não possui contratação de usuários adicionais.');
      return;
    }

    if (seatQuantity < 1) {
      setFeedback('Informe a quantidade de licenças que deseja contratar.');
      return;
    }

    const currentAdditional = billing.additionalSeats ?? 0;
    const limit = billing.additionalSeatLimit ?? null;
    if (limit && currentAdditional + seatQuantity > limit) {
      const remaining = limit - currentAdditional;
      setFeedback(
        remaining > 0
          ? `Você só pode contratar mais ${remaining} licença(s) com o limite atual. Ajuste a quantidade ou solicite um aumento ao administrador.`
          : 'O limite de usuários adicionais do seu plano foi atingido. Solicite ao administrador a ampliação do pacote.',
      );
      return;
    }

    setLoading(true);
    const payload = await requestCheckout({
      type: 'seat',
      userId: currentUser.id,
      planId: billing.planId,
      quantity: seatQuantity,
      seatPrice: billing.additionalSeatPrice,
    });

    if (payload.error) {
      setFeedback(payload.error);
    } else if (payload.checkoutUrl) {
      setFeedback('Link para contratação de usuários adicionais gerado com sucesso.');
      setSeatQuantity(1);
      setShowCheckout(true);
      setAutoOpenBlocked(false);
      setPendingCheckoutUrl(payload.checkoutUrl);
    } else {
      setFeedback(payload.message ?? 'Solicitação enviada.');
    }
    setLoading(false);
  };

  const syncPayments = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!billing) {
        if (!silent) {
          setFeedback('Nenhum plano ativo foi encontrado para este usuário.');
        }
        return { inserted: 0 };
      }

      if (!billing.asaasCustomerId && !billing.asaasSubscriptionId) {
        if (!silent) {
          setFeedback(
            'Nenhum identificador do Asaas foi salvo para este usuário. Gere uma cobrança antes de sincronizar.',
          );
        }
        return { inserted: 0 };
      }

      if (!silent) {
        setSyncing(true);
        setFeedback('');
      }

      try {
        const response = await fetch('/api/asaas/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: billing?.asaasCustomerId,
            subscriptionId: billing?.asaasSubscriptionId,
            apiKey: settings.asaasApiKey,
            apiUrl: settings.asaasApiUrl,
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          if (!silent) {
            setFeedback(payload?.error || 'Não foi possível sincronizar os pagamentos com o Asaas.');
          } else {
            console.warn('Falha ao sincronizar pagamentos com o Asaas', payload);
          }
          return { inserted: 0 };
        }

        const payments = Array.isArray(payload?.payments) ? payload.payments : [];

        if (payments.length === 0) {
          if (!silent) {
            setFeedback('Nenhum pagamento recente foi encontrado no Asaas para este usuário.');
          }
          return { inserted: 0 };
        }

        const snapshot = [...(billing.history ?? [])];
        const processedIds = new Set<string>();
        let inserted = 0;

        payments.forEach((payment: any) => {
          const paymentId = payment?.id ?? payment?.paymentNumber?.toString();
          if (!paymentId || processedIds.has(paymentId)) {
            return;
          }
          processedIds.add(paymentId);

          const rawStatus = typeof payment?.status === 'string' ? payment.status.toUpperCase() : '';
          const paidStatuses = new Set([
            'RECEIVED',
            'CONFIRMED',
            'RECEIVED_IN_CASH',
            'RECEIVED_IN_BANK',
            'RECEIVED_IN_CREDIT_CARD',
            'RECEIVED_IN_DEBIT_CARD',
            'RECEIVED_IN_PIX',
          ]);
          const overdueStatuses = new Set([
            'OVERDUE',
            'EXPIRED',
            'CHARGED_OFF',
            'AWAITING_CHARGEBACK_REVERSAL',
            'CHARGEBACK_REQUESTED',
            'CHARGEBACK_DISPUTE',
          ]);

          let status: PaymentRecord['status'];
          if (paidStatuses.has(rawStatus)) {
            status = 'paid';
          } else if (overdueStatuses.has(rawStatus)) {
            status = 'overdue';
          } else {
            status = 'pending';
          }

          const amount = Number(payment?.value ?? payment?.netValue ?? payment?.amount ?? 0);
          const record: PaymentRecord = {
            id: paymentId,
            date:
              payment?.paymentDate ??
              payment?.confirmedDate ??
              payment?.clientPaymentDate ??
              payment?.dueDate ??
              new Date().toISOString(),
            dueDate: payment?.dueDate ?? payment?.originalDueDate ?? undefined,
            amount,
            status,
            description:
              typeof payment?.description === 'string' && payment.description.trim()
                ? payment.description.trim()
                : `Pagamento Asaas ${payment?.invoiceNumber ?? ''}`.trim(),
            method: payment?.billingType,
            asaasPaymentId: paymentId,
            rawStatus: rawStatus || undefined,
          };

          const existingIndex = snapshot.findIndex(
            (entry) => (entry.asaasPaymentId ?? entry.id) === paymentId,
          );
          const existingRecord = existingIndex !== -1 ? snapshot[existingIndex] : null;

          if (
            existingRecord &&
            existingRecord.status === record.status &&
            existingRecord.amount === record.amount &&
            existingRecord.date === record.date &&
            existingRecord.dueDate === record.dueDate &&
            existingRecord.description === record.description &&
            existingRecord.method === record.method &&
            existingRecord.rawStatus === record.rawStatus
          ) {
            return;
          }

          const targetStatus = status === 'paid' ? 'active' : status === 'overdue' ? 'overdue' : undefined;
          recordPayment(currentUser.id, record, targetStatus);

          if (existingIndex !== -1) {
            snapshot[existingIndex] = record;
          } else {
            snapshot.push(record);
          }

          inserted += 1;
        });

        if (!silent) {
          if (inserted === 0) {
            setFeedback('Pagamentos já registrados anteriormente. Nenhuma novidade encontrada.');
          } else {
            setFeedback(`Sincronização concluída: ${inserted} pagamento(s) adicionados a partir do Asaas.`);
          }
        }

        return { inserted };
      } catch (error) {
        console.error('Erro ao sincronizar pagamentos', error);
        if (!silent) {
          setFeedback('Não foi possível sincronizar os pagamentos no momento.');
        }
        return { inserted: 0 };
      } finally {
        if (!silent) {
          setSyncing(false);
        }
      }
    },
    [
      billing,
      currentUser.id,
      recordPayment,
      settings.asaasApiKey,
      settings.asaasApiUrl,
    ],
  );

  useEffect(() => {
    if (!billing) return;
    if (!hasAsaasKey) return;
    if (!billing.asaasCustomerId && !billing.asaasSubscriptionId) return;

    const hasPendingHistory = (billing.history ?? []).some((item) => item.status !== 'paid');
    const awaitingCheckout = Boolean(billing.checkoutUrl);
    const awaitingStatus = billing.status !== 'active';

    if (!hasPendingHistory && !awaitingCheckout && !awaitingStatus) {
      return;
    }

    let cancelled = false;
    let running = false;

    const attempt = async () => {
      if (cancelled || running) return;
      running = true;
      try {
        await syncPayments({ silent: true });
      } finally {
        running = false;
      }
    };

    attempt();
    const intervalId = window.setInterval(attempt, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    billing?.asaasCustomerId,
    billing?.asaasSubscriptionId,
    billing?.checkoutUrl,
    billing?.history,
    billing?.status,
    hasAsaasKey,
    syncPayments,
  ]);

  return (
    <ProtectedPage allowWhenRestricted>
      <section className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">Financeiro e Assinaturas</h1>
          <p className="text-sm text-slate-600">
            Acompanhe os planos contratados, gere cobranças via Asaas e mantenha seus usuários sempre ativos.
          </p>
        </header>

        {restricted && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-700">
            O acesso às demais funcionalidades está bloqueado até que a situação financeira seja regularizada.
            Gere um novo pagamento ou atualize a forma de cobrança abaixo.
          </div>
        )}

        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'overview'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Resumo financeiro
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('plans')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'plans'
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Planos e valores
            </button>
          </div>
        )}

        {(!isAdmin || activeTab === 'overview') && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {checkoutUrl && (
                <article className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900 shadow-sm lg:col-span-2">
                  <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
                        Checkout integrado
                      </p>
                      <h2 className="text-lg font-semibold">Finalize o pagamento diretamente na plataforma</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowCheckout((value) => !value)}
                        className="rounded-lg border border-emerald-400 bg-white px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                      >
                        {showCheckout ? 'Ocultar checkout' : 'Abrir checkout aqui'}
                      </button>
                      <a
                        href={checkoutUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700"
                      >
                        Abrir em nova aba
                      </a>
                    </div>
                  </header>
                  <p className="text-sm">
                    Utilize o checkout abaixo para concluir o pagamento. Após a confirmação no Asaas, o acesso será
                    liberado automaticamente conforme o plano contratado.
                  </p>
                  {autoOpenBlocked && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                      O navegador bloqueou a abertura automática do pagamento. Utilize os botões acima para acessar o
                      checkout do Asaas ou permita pop-ups deste site para agilizar as próximas cobranças.
                    </div>
                  )}
                  {showCheckout && (
                    <div className="overflow-hidden rounded-xl border border-emerald-200 bg-white">
                      <iframe src={checkoutUrl} title="Checkout Asaas" className="h-[560px] w-full" allow="payment" />
                    </div>
                  )}
                </article>
              )}

              <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <header className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Plano atual</p>
                    <h2 className="text-2xl font-semibold text-slate-900">
                      {billing?.planName ?? 'Plano não configurado'}
                    </h2>
                  </div>
                  {billing && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_CLASSES[billing.status]}`}
                    >
                      {STATUS_LABELS[billing.status]}
                    </span>
                  )}
                </header>

                {billing ? (
                  <dl className="grid gap-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between">
                      <dt>Valor padrão</dt>
                      <dd className="font-medium text-slate-900">
                        {currency.format(billing.customPrice ?? billing.price)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt>Periodicidade</dt>
                      <dd className="font-medium text-slate-900">
                        {plan?.period === 'annual'
                          ? 'Anual'
                          : plan?.period === 'semiannual'
                            ? 'Semestral'
                            : plan?.period === 'quarterly'
                              ? 'Trimestral'
                              : 'Mensal'}
                      </dd>
                    </div>
                    {billing.expiresAt && (
                      <div className="flex items-center justify-between">
                        <dt>Próxima renovação</dt>
                        <dd className="font-medium text-slate-900">{dateFormatter.format(new Date(billing.expiresAt))}</dd>
                      </div>
                    )}
                    {billing.lastPaymentAt && (
                      <div className="flex items-center justify-between">
                        <dt>Último pagamento</dt>
                        <dd className="font-medium text-slate-900">{dateFormatter.format(new Date(billing.lastPaymentAt))}</dd>
                      </div>
                    )}
                    {remainingTrialDays !== null && (
                      <div className="flex items-center justify-between">
                        <dt>Dias restantes de teste</dt>
                        <dd className="font-medium text-slate-900">{remainingTrialDays} dia(s)</dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <p className="text-sm text-slate-600">
                    Nenhum plano está vinculado ao seu usuário. Entre em contato com o administrador para definir o
                    pacote adequado.
                  </p>
                )}

                {billing?.checkoutUrl && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">Pagamento em andamento</p>
                    <p className="mt-1">
                      Você gerou um link recentemente. Caso precise reenviar ao financeiro, utilize o endereço:
                    </p>
                    <Link
                      href={billing.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Abrir checkout
                    </Link>
                  </div>
                )}
              </article>

              <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <header className="space-y-1">
                  <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Atualizar assinatura</p>
                  <h2 className="text-xl font-semibold text-slate-900">Gerar checkout Asaas</h2>
                </header>

                <div className="space-y-4 text-sm text-slate-600">
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plano</span>
                    <select
                      value={selectedPlanId ?? ''}
                      onChange={handlePlanChange}
                      disabled={!isAdmin}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      <option value="">Selecione um plano</option>
                      {selectablePlans.map((option: Plan) => (
                        <option key={option.id} value={option.id}>
                          {option.name} — {currency.format(option.price)} /
                          {option.period === 'annual'
                            ? 'ano'
                            : option.period === 'semiannual'
                              ? 'semestre'
                              : option.period === 'quarterly'
                                ? 'trimestre'
                                : 'mês'}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!isAdmin && (
                    <p className="text-xs text-slate-500">
                      O administrador define os planos e valores disponíveis. Solicite ajustes diretamente à equipe
                      responsável.
                    </p>
                  )}

                  {canCustomizePrice && (
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Valor negociado (R$)
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={customPrice}
                        onChange={(event) => setCustomPrice(event.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
                        placeholder="Informe apenas se houver acordo personalizado"
                      />
                    </label>
                  )}

                  <button
                    type="button"
                    onClick={handleGenerateCheckout}
                    disabled={loading || (!isAdmin && !billing?.planId)}
                    className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? 'Gerando checkout...' : 'Gerar link de pagamento'}
                  </button>

                  <p className="text-xs text-slate-500">
                    Utilizamos a API do Asaas para registrar as cobranças automaticamente. Após concluir o pagamento, o
                    acesso será liberado conforme a duração do plano selecionado.
                  </p>
                </div>
              </article>
            </div>

            {isAdmin && (
              <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <header className="space-y-1">
                  <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Integrações e credenciais</p>
                  <h2 className="text-xl font-semibold text-slate-900">Gerencie as chaves da plataforma</h2>
                </header>
                <p className="text-sm text-slate-600">
                  Todas as chaves de API, incluindo a credencial do Asaas, ficam concentradas na aba{' '}
                  <span className="font-semibold">Segurança</span>. Mantenha as integrações atualizadas por lá.
                </p>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                      hasAsaasKey ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {hasAsaasKey ? 'Chave Asaas configurada' : 'Chave Asaas pendente'}
                  </span>
                  <Link
                    href="/security"
                    className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    Abrir Segurança
                  </Link>
                </div>
              </article>
            )}

        {currentUser.role === 'master' && billing?.additionalSeatPrice && (
          <article
            id="additional-seats"
            className={`space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition ${
              highlightSeats ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-emerald-50' : ''
            }`}
          >
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Usuários adicionais</p>
                <h2 className="text-xl font-semibold text-slate-900">Gerencie o tamanho da sua equipe</h2>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold text-slate-900">{teamUsage} / {totalSeats} licenças utilizadas</p>
                <p className="text-xs text-slate-500">
                  {availableSeats >= 0
                    ? `${availableSeats} licença(s) disponíveis`
                    : `Necessário contratar ${Math.abs(availableSeats)} licença(s)`}
                </p>
              </div>
            </header>

            <p className="text-sm text-slate-600">
              Definimos um pacote inicial com {seatsIncluded} usuários inclusos. Para expandir sua operação,
              contrate licenças adicionais que são liberadas automaticamente após o pagamento.
              {billing.additionalSeatLimit
                ? ` Você pode contratar até ${billing.additionalSeatLimit} licença(s) extras neste plano.`
                : ''}
            </p>

            <form className="flex flex-col gap-4 md:flex-row" onSubmit={handleSeatCheckout}>
              <label className="flex flex-1 flex-col space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quantidade</span>
                <input
                  type="number"
                  min={1}
                  value={seatQuantity}
                  onChange={(event) => setSeatQuantity(Number(event.target.value))}
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none"
                />
              </label>
              <div className="flex flex-col justify-end gap-2">
                <span className="text-xs text-slate-500">
                  Valor unitário: {currency.format(billing.additionalSeatPrice)} / usuário
                </span>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Enviando...' : 'Contratar usuários adicionais'}
                </button>
              </div>
            </form>
          </article>
        )}

        <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Histórico financeiro</p>
              <h2 className="text-xl font-semibold text-slate-900">Pagamentos registrados</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {billing?.history?.length ? (
                <span className="text-xs text-slate-500">
                  Última atualização em{' '}
                  {dateFormatter.format(
                    new Date(
                      billing.history
                        .slice()
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date,
                    ),
                  )}
                </span>
              ) : null}
              {(billing?.asaasCustomerId || billing?.asaasSubscriptionId) && (
                <button
                  type="button"
                  onClick={() => syncPayments()}
                  disabled={syncing}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {syncing ? 'Atualizando...' : 'Atualizar pagamento'}
                </button>
              )}
            </div>
          </header>

          {billing?.history && billing.history.length > 0 ? (
            <ul className="divide-y divide-slate-200 text-sm">
              {billing.history.map((payment) => (
                <li key={payment.id} className="flex flex-wrap items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium text-slate-900">{payment.description}</p>
                    <p className="text-xs text-slate-500">{dateFormatter.format(new Date(payment.date))}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">{currency.format(payment.amount)}</p>
                    <p
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        payment.status === 'paid'
                          ? 'text-emerald-600'
                          : payment.status === 'pending'
                            ? 'text-sky-600'
                            : 'text-rose-600'
                      }`}
                    >
                      {payment.status === 'paid'
                        ? 'Pago'
                        : payment.status === 'pending'
                          ? 'Pendente'
                          : 'Vencido'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">Ainda não há pagamentos registrados para este usuário.</p>
          )}
        </article>
          </div>
        )}

        {feedback && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{feedback}</div>
        )}

        {isAdmin && activeTab === 'plans' && (
          <PlanManager plans={plans} onCreate={createPlan} onUpdate={updatePlan} />
        )}
      </section>
    </ProtectedPage>
  );
}

type PlanManagerProps = {
  plans: Plan[];
  onCreate: (input: {
    name: string;
    description: string;
    price: number;
    period: Plan['period'];
    durationInDays: number;
    allowCustomPrice?: boolean;
    seatsIncluded: number;
    additionalSeatPrice?: number;
    additionalSeatLimit?: number;
    trialDays?: number;
  }) => Plan;
  onUpdate: (
    planId: string,
    data: Partial<{
      name: string;
      description: string;
      price: number;
      period: Plan['period'];
      durationInDays: number;
      allowCustomPrice?: boolean;
      seatsIncluded: number;
      additionalSeatPrice?: number;
      additionalSeatLimit?: number;
      trialDays?: number;
    }>,
  ) => void;
};

function PlanManager({ plans, onCreate, onUpdate }: PlanManagerProps) {
  const sortedPlans = useMemo(() => plans.slice().sort((a, b) => a.name.localeCompare(b.name)), [plans]);
  const defaultFormState = useMemo(
    () => ({
      name: '',
      description: '',
      price: '',
      period: 'monthly' as Plan['period'],
      durationInDays: '30',
      seatsIncluded: '1',
      allowCustomPrice: false,
      additionalSeatPrice: '',
      additionalSeatLimit: '',
      trialDays: '',
    }),
    [],
  );

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(sortedPlans[0]?.id ?? null);
  const selectedPlan = useMemo(
    () => sortedPlans.find((plan) => plan.id === selectedPlanId) ?? null,
    [sortedPlans, selectedPlanId],
  );
  const [formState, setFormState] = useState(() => ({ ...defaultFormState }));
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (sortedPlans.length === 0) {
      setSelectedPlanId(null);
      return;
    }
    if (selectedPlanId && !sortedPlans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(sortedPlans[0].id);
    }
  }, [selectedPlanId, sortedPlans]);

  useEffect(() => {
    if (!selectedPlan) {
      setFormState({ ...defaultFormState });
      return;
    }

    setFormState({
      name: selectedPlan.name,
      description: selectedPlan.description,
      price: String(selectedPlan.price),
      period: selectedPlan.period,
      durationInDays: String(selectedPlan.durationInDays),
      seatsIncluded: String(selectedPlan.seatsIncluded),
      allowCustomPrice: Boolean(selectedPlan.allowCustomPrice),
      additionalSeatPrice: selectedPlan.additionalSeatPrice ? String(selectedPlan.additionalSeatPrice) : '',
      additionalSeatLimit: selectedPlan.additionalSeatLimit ? String(selectedPlan.additionalSeatLimit) : '',
      trialDays: selectedPlan.trialDays ? String(selectedPlan.trialDays) : '',
    });
  }, [defaultFormState, selectedPlan]);

  const handleInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name } = event.target;
    const value =
      event.target instanceof HTMLInputElement && event.target.type === 'checkbox'
        ? event.target.checked
        : event.target.value;
    setFormState((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleCreateNew = () => {
    setSelectedPlanId(null);
    setFormState({ ...defaultFormState });
    setFeedback('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback('');

    if (!formState.name.trim()) {
      setFeedback('Informe um nome para o plano.');
      return;
    }

    const price = Number(formState.price);
    const duration = Number(formState.durationInDays);
    const seats = Number(formState.seatsIncluded);
    const additionalSeatPrice = formState.additionalSeatPrice ? Number(formState.additionalSeatPrice) : undefined;
    const additionalSeatLimit = formState.additionalSeatLimit ? Number(formState.additionalSeatLimit) : undefined;
    const trialDays = formState.trialDays ? Number(formState.trialDays) : undefined;

    if ([price, duration, seats].some((value) => Number.isNaN(value))) {
      setFeedback('Verifique os valores numéricos informados.');
      return;
    }

    const payload = {
      name: formState.name.trim(),
      description: formState.description.trim(),
      price,
      period: formState.period,
      durationInDays: duration,
      allowCustomPrice: formState.allowCustomPrice,
      seatsIncluded: seats,
      additionalSeatPrice,
      additionalSeatLimit,
      trialDays,
    };

    if (selectedPlanId) {
      onUpdate(selectedPlanId, payload);
      setFeedback('Plano atualizado com sucesso.');
    } else {
      const created = onCreate(payload);
      setSelectedPlanId(created.id);
      setFeedback('Plano cadastrado com sucesso.');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Planos disponíveis</h2>
          <button
            type="button"
            onClick={handleCreateNew}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Novo plano
          </button>
        </div>

        <ul className="space-y-2 text-sm">
          {sortedPlans.length === 0 && (
            <li className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">
              Nenhum plano cadastrado até o momento.
            </li>
          )}
          {sortedPlans.map((plan) => (
            <li key={plan.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedPlanId(plan.id);
                  setFeedback('');
                }}
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                  plan.id === selectedPlanId
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="block text-sm font-semibold">{plan.name}</span>
                <span className="block text-xs opacity-80">{currency.format(plan.price)} / {plan.period}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {selectedPlan ? 'Editar plano existente' : 'Cadastrar novo plano'}
          </p>
          <h2 className="text-xl font-semibold text-slate-900">
            {selectedPlan ? selectedPlan.name : 'Defina os pacotes disponíveis'}
          </h2>
        </header>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Nome do plano*
            <input
              name="name"
              value={formState.name}
              onChange={handleInputChange}
              required
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Valor (R$)*
            <input
              name="price"
              value={formState.price}
              onChange={handleInputChange}
              required
              type="number"
              min={0}
              step={0.01}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 md:col-span-2">
            Descrição
            <textarea
              name="description"
              value={formState.description}
              onChange={handleInputChange}
              rows={3}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Periodicidade*
            <select
              name="period"
              value={formState.period}
              onChange={handleInputChange}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="monthly">Mensal</option>
              <option value="quarterly">Trimestral</option>
              <option value="semiannual">Semestral</option>
              <option value="annual">Anual</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Duração (dias)*
            <input
              name="durationInDays"
              value={formState.durationInDays}
              onChange={handleInputChange}
              type="number"
              min={1}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Usuários inclusos*
            <input
              name="seatsIncluded"
              value={formState.seatsIncluded}
              onChange={handleInputChange}
              type="number"
              min={1}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Valor usuário adicional
            <input
              name="additionalSeatPrice"
              value={formState.additionalSeatPrice}
              onChange={handleInputChange}
              type="number"
              min={0}
              step={0.01}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Limite usuários adicionais
            <input
              name="additionalSeatLimit"
              value={formState.additionalSeatLimit}
              onChange={handleInputChange}
              type="number"
              min={0}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Dias de teste
            <input
              name="trialDays"
              value={formState.trialDays}
              onChange={handleInputChange}
              type="number"
              min={0}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              name="allowCustomPrice"
              checked={formState.allowCustomPrice}
              onChange={handleInputChange}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
            />
            Permitir valor personalizado
          </label>

          <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCreateNew}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Limpar
            </button>
            <button
              type="submit"
              className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {selectedPlan ? 'Salvar alterações' : 'Cadastrar plano'}
            </button>
          </div>
        </form>

        {feedback && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{feedback}</div>
        )}
      </article>
    </div>
  );
}

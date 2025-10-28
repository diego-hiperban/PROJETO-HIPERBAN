'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '../context/AuthContext';
import { ProtectedPage } from '../components/ProtectedPage';
import { Product } from '@/lib/data';
import {
  CredihomeError,
  CredihomeProposalSummary,
  CredihomeProposalsResponse,
  fetchCredihomeProposals,
  submitCredihomeSimulation,
} from '@/lib/credihome';

const mortgageInitialState = {
  email: '',
  phone: '',
  propertyValue: '',
  downPayment: '',
  monthlyIncome: '',
  propertyState: '',
  propertyCity: '',
  propertyType: 'residential',
  financingGoal: 'purchase',
  term: '360',
};

type TrackingState = {
  loading: boolean;
  error: string;
  data: CredihomeProposalsResponse | null;
  lastUpdated?: string;
};

export default function StorePage() {
  const {
    products,
    currentUser,
    createOrder,
    getShareLink,
    getProductShareLink,
    getVisibleUsers,
    settings,
  } = useAuth();
  const [ownerId, setOwnerId] = useState(currentUser?.id ?? '');
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerDocument, setCustomerDocument] = useState('');
  const [feedback, setFeedback] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [mortgageForm, setMortgageForm] = useState(mortgageInitialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [activeTab, setActiveTab] = useState<'form' | 'tracking'>('form');
  const [trackingDocument, setTrackingDocument] = useState('');
  const [trackingProtocol, setTrackingProtocol] = useState('');
  const [trackingEmail, setTrackingEmail] = useState('');
  const [trackingState, setTrackingState] = useState<TrackingState>({ loading: false, error: '', data: null });

  const visibleUsers = getVisibleUsers();

  useEffect(() => {
    if (!ownerId && currentUser) {
      setOwnerId(currentUser.id);
    }
  }, [currentUser, ownerId]);

  useEffect(() => {
    if (!modalProduct) {
      setCustomerName('');
      setCustomerDocument('');
      setMortgageForm(mortgageInitialState);
      setModalError('');
      setIsSubmitting(false);
      setActiveTab('form');
      setTrackingDocument('');
      setTrackingProtocol('');
      setTrackingEmail('');
      setTrackingState({ loading: false, error: '', data: null });
    }
  }, [modalProduct]);

  const shareableUsers = useMemo(() => visibleUsers, [visibleUsers]);

  const credihomeCredentials = useMemo(
    () => ({
      apiKey: settings.credihomeApiKey ?? undefined,
      username: settings.credihomeApiUsername ?? undefined,
      password: settings.credihomeApiPassword ?? undefined,
      partnerCode: settings.credihomePartnerCode ?? undefined,
      baseUrl: settings.credihomeApiUrl ?? undefined,
    }),
    [
      settings.credihomeApiUrl,
      settings.credihomeApiKey,
      settings.credihomeApiUsername,
      settings.credihomeApiPassword,
      settings.credihomePartnerCode,
    ],
  );

  const hasCredihomeCredentials = Boolean(
    credihomeCredentials.apiKey && credihomeCredentials.username && credihomeCredentials.password,
  );

  const parseNumberField = (value: string) => {
    if (!value) return 0;
    return Number(value.replace(/\./g, '').replace(',', '.')) || 0;
  };

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modalProduct || !ownerId || !customerName) return;
    const order = createOrder({
      productId: modalProduct.id,
      customerName,
      customerDocument,
      referrerId: ownerId,
    });
    setFeedback(`Pedido criado para ${customerName}. ID: ${order.id}`);
    setModalProduct(null);
  };

  const loadCredihomeTracking = async (params: { document?: string; protocol?: string; email?: string }) => {
    if (!hasCredihomeCredentials) {
      setTrackingState((prev) => ({ ...prev, loading: false, error: 'Cadastre as credenciais da Credihome na aba Segurança antes de consultar o andamento.' }));
      return;
    }

    setTrackingState((prev) => ({ ...prev, loading: true, error: '' }));

    try {
      const result = await fetchCredihomeProposals(params, { credentials: credihomeCredentials });
      setTrackingState({
        loading: false,
        error: '',
        data: result,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      const message =
        error instanceof CredihomeError
          ? `${error.message}${error.details ? ` Detalhes: ${JSON.stringify(error.details)}` : ''}`
          : error instanceof Error
          ? error.message
          : 'Não foi possível consultar o andamento das propostas agora.';

      setTrackingState((prev) => ({ ...prev, loading: false, error: message }));
    }
  };

  const handleCredihomeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modalProduct || !ownerId || !customerName) {
      setModalError('Preencha os dados obrigatórios antes de enviar.');
      return;
    }

    if (!customerDocument) {
      setModalError('Informe o CPF do cliente para prosseguir.');
      return;
    }

    if (!mortgageForm.email || !mortgageForm.phone) {
      setModalError('Informe e-mail e telefone para enviar a simulação.');
      return;
    }

    if (!mortgageForm.propertyState || !mortgageForm.propertyCity) {
      setModalError('Informe cidade e estado do imóvel.');
      return;
    }

    if (!hasCredihomeCredentials) {
      setModalError('Cadastre chave, usuário e senha da Credihome na aba Segurança antes de enviar a simulação.');
      return;
    }

    const propertyValue = parseNumberField(mortgageForm.propertyValue);
    const entryValue = parseNumberField(mortgageForm.downPayment);
    const monthlyIncome = parseNumberField(mortgageForm.monthlyIncome);

    if (!propertyValue || propertyValue <= 0) {
      setModalError('Informe o valor aproximado do imóvel.');
      return;
    }

    setIsSubmitting(true);
    setModalError('');
    setFeedback('');

    try {
      const payload = {
        channel: modalProduct.integration?.type === 'credihome' ? modalProduct.integration.partnerCode : undefined,
        customer: {
          name: customerName,
          email: mortgageForm.email,
          phone: mortgageForm.phone,
          document: customerDocument,
        },
        property: {
          value: propertyValue,
          state: mortgageForm.propertyState,
          city: mortgageForm.propertyCity,
          type: mortgageForm.propertyType as 'residential' | 'commercial',
        },
        financing: {
          goal: mortgageForm.financingGoal as 'purchase' | 'refinancing',
          entryValue,
          creditValue: propertyValue - entryValue,
          monthlyIncome,
          term: Number(mortgageForm.term) || undefined,
        },
      };

      const response = await submitCredihomeSimulation(payload, { credentials: credihomeCredentials });

      const order = createOrder({
        productId: modalProduct.id,
        customerName,
        customerDocument,
        referrerId: ownerId,
      });

      setFeedback(
        `Simulação enviada para a Credihome! Protocolo ${
          response?.id ?? order.id
        }. Status inicial: ${response?.status ?? 'pendente'}.`,
      );

      setCustomerName('');
      setCustomerDocument('');
      setMortgageForm(mortgageInitialState);

      if (customerDocument) {
        setTrackingDocument(customerDocument);
      }
      if (response?.id) {
        setTrackingProtocol(response.id);
      }
      setActiveTab('tracking');
      loadCredihomeTracking({
        document: customerDocument || undefined,
        protocol: response?.id,
      });
    } catch (error) {
      if (error instanceof CredihomeError) {
        const details =
          typeof error.details === 'string'
            ? error.details
            : error.details
            ? JSON.stringify(error.details)
            : '';
        setModalError(`${error.message}${details ? ` Detalhes: ${details}` : ''}`);
      } else {
        setModalError('Não foi possível se conectar à Credihome. Tente novamente em instantes.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopyMessage('Link copiado para a área de transferência!');
      setTimeout(() => setCopyMessage(''), 2500);
    } catch (error) {
      console.error('Erro ao copiar link', error);
      setCopyMessage('Não foi possível copiar o link automaticamente. Selecione e copie manualmente.');
      setTimeout(() => setCopyMessage(''), 4000);
    }
  };

  const allowTeamSelection = currentUser?.role !== 'user';
  const isCredihomeProduct = modalProduct?.integration?.type === 'credihome';

  const formatCurrency = (value: unknown) => {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    if (typeof value === 'string') {
      const numeric = Number(value.replace(/[^0-9,.-]/g, '').replace(',', '.'));
      if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
        return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      }
    }
    return null;
  };

  const renderProposal = (proposal: CredihomeProposalSummary) => {
    const formattedValue = formatCurrency(proposal.offerValue);
    const formattedRate =
      typeof proposal.rate === 'number'
        ? `${proposal.rate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}% a.a.`
        : typeof proposal.rate === 'string'
        ? proposal.rate
        : null;

    return (
      <article key={proposal.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Instituição</p>
            <h4 className="text-lg font-semibold text-slate-900">{proposal.institution}</h4>
            <p className="text-sm font-medium text-slate-700">Status: {proposal.status}</p>
            {proposal.stage && <p className="text-xs text-slate-500">Etapa: {proposal.stage}</p>}
            {proposal.updatedAt && (
              <p className="text-xs text-slate-500">Atualizado em: {new Date(proposal.updatedAt).toLocaleString('pt-BR')}</p>
            )}
          </div>
          <div className="flex flex-col items-start gap-1 text-right md:items-end">
            {formattedValue && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Valor estimado: {formattedValue}
              </span>
            )}
            {formattedRate && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Taxa: {formattedRate}
              </span>
            )}
          </div>
        </div>
        {proposal.timeline.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Andamento</p>
            <ol className="mt-2 space-y-2">
              {proposal.timeline.map((entry) => (
                <li key={entry.id} className="rounded-lg bg-white/70 p-3 text-sm text-slate-700 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{entry.label}</span>
                    {entry.date && (
                      <span className="text-xs text-slate-500">{new Date(entry.date).toLocaleString('pt-BR')}</span>
                    )}
                  </div>
                  {entry.description && <p className="mt-1 text-xs text-slate-600">{entry.description}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}
        <details className="mt-4 text-sm text-slate-600">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ver dados completos
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900/90 p-3 text-xs text-emerald-100">
            {JSON.stringify(proposal.raw, null, 2)}
          </pre>
        </details>
      </article>
    );
  };

  return (
    <ProtectedPage>
      <section className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">Loja Online</h1>
          <p className="text-sm text-slate-600">
            Compartilhe ofertas com seus clientes, gere links rastreáveis e encaminhe oportunidades para a esteira.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {products.map((product) => {
            const isCredihome = product.integration?.type === 'credihome';
            const openProductModal = () => {
              setModalProduct(product);
              if (isCredihome) {
                setActiveTab('form');
              }
            };

            return (
              <article
                key={product.id}
                className={`flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition ${
                  isCredihome ? 'cursor-pointer hover:-translate-y-1 hover:shadow-md' : ''
                }`}
                onClick={() => isCredihome && openProductModal()}
                role={isCredihome ? 'button' : undefined}
                tabIndex={isCredihome ? 0 : undefined}
                onKeyDown={(event) => {
                  if (!isCredihome) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openProductModal();
                  }
                }}
              >
                {product.imageUrl && (
                  <div className="relative mb-4 h-28 w-full overflow-hidden rounded-xl bg-slate-100">
                    <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
                    <span>{product.category ?? 'Produto'}</span>
                    {product.provider && <span className="font-semibold text-slate-700">{product.provider}</span>}
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">{product.name}</h2>
                  <p className="text-sm text-slate-600">{product.description}</p>
                </div>
                <div className="mt-6 flex flex-col gap-3 text-sm">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openProductModal();
                    }}
                    className="w-full rounded-full bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800"
                  >
                    {isCredihome ? 'Acessar jornada' : 'Indicar cliente'}
                  </button>
                  {currentUser && (
                    <button
                      type="button"
                      onClick={() => handleCopy(getProductShareLink(product.id, currentUser.id))}
                      className="w-full rounded-full border border-slate-200 px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Compartilhar link
                    </button>
                  )}
                  {product.link && (
                    <a
                      href={product.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-slate-500 underline"
                    >
                      Ver material do produto
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Links rastreáveis da equipe</h2>
          <p className="text-sm text-slate-600">
            Envie o link da loja personalizada de cada membro para acompanhar cadastros automaticamente.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {shareableUsers.map((user) => (
              <div key={user.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">{user.role}</p>
                <p className="mt-2 break-all font-mono text-xs text-slate-600">{getShareLink(user.id)}</p>
              </div>
            ))}
          </div>
          {copyMessage && <p className="mt-4 text-sm text-emerald-600">{copyMessage}</p>}
        </div>

        {modalProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Cadastrar oportunidade</p>
                  <h3 className="text-xl font-semibold text-slate-900">{modalProduct.name}</h3>
                  <p className="text-sm text-slate-600">
                    {isCredihomeProduct
                      ? 'Os dados serão enviados automaticamente para a Credihome e o protocolo ficará disponível na esteira.'
                      : 'Informe os dados básicos do cliente para iniciar a negociação.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalProduct(null)}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-200"
                >
                  Fechar
                </button>
              </div>

              {isCredihomeProduct && (
                <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <button
                    type="button"
                    onClick={() => setActiveTab('form')}
                    className={`rounded-full px-3 py-1 transition ${
                      activeTab === 'form'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Nova simulação
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('tracking')}
                    className={`rounded-full px-3 py-1 transition ${
                      activeTab === 'tracking'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Andamento das propostas
                  </button>
                </div>
              )}

              {activeTab === 'tracking' && isCredihomeProduct ? (
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                      Protocolo
                      <input
                        value={trackingProtocol}
                        onChange={(event) => setTrackingProtocol(event.target.value)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        placeholder="Informe o protocolo"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                      CPF do cliente
                      <input
                        value={trackingDocument}
                        onChange={(event) => setTrackingDocument(event.target.value)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        placeholder="000.000.000-00"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                      E-mail do cliente
                      <input
                        value={trackingEmail}
                        onChange={(event) => setTrackingEmail(event.target.value)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                        placeholder="cliente@email.com"
                        type="email"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() =>
                        loadCredihomeTracking({
                          protocol: trackingProtocol || undefined,
                          document: trackingDocument || undefined,
                          email: trackingEmail || undefined,
                        })
                      }
                      className="rounded-full bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800"
                      disabled={trackingState.loading}
                    >
                      {trackingState.loading ? 'Consultando...' : 'Consultar andamento'}
                    </button>
                    {trackingState.lastUpdated && (
                      <span className="text-xs text-slate-500">
                        Última atualização: {new Date(trackingState.lastUpdated).toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>
                  {trackingState.error && <p className="text-sm text-rose-600">{trackingState.error}</p>}
                  <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-2">
                    {trackingState.loading && !trackingState.data && (
                      <p className="text-sm text-slate-600">Carregando propostas...</p>
                    )}
                    {trackingState.data && trackingState.data.proposals.length === 0 && !trackingState.loading && (
                      <p className="text-sm text-slate-600">
                        Não encontramos propostas com os filtros informados. Ajuste os dados e tente novamente.
                      </p>
                    )}
                    {trackingState.data && trackingState.data.proposals.map((proposal) => renderProposal(proposal))}
                    {trackingState.data && (
                      <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Ver resposta bruta da API
                        </summary>
                        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900/90 p-3 text-xs text-emerald-100">
                          {JSON.stringify(trackingState.data.raw, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={isCredihomeProduct ? handleCredihomeSubmit : handleManualSubmit} className="mt-6 grid grid-cols-1 gap-4">
                  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                    Nome do cliente
                    <input
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      placeholder="Digite o nome completo"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                    CPF do cliente
                    <input
                      value={customerDocument}
                      onChange={(event) => setCustomerDocument(event.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      placeholder="000.000.000-00"
                      required={isCredihomeProduct}
                    />
                  </label>
                  {isCredihomeProduct && (
                    <>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                          E-mail
                          <input
                            value={mortgageForm.email}
                            onChange={(event) => setMortgageForm((prev) => ({ ...prev, email: event.target.value }))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            placeholder="cliente@email.com"
                            required
                            type="email"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                          Telefone
                          <input
                            value={mortgageForm.phone}
                            onChange={(event) => setMortgageForm((prev) => ({ ...prev, phone: event.target.value }))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            placeholder="(11) 99999-9999"
                            required
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                          Estado do imóvel
                          <input
                            value={mortgageForm.propertyState}
                            onChange={(event) =>
                              setMortgageForm((prev) => ({ ...prev, propertyState: event.target.value.toUpperCase() }))
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            placeholder="UF"
                            required
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                          Cidade do imóvel
                          <input
                            value={mortgageForm.propertyCity}
                            onChange={(event) => setMortgageForm((prev) => ({ ...prev, propertyCity: event.target.value }))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            placeholder="Cidade"
                            required
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                          Valor do imóvel (R$)
                          <input
                            value={mortgageForm.propertyValue}
                            onChange={(event) => setMortgageForm((prev) => ({ ...prev, propertyValue: event.target.value }))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            placeholder="350000"
                            required
                            inputMode="decimal"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                          Entrada (R$)
                          <input
                            value={mortgageForm.downPayment}
                            onChange={(event) => setMortgageForm((prev) => ({ ...prev, downPayment: event.target.value }))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            placeholder="70000"
                            inputMode="decimal"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                          Renda mensal (R$)
                          <input
                            value={mortgageForm.monthlyIncome}
                            onChange={(event) => setMortgageForm((prev) => ({ ...prev, monthlyIncome: event.target.value }))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            placeholder="12000"
                            inputMode="decimal"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                          Prazo desejado (meses)
                          <input
                            value={mortgageForm.term}
                            onChange={(event) => setMortgageForm((prev) => ({ ...prev, term: event.target.value }))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                            placeholder="360"
                            inputMode="numeric"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                          Tipo do imóvel
                          <select
                            value={mortgageForm.propertyType}
                            onChange={(event) =>
                              setMortgageForm((prev) => ({ ...prev, propertyType: event.target.value as 'residential' | 'commercial' }))
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                          >
                            <option value="residential">Residencial</option>
                            <option value="commercial">Comercial</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                          Objetivo da operação
                          <select
                            value={mortgageForm.financingGoal}
                            onChange={(event) =>
                              setMortgageForm((prev) => ({ ...prev, financingGoal: event.target.value as 'purchase' | 'refinancing' }))
                            }
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                          >
                            <option value="purchase">Compra</option>
                            <option value="refinancing">Refinanciamento</option>
                          </select>
                        </label>
                      </div>
                    </>
                  )}
                  {allowTeamSelection && (
                    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                      Responsável pela venda
                      <select
                        value={ownerId}
                        onChange={(event) => setOwnerId(event.target.value)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      >
                        {shareableUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isCredihomeProduct ? 'Enviar simulação' : 'Enviar para a esteira'}
                  </button>
                  {modalError && <p className="text-sm text-rose-600">{modalError}</p>}
                </form>
              )}
            </div>
          </div>
        )}

        {feedback && <p className="text-sm text-emerald-600">{feedback}</p>}
      </section>
    </ProtectedPage>
  );
}

'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '../context/AuthContext';
import { ProtectedPage } from '../components/ProtectedPage';
import { Product } from '@/lib/data';
import { CredihomeError, submitCredihomeSimulation } from '@/lib/credihome';

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

export default function StorePage() {
  const {
    products,
    currentUser,
    createOrder,
    getShareLink,
    getProductShareLink,
    getVisibleUsers,
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
    }
  }, [modalProduct]);

  const shareableUsers = useMemo(() => visibleUsers, [visibleUsers]);

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

      const response = await submitCredihomeSimulation(payload);

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
      setModalProduct(null);
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
          {products.map((product) => (
            <article key={product.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                  onClick={() => setModalProduct(product)}
                  className="w-full rounded-full bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800"
                >
                  Indicar cliente
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
          ))}
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
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
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
              <form
                onSubmit={isCredihomeProduct ? handleCredihomeSubmit : handleManualSubmit}
                className="mt-6 grid grid-cols-1 gap-4"
              >
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Nome do cliente
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none fo
cus:ring-2 focus:ring-slate-200"
                    placeholder="Digite o nome completo"
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  CPF do cliente
                  <input
                    value={customerDocument}
                    onChange={(event) => setCustomerDocument(event.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none fo
cus:ring-2 focus:ring-slate-200"
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
                          onChange={(event) =>
                            setMortgageForm((prev) => ({ ...prev, email: event.target.value }))
                          }
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-no
ne focus:ring-2 focus:ring-slate-200"
                          placeholder="cliente@email.com"
                          required
                          type="email"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                        Telefone
                        <input
                          value={mortgageForm.phone}
                          onChange={(event) =>
                            setMortgageForm((prev) => ({ ...prev, phone: event.target.value }))
                          }
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-no
ne focus:ring-2 focus:ring-slate-200"
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
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-no
ne focus:ring-2 focus:ring-slate-200"
                          placeholder="UF"
                          required
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                        Cidade do imóvel
                        <input
                          value={mortgageForm.propertyCity}
                          onChange={(event) =>
                            setMortgageForm((prev) => ({ ...prev, propertyCity: event.target.value }))
                          }
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-no
ne focus:ring-2 focus:ring-slate-200"
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
                          onChange={(event) =>
                            setMortgageForm((prev) => ({ ...prev, propertyValue: event.target.value }))
                          }
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-no
ne focus:ring-2 focus:ring-slate-200"
                          placeholder="350000"
                          required
                          inputMode="decimal"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                        Entrada (R$)
                        <input
                          value={mortgageForm.downPayment}
                          onChange={(event) =>
                            setMortgageForm((prev) => ({ ...prev, downPayment: event.target.value }))
                          }
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-no
ne focus:ring-2 focus:ring-slate-200"
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
                          onChange={(event) =>
                            setMortgageForm((prev) => ({ ...prev, monthlyIncome: event.target.value }))
                          }
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-no
ne focus:ring-2 focus:ring-slate-200"
                          placeholder="12000"
                          inputMode="decimal"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                        Prazo desejado (meses)
                        <input
                          value={mortgageForm.term}
                          onChange={(event) =>
                            setMortgageForm((prev) => ({ ...prev, term: event.target.value }))
                          }
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-no
ne focus:ring-2 focus:ring-slate-200"
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
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-no
ne focus:ring-2 focus:ring-slate-200"
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
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-no
ne focus:ring-2 focus:ring-slate-200"
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
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none fo
cus:ring-2 focus:ring-slate-200"
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

            </div>
          </div>
        )}

        {feedback && <p className="text-sm text-emerald-600">{feedback}</p>}
      </section>
    </ProtectedPage>
  );
}

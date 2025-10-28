'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
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

export default function PublicStorePage() {
  const params = useParams<{ userId: string }>();
  const searchParams = useSearchParams();
  const { users, products, createOrder, settings } = useAuth();

  const owner = useMemo(() => users.find((user) => user.id === params.userId) ?? null, [users, params.userId]);
  const [selectedProduct, setSelectedProduct] = useState(() => searchParams.get('produto') ?? '');
  const [customerName, setCustomerName] = useState('');
  const [customerDocument, setCustomerDocument] = useState('');
  const [feedback, setFeedback] = useState('');
  const [mortgageForm, setMortgageForm] = useState(mortgageInitialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const productId = searchParams.get('produto');
    if (productId) {
      setSelectedProduct(productId);
    }
  }, [searchParams]);

  const selectedProductData = useMemo(() => products.find((product) => product.id === selectedProduct) ?? null, [products, selectedProduct]);
  const isCredihomeProduct = selectedProductData?.integration?.type === 'credihome';

  const credihomeCredentials = useMemo(
    () => ({
      apiKey: settings.credihomeApiKey ?? undefined,
      username: settings.credihomeApiUsername ?? undefined,
      password: settings.credihomeApiPassword ?? undefined,
      partnerCode: settings.credihomePartnerCode ?? undefined,
    }),
    [
      settings.credihomeApiKey,
      settings.credihomeApiUsername,
      settings.credihomeApiPassword,
      settings.credihomePartnerCode,
    ],
  );

  const hasCredihomeCredentials = Boolean(
    credihomeCredentials.apiKey && credihomeCredentials.username && credihomeCredentials.password,
  );

  useEffect(() => {
    setSubmitError('');
    if (!isCredihomeProduct) {
      setMortgageForm(mortgageInitialState);
    }
  }, [isCredihomeProduct]);

  const parseNumberField = (value: string) => {
    if (!value) return 0;
    return Number(value.replace(/\./g, '').replace(',', '.')) || 0;
  };

  if (!owner) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Link não encontrado</h1>
        <p className="text-sm text-slate-600">
          O usuário associado a este link não foi localizado. Confirme se o endereço está correto ou entre em contato com a equipe
          Hiperban.
        </p>
        <Link href="/login" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Acessar plataforma
        </Link>
      </main>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProductData || !customerName) {
      setSubmitError('Selecione um produto e informe seu nome.');
      return;
    }

    if (isCredihomeProduct && !customerDocument) {
      setSubmitError('Informe o CPF para avançar com a simulação.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    setFeedback('');

    try {
      if (isCredihomeProduct) {
        if (!mortgageForm.email || !mortgageForm.phone) {
          setIsSubmitting(false);
          setSubmitError('Preencha e-mail e telefone para seguirmos com o atendimento.');
          return;
        }
        if (!mortgageForm.propertyState || !mortgageForm.propertyCity) {
          setIsSubmitting(false);
          setSubmitError('Informe a cidade e o estado do imóvel.');
          return;
        }
        const propertyValue = parseNumberField(mortgageForm.propertyValue);
        const entryValue = parseNumberField(mortgageForm.downPayment);
        const monthlyIncome = parseNumberField(mortgageForm.monthlyIncome);

        if (!propertyValue || propertyValue <= 0) {
          setIsSubmitting(false);
          setSubmitError('Informe o valor estimado do imóvel.');
          return;
        }

        if (!hasCredihomeCredentials) {
          setIsSubmitting(false);
          setSubmitError('Simulações temporariamente indisponíveis. Configure as credenciais Credihome na plataforma.');
          return;
        }

        await submitCredihomeSimulation({
          channel: selectedProductData.integration?.type === 'credihome'
            ? selectedProductData.integration.partnerCode
            : undefined,
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
        }, { credentials: credihomeCredentials });
      }

      createOrder({
        productId: selectedProductData.id,
        customerName,
        customerDocument,
        referrerId: owner.id,
      });

      setCustomerName('');
      setCustomerDocument('');
      setMortgageForm(mortgageInitialState);
      setFeedback(
        isCredihomeProduct
          ? 'Simulação enviada! Nossa equipe entrará em contato para apresentar as propostas.'
          : 'Recebemos seus dados! A equipe entrará em contato para concluir a contratação.',
      );
    } catch (error) {
      if (error instanceof CredihomeError) {
        const details =
          typeof error.details === 'string'
            ? error.details
            : error.details
            ? JSON.stringify(error.details)
            : '';
        setSubmitError(`${error.message}${details ? ` Detalhes: ${details}` : ''}`);
      } else {
        setSubmitError('Não foi possível registrar sua solicitação agora. Tente novamente em instantes.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-wide text-slate-500">Loja digital Hiperban</p>
        <h1 className="text-3xl font-semibold text-slate-900">Atendimento de {owner.name}</h1>
        <p className="text-sm text-slate-600">
          Escolha um produto e deixe seus dados para que possamos continuar o atendimento.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {products.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => setSelectedProduct(product.id)}
            className={`flex flex-col gap-4 rounded-2xl border p-6 text-left transition ${
              selectedProduct === product.id
                ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                : 'border-slate-200 bg-white text-slate-900 shadow-sm hover:border-slate-300'
            }`}
          >
            {product.imageUrl && (
              <div className="relative h-28 w-full overflow-hidden rounded-xl bg-slate-100">
                <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
              </div>
            )}
            <div className="flex flex-col gap-1 text-xs uppercase tracking-wide">
              <span>{product.category ?? 'Produto'}</span>
              {product.provider && <span className="font-semibold">{product.provider}</span>}
            </div>
            <h2 className="text-lg font-semibold">{product.name}</h2>
            <p className="text-sm opacity-80">{product.description}</p>
          </button>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Cadastre-se para ser atendido</h2>
        <p className="text-sm text-slate-600">
          Preencha os dados abaixo e a equipe entrará em contato para finalizar sua contratação.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 md:col-span-2">
            Produto escolhido
            <select
              value={selectedProduct}
              onChange={(event) => setSelectedProduct(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              required
            >
              <option value="" disabled>
                Selecione uma opção
              </option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Nome completo
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Digite seu nome"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            CPF
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
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Estado do imóvel
                <input
                  value={mortgageForm.propertyState}
                  onChange={(event) => setMortgageForm((prev) => ({ ...prev, propertyState: event.target.value.toUpperCase() }))}
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
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Tipo do imóvel
                <select
                  value={mortgageForm.propertyType}
                  onChange={(event) => setMortgageForm((prev) => ({ ...prev, propertyType: event.target.value as 'residential' | 'commercial' }))}
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
                  onChange={(event) => setMortgageForm((prev) => ({ ...prev, financingGoal: event.target.value as 'purchase' | 'refinancing' }))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="purchase">Compra</option>
                  <option value="refinancing">Refinanciamento</option>
                </select>
              </label>
            </>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="md:col-span-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isCredihomeProduct ? 'Enviar simulação' : 'Enviar dados'}
          </button>
        </form>

        {submitError && <p className="mt-4 text-sm text-rose-600">{submitError}</p>}
        {feedback && <p className="mt-4 text-sm text-emerald-600">{feedback}</p>}
      </section>
    </main>
  );
}

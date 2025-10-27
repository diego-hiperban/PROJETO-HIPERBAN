'use client';

import { FormEvent, useMemo, useState } from 'react';
import { ProtectedPage } from '../components/ProtectedPage';
import { useAuth } from '../context/AuthContext';

const initialForm = {
  name: '',
  description: '',
  price: '0',
  category: '',
  provider: '',
  link: '',
  imageUrl: '',
  integrationType: 'none',
  integrationPartnerCode: '',
};

export default function ProductsAdminPage() {
  const { products, createProduct, updateProduct } = useAuth();
  const [formData, setFormData] = useState(initialForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedId) ?? null,
    [products, selectedId],
  );

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.name || !formData.description) return;
    const price = Number(formData.price.replace(',', '.')) || 0;
    const product = createProduct({
      name: formData.name,
      description: formData.description,
      price,
      category: formData.category || undefined,
      provider: formData.provider || undefined,
      link: formData.link || undefined,
      imageUrl: formData.imageUrl || undefined,
      integration:
        formData.integrationType === 'credihome'
          ? {
              type: 'credihome',
              partnerCode: formData.integrationPartnerCode || undefined,
            }
          : undefined,
    });
    setFeedback(`Produto ${product.name} cadastrado com sucesso!`);
    setFormData(initialForm);
    setSelectedId(product.id);
  };

  const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProduct) return;
    updateProduct(selectedProduct.id, {
      description: formData.description,
      category: formData.category || undefined,
      provider: formData.provider || undefined,
      link: formData.link || undefined,
      imageUrl: formData.imageUrl || undefined,
      price: Number(formData.price.replace(',', '.')) || 0,
      name: formData.name,
      integration:
        formData.integrationType === 'credihome'
          ? {
              type: 'credihome',
              partnerCode: formData.integrationPartnerCode || undefined,
            }
          : undefined,
    });
    setFeedback(`Produto ${formData.name} atualizado.`);
  };

  const handleSelect = (productId: string) => {
    setSelectedId(productId);
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      category: product.category ?? '',
      provider: product.provider ?? '',
      link: product.link ?? '',
      imageUrl: product.imageUrl ?? '',
      integrationType: product.integration?.type ?? 'none',
      integrationPartnerCode:
        product.integration?.type === 'credihome' ? product.integration.partnerCode ?? '' : '',
    });
  };

  return (
    <ProtectedPage allowedRoles={['admin']}>
      <section className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">Catálogo da Loja</h1>
          <p className="text-sm text-slate-600">
            Cadastre e mantenha os produtos que ficarão disponíveis para os usuários compartilharem com seus clientes.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Produtos publicados</h2>
              <p className="text-xs text-slate-500">Clique para editar os detalhes</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleSelect(product.id)}
                  className={`rounded-2xl border px-5 py-4 text-left transition ${
                    selectedId === product.id
                      ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                      : 'border-slate-200 bg-white shadow-sm hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs uppercase tracking-wide">{product.category ?? 'Produto'}</p>
                  <p className="mt-2 text-lg font-semibold">{product.name}</p>
                  <p className="mt-1 text-sm opacity-80">{product.provider ?? '—'}</p>
                  <p className="mt-3 text-xs opacity-70">{product.description}</p>
                </button>
              ))}
              {products.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  Nenhum produto cadastrado até o momento. Use o formulário ao lado para adicionar.
                </p>
              )}
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {selectedProduct ? 'Editar produto' : 'Novo produto'}
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                {selectedProduct ? selectedProduct.name : 'Adicionar oferta'}
              </h2>
            </div>
            <form onSubmit={selectedProduct ? handleUpdate : handleCreate} className="grid grid-cols-1 gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Nome
                <input
                  value={formData.name}
                  onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Nome comercial do produto"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Descrição
                <textarea
                  value={formData.description}
                  onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                  className="min-h-[100px] rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Resumo do benefício para o cliente"
                  required
                />
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Categoria
                  <input
                    value={formData.category}
                    onChange={(event) => setFormData((prev) => ({ ...prev, category: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="Ex: Crédito"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Parceiro / Banco
                  <input
                    value={formData.provider}
                    onChange={(event) => setFormData((prev) => ({ ...prev, provider: event.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="Ex: Banco PAN"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Valor de referência
                <input
                  value={formData.price}
                  onChange={(event) => setFormData((prev) => ({ ...prev, price: event.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="0,00"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Link de material / regulamento
                <input
                  value={formData.link}
                  onChange={(event) => setFormData((prev) => ({ ...prev, link: event.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="https://"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Imagem (URL pública)
                <input
                  value={formData.imageUrl}
                  onChange={(event) => setFormData((prev) => ({ ...prev, imageUrl: event.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="https://cdn..."
                />
              </label>
              <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Integração automática</p>
                  <p className="text-slate-600">
                    Defina se o produto gera cadastros diretamente via API parceira quando um cliente é indicado.
                  </p>
                </div>
                <label className="flex flex-col gap-1 font-medium text-slate-700">
                  Serviço conectado
                  <select
                    value={formData.integrationType}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, integrationType: event.target.value }))
                    }
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focu
s:ring-2 focus:ring-slate-200"
                  >
                    <option value="none">Sem integração automática</option>
                    <option value="credihome">Credihome • Crédito Imobiliário</option>
                  </select>
                </label>
                {formData.integrationType === 'credihome' && (
                  <label className="flex flex-col gap-1 font-medium text-slate-700">
                    Código do parceiro (opcional)
                    <input
                      value={formData.integrationPartnerCode}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, integrationPartnerCode: event.target.value }))
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focu
s:ring-2 focus:ring-slate-200"
                      placeholder="Informe o código fornecido pela Credihome"
                    />
                    <span className="text-xs font-normal text-slate-500">
                      Será enviado no payload para rastrear o canal no parceiro.
                    </span>
                  </label>
                )}
              </div>
              <button
                type="submit"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {selectedProduct ? 'Salvar alterações' : 'Cadastrar produto'}
              </button>
            </form>
            {feedback && <p className="text-sm text-emerald-600">{feedback}</p>}
          </div>
        </div>
      </section>
    </ProtectedPage>
  );
}

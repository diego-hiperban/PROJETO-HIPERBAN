'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { ProtectedPage } from '../components/ProtectedPage';
import { useAuth } from '../context/AuthContext';

type CredentialScope = 'integration' | 'platform' | 'product' | 'user';

const SCOPE_LABELS: Record<CredentialScope, string> = {
  integration: 'Integração externa',
  platform: 'Plataforma',
  product: 'Produto',
  user: 'Usuário',
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'credencial';

export default function SecurityPage() {
  const { settings, updateSettings } = useAuth();
  const credentials = settings.credentials ?? [];
  type Credential = (typeof credentials)[number];
  const [selectedId, setSelectedId] = useState<string | null>(credentials[0]?.id ?? null);
  const [formFeedback, setFormFeedback] = useState('');
  const [asaasFeedback, setAsaasFeedback] = useState('');
  const [asaasForm, setAsaasForm] = useState({
    apiKey: settings.asaasApiKey ?? '',
    apiUrl: settings.asaasApiUrl ?? '',
  });
  const [credihomeFeedback, setCredihomeFeedback] = useState('');
  const [credihomeForm, setCredihomeForm] = useState({
    apiKey: settings.credihomeApiKey ?? '',
    username: settings.credihomeApiUsername ?? '',
    password: settings.credihomeApiPassword ?? '',
    partnerCode: settings.credihomePartnerCode ?? '',
  });
  const [formState, setFormState] = useState({
    id: '',
    label: '',
    value: '',
    description: '',
    scope: 'integration' as CredentialScope,
  });

  const selectedCredential = useMemo(
    () => credentials.find((credential) => credential.id === selectedId) ?? null,
    [credentials, selectedId],
  );

  useEffect(() => {
    setAsaasForm({
      apiKey: settings.asaasApiKey ?? '',
      apiUrl: settings.asaasApiUrl ?? '',
    });
    setAsaasFeedback('');
  }, [settings.asaasApiKey, settings.asaasApiUrl]);

  useEffect(() => {
    setCredihomeForm({
      apiKey: settings.credihomeApiKey ?? '',
      username: settings.credihomeApiUsername ?? '',
      password: settings.credihomeApiPassword ?? '',
      partnerCode: settings.credihomePartnerCode ?? '',
    });
    setCredihomeFeedback('');
  }, [
    settings.credihomeApiKey,
    settings.credihomeApiUsername,
    settings.credihomeApiPassword,
    settings.credihomePartnerCode,
  ]);

  useEffect(() => {
    if (!selectedCredential) {
      setFormState({ id: '', label: '', value: '', description: '', scope: 'integration' });
      setFormFeedback('');
      return;
    }

    setFormState({
      id: selectedCredential.id,
      label: selectedCredential.label,
      value: selectedCredential.value ?? '',
      description: selectedCredential.description ?? '',
      scope: (selectedCredential.scope ?? 'integration') as CredentialScope,
    });
    setFormFeedback('');
  }, [selectedCredential]);

  const handleInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setFormState((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleAsaasChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const { name, value } = event.target;
    setAsaasForm((previous) => ({
      ...previous,
      [name]: value,
    }));
    setAsaasFeedback('');
  };

  const handleAsaasSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedKey = asaasForm.apiKey.trim();
    const normalizedUrl = asaasForm.apiUrl.trim();

    updateSettings({
      asaasApiKey: normalizedKey || undefined,
      asaasApiUrl: normalizedUrl || undefined,
    });
    setAsaasFeedback(
      normalizedKey || normalizedUrl
        ? 'Integração Asaas atualizada com sucesso.'
        : 'Integração Asaas removida.',
    );
  };

  const handleClearAsaas = () => {
    setAsaasForm({ apiKey: '', apiUrl: '' });
    updateSettings({ asaasApiKey: undefined, asaasApiUrl: undefined });
    setAsaasFeedback('Integração Asaas removida.');
  };

  const handleCredihomeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setCredihomeForm((previous) => ({
      ...previous,
      [name]: value,
    }));
    setCredihomeFeedback('');
  };

  const handleCredihomeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedKey = credihomeForm.apiKey.trim();
    const normalizedUsername = credihomeForm.username.trim();
    const normalizedPassword = credihomeForm.password.trim();
    const normalizedPartnerCode = credihomeForm.partnerCode.trim();

    updateSettings({
      credihomeApiKey: normalizedKey || undefined,
      credihomeApiUsername: normalizedUsername || undefined,
      credihomeApiPassword: normalizedPassword || undefined,
      credihomePartnerCode: normalizedPartnerCode || undefined,
    });

    setCredihomeFeedback(
      normalizedKey || normalizedUsername || normalizedPassword || normalizedPartnerCode
        ? 'Credenciais Credihome salvas com sucesso.'
        : 'Credenciais Credihome removidas.',
    );
  };

  const handleClearCredihome = () => {
    setCredihomeForm({ apiKey: '', username: '', password: '', partnerCode: '' });
    updateSettings({
      credihomeApiKey: undefined,
      credihomeApiUsername: undefined,
      credihomeApiPassword: undefined,
      credihomePartnerCode: undefined,
    });
    setCredihomeFeedback('Credenciais Credihome removidas.');
  };

  const handleCreateNew = () => {
    setSelectedId(null);
    setFormState({ id: '', label: '', value: '', description: '', scope: 'integration' });
    setFormFeedback('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.label.trim()) {
      setFormFeedback('Informe um nome para identificar a credencial.');
      return;
    }
    if (!formState.value.trim()) {
      setFormFeedback('Inclua o valor ou token a ser armazenado.');
      return;
    }

    const normalizedId = slugify(formState.id || formState.label);
    const credential: Credential = {
      id: normalizedId,
      label: formState.label.trim(),
      description: formState.description.trim() || undefined,
      scope: formState.scope,
      value: formState.value.trim(),
      updatedAt: new Date().toISOString(),
    };

    const filtered = credentials.filter((item) => item.id !== normalizedId);
    const nextCredentials = [...filtered, credential];

    const overrides: Partial<typeof settings> = {};
    if (normalizedId === 'asaas-api-key') {
      overrides.asaasApiKey = credential.value;
    } else if (normalizedId === 'asaas-api-url') {
      overrides.asaasApiUrl = credential.value;
    } else if (normalizedId === 'credihome-api-key') {
      overrides.credihomeApiKey = credential.value;
    } else if (normalizedId === 'credihome-api-username') {
      overrides.credihomeApiUsername = credential.value;
    } else if (normalizedId === 'credihome-api-password') {
      overrides.credihomeApiPassword = credential.value;
    } else if (normalizedId === 'credihome-partner-code') {
      overrides.credihomePartnerCode = credential.value;
    }

    updateSettings({
      credentials: nextCredentials,
      ...overrides,
    });
    setFormFeedback('Credencial salva com sucesso.');
    setSelectedId(normalizedId);
  };

  const handleDelete = (credentialId: string) => {
    const filtered = credentials.filter((item) => item.id !== credentialId);
    const overrides: Partial<typeof settings> = {};
    if (credentialId === 'asaas-api-key') {
      overrides.asaasApiKey = undefined;
    } else if (credentialId === 'asaas-api-url') {
      overrides.asaasApiUrl = undefined;
    } else if (credentialId === 'credihome-api-key') {
      overrides.credihomeApiKey = undefined;
    } else if (credentialId === 'credihome-api-username') {
      overrides.credihomeApiUsername = undefined;
    } else if (credentialId === 'credihome-api-password') {
      overrides.credihomeApiPassword = undefined;
    } else if (credentialId === 'credihome-partner-code') {
      overrides.credihomePartnerCode = undefined;
    }

    updateSettings({
      credentials: filtered,
      ...overrides,
    });
    setFormFeedback('Credencial removida.');
    setSelectedId(filtered[0]?.id ?? null);
  };

  const maskedValue = (value?: string) => {
    if (!value) return '—';
    if (value.length <= 6) return `${value.slice(0, 2)}••${value.slice(-2)}`;
    return `${value.slice(0, 4)}••••${value.slice(-4)}`;
  };

  return (
    <ProtectedPage allowedRoles={['admin']} allowWhenRestricted>
      <section className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">Segurança e credenciais</h1>
          <p className="text-sm text-slate-600">
            Centralize as chaves de integração da plataforma e defina quem pode acessá-las. Os valores ficam salvos
            localmente para fins de demonstração.
          </p>
        </header>

        <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <header className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Integração financeira</p>
            <h2 className="text-xl font-semibold text-slate-900">Configurações do Asaas</h2>
          </header>

          <form onSubmit={handleAsaasSubmit} className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              URL base
              <input
                name="apiUrl"
                value={asaasForm.apiUrl}
                onChange={handleAsaasChange}
                placeholder="https://api.asaas.com/"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
              <span className="text-xs font-normal text-slate-500">
                Informe a raiz da API, sem incluir parâmetros. Ajustaremos automaticamente o caminho <code className="rounded bg-slate-100 px-1">/v3</code> quando necessário.
              </span>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Chave de API
              <input
                name="apiKey"
                value={asaasForm.apiKey}
                onChange={handleAsaasChange}
                required={!settings.asaasApiKey}
                placeholder="$aact_prod_xxx"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
              <span className="text-xs font-normal text-slate-500">
                Utilize a credencial gerada no painel do Asaas. Ela será utilizada automaticamente ao gerar cobranças.
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <button
                type="submit"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Salvar integração Asaas
              </button>
              <button
                type="button"
                onClick={handleClearAsaas}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Remover credenciais
              </button>
              {asaasFeedback && (
                <span className="text-xs font-medium text-slate-600">{asaasFeedback}</span>
              )}
            </div>
          </form>

          <p className="text-xs text-slate-500">
            As informações acima também aparecem na lista de credenciais abaixo para controle auditável.
          </p>
        </article>

        <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <header className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Integração imobiliária</p>
            <h2 className="text-xl font-semibold text-slate-900">Credenciais Credihome</h2>
          </header>

          <form onSubmit={handleCredihomeSubmit} className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Chave de API*
              <input
                type="password"
                name="apiKey"
                value={credihomeForm.apiKey}
                onChange={handleCredihomeChange}
                required={!settings.credihomeApiKey}
                placeholder="ch_prod_xxx"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
              <span className="text-xs font-normal text-slate-500">
                Informe o token fornecido pela Credihome. Ele será utilizado junto do OAuth nas requisições do Crédito Imobiliário.
              </span>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Usuário*
              <input
                name="username"
                value={credihomeForm.username}
                onChange={handleCredihomeChange}
                required={!settings.credihomeApiUsername}
                placeholder="contato@empresa.com"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
              <span className="text-xs font-normal text-slate-500">Mesmo login utilizado para gerar o token no endpoint <code className="rounded bg-slate-100 px-1">/oauth/token</code>.</span>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Senha*
              <input
                type="password"
                name="password"
                value={credihomeForm.password}
                onChange={handleCredihomeChange}
                required={!settings.credihomeApiPassword}
                placeholder="••••••••"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
              <span className="text-xs font-normal text-slate-500">Senha utilizada no fluxo de geração do token Credihome.</span>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Código do parceiro
              <input
                name="partnerCode"
                value={credihomeForm.partnerCode}
                onChange={handleCredihomeChange}
                placeholder="canal-123"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
              <span className="text-xs font-normal text-slate-500">Utilizado no campo <code className="rounded bg-slate-100 px-1">channel</code> para rastrear origens das propostas.</span>
            </label>

            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <button
                type="submit"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Salvar credenciais Credihome
              </button>
              <button
                type="button"
                onClick={handleClearCredihome}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Remover credenciais
              </button>
              {credihomeFeedback && (
                <span className="text-xs font-medium text-slate-600">{credihomeFeedback}</span>
              )}
            </div>
          </form>

          <p className="text-xs text-slate-500">
            Além de registrar aqui para fins de governança, lembre-se de definir as variáveis de ambiente <code className="rounded bg-slate-100 px-1">CREDIHOME_API_KEY</code>, <code className="rounded bg-slate-100 px-1">CREDIHOME_API_USERNAME</code> e <code className="rounded bg-slate-100 px-1">CREDIHOME_API_PASSWORD</code> no servidor para que a integração funcione em produção.
          </p>
        </article>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Credenciais cadastradas</h2>
              <button
                type="button"
                onClick={handleCreateNew}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Nova chave
              </button>
            </div>

            <ul className="space-y-2 text-sm">
              {credentials.length === 0 && (
                <li className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                  Nenhuma credencial adicionada até o momento.
                </li>
              )}
              {credentials
                .slice()
                .sort((a, b) => (a.label || a.id).localeCompare(b.label || b.id))
                .map((credential) => (
                  <li key={credential.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(credential.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        credential.id === selectedId
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        {credential.label || credential.id}
                      </span>
                      <span className="block text-xs opacity-80">{maskedValue(credential.value)}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </aside>

          <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                {selectedCredential ? 'Editar credencial' : 'Nova credencial'}
              </p>
              <h2 className="text-xl font-semibold text-slate-900">
                {selectedCredential ? selectedCredential.label : 'Adicionar integração segura'}
              </h2>
            </header>

            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Identificador
                <input
                  name="id"
                  value={formState.id}
                  onChange={handleInputChange}
                  placeholder="Ex.: asaas-api-key"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Nome visível*
                <input
                  name="label"
                  value={formState.label}
                  onChange={handleInputChange}
                  required
                  placeholder="Ex.: Chave de produção Asaas"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 md:col-span-2">
                Valor / Token*
                <input
                  name="value"
                  value={formState.value}
                  onChange={handleInputChange}
                  required
                  placeholder="$aact_prod_xxx"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Escopo
                <select
                  name="scope"
                  value={formState.scope}
                  onChange={handleInputChange}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 md:col-span-2">
                Descrição
                <textarea
                  name="description"
                  value={formState.description}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Anote detalhes sobre uso, responsável ou ambiente."
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-3">
                {selectedCredential && (
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedCredential.id)}
                    className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                  >
                    Remover
                  </button>
                )}
                <button
                  type="submit"
                  className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Salvar credencial
                </button>
              </div>
            </form>

            {formFeedback && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                {formFeedback}
              </div>
            )}

            {selectedCredential?.updatedAt && (
              <p className="text-xs text-slate-500">
                Última atualização em {new Date(selectedCredential.updatedAt).toLocaleString('pt-BR')}
              </p>
            )}
          </article>
        </div>
      </section>
    </ProtectedPage>
  );
}

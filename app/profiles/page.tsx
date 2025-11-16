'use client';

import { ChangeEvent, FormEvent, useState } from 'react';
import { ProtectedPage } from '../components/ProtectedPage';
import { useAuth } from '../context/AuthContext';
import { Role } from '@/lib/platform-data';

const ROLE_SUMMARY: Record<Role, string[]> = {
  admin: [
    'Visualiza e edita todos os usuários',
    'Acessa toda a esteira de negócios',
    'Gerencia produtos e configurações globais',
  ],
  master: [
    'Gerencia a própria equipe',
    'Acompanha pedidos dos subordinados',
    'Cria usuários operacionais',
  ],
  operational: [
    'Auxilia o master na gestão do tenant',
    'Pode editar usuários subordinados autorizados',
    'Não contrata novos assentos nem exclui usuários',
  ],
  user: ['Registra pedidos', 'Acessa apenas a própria carteira', 'Compartilha link da loja individual'],
};

export default function ProfilesPage() {
  const { currentUser, profiles, createProfile } = useAuth();
  const [feedback, setFeedback] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    role: 'user' as Role,
  });

  if (currentUser?.role !== 'admin') {
    return (
      <ProtectedPage>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
          Apenas administradores podem configurar perfis de utilização.
        </div>
      </ProtectedPage>
    );
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.name || !formData.description) {
      setFeedback('Informe um nome e uma descrição para cadastrar o perfil.');
      return;
    }

    const profile = createProfile({
      name: formData.name,
      description: formData.description,
      role: formData.role,
    });

    setFeedback(`Perfil ${profile.name} criado com sucesso.`);
    setFormData({ name: '', description: '', role: 'user' });
  };

  return (
    <ProtectedPage>
      <section className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">Perfis de utilização</h1>
          <p className="text-sm text-slate-600">
            Defina estruturas de acesso para controlar o que cada usuário pode visualizar dentro da plataforma.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {profiles.map((profile) => (
            <article key={profile.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{profile.name}</h2>
              <p className="mt-2 text-sm text-slate-600">{profile.description}</p>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Permissões padrão
              </h3>
              <ul className="mt-2 space-y-2 text-sm text-slate-600">
                {ROLE_SUMMARY[profile.role].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Criar novo perfil</h2>
          <p className="text-sm text-slate-600">
            Use esta seção para configurar perfis personalizados, como parceiros, consultores ou supervisores.
          </p>
          <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Nome do perfil*
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Nível de acesso*
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <option value="admin">Administrador</option>
                <option value="master">Usuário Master</option>
                <option value="operational">Usuário Operacional</option>
                <option value="user">Usuário Simples</option>
              </select>
            </label>
            <label className="md:col-span-2 flex flex-col gap-1 text-sm font-medium text-slate-700">
              Descrição*
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Salvar perfil
              </button>
            </div>
          </form>
          {feedback && <p className="mt-4 text-sm text-slate-600">{feedback}</p>}
        </div>
      </section>
    </ProtectedPage>
  );
}

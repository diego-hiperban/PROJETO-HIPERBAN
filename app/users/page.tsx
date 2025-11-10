'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedPage } from '../components/ProtectedPage';
import { useAuth } from '../context/AuthContext';
import { BillingStatus, Plan, Role, UserStatus } from '@/lib/data';

const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
};

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  master: 'Usuário Master',
  operational: 'Usuário Operacional',
  user: 'Usuário Simples',
};

const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  active: 'Em dia',
  trial: 'Período de teste',
  pending: 'Pagamento pendente',
  overdue: 'Em atraso',
  expired: 'Expirado',
  cancelled: 'Cancelado',
};

const BILLING_STATUS_CLASSES: Record<BillingStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  trial: 'bg-sky-100 text-sky-700',
  pending: 'bg-amber-100 text-amber-700',
  overdue: 'bg-rose-100 text-rose-700',
  expired: 'bg-rose-200 text-rose-700',
  cancelled: 'bg-slate-200 text-slate-600',
};

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function UsersPage() {
  const {
    currentUser,
    getVisibleUsers,
    users,
    profiles,
    plans,
    createUser,
    updateUser,
    updateUserStatus,
    deleteUser,
    assignPlanToUser,
    getRemainingTrialDays,
  } = useAuth();
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [billingFilter, setBillingFilter] = useState<'all' | BillingStatus | 'unassigned'>('all');
  const [search, setSearch] = useState('');
  const [dueRange, setDueRange] = useState({ start: '', end: '' });
  const [feedback, setFeedback] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    profileId: profiles[0]?.id ?? '',
    status: 'active' as UserStatus,
    parentId: '',
    company: '',
    city: '',
    phone: '',
    viewCommissions: false,
    bankInstitution: '',
    bankAgency: '',
    bankAccount: '',
    bankType: '',
    document: '',
    billingPlanId: currentUser?.billing?.planId ?? plans[0]?.id ?? '',
    billingCustomPrice: '',
    billingSeatsIncluded: '',
    billingAdditionalSeats: '',
    billingTrialDays: '',
  });

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const editingUser = useMemo(
    () => users.find((candidate) => candidate.id === editingUserId) ?? null,
    [editingUserId, users],
  );
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    password: '',
    profileId: profiles[0]?.id ?? '',
    status: 'active' as UserStatus,
    parentId: '',
    company: '',
    city: '',
    phone: '',
    viewCommissions: false,
    bankInstitution: '',
    bankAgency: '',
    bankAccount: '',
    bankType: '',
    document: '',
    billingPlanId: '',
    billingCustomPrice: '',
    billingSeatsIncluded: '',
    billingAdditionalSeats: '',
    billingStatus: 'pending' as BillingStatus,
    billingTrialDays: '',
    billingExpiresAt: '',
  });
  const [editFeedback, setEditFeedback] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const visibleUsers = getVisibleUsers();

  const filteredUsers = useMemo(() => {
    return visibleUsers.filter((user) => {
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesBilling =
        billingFilter === 'all'
          ? true
          : billingFilter === 'unassigned'
            ? !user.billing
            : user.billing?.status === billingFilter;
      const dueDate = user.billing?.expiresAt ?? user.billing?.trialEndsAt ?? null;
      const matchesDue = (() => {
        if (!dueRange.start && !dueRange.end) {
          return true;
        }
        if (!dueDate) {
          return false;
        }
        const target = new Date(dueDate);
        target.setHours(0, 0, 0, 0);
        if (dueRange.start) {
          const start = new Date(dueRange.start);
          start.setHours(0, 0, 0, 0);
          if (target.getTime() < start.getTime()) {
            return false;
          }
        }
        if (dueRange.end) {
          const end = new Date(dueRange.end);
          end.setHours(23, 59, 59, 999);
          if (target.getTime() > end.getTime()) {
            return false;
          }
        }
        return true;
      })();
      const matchesSearch = search
        ? user.name.toLowerCase().includes(search.toLowerCase()) ||
          user.email.toLowerCase().includes(search.toLowerCase())
        : true;
      return matchesStatus && matchesRole && matchesBilling && matchesDue && matchesSearch;
    });
  }, [visibleUsers, statusFilter, roleFilter, billingFilter, search, dueRange]);

  const canEditUser = useCallback(
    (candidate: (typeof users)[number]) => {
      if (!currentUser || currentUser.role === 'user' || currentUser.role === 'operational') return false;
      if (currentUser.role === 'admin') return true;
      if (candidate.role === 'admin') return false;
      return visibleUsers.some((user) => user.id === candidate.id);
    },
    [currentUser, visibleUsers],
  );

  const masterCount = visibleUsers.filter((user) => user.role === 'master').length;
  const activeCount = visibleUsers.filter((user) => user.status === 'active').length;
  const inactiveCount = visibleUsers.filter((user) => user.status === 'inactive').length;
  const upcomingDueCount = visibleUsers.filter((user) => {
    const expiresAt = user.billing?.expiresAt;
    if (!expiresAt || user.billing?.status !== 'active') {
      return false;
    }
    const expires = new Date(expiresAt).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }).length;

  const availableProfiles = useMemo(() => {
    if (currentUser?.role === 'admin') return profiles;
    return profiles.filter((profile) => profile.role !== 'admin');
  }, [profiles, currentUser]);

  const availableParents = useMemo(() => {
    if (currentUser?.role === 'master') {
      return users.filter((user) => user.id === currentUser.id);
    }
    return users.filter((user) => user.role === 'master');
  }, [users, currentUser]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === formData.billingPlanId),
    [plans, formData.billingPlanId],
  );

  const editingPlan = useMemo(
    () => plans.find((plan) => plan.id === editFormData.billingPlanId),
    [plans, editFormData.billingPlanId],
  );

  const editingTrialRemaining = useMemo(
    () => (editingUser ? getRemainingTrialDays(editingUser.id) : null),
    [editingUser, getRemainingTrialDays],
  );

  const formatDocumentInput = useCallback((value: string) => {
    const digits = value.replace(/\D+/g, '').slice(0, 14);
    if (digits.length <= 11) {
      return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return digits
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }, []);

  const handleFormChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name } = event.target;
    const fieldValue =
      event.target instanceof HTMLInputElement && event.target.type === 'checkbox'
        ? event.target.checked
        : event.target.value;
    if (name === 'document') {
      const value = typeof fieldValue === 'string' ? fieldValue : '';
      setFormData((previous) => ({
        ...previous,
        document: formatDocumentInput(value),
      }));
      return;
    }
    setFormData((previous) => ({
      ...previous,
      [name]: fieldValue,
    }));
  };

  const handleEditChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name } = event.target;
    const fieldValue =
      event.target instanceof HTMLInputElement && event.target.type === 'checkbox'
        ? event.target.checked
        : event.target.value;
    if (name === 'document') {
      const value = typeof fieldValue === 'string' ? fieldValue : '';
      setEditFormData((previous) => ({
        ...previous,
        document: formatDocumentInput(value),
      }));
      return;
    }
    setEditFormData((previous) => ({
      ...previous,
      [name]: fieldValue,
    }));
  };

  useEffect(() => {
    if (!availableProfiles.find((profile) => profile.id === formData.profileId)) {
      setFormData((previous) => ({
        ...previous,
        profileId: availableProfiles[0]?.id ?? '',
      }));
    }
  }, [availableProfiles, formData.profileId]);

  useEffect(() => {
    setFormData((previous) => {
      if (previous.billingPlanId) return previous;
      const fallback = currentUser?.billing?.planId ?? plans[0]?.id ?? '';
      if (!fallback) return previous;
      return { ...previous, billingPlanId: fallback };
    });
  }, [currentUser, plans]);

  useEffect(() => {
    if (!selectedPlan) return;
    setFormData((previous) => {
      if (previous.billingPlanId !== selectedPlan.id) {
        return previous;
      }

      const nextSeats = previous.billingSeatsIncluded || String(selectedPlan.seatsIncluded);
      const nextCustomPrice = selectedPlan.allowCustomPrice ? previous.billingCustomPrice : '';

      if (
        nextSeats === previous.billingSeatsIncluded &&
        nextCustomPrice === previous.billingCustomPrice
      ) {
        return previous;
      }

      return {
        ...previous,
        billingSeatsIncluded: nextSeats,
        billingCustomPrice: nextCustomPrice,
      };
    });
  }, [selectedPlan]);

  useEffect(() => {
    if (!editingUser) {
      setEditFormData((previous) => ({
        ...previous,
        name: '',
        email: '',
        password: '',
        profileId: profiles[0]?.id ?? '',
        status: 'active',
        parentId: '',
        company: '',
        city: '',
        phone: '',
        viewCommissions: false,
        bankInstitution: '',
        bankAgency: '',
        bankAccount: '',
        bankType: '',
        document: '',
        billingPlanId: '',
        billingCustomPrice: '',
        billingSeatsIncluded: '',
        billingAdditionalSeats: '',
        billingStatus: 'pending',
        billingTrialDays: '',
        billingExpiresAt: '',
      }));
      return;
    }

    setEditFormData({
      name: editingUser.name,
      email: editingUser.email,
      password: '',
      profileId: editingUser.profileId ?? profiles[0]?.id ?? '',
      status: editingUser.status,
      parentId: editingUser.parentId ?? '',
      company: editingUser.company ?? '',
      city: editingUser.city ?? '',
      phone: editingUser.phone ?? '',
      viewCommissions: Boolean(editingUser.viewCommissions),
      bankInstitution: editingUser.bank?.institution ?? '',
      bankAgency: editingUser.bank?.agency ?? '',
      bankAccount: editingUser.bank?.account ?? '',
      bankType: editingUser.bank?.type ?? '',
      document: editingUser.document ? formatDocumentInput(editingUser.document) : '',
      billingPlanId: editingUser.billing?.planId ?? '',
      billingCustomPrice:
        typeof editingUser.billing?.customPrice === 'number'
          ? String(editingUser.billing.customPrice)
          : '',
      billingSeatsIncluded:
        typeof editingUser.billing?.seatsIncluded === 'number'
          ? String(editingUser.billing.seatsIncluded)
          : '',
      billingAdditionalSeats:
        typeof editingUser.billing?.additionalSeats === 'number'
          ? String(editingUser.billing.additionalSeats)
          : '',
      billingStatus: editingUser.billing?.status ?? 'pending',
      billingTrialDays: '',
      billingExpiresAt: editingUser.billing?.expiresAt
        ? editingUser.billing.expiresAt.slice(0, 10)
        : '',
    });
  }, [editingUser, profiles]);

  useEffect(() => {
    if (!editingUser) return;
    if (!availableProfiles.find((profile) => profile.id === editFormData.profileId)) {
      setEditFormData((previous) => ({
        ...previous,
        profileId: availableProfiles[0]?.id ?? '',
      }));
    }
  }, [availableProfiles, editFormData.profileId, editingUser]);

  useEffect(() => {
    if (!editingPlan) return;
    setEditFormData((previous) => {
      if (previous.billingPlanId !== editingPlan.id) {
        return previous;
      }
      const hasSeats = previous.billingSeatsIncluded !== '';
      const nextSeats = hasSeats
        ? previous.billingSeatsIncluded
        : String(editingUser?.billing?.seatsIncluded ?? editingPlan.seatsIncluded);
      const nextCustom = editingPlan.allowCustomPrice ? previous.billingCustomPrice : '';
      if (nextSeats === previous.billingSeatsIncluded && nextCustom === previous.billingCustomPrice) {
        return previous;
      }
      return {
        ...previous,
        billingSeatsIncluded: nextSeats,
        billingCustomPrice: nextCustom,
      };
    });
  }, [editingPlan, editingUser]);

  useEffect(() => {
    setEditFeedback('');
    setEditLoading(false);
  }, [editingUserId]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback('');
    if (!formData.name || !formData.email || !formData.password || !formData.profileId) {
      setFeedback('Preencha todos os campos obrigatórios para cadastrar o usuário.');
      return;
    }

    if (!formData.billingPlanId) {
      setFeedback('Selecione um plano de cobrança para o novo usuário.');
      return;
    }

    setFormLoading(true);
    const customPrice =
      formData.billingCustomPrice !== '' && !Number.isNaN(Number(formData.billingCustomPrice))
        ? Number(formData.billingCustomPrice)
        : undefined;
    const seatsIncludedValue =
      formData.billingSeatsIncluded !== '' && !Number.isNaN(Number(formData.billingSeatsIncluded))
        ? Number(formData.billingSeatsIncluded)
        : undefined;
    const additionalSeatsValue =
      formData.billingAdditionalSeats !== '' && !Number.isNaN(Number(formData.billingAdditionalSeats))
        ? Number(formData.billingAdditionalSeats)
        : undefined;
    const trialDaysValue =
      formData.billingTrialDays !== '' && !Number.isNaN(Number(formData.billingTrialDays))
        ? Number(formData.billingTrialDays)
        : undefined;

    const { user: created, error } = createUser({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      profileId: formData.profileId,
      status: formData.status,
      parentId: formData.parentId || undefined,
      company: formData.company || undefined,
      city: formData.city || undefined,
      phone: formData.phone || undefined,
      viewCommissions: formData.viewCommissions,
      bank: {
        institution: formData.bankInstitution || undefined,
        agency: formData.bankAgency || undefined,
        account: formData.bankAccount || undefined,
        type: formData.bankType || undefined,
      },
      document: formData.document || undefined,
      billingPlanId: formData.billingPlanId,
      billingCustomPrice: customPrice,
      billingSeatsIncluded: seatsIncludedValue,
      billingAdditionalSeats: additionalSeatsValue,
      billingTrialDays: trialDaysValue,
    });

    if (created) {
      setFeedback(`Usuário ${created.name} cadastrado com sucesso.`);
      setFormData((previous) => ({
        ...previous,
        name: '',
        email: '',
        password: '',
        company: '',
        city: '',
        phone: '',
        parentId: '',
        bankInstitution: '',
        bankAgency: '',
        bankAccount: '',
        bankType: '',
        document: '',
        billingCustomPrice: '',
        billingSeatsIncluded: '',
        billingAdditionalSeats: '',
        billingTrialDays: '',
        viewCommissions: false,
      }));
      setIsCreateOpen(false);
    } else {
      if (
        error &&
        currentUser?.role === 'master' &&
        error.toLowerCase().includes('limite de usuários adicionais atingido')
      ) {
        setIsCreateOpen(false);
        setFeedback(
          'Você atingiu o limite de usuários do seu plano. Abrimos o Financeiro para contratar novos acessos.',
        );
        router.push('/billing?focus=seats');
      } else {
        setFeedback(error ?? 'Não foi possível criar o usuário. Verifique os dados informados.');
      }
    }
    setFormLoading(false);
  };

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser) return;
    setEditFeedback('');
    setEditLoading(true);

    try {
      updateUser(editingUser.id, {
        name: editFormData.name,
        email: editFormData.email,
        password: editFormData.password || undefined,
        profileId: editFormData.profileId,
        status: editFormData.status,
        parentId: editFormData.parentId || null,
        company: editFormData.company || null,
        city: editFormData.city || null,
        phone: editFormData.phone || null,
        viewCommissions: editFormData.viewCommissions,
        bank: {
          institution: editFormData.bankInstitution || undefined,
          agency: editFormData.bankAgency || undefined,
          account: editFormData.bankAccount || undefined,
          type: editFormData.bankType || undefined,
        },
        document: editFormData.document || null,
      });

      if (editFormData.billingPlanId) {
        const options: Parameters<typeof assignPlanToUser>[2] = {};
        if (editFormData.billingCustomPrice) {
          const value = Number(editFormData.billingCustomPrice);
          if (!Number.isNaN(value)) {
            options.customPrice = value;
          }
        }
        if (editFormData.billingSeatsIncluded) {
          const seats = Number(editFormData.billingSeatsIncluded);
          if (!Number.isNaN(seats)) {
            options.seatsIncluded = seats;
          }
        }
        if (editFormData.billingAdditionalSeats) {
          const extra = Number(editFormData.billingAdditionalSeats);
          if (!Number.isNaN(extra)) {
            options.additionalSeats = extra;
          }
        }
        if (editFormData.billingStatus) {
          options.status = editFormData.billingStatus;
        }
        if (editFormData.billingTrialDays) {
          const trial = Number(editFormData.billingTrialDays);
          if (!Number.isNaN(trial)) {
            options.trialDays = trial;
          }
        }
        if (editFormData.billingExpiresAt) {
          options.expiresAt = new Date(editFormData.billingExpiresAt).toISOString();
        }
        assignPlanToUser(editingUser.id, editFormData.billingPlanId, options);
      }

      setEditFeedback('Dados do usuário atualizados com sucesso.');
    } finally {
      setEditLoading(false);
      setEditFormData((previous) => ({ ...previous, password: '' }));
    }
  };

  const handleStatusToggle = (userId: string, currentStatus: UserStatus) => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    updateUserStatus(userId, nextStatus);
  };

  const handleDeleteUser = (userId: string, name: string) => {
    if (currentUser?.role !== 'admin') {
      return;
    }

    const confirmed = window.confirm(`Deseja realmente excluir o usuário ${name}? Esta ação não pode ser desfeita.`);
    if (!confirmed) {
      return;
    }

    deleteUser(userId);

    if (editingUserId === userId) {
      setEditingUserId(null);
    }

    setFeedback(`Usuário ${name} excluído com sucesso.`);
  };

  const closeEditPanel = () => {
    setEditingUserId(null);
  };

  const closeCreatePanel = () => {
    setIsCreateOpen(false);
    setFeedback('');
    setFormData((previous) => ({
      ...previous,
      name: '',
      email: '',
      password: '',
      company: '',
      city: '',
      phone: '',
      parentId: '',
      bankInstitution: '',
      bankAgency: '',
      bankAccount: '',
      bankType: '',
      document: '',
      billingCustomPrice: '',
      billingSeatsIncluded: '',
      billingAdditionalSeats: '',
      billingTrialDays: '',
      viewCommissions: false,
    }));
  };

  const openCreatePanel = () => {
    setFeedback('');
    setIsCreateOpen(true);
  };

  return (
    <ProtectedPage>
      <section className="space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-slate-900">Usuários</h1>
            <p className="text-sm text-slate-600">
              Gerencie a equipe, acompanhe o status dos acessos e cadastre novos colaboradores para a operação.
            </p>
          </div>
          {currentUser?.role !== 'user' && currentUser?.role !== 'operational' && (
            <button
              type="button"
              onClick={openCreatePanel}
              className="self-start rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Novo usuário
            </button>
          )}

        </header>

        {feedback && !isCreateOpen && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {feedback}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <SummaryCard title="Usuários Ativos" value={activeCount} accent="bg-emerald-100 text-emerald-700" />
          <SummaryCard title="Usuários Inativos" value={inactiveCount} accent="bg-amber-100 text-amber-700" />
          <SummaryCard title="Usuários Master" value={masterCount} accent="bg-indigo-100 text-indigo-700" />
          <SummaryCard title="Vencem em até 7 dias" value={upcomingDueCount} accent="bg-rose-100 text-rose-700" />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Filtro de usuários</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-6">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Situação
              <select
                name="status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <option value="all">Todas</option>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Perfil
              <select
                name="role"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <option value="all">Todos</option>
                <option value="admin">Administrador</option>
                <option value="master">Usuário Master</option>
                <option value="operational">Usuário Operacional</option>
                <option value="user">Usuário Simples</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Financeiro
              <select
                name="billing"
                value={billingFilter}
                onChange={(event) => setBillingFilter(event.target.value as typeof billingFilter)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <option value="all">Todos</option>
                <option value="active">Em dia</option>
                <option value="pending">Pagamento pendente</option>
                <option value="trial">Período de teste</option>
                <option value="overdue">Em atraso</option>
                <option value="expired">Expirado</option>
                <option value="cancelled">Cancelado</option>
                <option value="unassigned">Sem plano</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Vencimento inicial
              <input
                type="date"
                value={dueRange.start}
                onChange={(event) => setDueRange((previous) => ({ ...previous, start: event.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Vencimento final
              <input
                type="date"
                value={dueRange.end}
                onChange={(event) => setDueRange((previous) => ({ ...previous, end: event.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 md:col-span-2 lg:col-span-2">
              Busca rápida
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome ou e-mail"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Plano</th>
                  <th className="px-4 py-3">Financeiro</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3">Cadastro</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                {filteredUsers.map((user) => {
                  const trialRemaining = getRemainingTrialDays(user.id);
                  const trialEndsAt = user.billing?.trialEndsAt ? new Date(user.billing.trialEndsAt) : null;
                  const expiresAt = user.billing?.expiresAt ? new Date(user.billing.expiresAt) : null;

                  return (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{user.name}</div>
                      </td>
                      <td className="px-4 py-3">{user.email}</td>
                      <td className="px-4 py-3">{user.phone ?? '—'}</td>
                      <td className="px-4 py-3">{user.company ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{user.billing?.planName ?? '—'}</div>
                        {user.billing && (
                          <div className="text-xs text-slate-500">
                            {currency.format(user.billing.customPrice ?? user.billing.price)} /{' '}
                            {user.billing.period === 'annual'
                              ? 'ano'
                              : user.billing.period === 'semiannual'
                                ? 'semestre'
                                : user.billing.period === 'quarterly'
                                  ? 'trimestre'
                                  : 'mês'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {user.billing ? (
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                BILLING_STATUS_CLASSES[user.billing.status]
                              }`}
                            >
                              {BILLING_STATUS_LABELS[user.billing.status]}
                            </span>
                            {user.billing.asaasCustomerId && (
                              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                Cliente Asaas:{' '}
                                <span className="font-mono text-[10px] text-slate-500">
                                  {user.billing.asaasCustomerId}
                                </span>
                              </p>
                            )}
                            {user.billing.asaasSubscriptionId && (
                              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                Assinatura:{' '}
                                <span className="font-mono text-[10px] text-slate-500">
                                  {user.billing.asaasSubscriptionId}
                                </span>
                              </p>
                            )}
                            {user.billing.history.length > 0 && (
                              <p className="text-xs text-slate-500">
                                Último pagamento:{' '}
                                {new Date(user.billing.history[0]?.date ?? new Date()).toLocaleDateString('pt-BR')}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">Plano pendente</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {user.billing ? (
                          <div className="space-y-1 text-sm">
                            {expiresAt && (
                              <p className="font-medium text-slate-900">
                                {expiresAt.toLocaleDateString('pt-BR')}
                              </p>
                            )}
                            {trialEndsAt && (
                              <p className="font-medium text-slate-900">
                                Teste até {trialEndsAt.toLocaleDateString('pt-BR')}
                              </p>
                            )}
                            {trialEndsAt && (
                              <p className="text-xs text-slate-500">
                                {trialRemaining !== null
                                  ? `Restam ${trialRemaining} dia${trialRemaining === 1 ? '' : 's'} de teste`
                                  : 'Teste expirado'}
                              </p>
                            )}
                            {expiresAt && user.billing.status === 'active' && (() => {
                              const diffDays = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                              if (diffDays >= 0 && diffDays <= 7) {
                                return (
                                  <p className="text-xs font-semibold text-amber-600">
                                    Vence em {diffDays} dia{diffDays === 1 ? '' : 's'}
                                  </p>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{ROLE_LABELS[user.role]}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                          user.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {STATUS_LABELS[user.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {canEditUser(user) && (
                          <button
                            type="button"
                            onClick={() => setEditingUserId(user.id)}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                          >
                            Editar
                          </button>
                        )}
                        {currentUser?.role !== 'user' && currentUser?.role !== 'operational' && currentUser?.id !== user.id && (
                          <button
                            type="button"
                            onClick={() => handleStatusToggle(user.id, user.status)}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                          >
                            {user.status === 'active' ? 'Desativar' : 'Reativar'}
                          </button>
                        )}
                        {currentUser?.role === 'admin' && currentUser.id !== user.id && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user.id, user.name)}
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-6 text-center text-sm text-slate-500">
                      Nenhum usuário encontrado com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {currentUser?.role !== 'user' && currentUser?.role !== 'operational' && !visibleUsers.length && !isCreateOpen && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            Nenhum usuário cadastrado ainda. Utilize o botão “Novo usuário” para começar.
          </div>
        )}


      </section>
      {isCreateOpen && currentUser?.role !== 'user' && currentUser?.role !== 'operational' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
          <div className="max-h-full w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Cadastrar usuário</p>
                <h2 className="text-2xl font-semibold text-slate-900">Novo acesso</h2>
                <p className="text-sm text-slate-600">
                  Complete os campos a seguir para liberar o acesso de um novo membro à plataforma.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreatePanel}
                className="h-10 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Fechar
              </button>
            </header>
            <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Nome*
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  required
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                E-mail*
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleFormChange}
                  required
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Senha temporária*
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleFormChange}
                  required
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Perfil de utilização*
                <select
                  name="profileId"
                  value={formData.profileId}
                  onChange={handleFormChange}
                  required
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  {availableProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
              {currentUser?.role === 'admin' && (
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Responsável direto
                  <select
                    name="parentId"
                    value={formData.parentId}
                    onChange={handleFormChange}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="">— Sem responsável —</option>
                    {availableParents.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Status de acesso
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleFormChange}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Empresa
                <input
                  name="company"
                  value={formData.company}
                  onChange={handleFormChange}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Cidade
                <input
                  name="city"
                  value={formData.city}
                  onChange={handleFormChange}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Telefone
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleFormChange}
                  placeholder="(00) 00000-0000"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                CPF / CNPJ
                <input
                  name="document"
                  value={formData.document}
                  onChange={handleFormChange}
                  placeholder="Somente números"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  name="viewCommissions"
                  checked={formData.viewCommissions}
                  onChange={handleFormChange}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                Visualizar comissão
              </label>
              <div className="lg:col-span-2 mt-2 border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Plano e cobrança</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Ajuste o plano do usuário para que o Asaas gere a cobrança correta e controle o total de licenças disponíveis na sua operação.
                </p>
              </div>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Plano contratado*
                <select
                  name="billingPlanId"
                  value={formData.billingPlanId}
                  onChange={handleFormChange}
                  required
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="">Selecione um plano</option>
                  {plans.map((plan: Plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} — {currency.format(plan.price)} /
                      {plan.period === 'annual'
                        ? 'ano'
                        : plan.period === 'semiannual'
                          ? 'semestre'
                          : plan.period === 'quarterly'
                            ? 'trimestre'
                            : 'mês'}
                    </option>
                  ))}
                </select>
              </label>
              {selectedPlan?.allowCustomPrice && (
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Valor personalizado (R$)
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    name="billingCustomPrice"
                    value={formData.billingCustomPrice}
                    onChange={handleFormChange}
                    placeholder="Informe apenas em negociações específicas"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Usuários inclusos
                <input
                  type="number"
                  min={0}
                  name="billingSeatsIncluded"
                  value={formData.billingSeatsIncluded}
                  onChange={handleFormChange}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
                <span className="text-xs text-slate-500">
                  Plano padrão inclui {selectedPlan?.seatsIncluded ?? 0} usuário(s) sem custo extra.
                </span>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Usuários adicionais liberados
                <input
                  type="number"
                  min={0}
                  name="billingAdditionalSeats"
                  value={formData.billingAdditionalSeats}
                  onChange={handleFormChange}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
                {selectedPlan?.additionalSeatPrice && (
                  <span className="text-xs text-slate-500">
                    Sugestão de cobrança adicional: {currency.format(selectedPlan.additionalSeatPrice)} / usuário
                  </span>
                )}
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Dias de teste (opcional)
                <input
                  type="number"
                  min={0}
                  name="billingTrialDays"
                  value={formData.billingTrialDays}
                  onChange={handleFormChange}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
                <span className="text-xs text-slate-500">
                  Utilize para liberar testes controlados e converter o cliente automaticamente após o período.
                </span>
              </label>
              <div className="lg:col-span-2 mt-2 border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Dados bancários</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Preencha quando precisar gerar pagamentos de comissionamento diretamente pela plataforma.
                </p>
              </div>
              <div className="lg:col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  name="bankInstitution"
                  value={formData.bankInstitution}
                  onChange={handleFormChange}
                  placeholder="Banco"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
                <input
                  name="bankAgency"
                  value={formData.bankAgency}
                  onChange={handleFormChange}
                  placeholder="Agência"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
                <input
                  name="bankAccount"
                  value={formData.bankAccount}
                  onChange={handleFormChange}
                  placeholder="Conta"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
                <input
                  name="bankType"
                  value={formData.bankType}
                  onChange={handleFormChange}
                  placeholder="Tipo"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </div>
              <div className="lg:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {formLoading ? 'Cadastrando...' : 'Cadastrar usuário'}
                </button>
              </div>
            </form>
            {feedback && (
              <p className="mt-4 text-sm text-slate-600">{feedback}</p>
            )}
          </div>
        </div>
      )}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
          <div className="max-h-full w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Editar usuário</p>
                <h2 className="text-2xl font-semibold text-slate-900">{editingUser.name}</h2>
                <p className="text-sm text-slate-600">
                  Ajuste os dados cadastrais, permissões e o plano ativo. As mudanças são aplicadas imediatamente após
                  salvar.
                </p>
                <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                  <span className="font-semibold uppercase tracking-wide text-slate-600">{ROLE_LABELS[editingUser.role]}</span>
                  {editingUser.billing?.asaasCustomerId && (
                    <span className="font-mono">Cliente Asaas: {editingUser.billing.asaasCustomerId}</span>
                  )}
                  {editingUser.billing?.asaasSubscriptionId && (
                    <span className="font-mono">Assinatura: {editingUser.billing.asaasSubscriptionId}</span>
                  )}
                  {editingTrialRemaining !== null && (
                    <span>Teste ativo por mais {editingTrialRemaining} dia(s)</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditPanel}
                className="h-10 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Fechar
              </button>
            </header>
            <form onSubmit={handleEditSubmit} className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Nome*
                <input
                  name="name"
                  value={editFormData.name}
                  onChange={handleEditChange}
                  required
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                E-mail*
                <input
                  type="email"
                  name="email"
                  value={editFormData.email}
                  onChange={handleEditChange}
                  required
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Nova senha
                <input
                  type="password"
                  name="password"
                  value={editFormData.password}
                  onChange={handleEditChange}
                  placeholder="Deixe em branco para manter"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Perfil de utilização*
                <select
                  name="profileId"
                  value={editFormData.profileId}
                  onChange={handleEditChange}
                  required
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  {availableProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Status de acesso
                <select
                  name="status"
                  value={editFormData.status}
                  onChange={handleEditChange}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>
              {currentUser?.role === 'admin' && (
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Responsável direto
                  <select
                    name="parentId"
                    value={editFormData.parentId}
                    onChange={handleEditChange}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="">— Sem responsável —</option>
                    {availableParents.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Empresa
                <input
                  name="company"
                  value={editFormData.company}
                  onChange={handleEditChange}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Cidade
                <input
                  name="city"
                  value={editFormData.city}
                  onChange={handleEditChange}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Telefone
                <input
                  name="phone"
                  value={editFormData.phone}
                  onChange={handleEditChange}
                  placeholder="(00) 00000-0000"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                CPF / CNPJ
                <input
                  name="document"
                  value={editFormData.document}
                  onChange={handleEditChange}
                  placeholder="Somente números"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  name="viewCommissions"
                  checked={editFormData.viewCommissions}
                  onChange={handleEditChange}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                Visualizar comissão
              </label>

              <div className="lg:col-span-2 mt-2 border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Plano e cobrança</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Vincule o plano adequado para que o acesso seja controlado automaticamente após as cobranças.
                </p>
              </div>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Plano contratado
                <select
                  name="billingPlanId"
                  value={editFormData.billingPlanId}
                  onChange={handleEditChange}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="">Selecionar plano</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} — {currency.format(plan.price)} /
                      {plan.period === 'annual'
                        ? 'ano'
                        : plan.period === 'semiannual'
                          ? 'semestre'
                          : plan.period === 'quarterly'
                            ? 'trimestre'
                            : 'mês'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Status financeiro
                <select
                  name="billingStatus"
                  value={editFormData.billingStatus}
                  onChange={handleEditChange}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  {Object.entries(BILLING_STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {editingPlan?.allowCustomPrice && currentUser?.role === 'admin' && (
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Valor personalizado (R$)
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    name="billingCustomPrice"
                    value={editFormData.billingCustomPrice}
                    onChange={handleEditChange}
                    placeholder="Informe apenas se houver acordo específico"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Usuários inclusos
                <input
                  type="number"
                  min={0}
                  name="billingSeatsIncluded"
                  value={editFormData.billingSeatsIncluded}
                  onChange={handleEditChange}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
                {editingPlan && (
                  <span className="text-xs text-slate-500">
                    Plano inclui {editingPlan.seatsIncluded} usuário(s) por padrão.
                  </span>
                )}
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Usuários adicionais liberados
                <input
                  type="number"
                  min={0}
                  name="billingAdditionalSeats"
                  value={editFormData.billingAdditionalSeats}
                  onChange={handleEditChange}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
                {editingPlan?.additionalSeatPrice && (
                  <span className="text-xs text-slate-500">
                    Cobrança sugerida: {currency.format(editingPlan.additionalSeatPrice)} / usuário adicional.
                  </span>
                )}
              </label>
              {currentUser?.role === 'admin' && (
                <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  Dias de teste
                  <input
                    type="number"
                    min={0}
                    name="billingTrialDays"
                    value={editFormData.billingTrialDays}
                    onChange={handleEditChange}
                    placeholder="Ajustar apenas em casos especiais"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              )}
              <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                Vigência até
                <input
                  type="date"
                  name="billingExpiresAt"
                  value={editFormData.billingExpiresAt}
                  onChange={handleEditChange}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <div className="lg:col-span-2 mt-2 border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Dados bancários</h3>
              </div>
              <input
                name="bankInstitution"
                value={editFormData.bankInstitution}
                onChange={handleEditChange}
                placeholder="Banco"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
              <input
                name="bankAgency"
                value={editFormData.bankAgency}
                onChange={handleEditChange}
                placeholder="Agência"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
              <input
                name="bankAccount"
                value={editFormData.bankAccount}
                onChange={handleEditChange}
                placeholder="Conta"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
              <input
                name="bankType"
                value={editFormData.bankType}
                onChange={handleEditChange}
                placeholder="Tipo"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />

              <div className="lg:col-span-2 mt-4 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditPanel}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {editLoading ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
            {editFeedback && (
              <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                {editFeedback}
              </p>
            )}
          </div>
        </div>
      )}
    </ProtectedPage>
  );
}

function SummaryCard({ title, value, accent }: { title: string; value: number; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${accent}`}>Resumo</span>
    </div>
  );
}

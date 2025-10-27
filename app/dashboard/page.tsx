'use client';

import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProtectedPage } from '../components/ProtectedPage';

const STATUS_LABELS: Record<string, string> = {
  novo: 'Novo',
  em_contato: 'Em contato',
  negociando: 'Negociando',
  concluido: 'Concluído',
};

export default function DashboardPage() {
  const { currentUser, getVisibleOrders, getVisibleUsers, getShareLink, products } = useAuth();

  const orders = getVisibleOrders();
  const visibleUsers = getVisibleUsers();

  const totalByStatus = useMemo(() => {
    return orders.reduce<Record<string, number>>((accumulator, order) => {
      accumulator[order.status] = (accumulator[order.status] || 0) + 1;
      return accumulator;
    }, {});
  }, [orders]);

  const totalTicket = useMemo(() => {
    return orders.reduce((total, order) => {
      const product = products.find((item) => item.id === order.productId);
      return total + (product?.price || 0);
    }, 0);
  }, [orders]);

  return (
    <ProtectedPage>
      <section className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">Bem-vindo, {currentUser?.name}</h1>
          <p className="text-sm text-slate-600">
            Aqui você acompanha sua operação, gera links rastreáveis e monitora o desempenho da sua equipe.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <div key={status} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{totalByStatus[status] || 0}</p>
            </div>
          ))}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Ticket potencial</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {totalTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Equipe e permissões</h2>
            <p className="text-sm text-slate-600">Usuários que você consegue acompanhar.</p>
            <ul className="mt-4 space-y-3">
              {visibleUsers.map((user) => (
                <li key={user.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{user.role}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Link da sua loja</h2>
            <p className="text-sm text-slate-600">
              Compartilhe o endereço abaixo para rastrear as vendas originadas por você ou pela sua equipe.
            </p>
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 font-mono text-sm">
              {currentUser ? getShareLink(currentUser.id) : '—'}
            </div>
          </div>
        </div>
      </section>
    </ProtectedPage>
  );
}

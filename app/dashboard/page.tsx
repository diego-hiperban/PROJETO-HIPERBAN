'use client';

import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProtectedPage } from '../components/ProtectedPage';

type GaugedCardProps = {
  label: string;
  value: number;
  total: number;
  accent: string;
  helper?: string;
};

type ProductionStatus = 'paid' | 'pending' | 'rejected';

type ProductionSlice = {
  id: string;
  ownerId: string;
  amount: number;
  status: ProductionStatus;
};

const statusCopy: Record<ProductionStatus, string> = {
  paid: 'Sem pendências',
  pending: 'Pendentes',
  rejected: 'Reprovadas',
};

const statusColors: Record<ProductionStatus, string> = {
  paid: '#16a34a',
  pending: '#eab308',
  rejected: '#ef4444',
};

function buildGaugeStyle(value: number, total: number, color: string) {
  const safeTotal = total > 0 ? total : 1;
  const percentage = Math.max(0, Math.min(100, Math.round((value / safeTotal) * 100)));

  return {
    background: `conic-gradient(${color} ${percentage}%, #e2e8f0 ${percentage}% 100%)`,
  };
}

function GaugedCard({ label, value, total, accent, helper }: GaugedCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold text-slate-900"
        style={buildGaugeStyle(value, total, accent)}
      >
        <span className="rounded-full bg-white px-2 py-1 text-sm shadow-sm">{value}</span>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{helper ?? `${value} de ${total}`}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { currentUser, getVisibleOrders, getVisibleUsers, getShareLink, products } = useAuth();

  const orders = getVisibleOrders();
  const visibleUsers = getVisibleUsers();

  const productionSlices = useMemo<ProductionSlice[]>(() => {
    return visibleUsers.flatMap((user) => {
      const history = user.billing?.history ?? [];

      return history.map((payment) => {
        const normalizedRaw = payment.rawStatus?.toLowerCase() ?? '';
        let status: ProductionStatus = 'pending';

        if (payment.status === 'paid') {
          status = 'paid';
        } else if (payment.status === 'overdue' || normalizedRaw.includes('cancel') || normalizedRaw.includes('refus')) {
          status = 'rejected';
        }

        return {
          id: payment.id,
          ownerId: user.id,
          amount: payment.amount,
          status,
        };
      });
    });
  }, [visibleUsers]);

  const productionTotals = useMemo(() => {
    const base = productionSlices.reduce(
      (accumulator, slice) => {
        accumulator.counts[slice.status] = (accumulator.counts[slice.status] || 0) + 1;
        if (slice.status === 'paid') {
          accumulator.paidAmount += slice.amount;
        }
        accumulator.total += 1;
        return accumulator;
      },
      {
        counts: { paid: 0, pending: 0, rejected: 0 } as Record<ProductionStatus, number>,
        paidAmount: 0,
        total: 0,
      },
    );

    return base;
  }, [productionSlices]);

  const ordersByStatus = useMemo(() => {
    return orders.reduce<Record<string, number>>((accumulator, order) => {
      accumulator[order.status] = (accumulator[order.status] || 0) + 1;
      return accumulator;
    }, {} as Record<string, number>);
  }, [orders]);

  const totalTicket = useMemo(() => {
    return orders.reduce((total, order) => {
      const product = products.find((item) => item.id === order.productId);
      return total + (product?.price || 0);
    }, 0);
  }, [orders, products]);

  const productionTotalValue = productionTotals.paidAmount;

  return (
    <ProtectedPage>
      <section className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">Minha Produção</h1>
          <p className="text-sm text-slate-600">
            Acompanhe o volume gerado por produto e status. Apenas cobranças pagas entram no total da produção.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total da produção</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {productionTotalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <p className="mt-1 text-xs text-slate-500">Somente valores com status pago.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ticket potencial</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {totalTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <p className="mt-1 text-xs text-slate-500">Baseado nos pedidos lançados.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Produções registradas</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{productionTotals.total}</p>
            <p className="mt-1 text-xs text-slate-500">Inclui pagas, pendentes e reprovadas.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Links compartilháveis</p>
            <p className="mt-2 text-xs text-slate-600">{currentUser ? getShareLink(currentUser.id) : '—'}</p>
            <p className="mt-1 text-xs text-slate-500">Distribua para captar novas propostas.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(['rejected', 'pending', 'paid'] as ProductionStatus[]).map((status) => (
            <GaugedCard
              key={status}
              label={`Propostas ${statusCopy[status]}`}
              value={productionTotals.counts[status] ?? 0}
              total={productionTotals.total}
              accent={statusColors[status]}
              helper={
                status === 'paid'
                  ? 'Aprovadas e já pagas'
                  : status === 'pending'
                  ? 'Aguardando pagamento ou análise'
                  : 'Canceladas, vencidas ou recusadas'
              }
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Esteira</p>
                <h2 className="text-lg font-semibold text-slate-900">Pedidos por etapa</h2>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[{ key: 'novo', label: 'Novo' }, { key: 'em_contato', label: 'Em contato' }, { key: 'negociando', label: 'Negociando' }, { key: 'concluido', label: 'Concluído' }].map(
                (status) => (
                  <div key={status.key} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{status.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{ordersByStatus[status.key] ?? 0}</p>
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Equipe visível</p>
            <ul className="mt-3 space-y-3 text-sm text-slate-700">
              {visibleUsers.map((user) => (
                <li key={user.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <div>
                    <p className="font-semibold text-slate-900">{user.name}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{user.role}</p>
                  </div>
                  <span className="text-xs text-slate-500">{user.email}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </ProtectedPage>
  );
}

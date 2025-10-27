'use client';

import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProtectedPage } from '../components/ProtectedPage';

const STATUS_OPTIONS: { value: 'novo' | 'em_contato' | 'negociando' | 'concluido'; label: string }[] = [
  { value: 'novo', label: 'Novo' },
  { value: 'em_contato', label: 'Em contato' },
  { value: 'negociando', label: 'Negociando' },
  { value: 'concluido', label: 'Concluído' },
];

export default function PipelinePage() {
  const { getVisibleOrders, updateOrderStatus, users, products } = useAuth();
  const orders = getVisibleOrders();

  const ordersByStatus = useMemo(() => {
    return STATUS_OPTIONS.reduce<Record<string, typeof orders>>((accumulator, status) => {
      accumulator[status.value] = orders.filter((order) => order.status === status.value);
      return accumulator;
    }, {} as Record<string, typeof orders>);
  }, [orders]);

  return (
    <ProtectedPage>
      <section className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">Esteira de Negócios</h1>
          <p className="text-sm text-slate-600">
            Visualize pedidos por etapa e atualize o andamento das oportunidades em tempo real.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {STATUS_OPTIONS.map((status) => (
            <div key={status.value} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{status.label}</h2>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                  {ordersByStatus[status.value]?.length ?? 0}
                </span>
              </div>
              <div className="space-y-3">
                {ordersByStatus[status.value]?.map((order) => {
                  const product = products.find((item) => item.id === order.productId);
                  const owner = users.find((user) => user.id === order.ownerId);
                  return (
                    <div key={order.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
                      <p className="font-semibold text-slate-900">{order.customerName}</p>
                      {order.customerDocument && (
                        <p className="text-xs text-slate-500">CPF: {order.customerDocument}</p>
                      )}
                      <p className="text-xs text-slate-500">{product?.name}</p>
                      <p className="text-xs text-slate-500">Responsável: {owner?.name ?? '—'}</p>
                      <p className="text-xs text-slate-400">
                        Criado em {new Date(order.createdAt).toLocaleString('pt-BR')}
                      </p>
                      <select
                        value={order.status}
                        onChange={(event) => updateOrderStatus(order.id, event.target.value as typeof status.value)}
                        className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                {ordersByStatus[status.value]?.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                    Nenhum pedido nesta etapa.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </ProtectedPage>
  );
}

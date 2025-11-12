'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ProtectedPage } from '../../components/ProtectedPage';
import { consignadoCltBanks } from '@/lib/consignado-clt';

const placeholderColors = [
  'bg-slate-900 text-white',
  'bg-emerald-700 text-white',
  'bg-sky-700 text-white',
  'bg-amber-600 text-slate-900',
  'bg-indigo-700 text-white',
  'bg-rose-700 text-white',
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (!parts.length) return '?';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function ConsignadoCltBanksPage() {
  const banks = [...consignadoCltBanks].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ProtectedPage>
      <section className="space-y-6">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Crédito Consignado CLT</p>
          <h1 className="text-3xl font-semibold text-slate-900">Fichas por instituição financeira</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Acesse rapidamente a ficha de cadastro de cada banco parceiro para registrar a solicitação de consignado CLT.
            Mantenha os links atualizados nesta lista para garantir a simulação correta do cliente.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {banks.map((bank, index) => {
            const badgeClass = placeholderColors[index % placeholderColors.length];
            return (
              <Link
                key={bank.id}
                href={bank.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-start gap-4">
                  {bank.logo ? (
                    <Image
                      src={bank.logo}
                      alt={`Logo do ${bank.name}`}
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-xl object-contain"
                    />
                  ) : (
                    <span className={`flex h-16 w-16 items-center justify-center rounded-xl text-xl font-semibold ${badgeClass}`}>
                      {getInitials(bank.name)}
                    </span>
                  )}
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-slate-900">{bank.name}</h2>
                    <p className="text-sm text-slate-600">{bank.description}</p>
                    {bank.tags?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {bank.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between text-sm font-semibold text-slate-900">
                  <span>Preencher ficha</span>
                  <span className="text-base transition group-hover:translate-x-1">↗</span>
                </div>
              </Link>
            );
          })}
          {banks.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              Nenhuma instituição cadastrada ainda. Atualize a lista em <code className="rounded bg-slate-100 px-2 py-1 text-xs">lib/consignado-clt.ts</code> para adicionar novos bancos.
            </p>
          )}
        </div>
      </section>
    </ProtectedPage>
  );
}

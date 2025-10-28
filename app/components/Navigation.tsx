'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function Navigation() {
  const { currentUser, logout, isBillingRestricted, settings } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [gestaoOpen, setGestaoOpen] = useState(false);

  const tenantBranding = useMemo(() => {
    if (!currentUser) {
      return null;
    }

    const tenantId = currentUser.tenantId ?? (currentUser.role === 'admin' ? 'tenant-admin' : currentUser.id);
    const branding = settings.branding ?? {};

    return branding[tenantId] ?? branding['tenant-admin'] ?? null;
  }, [currentUser, settings.branding]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const restricted = useMemo(() => {
    if (!currentUser) {
      return false;
    }
    return isBillingRestricted(currentUser);
  }, [currentUser, isBillingRestricted]);

  const gestaoLinks = useMemo(() => {
    if (!currentUser) {
      return [] as { href: string; label: string }[];
    }

    const available = [] as { href: string; label: string }[];

    available.push({ href: '/billing', label: 'Financeiro' });

    if (currentUser.role === 'admin' || currentUser.role === 'master') {
      available.push({ href: '/branding', label: 'Identidade Visual' });
    }

    if (!restricted && currentUser.role !== 'user') {
      available.push({ href: '/users', label: 'Usuários' });
    }

    if (!restricted && currentUser.role === 'admin') {
      available.push({ href: '/profiles', label: 'Perfis' });
      available.push({ href: '/products', label: 'Produtos' });
      available.push({ href: '/security', label: 'Segurança' });
    } else if (restricted && currentUser.role === 'admin') {
      available.push({ href: '/security', label: 'Segurança' });
    }

    return available;
  }, [currentUser, restricted]);

  const primaryLinks = useMemo(() => {
    if (restricted) {
      return [] as { href: string; label: string }[];
    }

    return [
      { href: '/dashboard', label: 'Visão Geral' },
      { href: '/store', label: 'Loja Online' },
      { href: '/pipeline', label: 'Esteira de Negócios' },
    ];
  }, [restricted]);

  const isGestaoActive = gestaoLinks.some((link) => pathname.startsWith(link.href));

  useEffect(() => {
    setGestaoOpen(false);
  }, [pathname]);

  if (!currentUser) {
    return null;
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div
        className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-4 px-6 py-4 sm:grid-cols-[auto,1fr,auto]"
      >
        <div className="flex items-center gap-3">
          {tenantBranding?.logo ? (
            <img
              src={tenantBranding.logo}
              alt="Logo do tenant"
              className="max-h-12 w-auto max-w-[240px] object-contain"
            />
          ) : (
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Hiperban</p>
              <p className="text-base font-medium text-slate-900">Plataforma Comercial Integrada</p>
            </div>
          )}
        </div>
        <div className="w-full">
          <nav
            className="relative mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm font-medium sm:justify-center"
          >
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 transition-colors ${
                  pathname === link.href ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {gestaoLinks.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setGestaoOpen((previous) => !previous)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                    isGestaoActive ? 'bg-slate-900 text-white shadow-sm shadow-slate-200' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  aria-expanded={gestaoOpen}
                  aria-haspopup="true"
                >
                  Gestão
                  <span className="text-xs transition-transform duration-200" aria-hidden>
                    {gestaoOpen ? '▴' : '▾'}
                  </span>
                </button>
                {gestaoOpen && (
                  <div className="absolute left-1/2 z-40 mt-3 w-60 -translate-x-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white py-2 text-left shadow-xl shadow-slate-200 sm:left-auto sm:right-0 sm:translate-x-0">
                    {gestaoLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          pathname.startsWith(link.href)
                            ? 'bg-slate-900/5 text-slate-900'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>
        <div className="flex w-full items-center justify-end gap-4 sm:justify-end">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">{currentUser.name}</p>
            <p className="text-xs uppercase tracking-wide text-slate-500">{currentUser.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}

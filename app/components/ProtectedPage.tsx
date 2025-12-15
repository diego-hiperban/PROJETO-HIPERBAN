'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { Role } from '@/lib/platform-data';

type Props = {
  children: React.ReactNode;
  allowedRoles?: Role[];
  allowWhenRestricted?: boolean;
};

export function ProtectedPage({ children, allowedRoles, allowWhenRestricted = false }: Props) {
  const { currentUser, isBillingRestricted, hydrated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!currentUser) {
      router.push('/login');
      return;
    }

    if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
      router.push('/dashboard');
      return;
    }

    if (!allowWhenRestricted && isBillingRestricted(currentUser)) {
      router.push('/billing');
    }
  }, [allowedRoles, allowWhenRestricted, currentUser, hydrated, isBillingRestricted, router]);

  if (!hydrated) {
    return null;
  }

  if (!currentUser) {
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return null;
  }

  if (!allowWhenRestricted && isBillingRestricted(currentUser)) {
    return null;
  }

  return <>{children}</>;
}

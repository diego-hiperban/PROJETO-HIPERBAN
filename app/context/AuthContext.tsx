'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  BillingStatus,
  Order,
  PaymentRecord,
  Plan,
  Product,
  ProductIntegration,
  Role,
  User,
  UserBilling,
  UserProfile,
  UserStatus,
  plans as seedPlans,
  products as seedProducts,
  profiles as seedProfiles,
  storeBaseUrl,
  users as seedUsers,
} from '@/lib/data';
import { readValue, writeValue } from '@/lib/persistence';
import {
  DEFAULT_TENANT_PALETTE,
  TenantPalette,
  ensurePalette,
  mergePalette,
  paletteToCssVariables,
} from '@/lib/theme';

type StoredCredential = {
  id: string;
  label: string;
  description?: string;
  scope?: 'platform' | 'product' | 'user' | 'integration';
  value?: string;
  updatedAt?: string;
};

export type TenantBranding = {
  logo?: string;
  logoName?: string;
  logoMimeType?: string;
  logoWidth?: number;
  logoHeight?: number;
  logoUpdatedAt?: string;
  palette?: TenantPalette;
  paletteUpdatedAt?: string;
};

type PlatformSettings = {
  asaasApiKey?: string;
  asaasApiUrl?: string;
  credihomeApiKey?: string;
  credihomeApiUsername?: string;
  credihomeApiPassword?: string;
  credihomePartnerCode?: string;
  credihomeApiUrl?: string;
  credentials: StoredCredential[];
  branding: Record<string, TenantBranding>;
};

type TenantBrandingUpdate = {
  logo?: string;
  logoName?: string;
  logoMimeType?: string;
  logoWidth?: number;
  logoHeight?: number;
  logoUpdatedAt?: string;
  palette?: Partial<TenantPalette> | null;
  paletteUpdatedAt?: string;
};

interface AuthContextValue {
  currentUser: User | null;
  hydrated: boolean;
  users: User[];
  profiles: UserProfile[];
  products: Product[];
  plans: Plan[];
  orders: Order[];
  settings: PlatformSettings;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  createOrder: (data: {
    productId: string;
    customerName: string;
    customerDocument?: string;
    referrerId: string;
  }) => Order;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  getShareLink: (userId: string) => string;
  getProductShareLink: (productId: string, userId: string) => string;
  getVisibleUsers: () => User[];
  getVisibleOrders: () => Order[];
  createUser: (data: NewUserInput) => { user: User | null; error?: string };
  updateUser: (userId: string, data: UpdateUserInput) => void;
  updateUserStatus: (userId: string, status: UserStatus) => void;
  deleteUser: (userId: string) => void;
  createProfile: (data: NewProfileInput) => UserProfile;
  createProduct: (data: NewProductInput) => Product;
  updateProduct: (productId: string, data: Partial<NewProductInput>) => void;
  createPlan: (data: NewPlanInput) => Plan;
  updatePlan: (planId: string, data: Partial<NewPlanInput>) => void;
  assignPlanToUser: (
    userId: string,
    planId: string,
    options?: {
      customPrice?: number;
      status?: BillingStatus;
      trialDays?: number;
      expiresAt?: string;
      seatsIncluded?: number;
      additionalSeats?: number;
    },
  ) => void;
  updateUserBilling: (userId: string, data: Partial<UserBilling>) => void;
  recordPayment: (userId: string, payment: PaymentRecord, nextStatus?: BillingStatus) => void;
  removePaymentRecord: (
    userId: string,
    paymentId: string,
    options?: { clearCheckout?: boolean; statusOverride?: BillingStatus },
  ) => void;
  requestCheckout: (params: CheckoutRequest) => Promise<CheckoutResponse>;
  getPlanById: (planId: string) => Plan | undefined;
  isBillingRestricted: (user?: User | null) => boolean;
  getRemainingTrialDays: (userId: string) => number | null;
  updateSettings: (data: Partial<PlatformSettings>) => void;
  updateTenantBranding: (tenantId: string, data: TenantBrandingUpdate) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'hiperban-auth-user';
const ORDERS_KEY = 'hiperban-orders';
const USERS_KEY = 'hiperban-users';
const PROFILES_KEY = 'hiperban-profiles';
const PRODUCTS_KEY = 'hiperban-products';
const PLANS_KEY = 'hiperban-plans';
const SETTINGS_KEY = 'hiperban-settings';

type Props = {
  children: React.ReactNode;
};

type NewUserInput = {
  name: string;
  email: string;
  password: string;
  profileId: string;
  status?: UserStatus;
  parentId?: string;
  company?: string;
  city?: string;
  phone?: string;
  viewCommissions?: boolean;
  bank?: User['bank'];
  document?: string;
  billingPlanId?: string;
  billingCustomPrice?: number;
  billingStatus?: BillingStatus;
  billingTrialDays?: number;
  billingExpiresAt?: string;
  billingSeatsIncluded?: number;
  billingAdditionalSeats?: number;
};

type UpdateUserInput = {
  name?: string;
  email?: string;
  password?: string;
  profileId?: string;
  status?: UserStatus;
  parentId?: string | null;
  company?: string | null;
  city?: string | null;
  phone?: string | null;
  viewCommissions?: boolean;
  bank?: User['bank'];
  document?: string | null;
};

const SUBORDINATE_ROLES: Role[] = ['user', 'operational'];

type NewProfileInput = {
  name: string;
  description: string;
  role: UserProfile['role'];
};

type NewProductInput = {
  name: string;
  description: string;
  price: number;
  category?: string;
  provider?: string;
  link?: string;
  imageUrl?: string;
  integration?: ProductIntegration;
};

type NewPlanInput = {
  name: string;
  description: string;
  price: number;
  period: Plan['period'];
  durationInDays: number;
  allowCustomPrice?: boolean;
  seatsIncluded: number;
  additionalSeatPrice?: number;
  additionalSeatLimit?: number;
  trialDays?: number;
};

type CheckoutRequest =
  | {
      type: 'plan';
      userId: string;
      planId: string;
      customPrice?: number;
    }
  | {
      type: 'seat';
      userId: string;
      planId: string;
      quantity: number;
      seatPrice: number;
    };

type CheckoutResponse = {
  checkoutUrl?: string;
  message?: string;
  error?: string;
  customerId?: string;
  subscriptionId?: string;
  paymentId?: string;
  details?: unknown;
};

const findSubordinates = (userId: string, allUsers: User[]): User[] => {
  const direct = allUsers.filter((user) => user.parentId === userId);
  const indirect = direct.flatMap((child) => findSubordinates(child.id, allUsers));
  return [...direct, ...indirect];
};

const DEFAULT_TENANT_ID = 'tenant-admin';

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 11);
};

const cleanDocument = (value?: string | null) => {
  if (!value) return undefined;
  const numeric = value.replace(/\D+/g, '');
  return numeric.length > 0 ? numeric : undefined;
};

const isValidDate = (value?: string) => {
  if (!value) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime());
};

const sortPaymentsByDateDesc = (records: PaymentRecord[]): PaymentRecord[] =>
  records
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

const determineBillingStatus = ({
  history,
  previousStatus,
  trialEndsAt,
  override,
}: {
  history: PaymentRecord[];
  previousStatus?: BillingStatus;
  trialEndsAt?: string;
  override?: BillingStatus;
}): BillingStatus => {
  if (override) {
    return override;
  }

  const hasPaid = history.some((entry) => entry.status === 'paid');
  if (hasPaid) {
    return 'active';
  }

  if (previousStatus === 'cancelled' || previousStatus === 'expired') {
    return previousStatus;
  }

  const hasOverdue = history.some((entry) => entry.status === 'overdue');
  if (hasOverdue) {
    return 'overdue';
  }

  if (trialEndsAt && isValidDate(trialEndsAt)) {
    const trialDate = new Date(trialEndsAt);
    if (trialDate.getTime() > Date.now()) {
      return 'trial';
    }
  }

  return 'pending';
};

const isValidCPF = (value: string): boolean => {
  if (!/^\d{11}$/.test(value)) return false;
  if (/^([0-9])\1{10}$/.test(value)) return false;

  const digits = value.split('').map((char) => Number(char));

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += digits[i] * (10 - i);
  }
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== digits[9]) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += digits[i] * (11 - i);
  }
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === digits[10];
};

const isValidCNPJ = (value: string): boolean => {
  if (!/^\d{14}$/.test(value)) return false;
  if (/^([0-9])\1{13}$/.test(value)) return false;

  const digits = value.split('').map((char) => Number(char));
  const calcCheckDigit = (length: number) => {
    const factors = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let total = 0;
    for (let i = 0; i < factors.length; i += 1) {
      total += digits[i] * factors[i];
    }
    const mod = total % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const firstCheck = calcCheckDigit(12);
  if (firstCheck !== digits[12]) return false;
  const secondCheck = calcCheckDigit(13);
  return secondCheck === digits[13];
};

const mergeProductsWithSeeds = (stored: Product[] | null, seeds: Product[]): Product[] => {
  if (!stored || stored.length === 0) {
    return seeds;
  }

  const withDefaults = stored.map((product) => {
    const seed = seeds.find((item) => item.id === product.id);
    if (!seed) {
      return product;
    }

    return {
      ...seed,
      ...product,
      integration: product.integration ?? seed.integration,
    };
  });

  const storedIds = new Set(stored.map((product) => product.id));
  const missingSeeds = seeds.filter((product) => !storedIds.has(product.id));

  return [...withDefaults, ...missingSeeds];
};

const mergePlansWithSeeds = (stored: Plan[] | null, seeds: Plan[]): Plan[] => {
  if (!stored || stored.length === 0) {
    return seeds;
  }

  const storedIds = new Set(stored.map((plan) => plan.id));
  const merged = stored.map((plan) => {
    const seed = seeds.find((item) => item.id === plan.id);
    if (!seed) return plan;
    return { ...seed, ...plan };
  });

  const missing = seeds.filter((plan) => !storedIds.has(plan.id));
  return [...merged, ...missing];
};

const allowedCredentialScopes: StoredCredential['scope'][] = [
  'platform',
  'product',
  'user',
  'integration',
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

const normalizeCredential = (
  credential: Partial<StoredCredential> | null | undefined,
): StoredCredential | null => {
  if (!credential) {
    return null;
  }

  const now = new Date().toISOString();
  const rawId =
    typeof credential.id === 'string' && credential.id.trim()
      ? credential.id.trim()
      : typeof credential.label === 'string' && credential.label.trim()
        ? credential.label.trim()
        : `credential-${generateId()}`;

  const normalizedIdFromRaw = slugify(rawId);
  const normalizedId = normalizedIdFromRaw || `credential-${generateId()}`;

  const label =
    typeof credential.label === 'string' && credential.label.trim()
      ? credential.label.trim()
      : rawId;

  const description =
    typeof credential.description === 'string' && credential.description.trim()
      ? credential.description.trim()
      : undefined;

  const scope = allowedCredentialScopes.includes(credential.scope as StoredCredential['scope'])
    ? (credential.scope as StoredCredential['scope'])
    : 'integration';

  let value: string | undefined;
  if (typeof credential.value === 'string') {
    value = credential.value.trim() || undefined;
  } else if (typeof credential.value !== 'undefined' && credential.value !== null) {
    value = String(credential.value);
  }

  let updatedAt = now;
  if (credential.updatedAt) {
    const parsed = new Date(credential.updatedAt);
    if (!Number.isNaN(parsed.valueOf())) {
      updatedAt = parsed.toISOString();
    }
  }

  return {
    id: normalizedId,
    label,
    description,
    scope,
    value,
    updatedAt,
  };
};

const normalizeCredentialList = (
  credentials: unknown,
): StoredCredential[] => {
  const items: (Partial<StoredCredential> | null | undefined)[] = [];

  if (Array.isArray(credentials)) {
    items.push(...credentials);
  } else if (credentials && typeof credentials === 'object') {
    Object.entries(credentials as Record<string, unknown>).forEach(([key, value]) => {
      if (value && typeof value === 'object') {
        items.push({ id: key, ...(value as Partial<StoredCredential>) });
        return;
      }

      if (typeof value === 'string') {
        items.push({ id: key, value, label: key });
        return;
      }

      if (typeof value !== 'undefined' && value !== null) {
        items.push({ id: key, value: String(value), label: key });
      }
    });
  }

  const unique = new Map<string, StoredCredential>();
  items.forEach((item) => {
    const normalized = normalizeCredential(item);
    if (normalized) {
      unique.set(normalized.id, normalized);
    }
  });

  return Array.from(unique.values());
};

const normalizeTenantBranding = (
  branding: TenantBrandingUpdate | null | undefined,
): TenantBranding | null => {
  if (!branding || typeof branding !== 'object') {
    return null;
  }

  const next: TenantBranding = {};
  let hasData = false;
  const nowIso = new Date().toISOString();

  if (typeof branding.logo === 'string') {
    const trimmed = branding.logo.trim();
    if (trimmed) {
      next.logo = trimmed;
      hasData = true;
    }
  }

  if (typeof branding.logoName === 'string') {
    const trimmed = branding.logoName.trim();
    if (trimmed) {
      next.logoName = trimmed;
      hasData = true;
    }
  }

  if (typeof branding.logoMimeType === 'string') {
    const trimmed = branding.logoMimeType.trim();
    if (trimmed) {
      next.logoMimeType = trimmed;
      hasData = true;
    }
  }

  if (typeof branding.logoWidth === 'number' && Number.isFinite(branding.logoWidth)) {
    const rounded = Math.max(0, Math.round(branding.logoWidth));
    if (rounded > 0) {
      next.logoWidth = rounded;
      hasData = true;
    }
  }

  if (typeof branding.logoHeight === 'number' && Number.isFinite(branding.logoHeight)) {
    const rounded = Math.max(0, Math.round(branding.logoHeight));
    if (rounded > 0) {
      next.logoHeight = rounded;
      hasData = true;
    }
  }

  if (branding.logoUpdatedAt) {
    const parsed = new Date(branding.logoUpdatedAt);
    if (!Number.isNaN(parsed.valueOf())) {
      next.logoUpdatedAt = parsed.toISOString();
      hasData = true;
    }
  }

  if ('palette' in branding && branding.palette) {
    const normalizedPalette = ensurePalette(branding.palette as TenantPalette);
    if (normalizedPalette) {
      next.palette = normalizedPalette;
      hasData = true;
    }
  }

  if (branding.paletteUpdatedAt) {
    const parsed = new Date(branding.paletteUpdatedAt);
    if (!Number.isNaN(parsed.valueOf())) {
      next.paletteUpdatedAt = parsed.toISOString();
      hasData = true;
    }
  }

  if (!hasData) {
    return null;
  }

  if (next.logo && !next.logoUpdatedAt) {
    next.logoUpdatedAt = nowIso;
  }

  if (next.palette && !next.paletteUpdatedAt) {
    next.paletteUpdatedAt = nowIso;
  }

  return next;
};

const normalizeBrandingMap = (branding: unknown): Record<string, TenantBranding> => {
  if (!branding || typeof branding !== 'object') {
    return {};
  }

  const entries = Object.entries(branding as Record<string, unknown>);
  const result: Record<string, TenantBranding> = {};

  entries.forEach(([tenantId, value]) => {
    if (typeof tenantId !== 'string') {
      return;
    }
    const normalizedId = tenantId.trim();
    if (!normalizedId) {
      return;
    }

    const normalized = normalizeTenantBranding(value as Partial<TenantBranding>);
    if (normalized) {
      result[normalizedId] = normalized;
    }
  });

  return result;
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeBilling = (billing?: UserBilling | null): UserBilling | undefined => {
  if (!billing) return undefined;

  const now = new Date();
  const trialEndsAt = billing.trialEndsAt ? new Date(billing.trialEndsAt) : undefined;
  const expiresAt = billing.expiresAt ? new Date(billing.expiresAt) : undefined;
  let status: BillingStatus = billing.status;

  if (status === 'trial' && trialEndsAt && trialEndsAt.getTime() < now.getTime()) {
    status = 'expired';
  }

  if (status === 'active' && expiresAt && expiresAt.getTime() < now.getTime()) {
    status = 'expired';
  }

  if (status === 'pending' && expiresAt && expiresAt.getTime() < now.getTime()) {
    status = 'overdue';
  }

  if (status === 'overdue' && expiresAt && expiresAt.getTime() >= now.getTime()) {
    status = 'pending';
  }

  return {
    ...billing,
    status,
    trialEndsAt: trialEndsAt?.toISOString(),
    expiresAt: expiresAt?.toISOString(),
  };
};

const normalizeUser = (user: User): User => {
  const tenantId = user.tenantId
    ? user.tenantId
    : user.role === 'master'
      ? user.id
      : user.parentId
        ? user.parentId
        : user.role === 'admin'
          ? DEFAULT_TENANT_ID
          : DEFAULT_TENANT_ID;

  return {
    ...user,
    tenantId,
    document: cleanDocument(user.document),
    billing: normalizeBilling(user.billing),
  };
};

const getRemainingTrialDaysFromBilling = (billing?: UserBilling | null): number | null => {
  if (!billing || billing.status !== 'trial' || !billing.trialEndsAt) {
    return null;
  }

  const now = new Date();
  const ends = new Date(billing.trialEndsAt);
  const diff = Math.ceil((ends.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
};

const DEFAULT_SETTINGS: PlatformSettings = {
  credentials: [],
  branding: {},
};

export function AuthProvider({ children }: Props) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [usersState, setUsersState] = useState<User[]>(() => seedUsers.map(normalizeUser));
  const [profilesState, setProfilesState] = useState<UserProfile[]>(seedProfiles);
  const [productsState, setProductsState] = useState<Product[]>(seedProducts);
  const [plansState, setPlansState] = useState<Plan[]>(seedPlans);
  const [settingsState, setSettingsState] = useState<PlatformSettings>(DEFAULT_SETTINGS);

  const activePalette = useMemo(() => {
    const branding = settingsState.branding ?? {};

    if (!currentUser) {
      const adminBranding = branding[DEFAULT_TENANT_ID];
      return ensurePalette(adminBranding?.palette ?? DEFAULT_TENANT_PALETTE);
    }

    const tenantId = currentUser.tenantId ?? (currentUser.role === 'admin' ? DEFAULT_TENANT_ID : currentUser.id);
    const tenantBranding = branding[tenantId];

    if (tenantBranding?.palette) {
      return ensurePalette(tenantBranding.palette);
    }

    if (tenantId !== DEFAULT_TENANT_ID) {
      const fallbackBranding = branding[DEFAULT_TENANT_ID];
      if (fallbackBranding?.palette) {
        return ensurePalette(fallbackBranding.palette);
      }
    }

    return ensurePalette(DEFAULT_TENANT_PALETTE);
  }, [currentUser, settingsState.branding]);

  const updateUsers = useCallback(
    (updater: (previous: User[]) => User[]) => {
      setUsersState((previous) => {
        const next = updater(previous).map(normalizeUser);
        setCurrentUser((prevCurrent) => {
          if (!prevCurrent) return prevCurrent;
          const updated = next.find((user) => user.id === prevCurrent.id);
          return updated ?? prevCurrent;
        });
        return next;
      });
    },
    [setCurrentUser],
  );

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;

    const hydrate = async () => {
      try {
        const [
          storedUser,
          storedOrders,
          storedUsers,
          storedProfiles,
          storedProducts,
          storedPlans,
          storedSettings,
        ] = await Promise.all([
          readValue<User | null>(STORAGE_KEY),
          readValue<Order[]>(ORDERS_KEY),
          readValue<User[]>(USERS_KEY),
          readValue<UserProfile[]>(PROFILES_KEY),
          readValue<Product[]>(PRODUCTS_KEY),
          readValue<Plan[]>(PLANS_KEY),
          readValue<PlatformSettings>(SETTINGS_KEY),
        ]);

        if (cancelled) return;

        if (storedUser) {
          setCurrentUser(normalizeUser(storedUser));
        }

        if (storedOrders && storedOrders.length > 0) {
          setOrders(storedOrders.map((order) => ({ ...order, customerDocument: order.customerDocument ?? '' })));
        }

        if (storedUsers && storedUsers.length > 0) {
          const normalized = storedUsers.map(normalizeUser);
          setUsersState(normalized);
          setCurrentUser((prev) => {
            if (!prev) return prev;
            const updated = normalized.find((user) => user.id === prev.id);
            return updated ?? prev;
          });
        }

        if (storedProfiles && storedProfiles.length > 0) {
          setProfilesState(storedProfiles);
        }

        if (storedProducts && storedProducts.length > 0) {
          setProductsState(mergeProductsWithSeeds(storedProducts, seedProducts));
        }

        if (storedPlans && storedPlans.length > 0) {
          setPlansState(mergePlansWithSeeds(storedPlans, seedPlans));
        }

        if (storedSettings) {
          const credentials = normalizeCredentialList(storedSettings.credentials ?? []);
          const branding = normalizeBrandingMap(storedSettings.branding ?? {});
          const mergedSettings: PlatformSettings = {
            ...DEFAULT_SETTINGS,
            ...storedSettings,
            credentials,
            branding: { ...DEFAULT_SETTINGS.branding, ...branding },
          };
          if (!mergedSettings.asaasApiKey) {
            const savedKey = credentials.find((item) => item.id === 'asaas-api-key')?.value;
            if (savedKey) {
              mergedSettings.asaasApiKey = savedKey;
            }
          }

          if (!mergedSettings.asaasApiUrl) {
            const savedUrl = credentials.find((item) => item.id === 'asaas-api-url')?.value;
            if (savedUrl) {
              mergedSettings.asaasApiUrl = savedUrl;
            }
          }

          if (!mergedSettings.credihomeApiKey) {
            const savedKey = credentials.find((item) => item.id === 'credihome-api-key')?.value;
            if (savedKey) {
              mergedSettings.credihomeApiKey = savedKey;
            }
          }

          if (!mergedSettings.credihomeApiUsername) {
            const savedUsername = credentials.find((item) => item.id === 'credihome-api-username')?.value;
            if (savedUsername) {
              mergedSettings.credihomeApiUsername = savedUsername;
            }
          }

          if (!mergedSettings.credihomeApiPassword) {
            const savedPassword = credentials.find((item) => item.id === 'credihome-api-password')?.value;
            if (savedPassword) {
              mergedSettings.credihomeApiPassword = savedPassword;
            }
          }

          if (!mergedSettings.credihomeApiUrl) {
            const savedUrl = credentials.find((item) => item.id === 'credihome-api-url')?.value;
            if (savedUrl) {
              mergedSettings.credihomeApiUrl = savedUrl;
            }
          }

          if (!mergedSettings.credihomePartnerCode) {
            const savedPartnerCode = credentials.find((item) => item.id === 'credihome-partner-code')?.value;
            if (savedPartnerCode) {
              mergedSettings.credihomePartnerCode = savedPartnerCode;
            }
          }
          setSettingsState(mergedSettings);
        }
      } catch (error) {
        console.error('Erro ao restaurar dados salvos localmente', error);
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };

    hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const persist = async () => {
      if (currentUser) {
        await writeValue(STORAGE_KEY, currentUser);
      } else {
        await writeValue<User | null>(STORAGE_KEY, undefined);
      }
    };
    void persist();
  }, [currentUser, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void writeValue(ORDERS_KEY, orders);
  }, [orders, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void writeValue(USERS_KEY, usersState);
  }, [usersState, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void writeValue(PROFILES_KEY, profilesState);
  }, [profilesState, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void writeValue(PRODUCTS_KEY, productsState);
  }, [productsState, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void writeValue(PLANS_KEY, plansState);
  }, [plansState, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void writeValue(SETTINGS_KEY, settingsState);
  }, [settingsState, hydrated]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const variables = paletteToCssVariables(activePalette);

    Object.entries(variables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [activePalette]);

  const updateSettings = useCallback((data: Partial<PlatformSettings>) => {
    setSettingsState((previous) => {
      const {
        credentials: incomingCredentials,
        branding: incomingBranding,
        asaasApiKey: incomingApiKey,
        asaasApiUrl: incomingApiUrl,
        credihomeApiKey: incomingCredihomeKey,
        credihomeApiUsername: incomingCredihomeUsername,
        credihomeApiPassword: incomingCredihomePassword,
        credihomePartnerCode: incomingCredihomePartnerCode,
        credihomeApiUrl: incomingCredihomeApiUrl,
        ...otherSettings
      } = data;

      let nextCredentials = incomingCredentials
        ? normalizeCredentialList(incomingCredentials)
        : [...(previous.credentials ?? [])];

      let nextApiKey = previous.asaasApiKey;
      if (typeof incomingApiKey !== 'undefined') {
        const trimmed = incomingApiKey?.trim();
        nextApiKey = trimmed ? trimmed : undefined;
        nextCredentials = nextCredentials.filter((item) => item.id !== 'asaas-api-key');
        if (nextApiKey) {
          const normalized = normalizeCredential({
            id: 'asaas-api-key',
            label: 'Chave API Asaas',
            scope: 'integration',
            value: nextApiKey,
            updatedAt: new Date().toISOString(),
          });
          if (normalized) {
            nextCredentials = [...nextCredentials, normalized];
          }
        }
      } else if (!incomingCredentials && previous.asaasApiKey) {
        const exists = nextCredentials.some((item) => item.id === 'asaas-api-key');
        if (!exists) {
          const normalized = normalizeCredential({
            id: 'asaas-api-key',
            label: 'Chave API Asaas',
            scope: 'integration',
            value: previous.asaasApiKey,
            updatedAt: new Date().toISOString(),
          });
          if (normalized) {
            nextCredentials = [...nextCredentials, normalized];
          }
        }
      }

      let nextApiUrl = previous.asaasApiUrl;
      if (typeof incomingApiUrl !== 'undefined') {
        const trimmed = incomingApiUrl?.trim();
        nextApiUrl = trimmed ? trimmed : undefined;
        nextCredentials = nextCredentials.filter((item) => item.id !== 'asaas-api-url');
        if (nextApiUrl) {
          const normalized = normalizeCredential({
            id: 'asaas-api-url',
            label: 'URL API Asaas',
            scope: 'integration',
            value: nextApiUrl,
            updatedAt: new Date().toISOString(),
          });
          if (normalized) {
            nextCredentials = [...nextCredentials, normalized];
          }
        }
      } else if (!incomingCredentials && previous.asaasApiUrl) {
        const exists = nextCredentials.some((item) => item.id === 'asaas-api-url');
        if (!exists) {
          const normalized = normalizeCredential({
            id: 'asaas-api-url',
            label: 'URL API Asaas',
            scope: 'integration',
            value: previous.asaasApiUrl,
            updatedAt: new Date().toISOString(),
          });
          if (normalized) {
            nextCredentials = [...nextCredentials, normalized];
          }
        }
      }

      let nextCredihomeKey = previous.credihomeApiKey;
      if (typeof incomingCredihomeKey !== 'undefined') {
        const trimmed = incomingCredihomeKey?.trim();
        nextCredihomeKey = trimmed ? trimmed : undefined;
        nextCredentials = nextCredentials.filter((item) => item.id !== 'credihome-api-key');
        if (nextCredihomeKey) {
          const normalized = normalizeCredential({
            id: 'credihome-api-key',
            label: 'Chave API Credihome',
            scope: 'integration',
            value: nextCredihomeKey,
            updatedAt: new Date().toISOString(),
          });
          if (normalized) {
            nextCredentials = [...nextCredentials, normalized];
          }
        }
      } else if (!incomingCredentials && previous.credihomeApiKey) {
        const exists = nextCredentials.some((item) => item.id === 'credihome-api-key');
        if (!exists) {
          const normalized = normalizeCredential({
            id: 'credihome-api-key',
            label: 'Chave API Credihome',
            scope: 'integration',
            value: previous.credihomeApiKey,
            updatedAt: new Date().toISOString(),
          });
          if (normalized) {
            nextCredentials = [...nextCredentials, normalized];
          }
        }
      }

      let nextCredihomeUsername = previous.credihomeApiUsername;
      if (typeof incomingCredihomeUsername !== 'undefined') {
        const trimmed = incomingCredihomeUsername?.trim();
        nextCredihomeUsername = trimmed ? trimmed : undefined;
        nextCredentials = nextCredentials.filter((item) => item.id !== 'credihome-api-username');
        if (nextCredihomeUsername) {
          const normalized = normalizeCredential({
            id: 'credihome-api-username',
            label: 'Usuário Credihome',
            scope: 'integration',
            value: nextCredihomeUsername,
            updatedAt: new Date().toISOString(),
          });
          if (normalized) {
            nextCredentials = [...nextCredentials, normalized];
          }
        }
      } else if (!incomingCredentials && previous.credihomeApiUsername) {
        const exists = nextCredentials.some((item) => item.id === 'credihome-api-username');
        if (!exists) {
          const normalized = normalizeCredential({
            id: 'credihome-api-username',
            label: 'Usuário Credihome',
            scope: 'integration',
            value: previous.credihomeApiUsername,
            updatedAt: new Date().toISOString(),
          });
          if (normalized) {
            nextCredentials = [...nextCredentials, normalized];
          }
        }
      }

      let nextCredihomePassword = previous.credihomeApiPassword;
      if (typeof incomingCredihomePassword !== 'undefined') {
        const trimmed = incomingCredihomePassword?.trim();
        nextCredihomePassword = trimmed ? trimmed : undefined;
        nextCredentials = nextCredentials.filter((item) => item.id !== 'credihome-api-password');
        if (nextCredihomePassword) {
          const normalized = normalizeCredential({
            id: 'credihome-api-password',
            label: 'Senha Credihome',
            scope: 'integration',
            value: nextCredihomePassword,
            updatedAt: new Date().toISOString(),
          });
          if (normalized) {
            nextCredentials = [...nextCredentials, normalized];
          }
        }
      } else if (!incomingCredentials && previous.credihomeApiPassword) {
        const exists = nextCredentials.some((item) => item.id === 'credihome-api-password');
        if (!exists) {
          const normalized = normalizeCredential({
            id: 'credihome-api-password',
            label: 'Senha Credihome',
            scope: 'integration',
            value: previous.credihomeApiPassword,
            updatedAt: new Date().toISOString(),
          });
          if (normalized) {
            nextCredentials = [...nextCredentials, normalized];
          }
        }
      }

      let nextCredihomeApiUrl = previous.credihomeApiUrl;
      if (typeof incomingCredihomeApiUrl !== 'undefined') {
        const trimmed = incomingCredihomeApiUrl?.trim();
        nextCredihomeApiUrl = trimmed ? trimmed : undefined;
        nextCredentials = nextCredentials.filter((item) => item.id !== 'credihome-api-url');
        if (nextCredihomeApiUrl) {
          const normalized = normalizeCredential({
            id: 'credihome-api-url',
            label: 'URL API Credihome',
            scope: 'integration',
            value: nextCredihomeApiUrl,
            updatedAt: new Date().toISOString(),
          });
          if (normalized) {
            nextCredentials = [...nextCredentials, normalized];
          }
        }
      } else if (!incomingCredentials && previous.credihomeApiUrl) {
        const exists = nextCredentials.some((item) => item.id === 'credihome-api-url');
        if (!exists) {
          const normalized = normalizeCredential({
            id: 'credihome-api-url',
            label: 'URL API Credihome',
            scope: 'integration',
            value: previous.credihomeApiUrl,
            updatedAt: new Date().toISOString(),
          });
          if (normalized) {
            nextCredentials = [...nextCredentials, normalized];
          }
        }
      }

      let nextCredihomePartnerCode = previous.credihomePartnerCode;
      if (typeof incomingCredihomePartnerCode !== 'undefined') {
        const trimmed = incomingCredihomePartnerCode?.trim();
        nextCredihomePartnerCode = trimmed ? trimmed : undefined;
        nextCredentials = nextCredentials.filter((item) => item.id !== 'credihome-partner-code');
        if (nextCredihomePartnerCode) {
          const normalized = normalizeCredential({
            id: 'credihome-partner-code',
            label: 'Código parceiro Credihome',
            scope: 'integration',
            value: nextCredihomePartnerCode,
            updatedAt: new Date().toISOString(),
          });
          if (normalized) {
            nextCredentials = [...nextCredentials, normalized];
          }
        }
      } else if (!incomingCredentials && previous.credihomePartnerCode) {
        const exists = nextCredentials.some((item) => item.id === 'credihome-partner-code');
        if (!exists) {
          const normalized = normalizeCredential({
            id: 'credihome-partner-code',
            label: 'Código parceiro Credihome',
            scope: 'integration',
            value: previous.credihomePartnerCode,
            updatedAt: new Date().toISOString(),
          });
          if (normalized) {
            nextCredentials = [...nextCredentials, normalized];
          }
        }
      }

      nextCredentials = normalizeCredentialList(nextCredentials);

      let nextBranding = previous.branding ?? {};
      if (typeof incomingBranding !== 'undefined') {
        nextBranding = normalizeBrandingMap(incomingBranding);
      }

      const merged: PlatformSettings = {
        ...previous,
        ...otherSettings,
        credentials: nextCredentials,
        branding: nextBranding,
        asaasApiKey: nextApiKey,
        asaasApiUrl: nextApiUrl,
        credihomeApiKey: nextCredihomeKey,
        credihomeApiUsername: nextCredihomeUsername,
        credihomeApiPassword: nextCredihomePassword,
        credihomeApiUrl: nextCredihomeApiUrl,
        credihomePartnerCode: nextCredihomePartnerCode,
      };

      if (!merged.asaasApiKey) {
        const storedKey = nextCredentials.find((item) => item.id === 'asaas-api-key')?.value;
        if (storedKey) {
          merged.asaasApiKey = storedKey;
        }
      }

      if (!merged.asaasApiUrl) {
        const storedUrl = nextCredentials.find((item) => item.id === 'asaas-api-url')?.value;
        if (storedUrl) {
          merged.asaasApiUrl = storedUrl;
        }
      }

      if (!merged.credihomeApiKey) {
        const stored = nextCredentials.find((item) => item.id === 'credihome-api-key')?.value;
        if (stored) {
          merged.credihomeApiKey = stored;
        }
      }

      if (!merged.credihomeApiUsername) {
        const stored = nextCredentials.find((item) => item.id === 'credihome-api-username')?.value;
        if (stored) {
          merged.credihomeApiUsername = stored;
        }
      }

      if (!merged.credihomeApiPassword) {
        const stored = nextCredentials.find((item) => item.id === 'credihome-api-password')?.value;
        if (stored) {
          merged.credihomeApiPassword = stored;
        }
      }

      if (!merged.credihomeApiUrl) {
        const stored = nextCredentials.find((item) => item.id === 'credihome-api-url')?.value;
        if (stored) {
          merged.credihomeApiUrl = stored;
        }
      }

      if (!merged.credihomePartnerCode) {
        const stored = nextCredentials.find((item) => item.id === 'credihome-partner-code')?.value;
        if (stored) {
          merged.credihomePartnerCode = stored;
        }
      }















      return merged;
    });
  }, []);

  const updateTenantBranding = useCallback(
    (tenantId: string, data: TenantBrandingUpdate) => {
      setSettingsState((previous) => {
        const normalizedId = tenantId?.trim();
        if (!normalizedId) {
          return previous;
        }

        const currentBranding = previous.branding ?? {};
        const existing = currentBranding[normalizedId];
        const payload: TenantBrandingUpdate = { ...(existing ?? {}) };

        if (typeof data.logo !== 'undefined') {
          const trimmed = typeof data.logo === 'string' ? data.logo.trim() : '';
          if (trimmed) {
            payload.logo = trimmed;
          } else {
            delete payload.logo;
          }
        }

        if (typeof data.logoName !== 'undefined') {
          const trimmed = data.logoName ? data.logoName.trim() : '';
          if (trimmed) {
            payload.logoName = trimmed;
          } else {
            delete payload.logoName;
          }
        }

        if (typeof data.logoMimeType !== 'undefined') {
          const trimmed = data.logoMimeType ? data.logoMimeType.trim() : '';
          if (trimmed) {
            payload.logoMimeType = trimmed;
          } else {
            delete payload.logoMimeType;
          }
        }

        if (typeof data.logoWidth !== 'undefined') {
          if (typeof data.logoWidth === 'number' && Number.isFinite(data.logoWidth)) {
            payload.logoWidth = data.logoWidth;
          } else {
            delete payload.logoWidth;
          }
        }

        if (typeof data.logoHeight !== 'undefined') {
          if (typeof data.logoHeight === 'number' && Number.isFinite(data.logoHeight)) {
            payload.logoHeight = data.logoHeight;
          } else {
            delete payload.logoHeight;
          }
        }

        if ('palette' in data) {
          if (!data.palette) {
            delete payload.palette;
            delete payload.paletteUpdatedAt;
          } else {
            const mergedPalette = mergePalette(payload.palette as TenantPalette | undefined, data.palette);
            if (mergedPalette) {
              payload.palette = mergedPalette;
              payload.paletteUpdatedAt = new Date().toISOString();
            } else {
              delete payload.palette;
              delete payload.paletteUpdatedAt;
            }
          }
        }

        if (typeof data.paletteUpdatedAt !== 'undefined') {
          if (data.paletteUpdatedAt) {
            const parsed = new Date(data.paletteUpdatedAt);
            if (!Number.isNaN(parsed.valueOf())) {
              payload.paletteUpdatedAt = parsed.toISOString();
            }
          } else {
            delete payload.paletteUpdatedAt;
          }
        }

        let normalized = normalizeTenantBranding(payload);

        if (normalized && typeof data.logo === 'undefined' && existing?.logoUpdatedAt) {
          normalized.logoUpdatedAt = existing.logoUpdatedAt;
        }

        if (normalized && typeof data.logo === 'string' && data.logo.trim()) {
          normalized.logoUpdatedAt = new Date().toISOString();
        }

        if (normalized && !('palette' in data) && existing?.paletteUpdatedAt) {
          normalized.paletteUpdatedAt = existing.paletteUpdatedAt;
        }

        const nextBranding = { ...currentBranding };

        if (!normalized) {
          if (!existing) {
            return previous;
          }
          delete nextBranding[normalizedId];
        } else {
          const paletteEqual =
            (!existing?.palette && !normalized.palette) ||
            (existing?.palette &&
              normalized.palette &&
              JSON.stringify(existing.palette) === JSON.stringify(normalized.palette));

          const isSame =
            existing &&
            existing.logo === normalized.logo &&
            existing.logoName === normalized.logoName &&
            existing.logoMimeType === normalized.logoMimeType &&
            existing.logoWidth === normalized.logoWidth &&
            existing.logoHeight === normalized.logoHeight &&
            existing.logoUpdatedAt === normalized.logoUpdatedAt &&
            paletteEqual &&
            existing.paletteUpdatedAt === normalized.paletteUpdatedAt;

          if (isSame) {
            return previous;
          }

          nextBranding[normalizedId] = normalized;
        }

        return {
          ...previous,
          branding: nextBranding,
        };
      });
    },
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    const user = usersState.find((candidate) => candidate.email === email && candidate.password === password);
    if (!user) return false;

    if (user.status === 'inactive' && user.billing?.status !== 'overdue') {
      return false;
    }

    const normalized = normalizeUser(user);
    setCurrentUser(normalized);
    updateUsers((previous) => previous.map((candidate) => (candidate.id === normalized.id ? normalized : candidate)));
    return true;
  }, [updateUsers, usersState]);

  const logout = useCallback(() => {
    setCurrentUser(null);
  }, []);

  const createOrder = useCallback(
    ({
      productId,
      customerName,
      customerDocument,
      referrerId,
    }: {
      productId: string;
      customerName: string;
      customerDocument?: string;
      referrerId: string;
    }) => {
      const ownerId = referrerId;
      const newOrder: Order = {
        id: generateId(),
        productId,
        ownerId,
        customerName,
        customerDocument,
        status: 'novo',
        referrerId,
        createdAt: new Date().toISOString(),
      };
      setOrders((previous) => [newOrder, ...previous]);
      return newOrder;
    },
    [],
  );

  const updateOrderStatus = useCallback((orderId: string, status: Order['status']) => {
    setOrders((previous) => previous.map((order) => (order.id === orderId ? { ...order, status } : order)));
  }, []);

  const getBaseUrl = useCallback(() => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return storeBaseUrl;
  }, []);

  const getShareLink = useCallback(
    (userId: string) => {
      const baseUrl = getBaseUrl();
      return `${baseUrl}/loja/${userId}`;
    },
    [getBaseUrl],
  );

  const getProductShareLink = useCallback(
    (productId: string, userId: string) => {
      const baseUrl = getBaseUrl();
      return `${baseUrl}/loja/${userId}?produto=${productId}`;
    },
    [getBaseUrl],
  );

  const getVisibleUsers = useCallback(() => {
    if (!currentUser) return [];

    if (currentUser.role === 'admin') {
      return usersState;
    }

    if (currentUser.role === 'master') {
      const team = findSubordinates(currentUser.id, usersState);
      return [currentUser, ...team];
    }

    return [currentUser];
  }, [currentUser, usersState]);

  const getVisibleOrders = useCallback(() => {
    if (!currentUser) return [];

    if (currentUser.role === 'admin') {
      return orders;
    }

    if (currentUser.role === 'master') {
      const allowedUsers = [currentUser, ...findSubordinates(currentUser.id, usersState)].map((user) => user.id);
      return orders.filter((order) => allowedUsers.includes(order.ownerId));
    }

    return orders.filter((order) => order.ownerId === currentUser.id);
  }, [currentUser, orders, usersState]);

  const createUser = useCallback(
    ({
      name,
      email,
      password,
      profileId,
      status = 'active',
      parentId,
      company,
      city,
      phone,
      viewCommissions,
      bank,
      document,
      billingPlanId,
      billingCustomPrice,
      billingStatus,
      billingTrialDays,
      billingExpiresAt,
      billingSeatsIncluded,
      billingAdditionalSeats,
    }: NewUserInput) => {
      const profile = profilesState.find((item) => item.id === profileId);
      if (!profile) return { user: null, error: 'Perfil selecionado é inválido.' };

      const normalizedEmail = email.trim().toLowerCase();
      const rawDocument = cleanDocument(document);
      const resolvedStatus: UserStatus = status ?? 'active';

      if (rawDocument) {
        if (rawDocument.length === 11 && !isValidCPF(rawDocument)) {
          return { user: null, error: 'CPF inválido.' };
        }

        if (rawDocument.length === 14 && !isValidCNPJ(rawDocument)) {
          return { user: null, error: 'CNPJ inválido.' };
        }

        if (![11, 14].includes(rawDocument.length)) {
          return { user: null, error: 'Documento deve ser um CPF ou CNPJ válido.' };
        }
      }

      const newUserId = generateId();

      const masterReferenceId =
        currentUser?.role === 'master' && SUBORDINATE_ROLES.includes(profile.role)
          ? currentUser.id
          : parentId || undefined;

      const masterReference = masterReferenceId
        ? usersState.find((candidate) => candidate.id === masterReferenceId && candidate.role === 'master')
        : undefined;

      let tenantId = DEFAULT_TENANT_ID;
      if (profile.role === 'admin') {
        tenantId = currentUser?.tenantId ?? DEFAULT_TENANT_ID;
      } else if (profile.role === 'master') {
        tenantId = newUserId;
      } else if (masterReference) {
        tenantId = masterReference.tenantId ?? masterReference.id;
      } else if (currentUser?.tenantId) {
        tenantId = currentUser.tenantId;
      }

      const scopeUsers = profile.role === 'admin'
        ? usersState
        : usersState.filter((candidate) => candidate.tenantId === tenantId);

      const duplicateEmail = scopeUsers.some((candidate) => candidate.email.toLowerCase() === normalizedEmail);
      if (duplicateEmail) {
        return { user: null, error: 'Já existe um usuário cadastrado com este e-mail.' };
      }

      if (rawDocument) {
        const duplicateDocument = scopeUsers.some((candidate) => candidate.document === rawDocument);
        if (duplicateDocument) {
          return { user: null, error: 'Já existe um usuário cadastrado com este CPF/CNPJ.' };
        }
      }

      const seatOwner = masterReference ?? (currentUser?.role === 'master' ? currentUser : undefined);
      if (seatOwner && SUBORDINATE_ROLES.includes(profile.role)) {
        const seatOwnerPlan = seatOwner.billing?.planId
          ? plansState.find((plan) => plan.id === seatOwner.billing?.planId)
          : undefined;
        const includedSeats = typeof seatOwner.billing?.seatsIncluded === 'number'
          ? seatOwner.billing.seatsIncluded
          : seatOwnerPlan?.seatsIncluded ?? 0;
        const purchasedSeats = typeof seatOwner.billing?.additionalSeats === 'number'
          ? seatOwner.billing.additionalSeats
          : 0;
        const allowedSeats = Math.max(0, includedSeats + purchasedSeats);
        const teamCount = usersState.filter(
          (candidate) =>
            candidate.parentId === seatOwner.id &&
            SUBORDINATE_ROLES.includes(candidate.role) &&
            candidate.status !== 'inactive',
        ).length;

        const consumesSeat = resolvedStatus !== 'inactive';

        if (consumesSeat && teamCount >= allowedSeats) {
          return {
            user: null,
            error:
              'Limite de usuários adicionais atingido para este master. Contrate assentos extras para cadastrar novos usuários.',
          };
        }
      }

      let billing: UserBilling | undefined;
      if (billingPlanId) {
        const plan = plansState.find((item) => item.id === billingPlanId);
        if (plan) {
          const now = new Date();
          const trialDays = billingTrialDays ?? plan.trialDays;
          const trialEndsAt = trialDays ? addDays(now, trialDays).toISOString() : undefined;
          const expiresAt = billingExpiresAt
            ? new Date(billingExpiresAt).toISOString()
            : !trialEndsAt
              ? addDays(now, plan.durationInDays).toISOString()
              : undefined;
          const status: BillingStatus = billingStatus ?? (trialEndsAt ? 'trial' : 'pending');
          billing = {
            planId: plan.id,
            planName: plan.name,
            period: plan.period,
            price: plan.price,
            customPrice: billingCustomPrice,
            status,
            seatsIncluded: billingSeatsIncluded ?? plan.seatsIncluded,
            additionalSeats: billingAdditionalSeats ?? 0,
            additionalSeatPrice: plan.additionalSeatPrice,
            additionalSeatLimit: plan.additionalSeatLimit,
            trialEndsAt,
            expiresAt,
            history: [],
          };
        }
      }

      const newUser: User = {
        id: newUserId,
        tenantId,
        name,
        email: normalizedEmail,
        password,
        role: profile.role,
        profileId,
        status: resolvedStatus,
        parentId: masterReference ? masterReference.id : undefined,
        company,
        city,
        phone,
        viewCommissions,
        bank,
        document: rawDocument,
        createdAt: new Date().toISOString(),
        billing,
      };

      const normalizedUser = normalizeUser(newUser);
      updateUsers((previous) => [...previous, newUser]);
      return { user: normalizedUser };
    },
    [profilesState, currentUser, plansState, updateUsers, usersState],
  );

  const updateUser = useCallback(
    (userId: string, data: UpdateUserInput) => {
      updateUsers((previous) => {
        return previous.map((user) => {
          if (user.id !== userId) return user;

          let next: User = { ...user };

          if (typeof data.name !== 'undefined') {
            next.name = data.name;
          }

          if (typeof data.email !== 'undefined') {
            next.email = data.email.trim().toLowerCase();
          }

          if (typeof data.password !== 'undefined' && data.password !== '') {
            next.password = data.password;
          }

          if (data.status) {
            next.status = data.status;
          }

          if (typeof data.parentId !== 'undefined') {
            next.parentId = data.parentId || undefined;
          }

          if (typeof data.company !== 'undefined') {
            next.company = data.company || undefined;
          }

          if (typeof data.city !== 'undefined') {
            next.city = data.city || undefined;
          }

          if (typeof data.phone !== 'undefined') {
            next.phone = data.phone || undefined;
          }

          if (typeof data.viewCommissions === 'boolean') {
            next.viewCommissions = data.viewCommissions;
          }

          if (typeof data.document !== 'undefined') {
            const cleaned = cleanDocument(data.document);
            next.document = cleaned;
          }

          if (data.bank) {
            next.bank = {
              ...next.bank,
              institution: data.bank.institution ?? next.bank?.institution,
              agency: data.bank.agency ?? next.bank?.agency,
              account: data.bank.account ?? next.bank?.account,
              type: data.bank.type ?? next.bank?.type,
            };
          }

          if (data.profileId) {
            const profile = profilesState.find((item) => item.id === data.profileId);
            if (profile) {
              next.profileId = profile.id;
              next.role = profile.role;
            }
          }

          if (next.role === 'master') {
            next.tenantId = next.tenantId || next.id;
          } else if (next.role === 'admin') {
            next.tenantId = DEFAULT_TENANT_ID;
          } else if (next.parentId) {
            const parent = previous.find((candidate) => candidate.id === next.parentId);
            if (parent) {
              next.tenantId = parent.tenantId ?? parent.id;
            }
          }

          return next;
        });
      });
    },
    [profilesState, updateUsers],
  );

  const updateUserStatus = useCallback(
    (userId: string, status: UserStatus) => {
      updateUsers((previous) => previous.map((user) => (user.id === userId ? { ...user, status } : user)));
    },
    [updateUsers],
  );

  const deleteUser = useCallback(
    (userId: string) => {
      const target = usersState.find((candidate) => candidate.id === userId);
      if (!target) {
        return;
      }

      const dependents = findSubordinates(userId, usersState);
      const idsToRemove = new Set([userId, ...dependents.map((user) => user.id)]);

      setCurrentUser((previous) => {
        if (previous && idsToRemove.has(previous.id)) {
          return null;
        }
        return previous;
      });

      setOrders((previous) => previous.filter((order) => !idsToRemove.has(order.ownerId)));

      updateUsers((previous) => previous.filter((user) => !idsToRemove.has(user.id)));
    },
    [setCurrentUser, setOrders, updateUsers, usersState],
  );

  const createProfile = useCallback(
    ({ name, description, role }: NewProfileInput) => {
      const profile: UserProfile = {
        id: generateId(),
        name,
        description,
        role,
      };
      setProfilesState((previous) => [...previous, profile]);
      return profile;
    },
    [],
  );

  const createProduct = useCallback(
    ({ name, description, price, category, provider, link, imageUrl, integration }: NewProductInput) => {
      const product: Product = {
        id: generateId(),
        name,
        description,
        price,
        category,
        provider,
        link,
        imageUrl,
        integration,
      };
      setProductsState((previous) => [product, ...previous]);
      return product;
    },
    [],
  );

  const updateProduct = useCallback((productId: string, data: Partial<NewProductInput>) => {
    setProductsState((previous) =>
      previous.map((product) => (product.id === productId ? { ...product, ...data } : product)),
    );
  }, []);

  const createPlan = useCallback(
    ({
      name,
      description,
      price,
      period,
      durationInDays,
      allowCustomPrice,
      seatsIncluded,
      additionalSeatPrice,
      additionalSeatLimit,
      trialDays,
    }: NewPlanInput) => {
      const plan: Plan = {
        id: generateId(),
        name,
        description,
        price,
        period,
        durationInDays,
        allowCustomPrice,
        seatsIncluded,
        additionalSeatPrice,
        additionalSeatLimit,
        trialDays,
      };
      setPlansState((previous) => [...previous, plan]);
      return plan;
    },
    [],
  );

  const updatePlan = useCallback((planId: string, data: Partial<NewPlanInput>) => {
    setPlansState((previous) => previous.map((plan) => (plan.id === planId ? { ...plan, ...data } : plan)));
  }, []);

  const getPlanById = useCallback((planId: string) => plansState.find((plan) => plan.id === planId), [plansState]);

  const assignPlanToUser = useCallback(
    (
      userId: string,
      planId: string,
      {
        customPrice,
        status,
        trialDays,
        expiresAt,
        seatsIncluded,
        additionalSeats,
      }: {
        customPrice?: number;
        status?: BillingStatus;
        trialDays?: number;
        expiresAt?: string;
        seatsIncluded?: number;
        additionalSeats?: number;
      } = {},
    ) => {
      const plan = plansState.find((item) => item.id === planId);
      if (!plan) return;

      const now = new Date();
      updateUsers((previous) =>
        previous.map((user) => {
          if (user.id !== userId) return user;

          const trialEndsAt = trialDays
            ? addDays(now, trialDays).toISOString()
            : plan.trialDays
              ? addDays(now, plan.trialDays).toISOString()
              : undefined;

          const effectiveExpiresAt = expiresAt
            ? new Date(expiresAt).toISOString()
            : !trialEndsAt
              ? addDays(now, plan.durationInDays).toISOString()
              : undefined;

          const currentHistory = user.billing?.history ?? [];
          const previousStatus = user.billing?.status;
          const derivedStatus: BillingStatus =
            typeof status !== 'undefined'
              ? status
              : previousStatus
                ? previousStatus
                : trialEndsAt
                  ? 'trial'
                  : 'pending';

          const billing: UserBilling = {
            planId: plan.id,
            planName: plan.name,
            period: plan.period,
            price: plan.price,
            customPrice: customPrice ?? user.billing?.customPrice,
            status: derivedStatus,
            seatsIncluded: seatsIncluded ?? plan.seatsIncluded,
            additionalSeats: additionalSeats ?? user.billing?.additionalSeats ?? 0,
            additionalSeatPrice: plan.additionalSeatPrice,
            additionalSeatLimit: plan.additionalSeatLimit,
            trialEndsAt,
            expiresAt: effectiveExpiresAt,
            lastPaymentAt: user.billing?.lastPaymentAt,
            checkoutUrl: user.billing?.checkoutUrl,
            asaasCustomerId: user.billing?.asaasCustomerId,
            asaasSubscriptionId: user.billing?.asaasSubscriptionId,
            history: currentHistory,
          };

          return { ...user, billing };
        }),
      );
    },
    [plansState, updateUsers],
  );

  const updateUserBilling = useCallback(
    (userId: string, data: Partial<UserBilling>) => {
      updateUsers((previous) =>
        previous.map((user) => {
          if (user.id !== userId) return user;
          if (!user.billing) {
            return data.planId
              ? {
                  ...user,
                  billing: normalizeBilling({
                    planId: data.planId,
                    planName: data.planName ?? 'Plano personalizado',
                    period: data.period ?? 'monthly',
                    price: data.price ?? 0,
                    customPrice: data.customPrice,
                    status: data.status ?? 'active',
                    seatsIncluded: data.seatsIncluded ?? 1,
                    additionalSeats: data.additionalSeats ?? 0,
                    additionalSeatPrice: data.additionalSeatPrice,
                    additionalSeatLimit: data.additionalSeatLimit,
                    trialEndsAt: data.trialEndsAt,
                    expiresAt: data.expiresAt,
                    lastPaymentAt: data.lastPaymentAt,
                    checkoutUrl: data.checkoutUrl,
                    asaasCustomerId: data.asaasCustomerId,
                    asaasSubscriptionId: data.asaasSubscriptionId,
                    history: data.history ?? [],
                  }),
                }
              : user;
          }
          return {
            ...user,
            billing: normalizeBilling({ ...user.billing, ...data }),
          };
        }),
      );
    },
    [updateUsers],
  );

  const recordPayment = useCallback(
    (userId: string, payment: PaymentRecord, nextStatus?: BillingStatus) => {
      updateUsers((previous) =>
        previous.map((user) => {
          if (user.id !== userId || !user.billing) return user;

          const plan = plansState.find((item) => item.id === user.billing?.planId);
          const duration = plan?.durationInDays ?? 30;
          const paymentDate = parseDate(payment.date) ?? new Date();
          const dueDate = parseDate(payment.dueDate);
          const currentExpiresAt = parseDate(user.billing.expiresAt);

          let baseDate = paymentDate;
          [dueDate, currentExpiresAt].forEach((candidate) => {
            if (candidate && candidate.getTime() > baseDate.getTime()) {
              baseDate = candidate;
            }
          });

          const isPaid = payment.status === 'paid';
          const isOverdue = payment.status === 'overdue';
          const nextExpiresAt = isPaid ? addDays(baseDate, duration).toISOString() : user.billing.expiresAt;
          const normalizedRecord: PaymentRecord = {
            ...payment,
            date: paymentDate.toISOString(),
            dueDate: dueDate ? dueDate.toISOString() : payment.dueDate,
          };

          const history = [normalizedRecord].concat(
            (user.billing.history ?? []).filter(
              (entry) => (entry.asaasPaymentId ?? entry.id) !== (payment.asaasPaymentId ?? payment.id),
            ),
          );

          const sortedHistory = sortPaymentsByDateDesc(history);
          const lastPaid = sortedHistory.find((entry) => entry.status === 'paid');
          const overrideStatus = nextStatus ?? (isPaid ? 'active' : isOverdue ? 'overdue' : undefined);
          const status = determineBillingStatus({
            history: sortedHistory,
            previousStatus: user.billing.status,
            trialEndsAt: user.billing.trialEndsAt,
            override: overrideStatus,
          });

          let expiresAt = user.billing.expiresAt;
          if (isPaid) {
            expiresAt = nextExpiresAt;
          } else if (!lastPaid) {
            expiresAt = status === 'trial' ? user.billing.expiresAt : undefined;
          }

          const billing: UserBilling = {
            ...user.billing,
            history: sortedHistory,
            lastPaymentAt: lastPaid?.date,
            status,
            expiresAt,
            checkoutUrl: isPaid ? undefined : user.billing.checkoutUrl,
          };

          return { ...user, billing };
        }),
      );
    },
    [plansState, updateUsers],
  );

  const removePaymentRecord = useCallback(
    (
      userId: string,
      paymentId: string,
      { clearCheckout = false, statusOverride }: { clearCheckout?: boolean; statusOverride?: BillingStatus } = {},
    ) => {
      updateUsers((previous) =>
        previous.map((user) => {
          if (user.id !== userId || !user.billing) {
            return user;
          }

          const filtered = (user.billing.history ?? []).filter(
            (entry) => (entry.asaasPaymentId ?? entry.id) !== paymentId,
          );
          const sortedHistory = sortPaymentsByDateDesc(filtered);
          const lastPaid = sortedHistory.find((entry) => entry.status === 'paid');
          const status = determineBillingStatus({
            history: sortedHistory,
            previousStatus: user.billing.status,
            trialEndsAt: user.billing.trialEndsAt,
            override: statusOverride,
          });

          let expiresAt = user.billing.expiresAt;
          if (!lastPaid) {
            expiresAt = status === 'trial' ? user.billing.expiresAt : undefined;
          }

          const billing: UserBilling = {
            ...user.billing,
            history: sortedHistory,
            lastPaymentAt: lastPaid?.date,
            status,
            expiresAt,
            checkoutUrl: clearCheckout ? undefined : user.billing.checkoutUrl,
          };

          return { ...user, billing };
        }),
      );
    },
    [updateUsers],
  );

  const requestCheckout = useCallback(
    async (params: CheckoutRequest): Promise<CheckoutResponse> => {
      const targetUser = usersState.find((candidate) => candidate.id === params.userId);
      const plan = plansState.find((item) => item.id === params.planId);

      const checkoutPayload: Record<string, unknown> = {
        ...params,
        planName: plan?.name,
        period: plan?.period,
        durationInDays: plan?.durationInDays,
        amount:
          params.type === 'seat'
            ? params.seatPrice * params.quantity
            : params.type === 'plan'
              ? params.customPrice ?? plan?.price
              : undefined,
        seatsIncluded: plan?.seatsIncluded,
        customerId: targetUser?.billing?.asaasCustomerId,
        customer: targetUser
          ? {
              name: targetUser.name,
              email: targetUser.email,
              document: targetUser.document,
              phone: targetUser.phone,
            }
          : undefined,
      };

      if (settingsState.asaasApiKey) {
        checkoutPayload.apiKey = settingsState.asaasApiKey;
      }

      if (settingsState.asaasApiUrl) {
        checkoutPayload.apiUrl = settingsState.asaasApiUrl;
      }

      try {
        const response = await fetch('/api/asaas/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(checkoutPayload),
        });

        const responseBody = (await response.json().catch(() => ({}))) as CheckoutResponse;

        if (!response.ok) {
          const baseError =
            responseBody?.error || responseBody?.message || 'Não foi possível gerar o link de pagamento.';

          let detailMessage: string | undefined;
          if (typeof responseBody?.details === 'string') {
            detailMessage = responseBody.details;
          } else if (responseBody?.details && typeof responseBody.details === 'object') {
            const detailsObject = responseBody.details as { [key: string]: any };
            const nestedError = Array.isArray(detailsObject?.errors)
              ? detailsObject.errors[0]
              : undefined;
            detailMessage =
              nestedError?.description || detailsObject?.message || detailsObject?.error || undefined;
          }

          return {
            error:
              detailMessage && !baseError.includes(detailMessage)
                ? `${baseError} (${detailMessage})`
                : baseError,
            details: responseBody?.details,
          };
        }

        if (responseBody.checkoutUrl || responseBody.customerId || responseBody.subscriptionId) {
          const updates: Partial<UserBilling> = {};
          if (responseBody.checkoutUrl) {
            updates.checkoutUrl = responseBody.checkoutUrl;
          }
          if (responseBody.customerId) {
            updates.asaasCustomerId = responseBody.customerId;
          }
          if (params.type === 'plan' && responseBody.subscriptionId) {
            updates.asaasSubscriptionId = responseBody.subscriptionId;
          }

          if (Object.keys(updates).length > 0) {
            updateUserBilling(params.userId, updates);
          }
        }

        if (responseBody.paymentId) {
          let pendingAmount: number | undefined;
          let description: string | undefined;

          if (params.type === 'plan') {
            const targetPlan = plansState.find((item) => item.id === params.planId);
            pendingAmount =
              typeof params.customPrice === 'number'
                ? params.customPrice
                : targetPlan?.price ?? undefined;
            description = targetPlan?.name
              ? `Assinatura ${targetPlan.name}`
              : 'Cobrança de assinatura Asaas';
          } else if (params.type === 'seat') {
            const seats = typeof params.quantity === 'number' ? params.quantity : 0;
            pendingAmount = seats > 0 ? params.seatPrice * seats : undefined;
            description = seats > 0 ? `Usuários adicionais (${seats})` : 'Cobrança de usuários adicionais';
          }

          if (typeof pendingAmount === 'number' && pendingAmount > 0) {
            recordPayment(
              params.userId,
              {
                id: responseBody.paymentId,
                asaasPaymentId: responseBody.paymentId,
                amount: pendingAmount,
                date: new Date().toISOString(),
                status: 'pending',
                description: description ?? 'Cobrança registrada no Asaas',
                method: 'Asaas',
              },
              'pending',
            );
          }
        }

        return responseBody;
      } catch (error) {
        console.error('Erro ao solicitar checkout', error);
        return {
          error:
            'Não foi possível se comunicar com o Asaas. Verifique a conexão ou as credenciais configuradas.',
        };
      }
    },
    [plansState, settingsState, updateUserBilling, usersState],
  );

  const isBillingRestricted = useCallback(
    (user?: User | null) => {
      const target = user ?? currentUser;
      if (!target) return false;
      if (target.role === 'admin') return false;
      const status = target.billing?.status;
      return status === 'pending' || status === 'overdue' || status === 'expired' || status === 'cancelled';
    },
    [currentUser],
  );

  const getRemainingTrialDays = useCallback(
    (userId: string) => {
      const user = usersState.find((item) => item.id === userId);
      return getRemainingTrialDaysFromBilling(user?.billing);
    },
    [usersState],
  );

  const value = useMemo(
    () => ({
      currentUser,
      hydrated,
      users: usersState,
      profiles: profilesState,
      products: productsState,
      plans: plansState,
      orders,
      settings: settingsState,
      login,
      logout,
      createOrder,
      updateOrderStatus,
      getShareLink,
      getProductShareLink,
      getVisibleUsers,
      getVisibleOrders,
      createUser,
      updateUser,
      updateUserStatus,
      deleteUser,
      createProfile,
      createProduct,
      updateProduct,
      createPlan,
      updatePlan,
      assignPlanToUser,
      updateUserBilling,
      recordPayment,
      requestCheckout,
      getPlanById,
      isBillingRestricted,
      getRemainingTrialDays,
      updateSettings,
      updateTenantBranding,
      removePaymentRecord,
    }),
    [
      currentUser,
      hydrated,
      usersState,
      profilesState,
      productsState,
      plansState,
      login,
      logout,
      createOrder,
      updateOrderStatus,
      getShareLink,
      getProductShareLink,
      getVisibleUsers,
      getVisibleOrders,
      orders,
      createUser,
      updateUser,
      updateUserStatus,
      deleteUser,
      createProfile,
      createProduct,
      updateProduct,
      createPlan,
      updatePlan,
      assignPlanToUser,
      updateUserBilling,
      recordPayment,
      removePaymentRecord,
      requestCheckout,
      getPlanById,
      isBillingRestricted,
      getRemainingTrialDays,
      updateSettings,
      settingsState,
      updateTenantBranding,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};

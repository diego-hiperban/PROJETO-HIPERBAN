import type {
  BillingPeriod,
  BillingStatus as SeedBillingStatus,
  Order,
  PaymentRecord,
  Plan,
  Product,
  ProductIntegration,
  Role,
  User as SeedUser,
  UserBilling as SeedUserBilling,
  UserProfile,
  UserStatus,
} from '@/lib/data';
import {
  plans as basePlans,
  products as baseProducts,
  profiles as baseProfiles,
  storeBaseUrl,
  users as baseUsers,
} from '@/lib/data';

export type BillingStatus = SeedBillingStatus | 'pending';

export type UserBilling = Omit<SeedUserBilling, 'status'> & {
  status: BillingStatus;
};

export type User = Omit<SeedUser, 'billing'> & {
  billing?: UserBilling | null;
};

export type {
  BillingPeriod,
  Order,
  PaymentRecord,
  Plan,
  Product,
  ProductIntegration,
  Role,
  UserProfile,
  UserStatus,
};

export const plans = basePlans;
export const products = baseProducts;
export const profiles = baseProfiles;
export const users = baseUsers as unknown as User[];
export { storeBaseUrl };

export type Role = 'admin' | 'master' | 'operational' | 'user';
export type UserStatus = 'active' | 'inactive';

export type BillingPeriod = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export type BillingStatus = 'trial' | 'pending' | 'active' | 'overdue' | 'expired' | 'cancelled';

export interface PaymentRecord {
  id: string;
  date: string;
  dueDate?: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  description: string;
  method?: string;
  asaasPaymentId?: string;
  rawStatus?: string;
}

export interface UserBilling {
  planId: string;
  planName: string;
  period: BillingPeriod;
  price: number;
  customPrice?: number;
  status: BillingStatus;
  seatsIncluded: number;
  additionalSeats: number;
  additionalSeatPrice?: number;
  additionalSeatLimit?: number;
  trialEndsAt?: string;
  expiresAt?: string;
  lastPaymentAt?: string;
  checkoutUrl?: string;
  asaasCustomerId?: string;
  asaasSubscriptionId?: string;
  history: PaymentRecord[];
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  period: BillingPeriod;
  durationInDays: number;
  allowCustomPrice?: boolean;
  seatsIncluded: number;
  additionalSeatPrice?: number;
  additionalSeatLimit?: number;
  trialDays?: number;
}

export interface UserProfile {
  id: string;
  name: string;
  description: string;
  role: Role;
}

export interface UserTheme {
  primary: string;
  secondary: string;
  background: string;
  text: string;
}

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  parentId?: string;
  profileId?: string;
  status: UserStatus;
  document?: string;
  company?: string;
  city?: string;
  phone?: string;
  viewCommissions?: boolean;
  bank?: {
    institution?: string;
    agency?: string;
    account?: string;
    type?: string;
  };
  theme?: UserTheme;
  commissionShare?: number;
  createdAt: string;
  billing?: UserBilling;
}

export type ProductIntegration =
  | {
      type: 'credihome';
      partnerCode?: string;
    };

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category?: string;
  provider?: string;
  link?: string;
  imageUrl?: string;
  integration?: ProductIntegration;
}

export interface Order {
  id: string;
  productId: string;
  ownerId: string;
  customerName: string;
  customerDocument?: string;
  status: 'novo' | 'em_contato' | 'negociando' | 'concluido';
  referrerId: string;
  createdAt: string;
}

export const profiles: UserProfile[] = [
  {
    id: 'profile-admin',
    name: 'Administrador',
    description: 'Acesso total à plataforma, consegue acompanhar e editar todos os dados.',
    role: 'admin',
  },
  {
    id: 'profile-master',
    name: 'Usuário Master',
    description: 'Gerencia a própria operação e a equipe subordinada, com visão completa da esteira.',
    role: 'master',
  },
  {
    id: 'profile-operational',
    name: 'Usuário Operacional',
    description: 'Apoia o master na gestão do tenant sem contratar novos usuários.',
    role: 'operational',
  },
  {
    id: 'profile-user',
    name: 'Usuário Simples',
    description: 'Visualiza apenas os próprios pedidos e registra novas oportunidades.',
    role: 'user',
  },
];

export const users: User[] = [
  {
    id: 'admin-1',
    tenantId: 'tenant-admin',
    name: 'Administrador Geral',
    email: 'admin@sistema.com',
    password: 'admin123',
    role: 'admin',
    profileId: 'profile-admin',
    status: 'active',
    company: 'Hiperban',
    phone: '+55 (11) 99000-0000',
    viewCommissions: true,
    createdAt: new Date('2024-01-05').toISOString(),
    billing: {
      planId: 'plan-enterprise',
      planName: 'Enterprise',
      period: 'annual',
      price: 0,
      status: 'active',
      seatsIncluded: 50,
      additionalSeats: 0,
      history: [],
    },
  },
  {
    id: 'master-1',
    tenantId: 'master-1',
    name: 'Maria Gestora',
    email: 'maria@empresa.com',
    password: 'master123',
    role: 'master',
    profileId: 'profile-master',
    status: 'active',
    company: 'Seguros Brasil',
    city: 'São Paulo',
    phone: '+55 (11) 91234-5678',
    viewCommissions: true,
    createdAt: new Date('2024-02-10').toISOString(),
    document: '12345678901',
    billing: {
      planId: 'plan-professional',
      planName: 'Plano Profissional',
      period: 'monthly',
      price: 299,
      status: 'active',
      seatsIncluded: 10,
      additionalSeats: 2,
      additionalSeatPrice: 49,
      additionalSeatLimit: 30,
      expiresAt: new Date('2024-12-31').toISOString(),
      lastPaymentAt: new Date('2024-05-31').toISOString(),
      history: [
        {
          id: 'pay-001',
          date: new Date('2024-05-31').toISOString(),
          amount: 299,
          status: 'paid',
          description: 'Mensalidade Plano Profissional',
          method: 'credit_card',
        },
      ],
    },
  },
  {
    id: 'user-1',
    tenantId: 'master-1',
    name: 'Carlos Vendedor',
    email: 'carlos@empresa.com',
    password: 'user123',
    role: 'user',
    parentId: 'master-1',
    profileId: 'profile-user',
    status: 'active',
    company: 'Seguros Brasil',
    city: 'Guarulhos',
    phone: '+55 (11) 99876-5432',
    createdAt: new Date('2024-03-15').toISOString(),
    document: '98765432100',
    billing: {
      planId: 'plan-operational',
      planName: 'Plano Operacional',
      period: 'monthly',
      price: 79,
      status: 'active',
      seatsIncluded: 1,
      additionalSeats: 0,
      expiresAt: new Date('2024-06-30').toISOString(),
      lastPaymentAt: new Date('2024-05-31').toISOString(),
      history: [
        {
          id: 'pay-002',
          date: new Date('2024-05-31').toISOString(),
          amount: 79,
          status: 'paid',
          description: 'Mensalidade Plano Operacional',
          method: 'pix',
        },
      ],
    },
  },
  {
    id: 'user-2',
    tenantId: 'master-1',
    name: 'Fernanda Consultora',
    email: 'fernanda@empresa.com',
    password: 'user123',
    role: 'operational',
    parentId: 'master-1',
    profileId: 'profile-operational',
    status: 'inactive',
    company: 'Seguros Brasil',
    city: 'Osasco',
    phone: '+55 (11) 93456-7890',
    createdAt: new Date('2024-04-03').toISOString(),
    document: '12312312312',
    billing: {
      planId: 'plan-operational',
      planName: 'Plano Operacional',
      period: 'monthly',
      price: 79,
      status: 'overdue',
      seatsIncluded: 1,
      additionalSeats: 0,
      expiresAt: new Date('2024-04-30').toISOString(),
      history: [
        {
          id: 'pay-003',
          date: new Date('2024-03-31').toISOString(),
          amount: 79,
          status: 'paid',
          description: 'Mensalidade Plano Operacional',
          method: 'boleto',
        },
      ],
    },
  },
  {
    id: 'master-2',
    tenantId: 'master-2',
    name: 'João Gestor',
    email: 'joao@empresa.com',
    password: 'master123',
    role: 'master',
    profileId: 'profile-master',
    status: 'active',
    company: 'Protege Corretora',
    city: 'Santos',
    phone: '+55 (13) 98888-1111',
    viewCommissions: true,
    createdAt: new Date('2024-02-22').toISOString(),
    document: '32165498700',
    billing: {
      planId: 'plan-professional',
      planName: 'Plano Profissional',
      period: 'quarterly',
      price: 849,
      status: 'trial',
      seatsIncluded: 8,
      additionalSeats: 0,
      additionalSeatPrice: 59,
      trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      history: [],
    },
  },
  {
    id: 'user-3',
    tenantId: 'master-2',
    name: 'Patrícia Especialista',
    email: 'patricia@empresa.com',
    password: 'user123',
    role: 'user',
    parentId: 'master-2',
    profileId: 'profile-user',
    status: 'active',
    company: 'Protege Corretora',
    city: 'Campinas',
    phone: '+55 (19) 98765-1234',
    createdAt: new Date('2024-05-12').toISOString(),
    document: '55566677788',
    billing: {
      planId: 'plan-operational',
      planName: 'Plano Operacional',
      period: 'monthly',
      price: 79,
      status: 'trial',
      seatsIncluded: 1,
      additionalSeats: 0,
      trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      history: [],
    },
  },
  {
    id: 'trial-1',
    tenantId: 'trial-1',
    name: 'Teste Gratuito',
    email: 'teste@hiperban.com',
    password: 'teste123',
    role: 'user',
    profileId: 'profile-user',
    status: 'active',
    company: 'Conta Demonstração',
    city: 'São Paulo',
    phone: '+55 (11) 90000-0000',
    document: '00000000000',
    createdAt: new Date().toISOString(),
    billing: {
      planId: 'plan-trial',
      planName: 'Avaliação 14 dias',
      period: 'monthly',
      price: 0,
      status: 'trial',
      seatsIncluded: 1,
      additionalSeats: 0,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      history: [],
    },
  },
];

export const plans: Plan[] = [
  {
    id: 'plan-operational',
    name: 'Plano Operacional',
    description: 'Acesso individual à plataforma com recursos essenciais.',
    price: 79,
    period: 'monthly',
    durationInDays: 30,
    seatsIncluded: 1,
  },
  {
    id: 'plan-professional',
    name: 'Plano Profissional',
    description: 'Ideal para equipes lideradas por um master com até 10 usuários inclusos.',
    price: 299,
    period: 'monthly',
    durationInDays: 30,
    seatsIncluded: 10,
    additionalSeatPrice: 49,
    additionalSeatLimit: 50,
  },
  {
    id: 'plan-enterprise',
    name: 'Plano Enterprise',
    description: 'Gestão corporativa completa com cobrança negociada.',
    price: 999,
    period: 'annual',
    durationInDays: 365,
    allowCustomPrice: true,
    seatsIncluded: 50,
    additionalSeatPrice: 39,
  },
  {
    id: 'plan-trial',
    name: 'Avaliação 14 dias',
    description: 'Plano temporário para demonstrações com expiração automática.',
    price: 0,
    period: 'monthly',
    durationInDays: 14,
    seatsIncluded: 1,
    trialDays: 14,
  },
];

export const products: Product[] = [
  {
    id: 'prd-1',
    name: 'FGTS Antecipado',
    description: 'Linha de crédito com taxas reduzidas para antecipação do saque aniversário.',
    price: 0,
    category: 'Crédito Consignado',
    provider: 'Banco PAN',
    link: 'https://hiperban.com.br/produtos/fgts',
    imageUrl: '/products/fgts.svg',
  },
  {
    id: 'prd-2',
    name: 'Consignado INSS',
    description: 'Oferta exclusiva para aposentados e pensionistas do INSS com aprovação ágil.',
    price: 0,
    category: 'Crédito',
    provider: 'Banco BMG',
    link: 'https://hiperban.com.br/produtos/consignado-inss',
    imageUrl: '/products/inss.svg',
  },
  {
    id: 'prd-3',
    name: 'Conta Digital PJ',
    description: 'Conta PJ completa com cartões, boletos e gestão de recebíveis.',
    price: 0,
    category: 'Serviços Financeiros',
    provider: 'Crefisa',
    link: 'https://hiperban.com.br/produtos/conta-digital-pj',
    imageUrl: '/products/digital-account.svg',
  },
  {
    id: 'prd-cred-imob',
    name: 'Crédito Imobiliário',
    description:
      'Simulação completa de financiamento com integração automática à Credihome by Loft.',
    price: 0,
    category: 'Financiamento',
    provider: 'Credihome by Loft',
    link: 'https://docs.credihome.com.br/',
    imageUrl: '/products/mortgage.svg',
    integration: {
      type: 'credihome',
    },
  },
];

export const storeBaseUrl = 'https://minha-loja.com';

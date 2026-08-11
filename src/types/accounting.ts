import { BaseReference } from './reference';

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type AnalyticalRequirement = 'not_allowed' | 'optional' | 'required' | 'auto';

export interface AccountAnalyticalConfig {
  costCenter: AnalyticalRequirement;
  profitCenter: AnalyticalRequirement;
  project: AnalyticalRequirement;
  distributionAllowed: boolean;
}

export interface Account extends BaseReference {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  type: AccountType;
  parentId: string | null;
  isGroup: boolean;
  level: number;
  isActive: boolean;
  balance?: number;
  
  expenseNature?: 'direct' | 'administrative';
  analyticalConfig?: AccountAnalyticalConfig;
  allowedPaymentMethods?: string[]; // مصفوفة من أكواد طرق الدفع المسموحة من المرجع (Payment Methods Reference Codes)
}

export interface JournalEntryLine {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  projectId?: string;
  costCenterId?: string;
  profitCenterId?: string;
  memo?: string;
}

export type JournalStatus = 'draft' | 'posted' | 'reversed';

export interface JournalEntry extends BaseReference {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  status: JournalStatus;
  lines: JournalEntryLine[];
  sourceType?: 'manual' | 'receipt' | 'payment' | 'payroll' | 'invoice';
  sourceId?: string;
  createdBy: string;
}

export type VoucherType = 'receipt' | 'payment';

export interface VoucherDistribution {
  projectId?: string;
  costCenterId?: string;
  profitCenterId?: string;
  amount: number;
}

export interface Voucher extends BaseReference {
  id: string;
  voucherNumber: string;
  type: VoucherType;
  date: string;
  amount: number;         // المبلغ الإجمالي (المستلم من العميل)
  feeAmount?: number;     // مبلغ العمولة البنكية (المخصوم)
  netAmount?: number;     // المبلغ الصافي (الداخل للبنك)
  paymentMethod: string;  // كود طريقة الدفع من القوائم المرجعية
  personName: string;
  accountId: string;
  cashAccountId: string;
  journalEntryId?: string;
  notes?: string;
  projectId?: string;
  transactionId?: string; 
  contractId?: string;    
  costCenterId?: string;
  profitCenterId?: string;
  appliedMilestoneName?: string; 
  distributions?: VoucherDistribution[]; 
  createdBy: string;
}

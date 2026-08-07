
import { BaseReference } from './reference';

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

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
  balance?: number; // Calculated balance
}

export interface JournalEntryLine {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  projectId?: string;
  costCenterId?: string;
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
export type PaymentMethod = 'cash' | 'bank' | 'transfer';

export interface Voucher extends BaseReference {
  id: string;
  voucherNumber: string;
  type: VoucherType;
  date: string;
  amount: number;
  paymentMethod: PaymentMethod;
  personName: string; // Received from or Paid to
  accountId: string; // The opposite account (Customer/Supplier/Expense)
  cashAccountId: string; // The cash/bank account
  journalEntryId?: string;
  notes?: string;
  projectId?: string;
  createdBy: string;
}

import { BaseReference } from './reference';

export type PayrollStatus = 'draft' | 'reviewed' | 'approved' | 'paid';

export interface PayrollBatch extends BaseReference {
  month: number;
  year: number;
  status: PayrollStatus;
  totalEmployees: number;
  totalBasicSalary: number;
  totalAllowances: number;
  totalDeductions: number;
  totalNetSalary: number;
  generatedBy: string;
  generatedAt: any;
  reviewedBy?: string;
  reviewedAt?: any;
  approvedBy?: string;
  approvedAt?: any;
  paidBy?: string;
  paidAt?: any;
  accountingJournalId?: string; // مرجع للقيد المحاسبي المولد
}

export interface PayrollRecord extends BaseReference {
  batchId: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  month: number;
  year: number;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  absentDays: number;
  lateMinutes: number;
  unjustifiedAbsenceDays: number;
  justifiedAbsenceDays: number;
  status: 'draft' | 'approved' | 'paid';
  notes?: string;
}

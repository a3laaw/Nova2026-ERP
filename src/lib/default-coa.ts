/**
 * @fileOverview دليل الحسابات الافتراضي (Chart of Accounts) لنظام Nova Flow.
 * يستخدم من قبل المساعد المحاسبي الذكي لتوليد قيود اليومية بدقة.
 */

export interface CoaAccount {
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
}

export const defaultCoa: CoaAccount[] = [
  // الأصول (Assets)
  { code: '101', name: 'Cash', type: 'Asset' },
  { code: '102', name: 'Bank - Main Account', type: 'Asset' },
  { code: '103', name: 'Accounts Receivable', type: 'Asset' },
  { code: '104', name: 'Inventory - Raw Materials', type: 'Asset' },
  { code: '105', name: 'Retainage Receivable', type: 'Asset' },
  
  // الالتزامات (Liabilities)
  { code: '201', name: 'Accounts Payable', type: 'Liability' },
  { code: '202', name: 'Accrued Salaries', type: 'Liability' },
  { code: '203', name: 'Advanced Payments from Clients', type: 'Liability' },
  { code: '204', name: 'Retention Payable', type: 'Liability' },
  
  // حقوق الملكية (Equity)
  { code: '301', name: 'Owner Capital', type: 'Equity' },
  { code: '302', name: 'Retained Earnings', type: 'Equity' },
  
  // الإيرادات (Revenue)
  { code: '401', name: 'Project Revenue', type: 'Revenue' },
  { code: '402', name: 'Consulting Fees', type: 'Revenue' },
  { code: '403', name: 'Other Income', type: 'Revenue' },
  
  // المصروفات (Expenses)
  { code: '501', name: 'Construction Material Costs', type: 'Expense' },
  { code: '502', name: 'Subcontractor Costs', type: 'Expense' },
  { code: '503', name: 'Site Labor Wages', type: 'Expense' },
  { code: '504', name: 'Fuel & Transportation', type: 'Expense' },
  { code: '505', name: 'General & Administrative Expenses', type: 'Expense' },
];

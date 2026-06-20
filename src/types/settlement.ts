/**
 * @fileOverview تعريف واجهات البيانات لموديول تسوية نهاية الخدمة.
 */

export type TerminationReason = 'resignation' | 'termination' | 'end_of_contract' | 'misconduct';

export type NoticeType = 'worked' | 'indemnity' | 'waived';

export interface EmployeeSettlementInput {
  employeeId: string;
  fullName: string;
  hireDate: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances?: number;
  annualLeaveUsed: number;
  carriedLeaveDays: number;
  terminationReason: TerminationReason;
}

export interface SettlementResult {
  gratuity: number;
  leaveBalancePay: number;
  noticeIndemnity: number;
  total: number;
  notice: string;
  yearsOfService: number;
  monthsOfService: number;
  lastSalary: number;
  leaveBalance: number;
  dailyWage: number;
  baseGratuityBeforeFactor: number;
  resignationFactor: number;
  effectiveEndDate: string;
  isCapped: boolean;
}

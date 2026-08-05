import { BaseReference } from './reference';

export type EmployeeStatus = 'active' | 'on-leave' | 'terminated';
export type EmployeeType = 'internal' | 'external';
export type PaymentBasis = 'monthly' | 'daily';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'on-leave' | 'returned' | 'commenced';
export type LeaveType = 'annual' | 'sick' | 'emergency' | 'unpaid';
export type PermissionType = 'late_arrival' | 'early_departure';
export type AttendanceStatus = 'present' | 'absent' | 'weekend' | 'holiday' | 'late' | 'early_leave';
export type PayrollStatus = 'draft' | 'reviewed' | 'approved' | 'paid';
export type PaymentMethod = 'cash' | 'check' | 'site_petty_cash' | 'lead_engineer' | 'payroll' | 'transfer';

export interface Employee extends BaseReference {
  employeeNumber: string;
  fullName: string;
  nameEn: string;
  civilId: string;
  mobile: string;
  email?: string;
  nationality?: string;
  departmentId: string;
  departmentName?: string;
  jobId: string;
  jobTitle?: string;
  roleId?: string;       
  roleName?: string;
  roleCode?: string;
  hireDate: string;
  contractType?: string;
  status: EmployeeStatus;
  employeeType: EmployeeType; // 'internal' | 'external'
  paymentBasis: PaymentBasis; // 'monthly' | 'daily'
  paymentMethod: PaymentMethod;
  basicSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: number;
  bankName?: string;
  iban?: string;
  contractExpiry?: string;
  residencyExpiry?: string;
  annualLeaveBalance: number;
  sickLeaveBalance: number;
  isActive: boolean;
}

export interface WorkGroup extends BaseReference {
  id?: string;
  name: string;
  code: string;
  supervisorId: string;
  supervisorName: string;
  category: 'skeleton' | 'finishing' | 'electrical' | 'plumbing' | 'general' | string;
  memberIds: string[];
  isActive: boolean;
  memberCount: number;
  description?: string;
}

export interface LeaveRequest extends BaseReference {
  userId: string;
  userName: string;
  employeeId: string; 
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  workingDays: number;
  reason: string;
  status: LeaveStatus;
  approvedBy?: string;
  approvedAt?: any;
  rejectedBy?: string;
  rejectedAt?: any;
  departureConfirmedAt?: any;
  returnRecordedAt?: any;
  actualReturnDate?: string;
  actualDepartureDate?: string;
  commencementConfirmedAt?: any;
  comment?: string;
  sickLeaveTiers?: {
    fullPay: number;
    threeQuarterPay: number;
    halfPay: number;
    quarterPay: number;
    noPay: number;
  };
}

export interface PermissionRequest extends BaseReference {
  userId: string;
  userName: string;
  employeeId?: string;
  type: 'late_arrival' | 'early_departure';
  date: string; 
  startTime: string; 
  endTime: string; 
  durationHours: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: any;
  comment?: string;
}

export interface EmployeeAuditLog extends BaseReference {
  employeeId: string;
  changedBy: string;
  changedByName: string;
  field: string;
  oldValue: any;
  newValue: any;
  action: 'update' | 'terminate' | 'activate' | 'leave_deduction' | 'leave_status_change';
}

export interface AttendanceRecord extends BaseReference {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  date: string; 
  checkIn?: string; 
  checkOut?: string; 
  checkIn2?: string; 
  checkOut2?: string;
  status: AttendanceStatus;
  minutesLate: number; 
  minutesEarlyLeave: number;
  isHoliday: boolean;
  isWeekend: boolean;
  note?: string;
}

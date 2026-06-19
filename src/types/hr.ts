import { BaseReference } from './reference';

export type EmployeeStatus = 'active' | 'on-leave' | 'terminated';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'on-leave' | 'returned';
export type LeaveType = 'Annual' | 'Sick' | 'Emergency' | 'Unpaid';
export type PermissionType = 'late_arrival' | 'early_departure';
export type AttendanceStatus = 'present' | 'absent' | 'weekend' | 'holiday';
export type PayrollStatus = 'draft' | 'reviewed' | 'approved' | 'paid';
export type PaymentMethod = 'cash' | 'transfer' | 'check' | 'payroll';

export interface Employee extends BaseReference {
  employeeNumber: string;
  fullName: string;
  nameEn: string; // الاسم بالإنجليزية (إلزامي الآن)
  civilId: string;
  mobile: string;
  email?: string;
  nationality?: string;
  departmentId: string;
  departmentName?: string;
  jobId: string;
  jobTitle?: string;
  roleCode?: string;
  hireDate: string; // YYYY-MM-DD
  contractType?: string;
  status: EmployeeStatus;
  paymentMethod: PaymentMethod;
  basicSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: number;
  bankName?: string;
  bankAccountNumber?: string;
  iban?: string;
  contractExpiry?: string;
  residencyExpiry?: string;
  annualLeaveUsed?: number;
  carriedLeaveDays?: number;
  terminationDate?: string;
  terminationReason?: string;
  isActive: boolean;
}

export interface EmployeeAuditLog extends BaseReference {
  employeeId: string;
  changedBy: string;
  changedByName: string;
  field: string;
  oldValue: any;
  newValue: any;
  action: 'update' | 'terminate' | 'activate';
}

export interface LeaveRequest extends BaseReference {
  employeeId: string;
  employeeName: string;
  leaveType: LeaveType;
  startDate: any;
  endDate: any;
  days: number;
  workingDays: number;
  notes?: string;
  status: LeaveStatus;
  adminComment?: string;
  approvedBy?: string;
  approvedAt?: any;
}

export interface PermissionRequest extends BaseReference {
  employeeId: string;
  employeeName: string;
  type: PermissionType;
  date: any;
  durationHours: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  adminComment?: string;
}

export interface AttendanceRecord extends BaseReference {
  employeeId: string;
  employeeName: string;
  date: any;
  checkIn?: string;
  checkOut?: string;
  minutesLate?: number;
  minutesEarlyLeave?: number;
  status: AttendanceStatus;
  source?: 'excel' | 'manual';
}

export interface PayrollRecord extends BaseReference {
  employeeId: string;
  employeeName: string;
  year: number;
  month: number;
  earnings: {
    basicSalary: number;
    housingAllowance?: number;
    transportAllowance?: number;
    otherAllowances?: number;
  };
  deductions?: {
    absence?: number;
    late?: number;
    penalties?: number;
    advances?: number;
    other?: number;
  };
  netSalary: number;
  status: PayrollStatus;
}

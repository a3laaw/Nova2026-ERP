import { BaseReference } from './reference';

export type EmployeeStatus = 'active' | 'on-leave' | 'terminated';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'on-leave' | 'returned';
export type LeaveType = 'annual' | 'sick' | 'emergency' | 'unpaid';
export type PermissionType = 'late_arrival' | 'early_departure';
export type AttendanceStatus = 'present' | 'absent' | 'weekend' | 'holiday';
export type PayrollStatus = 'draft' | 'reviewed' | 'approved' | 'paid';
export type PaymentMethod = 'cash' | 'transfer' | 'check' | 'payroll';

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
  roleCode?: string;
  hireDate: string;
  contractType?: string;
  status: EmployeeStatus;
  paymentMethod: PaymentMethod;
  basicSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: number;
  bankName?: string;
  iban?: string;
  contractExpiry?: string;
  residencyExpiry?: string;
  annualLeaveBalance: number; // رصيد الإجازات السنوية
  sickLeaveBalance: number;   // رصيد الإجازات المرضية
  isActive: boolean;
}

export interface LeaveRequest extends BaseReference {
  userId: string;
  userName: string;
  employeeId?: string; // ID الوثيقة في Firestore
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;        // إجمالي الأيام التقويمية
  workingDays: number; // أيام العمل الفعلية (بعد استبعاد العطلات)
  reason: string;
  status: LeaveStatus;
  approvedBy?: string;
  approvedAt?: any;
  comment?: string;
  sickLeaveTiers?: {
    fullPay: number;
    threeQuarterPay: number;
    halfPay: number;
    quarterPay: number;
    noPay: number;
  };
}

export interface EmployeeAuditLog extends BaseReference {
  employeeId: string;
  changedBy: string;
  changedByName: string;
  field: string;
  oldValue: any;
  newValue: any;
  action: 'update' | 'terminate' | 'activate' | 'leave_deduction';
}

export interface AttendanceRecord extends BaseReference {
  employeeId: string;
  employeeName: string;
  date: any;
  checkIn?: string;
  checkOut?: string;
  status: AttendanceStatus;
}

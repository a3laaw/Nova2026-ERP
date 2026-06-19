import { BaseReference } from './reference';

export type LeaveType = 'annual' | 'sick' | 'emergency' | 'unpaid';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest extends BaseReference {
  userId: string;
  userName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  comment?: string;
  approvedBy?: string;
  approvedAt?: any;
}

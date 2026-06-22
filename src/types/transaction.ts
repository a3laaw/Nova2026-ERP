import { BaseReference } from './reference';

export type TransactionStatus = 'new' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';

export interface Transaction extends BaseReference {
  id: string;
  transactionNumber: string; // الرقم المتسلسل المهني (مثل C-1001-01)
  clientId: string;
  clientName: string;
  activityTypeId: string;
  activityTypeName: string;
  serviceId: string;
  serviceName: string;
  subServiceId: string;
  subServiceName: string;
  assignedEngineerId: string;
  assignedEngineerName: string;
  description: string;
  status: TransactionStatus;
  companyId: string;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
  updatedBy: string;
}

export interface TransactionTimelineEvent extends BaseReference {
  transactionId: string;
  type: 'system' | 'stage_start' | 'stage_complete' | 'comment';
  content: string;
  userId: string;
  userName: string;
}

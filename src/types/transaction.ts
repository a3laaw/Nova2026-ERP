
import { BaseReference } from './reference';

export type TransactionStatus = 'new' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';

export interface Transaction extends BaseReference {
  transactionNumber: string;
  clientId: string;
  clientName?: string;
  activityTypeId: string;
  activityTypeName?: string;
  serviceId: string;
  serviceName?: string;
  subServiceId: string;
  subServiceName?: string;
  assignedEngineerId?: string;
  assignedEngineerName?: string;
  description?: string;
  status: TransactionStatus;
  createdBy?: string;
  updatedBy?: string;
}

export interface TransactionTimelineEvent extends BaseReference {
  transactionId: string;
  type: 'system' | 'update' | 'note' | 'status_change';
  content: string;
  userId?: string;
  userName?: string;
}

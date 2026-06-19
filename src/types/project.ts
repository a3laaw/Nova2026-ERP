'use client';

import { BaseReference } from './reference';

export interface Project extends BaseReference {
  name: string;
  description?: string;
  activityTypeId: string;
  serviceId: string;
  subServiceId: string;
  budget: number;
  status: 'active' | 'completed' | 'suspended' | 'on-hold';
  startDate?: string;
  endDate?: string;
  clientName?: string;
  location?: {
    governorateId: string;
    areaId: string;
  };
}

export interface StageInstance extends BaseReference {
  projectId: string;
  templateStageId: string;
  name: string;
  nameEn: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped';
  isNumeric: boolean;
  numericTarget?: number | null;
  numericValue?: number;
  isTimed: boolean;
  timeTargetDays?: number | null;
  startedAt?: any;
  completedAt?: any;
  completedBy?: string;
  nextStageIds: string[]; // الروابط التنفيذية المستنسخة من القالب
}

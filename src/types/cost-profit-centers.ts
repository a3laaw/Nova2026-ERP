'use client';
/**
 * @fileOverview مراكز التكلفة والربحية — أبعاد تحليلية مستقلة عن الحسابات،
 * تُستخدم على مستوى سطر القيد المحاسبي (JournalEntryLine) فقط.
 */

import { BaseReference } from './reference';

export interface CostCenter extends BaseReference {
  id: string;
  code: string;              // كود فريد، مثال: CC-A-MATERIALS
  name: string;
  projectId?: string;        // ربط اختياري بمشروع (لو مركز تكلفة خاص بمشروع)
  isAdministrative: boolean; // true لمراكز إدارية عامة (HQ, Finance, HR)
  isActive: boolean;
}

export interface ProfitCenter extends BaseReference {
  id: string;
  code: string;              // مثال: PC-PROJECT-A
  name: string;
  projectId?: string;
  isActive: boolean;
}

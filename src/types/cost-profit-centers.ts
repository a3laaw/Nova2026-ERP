'use client';
/**
 * @fileOverview مراكز التكلفة والربحية — أبعاد تحليلية مستقلة عن الحسابات.
 * تم تحديثها لدعم الهوية الثنائية (Ar/En) لضمان دقة التقارير السيادية.
 */

import { BaseReference } from './reference';

export interface CostCenter extends BaseReference {
  id: string;
  code: string;              // كود فريد، مثال: CC-A-MATERIALS
  name: string;              // للاستخدام العام
  nameAr: string;            // الاسم بالعربي
  nameEn: string;            // الاسم بالإنجليزي
  projectId?: string;        // ربط اختياري بمشروع (لو مركز تكلفة خاص بمشروع)
  isAdministrative: boolean; // true لمراكز إدارية عامة (HQ, Finance, HR)
  isActive: boolean;
}

export interface ProfitCenter extends BaseReference {
  id: string;
  code: string;              // مثال: PC-PROJECT-A
  name: string;
  nameAr: string;
  nameEn: string;
  projectId?: string;
  isActive: boolean;
}

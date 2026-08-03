'use client';
/**
 * @fileOverview جدول التكلفة المرجعي الموحد (العمالة).
 * المصدر الوحيد لحساب تكلفة الساعة عند تسجيل الزيارات الميدانية لضمان دقة WIP.
 */

import { BaseReference } from './reference';

export interface LaborRateEntry {
  jobTitle: string;          // المسمى الوظيفي (نجار، حداد، عامل عام...)
  hourlyCost: number;        // تكلفة الساعة المعتمدة
}

export interface CostRateCard extends BaseReference {
  id: string;
  name: string;                    // مثال: "تعرفة 2026 - الربع الأول"
  effectiveFrom: string;           // تاريخ سريان هذا الجدول YYYY-MM-DD
  laborRates: LaborRateEntry[];
  isActive: boolean;               // الجدول المعتمد حالياً (واحد فعّال بكل مرة)
  createdBy?: string;
  updatedBy?: string;
}

'use client';
/**
 * @fileOverview تعريف واجهات البيانات لسجل المعدات والآليات (Equipment Master).
 * المصدر السيادي الوحيد لكل معدة/آلية يمتلكها أو يستأجرها النظام.
 */

import { BaseReference } from './reference';

export type EquipmentOwnershipType = 'owned' | 'rented';
export type EquipmentStatus = 'available' | 'in_use' | 'under_maintenance' | 'retired';
export type RentalCostMethod = 'hourly' | 'daily' | 'monthly';

export interface Equipment extends BaseReference {
  id: string;
  code: string;                          // كود المعدة (مثال: EQ-R-001)
  name: string;                          // اسم المعدة (مثال: حفار كوماتسو)
  type: string;                          // تصنيف المعدة
  ownershipType: EquipmentOwnershipType; // مملوكة أو مستأجرة
  
  // بيانات التأجير (المرحلة الحالية)
  supplierId?: string;                   // معرف شركة التأجير
  supplierName?: string;                 // اسم شركة التأجير
  costMethod?: RentalCostMethod;         // طريقة التكلفة (ساعة/يوم/شهر)
  costValue?: number;                    // قيمة التكلفة (KWD)

  status: EquipmentStatus;
  currentProjectId?: string;
  currentProjectName?: string;
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
}

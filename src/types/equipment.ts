'use client';
/**
 * @fileOverview تعريف واجهات البيانات لسجل المعدات والآليات (Equipment Master).
 * المصدر السيادي الوحيد لكل معدة/آلية يمتلكها أو يستأجرها النظام.
 */

import { BaseReference } from './reference';

export type EquipmentOwnershipType = 'owned' | 'rented';
export type EquipmentStatus = 'available' | 'in_use' | 'under_maintenance' | 'retired';
export type RentalCostMethod = 'hourly' | 'daily' | 'monthly';
export type DepreciationMethod = 'hours' | 'straight' | 'none';

export interface Equipment extends BaseReference {
  id: string;
  code: string;                          // كود المعدة (مثال: EQ-001)
  name: string;                          // اسم المعدة
  type: string;                          // تصنيف المعدة (حفار، بوكات، إلخ)
  ownershipType: EquipmentOwnershipType; 
  status: EquipmentStatus;
  
  // --- بيانات الملكية (للنوع: مملوكة) ---
  purchaseDate?: string;
  purchaseCost?: number;
  salvageValue?: number;                 // القيمة التخريدية
  expectedTotalHours?: number;           // العمر الافتراضي بالساعات
  depreciationMethod?: DepreciationMethod;
  hourlyDepreciationRate?: number;       // معدل الإهلاك للساعة (محسوب أو يدوي)
  
  // بيانات التمويل
  isFinanced?: boolean;
  financierName?: string;
  monthlyInstallment?: number;
  installmentDay?: number;

  // --- بيانات التأجير (للنوع: مستأجرة) ---
  supplierId?: string;
  supplierName?: string;
  costMethod?: RentalCostMethod;         // ساعة/يوم/شهر
  costValue?: number;                    // القيمة المتفق عليها
  hourlyRentalRate?: number;             // القيمة المحولة للساعة للربط الميداني

  plateNumber?: string;
  notes?: string;
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
}

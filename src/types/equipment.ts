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
export type EquipmentCategory = 'heavy_machinery' | 'vehicle' | 'hand_tool' | 'stationary' | 'other';
export type InsuranceType = 'comprehensive' | 'third_party' | 'none';

export interface Equipment extends BaseReference {
  id: string;
  code: string;                          // كود المعدة (مثال: EQ-001)
  name: string;                          // اسم المعدة
  category: EquipmentCategory;           // تصنيف المعدة
  status: EquipmentStatus;
  ownershipType: EquipmentOwnershipType; 
  
  // --- البيانات الإدارية والتراخيص (للمملوكة والمرخصة فقط) ---
  isLicensed?: boolean;
  chassisNumber?: string;                // رقم الشاصي
  plateNumber?: string;                  // رقم اللوحة / الدفتر
  registrationExpiry?: string;           // تاريخ انتهاء الترخيص
  insuranceType?: InsuranceType;         // نوع التأمين
  insuranceCompany?: string;             // شركة التأمين
  insuranceExpiry?: string;              // تاريخ انتهاء التأمين

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

  notes?: string;
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
}

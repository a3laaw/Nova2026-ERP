'use client';
/**
 * @fileOverview تعريف واجهات البيانات لسجل المعدات والآليات (Equipment Master).
 * المصدر السيادي الوحيد لكل معدة/آلية يمتلكها أو يستأجرها النظام.
 */

import { BaseReference } from './reference';

export type EquipmentOwnershipType = 'owned' | 'rented';
export type EquipmentStatus = 'available' | 'in_use' | 'under_maintenance' | 'retired';
export type DepreciationMethod = 'hours' | 'straight' | 'none';

export interface Equipment extends BaseReference {
  id: string;
  code: string;                          // كود تسلسلي (مثال: EQP-0001)
  name: string;                          // اسم المعدة
  type: string;                          // نوع المعدة (حفار، رافعة، شاحنة قلاب...)
  ownershipType: EquipmentOwnershipType;
  
  // بيانات الشراء والتشغيل
  purchaseDate?: string;                 // تاريخ الشراء / بدء التشغيل
  purchaseCost?: number;                 // سعر الشراء الأصلي (KWD)
  salvageValue?: number;                 // القيمة التخريدية / الخردة (KWD)
  
  // التمويل (للمعدات المملوكة)
  isFinanced?: boolean;                  // هل المعدة ممولة؟
  financierName?: string;                // جهة التمويل
  monthlyInstallment?: number;           // القسط الشهري (KWD)
  installmentDay?: number;               // يوم القسط في الشهر

  // معالجة الإهلاك (للمعدات المملوكة)
  depreciationMethod?: DepreciationMethod;
  expectedTotalHours?: number;           // إجمالي ساعات العمل المتوقعة
  hourlyDepreciationRate?: number;       // معدل الإهلاك بالساعة (KWD / HR)

  // الإيجار (للمعدات المستأجرة)
  hourlyRentalRate?: number;             

  status: EquipmentStatus;
  currentProjectId?: string;             // المشروع المخصص له حاليًا
  currentProjectName?: string;
  plateNumber?: string;                  // رقم اللوحة
  notes?: string;

  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * سجل حركة/تخصيص المعدة (Equipment Log)
 */
export interface EquipmentAssignmentLog extends BaseReference {
  id: string;
  equipmentId: string;
  equipmentName: string;
  projectId: string;
  projectName: string;
  fromDate: string;
  toDate?: string;
  assignedBy: string;
  assignedByName: string;
}

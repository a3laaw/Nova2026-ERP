'use client';
/**
 * @fileOverview تعريف واجهات البيانات لسجل المعدات والآليات (Equipment Master).
 * المصدر السيادي الوحيد لكل معدة/آلية يمتلكها أو يستأجرها النظام.
 */

import { BaseReference } from './reference';

export type EquipmentOwnershipType = 'owned' | 'rented';
export type EquipmentStatus = 'available' | 'in_use' | 'under_maintenance' | 'retired';

export interface Equipment extends BaseReference {
  id: string;
  code: string;                          // كود تسلسلي (مثال: EQP-0001)
  name: string;                          // اسم المعدة
  type: string;                          // نوع المعدة (حفار، رافعة، شاحنة قلاب...)
  ownershipType: EquipmentOwnershipType;

  // تعرفة الاستخدام بالساعة (حسب نوع الملكية)
  hourlyRentalRate?: number;             // إلزامي لو ownershipType == 'rented'
  hourlyDepreciationRate?: number;       // إلزامي لو ownershipType == 'owned'

  status: EquipmentStatus;
  currentProjectId?: string;             // المشروع اللي مخصصة له حاليًا (إن وجد)
  currentProjectName?: string;
  plateNumber?: string;                  // رقم اللوحة (للمركبات)
  notes?: string;

  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * سجل حركة/تخصيص المعدة (Equipment Log) — لتتبع أين استُخدمت ومتى
 */
export interface EquipmentAssignmentLog extends BaseReference {
  id: string;
  equipmentId: string;
  equipmentName: string;
  projectId: string;
  projectName: string;
  fromDate: string;
  toDate?: string;                       // فارغ = لسا مخصصة
  assignedBy: string;
  assignedByName: string;
}

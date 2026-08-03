'use client';
/**
 * @fileOverview تعريف واجهات البيانات لسجل المعدات والآليات (Equipment Master).
 * تم التحديث لدعم البيانات الإدارية الديناميكية وحالة الأدوات اليدوية وسنة التصنيع.
 */

import { BaseReference } from './reference';

export type EquipmentOwnershipType = 'owned' | 'rented';
export type EquipmentStatus = 'available' | 'in_use' | 'under_maintenance' | 'retired';
export type RentalCostMethod = 'hourly' | 'daily' | 'monthly';
export type DepreciationMethod = 'hours' | 'straight' | 'none';
export type EquipmentCategory = 'heavy_machinery' | 'vehicle' | 'hand_tool' | 'stationary' | 'other';
export type InsuranceType = 'comprehensive' | 'third_party' | 'none';
export type ToolCondition = 'new' | 'used_good' | 'under_maintenance';

export interface Equipment extends BaseReference {
  id: string;
  code: string;                          
  name: string;                          
  category: EquipmentCategory;           
  status: EquipmentStatus;
  ownershipType: EquipmentOwnershipType; 
  
  // --- البيانات الإدارية والتراخيص (ديناميكية) ---
  manufacturingYear?: string;            // سنة التصنيع / الموديل
  isLicensed?: boolean;
  isStreetLicensed?: boolean;            // للآليات الثقيلة
  chassisNumber?: string;                
  plateNumber?: string;                  
  registrationNumber?: string;           // رقم الدفتر
  registrationExpiry?: string;           
  insuranceType?: InsuranceType;         
  insuranceCompany?: string;             
  insuranceExpiry?: string;              
  thirdPartyInspectionExpiry?: string;    // لآليات الموقع
  siteInsuranceExpiry?: string;          // لآليات الموقع

  // بيانات المعدات الثابتة
  serialNumber?: string;
  capacity?: string;                     // KVA/HP
  nextServiceDate?: string;
  safetyCertExpiry?: string;

  // بيانات الأدوات اليدوية
  brandModel?: string;                   // الماركة/الموديل
  toolCondition?: ToolCondition;

  // --- بيانات الملكية (للنوع: مملوكة) ---
  purchaseDate?: string;
  purchaseCost?: number;
  salvageValue?: number;                 
  depreciationMethod?: DepreciationMethod;
  hourlyDepreciationRate?: number;       
  
  isFinanced?: boolean;
  financierName?: string;
  monthlyInstallment?: number;
  installmentDay?: number;

  // --- بيانات التأجير (للنوع: مستأجرة) ---
  supplierId?: string;
  supplierName?: string;
  costMethod?: RentalCostMethod;         
  costValue?: number;                    
  hourlyRentalRate?: number;             

  notes?: string;
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
}

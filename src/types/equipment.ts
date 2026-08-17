
'use client';
/**
 * @fileOverview تعريف واجهات البيانات لسجل المعدات والآليات (Equipment Master).
 * تم التحديث لدعم البيانات الإدارية الديناميكية ثنائية اللغة.
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
  nameAr: string;                          
  nameEn: string;                          
  category: EquipmentCategory;           
  status: EquipmentStatus;
  ownershipType: EquipmentOwnershipType; 
  
  manufacturingYear?: string;            
  isLicensed?: boolean;
  isStreetLicensed?: boolean;            
  chassisNumber?: string;                
  plateNumber?: string;                  
  registrationNumber?: string;           
  registrationExpiry?: string;           
  insuranceType?: InsuranceType;         
  insuranceCompany?: string;             
  insuranceExpiry?: string;              
  thirdPartyInspectionExpiry?: string;    
  siteInsuranceExpiry?: string;          

  serialNumber?: string;
  capacity?: string;                     
  nextServiceDate?: string;
  safetyCertExpiry?: string;

  brandModel?: string;                   
  toolCondition?: ToolCondition;

  purchaseDate?: string;
  purchaseCost?: number;
  salvageValue?: number;                 
  depreciationMethod?: DepreciationMethod;
  hourlyDepreciationRate?: number;       
  
  isFinanced?: boolean;
  financierName?: string;
  monthlyInstallment?: number;
  installmentDay?: number;

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

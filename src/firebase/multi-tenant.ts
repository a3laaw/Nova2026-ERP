
'use client';

import { getTenantPath } from '@/lib/utils';

/**
 * محرك المسارات الموحد لنظام Nova ERP.
 * يضمن هذا الملف أن كافة البيانات يتم تخزينها داخل نطاق الشركة (Company Scope).
 */
export const paths = {
  // الحسابات العالمية
  globalUser: (uid: string) => `global_users/${uid}`,
  company: (companyId: string) => `companies/${companyId}`,
  
  // المرجعيات التنظيمية
  departments: (companyId: string) => getTenantPath(companyId, 'departments'),
  jobs: (companyId: string, deptId: string) => getTenantPath(companyId, 'departments', deptId, 'jobs'),

  // المرجعيات الجغرافية
  governorates: (companyId: string) => getTenantPath(companyId, 'governorates'),
  areas: (companyId: string, govId: string) => getTenantPath(companyId, 'governorates', govId, 'areas'),

  // المسارات الفنية (Technical Path Engine - Templates)
  serviceTypes: (companyId: string) => getTenantPath(companyId, 'serviceTypes'),
  transactionTypes: (companyId: string) => getTenantPath(companyId, 'transactionTypes'),
  subServices: (companyId: string, txId: string) => 
    getTenantPath(companyId, 'transactionTypes', txId, 'subServices'),
  technicalStages: (companyId: string, txId: string, subId: string) => 
    getTenantPath(companyId, 'transactionTypes', txId, 'subServices', subId, 'technicalStages'),

  // الموديولات التشغيلية (Live Execution)
  projects: (companyId: string) => getTenantPath(companyId, 'projects'),
  projectStages: (companyId: string, projectId: string) => 
    getTenantPath(companyId, 'projects', projectId, 'stages'),
  projectContracts: (companyId: string, projectId: string) => 
    getTenantPath(companyId, 'projects', projectId, 'contracts'),
  
  leads: (companyId: string) => getTenantPath(companyId, 'leads'),
};

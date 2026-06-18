
'use client';

import { getTenantPath } from '@/lib/utils';

/**
 * محرك المسارات الموحد لنظام Nova ERP.
 * يضمن هذا الملف أن كافة البيانات يتم تخزينها داخل نطاق الشركة (Company Scope).
 */
export const paths = {
  // الحسابات العالمية (Global Context)
  globalUser: (uid: string) => `global_users/${uid}`,
  company: (companyId: string) => `companies/${companyId}`,
  
  // المرجعيات التنظيمية (Organization Reference)
  departments: (companyId: string) => getTenantPath(companyId, 'departments'),
  jobs: (companyId: string, deptId: string) => getTenantPath(companyId, 'departments', deptId, 'jobs'),

  // المرجعيات الجغرافية (Geography Reference)
  governorates: (companyId: string) => getTenantPath(companyId, 'governorates'),
  areas: (companyId: string, govId: string) => getTenantPath(companyId, 'governorates', govId, 'areas'),

  // المسارات الفنية - القوالب (Technical Path Engine - Templates)
  serviceTypes: (companyId: string) => getTenantPath(companyId, 'serviceTypes'),
  transactionTypes: (companyId: string) => getTenantPath(companyId, 'transactionTypes'),
  subServices: (companyId: string, txId: string) => 
    getTenantPath(companyId, 'transactionTypes', txId, 'subServices'),
  technicalStages: (companyId: string, txId: string, subId: string) => 
    getTenantPath(companyId, 'transactionTypes', txId, 'subServices', subId, 'technicalStages'),

  // الموديولات التشغيلية - التنفيذ (Live Execution)
  projects: (companyId: string) => getTenantPath(companyId, 'projects'),
  stageInstances: (companyId: string, projectId: string) => 
    getTenantPath(companyId, 'projects', projectId, 'stageInstances'),
  projectContracts: (companyId: string, projectId: string) => 
    getTenantPath(companyId, 'projects', projectId, 'contracts'),
  
  leads: (companyId: string) => getTenantPath(companyId, 'leads'),
};

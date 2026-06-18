
'use client';

import { getTenantPath } from '@/lib/utils';

/**
 * Utility to build firestore paths based on the current active company.
 * Follows the patterns defined in the Reference Data Constitution.
 */
export const paths = {
  // Core Entities
  user: (companyId: string, uid: string) => getTenantPath(companyId, 'users', uid),
  settings: (companyId: string) => getTenantPath(companyId, 'settings', 'general'),
  company: (companyId: string) => `companies/${companyId}`,
  globalUser: (uid: string) => `global_users/${uid}`,

  // Organizational Reference
  departments: (companyId: string) => getTenantPath(companyId, 'departments'),
  jobs: (companyId: string, deptId: string) => getTenantPath(companyId, 'departments', deptId, 'jobs'),

  // Geographical Reference
  governorates: (companyId: string) => getTenantPath(companyId, 'governorates'),
  areas: (companyId: string, govId: string) => getTenantPath(companyId, 'governorates', govId, 'areas'),

  // Technical Path Engine (The Heart)
  serviceTypes: (companyId: string) => getTenantPath(companyId, 'serviceTypes'),
  transactionTypes: (companyId: string) => getTenantPath(companyId, 'transactionTypes'),
  subServices: (companyId: string, txId: string) => getTenantPath(companyId, 'transactionTypes', txId, 'subServices'),
  technicalStages: (companyId: string, txId: string, subId: string) => 
    getTenantPath(companyId, 'transactionTypes', txId, 'subServices', subId, 'technicalStages'),

  // Operational
  projects: (companyId: string) => getTenantPath(companyId, 'projects'),
  leads: (companyId: string) => getTenantPath(companyId, 'leads'),
  checklists: (companyId: string) => getTenantPath(companyId, 'checklists'),
};

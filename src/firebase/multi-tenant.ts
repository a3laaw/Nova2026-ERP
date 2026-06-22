'use client';

import { getTenantPath } from '@/lib/utils';

/**
 * محرك المسارات الموحد لنظام Nova ERP.
 */
export const paths = {
  // الحسابات العالمية
  globalUser: (uid: string) => `global_users/${uid}`,
  company: (companyId: string) => `companies/${companyId}`,
  
  // نظام الدعوات (Invites)
  invitations: (companyId: string) => getTenantPath(companyId, 'invitations'),
  
  // الهيكل التنظيمي
  departments: (companyId: string) => getTenantPath(companyId, 'departments'),
  jobs: (companyId: string, deptId: string) => `${getTenantPath(companyId, 'departments')}/${deptId}/jobs`,
  roles: (companyId: string) => getTenantPath(companyId, 'roles'),

  // الجغرافيا
  governorates: (companyId: string) => getTenantPath(companyId, 'governorates'),
  areas: (companyId: string, govId: string) => `${getTenantPath(companyId, 'governorates')}/${govId}/areas`,

  // العملاء
  clients: (companyId: string) => getTenantPath(companyId, 'clients'),
  clientHistory: (companyId: string, clientId: string) => `${getTenantPath(companyId, 'clients')}/${clientId}/history`,

  // الموارد البشرية والتوظيف
  employees: (companyId: string) => getTenantPath(companyId, 'employees'),
  applications: (companyId: string) => getTenantPath(companyId, 'applications'),
  leaveRequests: (companyId: string) => getTenantPath(companyId, 'leaveRequests'),
  permissionRequests: (companyId: string) => getTenantPath(companyId, 'permissionRequests'),
  attendance: (companyId: string) => getTenantPath(companyId, 'attendance'),
  payroll: (companyId: string) => getTenantPath(companyId, 'payroll'),

  // المخازن والمخزون
  warehouses: (companyId: string) => getTenantPath(companyId, 'warehouses'),
  inventoryItems: (companyId: string) => getTenantPath(companyId, 'inventoryItems'),
  assetAssignments: (companyId: string) => getTenantPath(companyId, 'assetAssignments'),

  // المشاريع والفرص
  projects: (companyId: string) => getTenantPath(companyId, 'projects'),
  leads: (companyId: string) => getTenantPath(companyId, 'leads'),
};

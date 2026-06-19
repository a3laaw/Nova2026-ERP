'use client';

import { getTenantPath } from '@/lib/utils';

/**
 * محرك المسارات الموحد لنظام Nova ERP.
 * يضمن تخزين كافة البيانات المرجعية والتشغيلية داخل نطاق الشركة حصراً (Multi-tenant).
 */
export const paths = {
  // الحسابات العالمية
  globalUser: (uid: string) => `global_users/${uid}`,
  company: (companyId: string) => `companies/${companyId}`,
  
  // الهيكل التنظيمي والصلاحيات
  departments: (companyId: string) => 
    getTenantPath(companyId, 'departments'),
  jobs: (companyId: string, deptId: string) => 
    `${getTenantPath(companyId, 'departments')}/${deptId}/jobs`,
  roles: (companyId: string) =>
    getTenantPath(companyId, 'roles'),

  // البيانات الجغرافية
  governorates: (companyId: string) => 
    getTenantPath(companyId, 'governorates'),
  areas: (companyId: string, govId: string) => 
    `${getTenantPath(companyId, 'governorates')}/${govId}/areas`,

  // الموارد البشرية (HR)
  employees: (companyId: string) => 
    getTenantPath(companyId, 'employees'),
  employeeAuditLogs: (companyId: string, empId: string) => 
    `${getTenantPath(companyId, 'employees')}/${empId}/auditLogs`,
  leaveRequests: (companyId: string) => 
    getTenantPath(companyId, 'leaveRequests'),
  permissionRequests: (companyId: string) => 
    getTenantPath(companyId, 'permissionRequests'),
  attendance: (companyId: string) => 
    getTenantPath(companyId, 'attendance'),
  payroll: (companyId: string) => 
    getTenantPath(companyId, 'payroll'),
  holidays: (companyId: string) => 
    getTenantPath(companyId, 'holidays'),

  // الهيكل المرجعي الفني الرباعي
  activityTypes: (companyId: string) => 
    getTenantPath(companyId, 'activityTypes'),
  services: (companyId: string, activityTypeId: string) => 
    `${getTenantPath(companyId, 'activityTypes')}/${activityTypeId}/services`,
  subServices: (companyId: string, activityTypeId: string, serviceId: string) => 
    `${getTenantPath(companyId, 'activityTypes')}/${activityTypeId}/services/${serviceId}/subServices`,
  technicalStages: (companyId: string, activityTypeId: string, serviceId: string, subId: string) => 
    `${getTenantPath(companyId, 'activityTypes')}/${activityTypeId}/services/${serviceId}/subServices/${subId}/technicalStages`,

  // الموديولات التشغيلية
  projects: (companyId: string) => 
    getTenantPath(companyId, 'projects'),
  stageInstances: (companyId: string, projectId: string) => 
    `${getTenantPath(companyId, 'projects')}/${projectId}/stageInstances`,
  projectContracts: (companyId: string, projectId: string) => 
    `${getTenantPath(companyId, 'projects')}/${projectId}/contracts`,
  leads: (companyId: string) => 
    getTenantPath(companyId, 'leads'),
};

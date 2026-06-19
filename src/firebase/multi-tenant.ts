
'use client';

import { getTenantPath } from '@/lib/utils';

/**
 * محرك المسارات الموحد لنظام Nova ERP (الهيكل الرباعي الجديد).
 * يضمن تخزين كافة البيانات المرجعية داخل نطاق الشركة حصراً.
 */
export const paths = {
  // الحسابات العالمية
  globalUser: (uid: string) => `global_users/${uid}`,
  company: (companyId: string) => `companies/${companyId}`,
  
  // الهيكل المرجعي الرباعي
  activityTypes: (companyId: string) => 
    getTenantPath(companyId, 'activityTypes'),
  
  services: (companyId: string, activityTypeId: string) => 
    `${getTenantPath(companyId, 'activityTypes')}/${activityTypeId}/services`,
  
  subServices: (companyId: string, activityTypeId: string, serviceId: string) => 
    `${getTenantPath(companyId, 'activityTypes')}/${activityTypeId}/services/${serviceId}/subServices`,
  
  technicalStages: (companyId: string, activityTypeId: string, serviceId: string, subId: string) => 
    `${getTenantPath(companyId, 'activityTypes')}/${activityTypeId}/services/${serviceId}/subServices/${subId}/technicalStages`,

  // الموديولات التشغيلية (للمستقبل)
  projects: (companyId: string) => getTenantPath(companyId, 'projects'),
  leads: (companyId: string) => getTenantPath(companyId, 'leads'),
};

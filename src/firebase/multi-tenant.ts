'use client';

import { getTenantPath } from '@/lib/utils';

/**
 * محرك المسارات الموحد لنظام Nova ERP.
 * يحتوي على كافة مراجع مجموعات Firestore المعزولة لكل منشأة.
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

  // القوائم المرجعية الموحدة (Extensible Lists)
  unitTypes: (companyId: string) => getTenantPath(companyId, 'unitTypes'),
  paymentMethods: (companyId: string) => getTenantPath(companyId, 'paymentMethods'),
  paymentConditionTypes: (companyId: string) => getTenantPath(companyId, 'paymentConditionTypes'),
  milestoneTimingTypes: (companyId: string) => getTenantPath(companyId, 'milestoneTimingTypes'),
  itemCategories: (companyId: string) => getTenantPath(companyId, 'itemCategories'),
  costTypeCategories: (companyId: string) => getTenantPath(companyId, 'costTypeCategories'),

  // أنشطة الأعمال (Service Types)
  serviceTypes: (companyId: string) => getTenantPath(companyId, 'serviceTypes'),

  // العملاء والفرص
  leads: (companyId: string) => getTenantPath(companyId, 'leads'),
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
  inventoryTransactions: (companyId: string) => getTenantPath(companyId, 'inventoryTransactions'), 
  assetAssignments: (companyId: string) => getTenantPath(companyId, 'assetAssignments'),

  // الموردين والمشتريات
  suppliers: (companyId: string) => getTenantPath(companyId, 'suppliers'),
  purchaseOrders: (companyId: string) => getTenantPath(companyId, 'purchaseOrders'),
  poItems: (companyId: string, poId: string) => `${getTenantPath(companyId, 'purchaseOrders')}/${poId}/items`,

  // المسارات الفنية والتشغيلية (The Technical Core - Workflows)
  activityTypes: (companyId: string) => getTenantPath(companyId, 'activityTypes'),
  services: (companyId: string, actId: string) => `${getTenantPath(companyId, 'activityTypes')}/${actId}/services`,
  subServices: (companyId: string, actId: string, srvId: string) => `${getTenantPath(companyId, 'activityTypes')}/${actId}/services/${srvId}/subServices`,
  technicalStages: (companyId: string, actId: string, srvId: string, subId: string) => `${getTenantPath(companyId, 'activityTypes')}/${actId}/services/${srvId}/subServices/${subId}/stages`,

  // المعاملات الفنية (Technical Transactions)
  transactions: (companyId: string) => getTenantPath(companyId, 'transactions'),
  transactionStages: (companyId: string, tId: string) => `${getTenantPath(companyId, 'transactions')}/${tId}/stageInstances`,
  transactionTimeline: (companyId: string, tId: string) => `${getTenantPath(companyId, 'transactions')}/${tId}/timeline`,
  transactionComments: (companyId: string, tId: string) => `${getTenantPath(companyId, 'transactions')}/${tId}/comments`,

  // المرجع الشجري الديناميكي الموحد لبنود BOQ
  boqReferenceNodes: (companyId: string) => getTenantPath(companyId, 'boqReferenceNodes'),

  // مكتبة القوالب
  quotationTemplates: (companyId: string) => getTenantPath(companyId, 'quotationTemplates'),
  contractTemplates: (companyId: string) => getTenantPath(companyId, 'contractTemplates'),
  boqTemplates: (companyId: string) => getTenantPath(companyId, 'boqTemplates'),
  boqTemplateItems: (companyId: string, templateId: string) => `${getTenantPath(companyId, 'boqTemplates')}/${templateId}/items`,

  // المستندات الحية
  quotations: (companyId: string) => getTenantPath(companyId, 'quotations'),
  contracts: (companyId: string) => getTenantPath(companyId, 'contracts'),
  boqs: (companyId: string) => getTenantPath(companyId, 'boqs'),
  boqItems: (companyId: string, boqId: string) => `${getTenantPath(companyId, 'boqs')}/${boqId}/items`,
  
  // الأوامر التغييرية
  boqVariations: (companyId: string, boqId: string) => `${getTenantPath(companyId, 'boqs')}/${boqId}/variations`,
  boqVariationItems: (companyId: string, boqId: string, voId: string) => `${getTenantPath(companyId, 'boqs')}/${boqId}/variations/${voId}/items`,

  // سجلات التنفيذ الميدانية
  executions: (companyId: string) => getTenantPath(companyId, 'executions'),

  // المواعيد والزيارات الميدانية
  appointments: (companyId: string) => getTenantPath(companyId, 'appointments'),
  fieldVisits: (companyId: string, transactionId: string) =>
    `${getTenantPath(companyId, 'transactions')}/${transactionId}/fieldVisits`,
};

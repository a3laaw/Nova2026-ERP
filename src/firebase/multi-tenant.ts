'use client';

import { getTenantPath } from '@/lib/utils';

/**
 * utility to build firestore paths based on the current active company.
 */
export const paths = {
  user: (companyId: string, uid: string) => getTenantPath(companyId, 'users', uid),
  settings: (companyId: string) => getTenantPath(companyId, 'settings', 'general'),
  projects: (companyId: string) => getTenantPath(companyId, 'projects'),
  accounting: (companyId: string) => getTenantPath(companyId, 'accounting'),
  globalUser: (uid: string) => `global_users/${uid}`,
};

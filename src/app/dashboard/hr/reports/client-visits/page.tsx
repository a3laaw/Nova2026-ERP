
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * @fileOverview صفحة تحويل (Redirect) - تم نقل تقارير الزيارات إلى قسم المشاريع.
 */
export default function HRClientVisitsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/projects/reports/client-visits');
  }, [router]);
  return null;
}

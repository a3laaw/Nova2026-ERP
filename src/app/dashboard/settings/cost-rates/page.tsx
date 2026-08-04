'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * @fileOverview صفحة ملغاة (Deleted) - تم دمج التعرفة في الهيكل التنظيمي.
 */
export default function DeletedCostRatesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/settings/checklists');
  }, [router]);
  return null;
}
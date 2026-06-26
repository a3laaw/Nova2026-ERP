'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeprecatedBOQMasterPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirection to the new consolidated sovereign tree
    router.replace('/dashboard/settings/checklists?tab=boq_nodes');
  }, [router]);

  return null;
}

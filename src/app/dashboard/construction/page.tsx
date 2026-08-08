'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * صفحة تحويل تلقائي (Redirect) لمنع خطأ 404 عند الدخول لمسار العمليات الميدانية مباشرة.
 */
export default function ConstructionRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/construction/bookings');
  }, [router]);

  return (
    <div className="h-[80vh] flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
        Redirecting to Field Radar...
      </p>
    </div>
  );
}

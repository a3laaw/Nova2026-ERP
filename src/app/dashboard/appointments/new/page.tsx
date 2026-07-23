'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * @fileOverview صفحة الحجز المنفصلة (Duplicated).
 * تم استبدالها بالكامل بالنافذة المنبثقة الذكية في Architectural Radar.
 * تقوم هذه الصفحة الآن بإعادة توجيه المستخدم لضمان وحدة المرجع.
 */
export default function NewAppointmentRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/appointments');
  }, [router]);

  return (
    <div className="h-[80vh] flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">
        Redirecting to Central Radar...
      </p>
    </div>
  );
}

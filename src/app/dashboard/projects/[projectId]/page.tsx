
'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuthContext } from '@/context/auth-context';
import { paths } from '@/firebase/multi-tenant';

/**
 * صفحة تفاصيل المشروع (Proxy Page).
 * تقوم بتوجيه المستخدم تلقائياً إلى صفحة "المعاملة الفنية" المقابلة لهذا المشروع.
 * هذا يضمن أن لدينا "شاشة واحدة" لإدارة العمل (Single Pane of Glass).
 */
export default function ProjectDetailsProxyPage() {
  const { projectId } = useParams();
  const { globalUser } = useAuthContext();
  const db = useFirestore();
  const router = useRouter();
  const companyId = globalUser?.companyId;

  useEffect(() => {
    async function resolveAndRedirect() {
      if (!db || !companyId || !projectId) return;

      // جلب بيانات المعاملة لمعرفة معرف العميل (للتوجيه الصحيح)
      const transRef = doc(db, paths.transactions(companyId), projectId as string);
      const snap = await getDoc(transRef);

      if (snap.exists()) {
        const data = snap.data();
        // التوجيه إلى الشاشة السيادية الموحدة
        router.replace(`/dashboard/clients/${data.clientId}/transactions/${projectId}`);
      } else {
        router.replace('/dashboard/projects');
      }
    }

    resolveAndRedirect();
  }, [db, companyId, projectId, router]);

  return (
    <div className="h-[80vh] flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">
        Directing to Sovereign Project Control...
      </p>
    </div>
  );
}

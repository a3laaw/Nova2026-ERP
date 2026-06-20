'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, Query, DocumentData } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(!!query);
  const [error, setError] = useState<Error | null>(null);
  
  // استخدام Ref لتتبع الاستعلام الحالي ومنع التكرار غير الضروري
  const lastQueryRef = useRef<string | null>(null);

  useEffect(() => {
    if (!query) {
      setLoading(false);
      setData([]);
      return;
    }

    // منع إعادة التشغيل إذا كان الاستعلام هو نفسه (بناءً على الهيكل)
    // ملاحظة: Firestore لا يوفر مساراً سهلاً للمقارنة، لذا نعتمد على استقرار المرجع من المكون الأب
    
    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as unknown as T[];
        setData(items);
        setLoading(false);
        setError(null);
      },
      (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: 'collection_query',
          operation: 'list',
        } satisfies SecurityRuleContext);

        errorEmitter.emit('permission-error', permissionError);
        setError(permissionError);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [query]);

  return { data, loading, error };
}

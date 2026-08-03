'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, Query, DocumentData, FirestoreError, queryEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف جلب المجموعات السيادي المحصن (Sovereign Hardened Collection Hook).
 * يستخدم تقنية queryEqual لمنع حلقة الاشتراك اللانهائية (ID: ca9).
 */
export function useCollection<T = DocumentData>(q: Query<any, any> | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(q !== null);
  const [error, setError] = useState<Error | null>(null);

  // الحفاظ على مرجع مستقر للاستعلام منطقياً
  const [stableQuery, setStableQuery] = useState<Query<any, any> | null>(q);

  useEffect(() => {
    if (!q) {
      if (stableQuery !== null) setStableQuery(null);
      return;
    }

    // إذا كان الاستعلام الجديد يختلف منطقياً عن المستقر حالياً، نقوم بتحديثه
    if (!stableQuery || !queryEqual(q, stableQuery)) {
      setStableQuery(q);
    }
  }, [q, stableQuery]);

  useEffect(() => {
    if (!stableQuery) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      stableQuery,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as unknown as T[];
        
        setData(items);
        setLoading(false);
      },
      (serverError: FirestoreError) => {
        setLoading(false);
        setError(serverError);
        if (serverError.code === 'permission-denied') {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'collection_query',
            operation: 'list',
          } satisfies SecurityRuleContext));
        }
      }
    );

    return () => unsubscribe();
  }, [stableQuery]); // الاعتماد على الاستعلام المستقر حصراً

  return { data, loading, error };
}

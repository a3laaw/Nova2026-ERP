'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, Query, DocumentData, FirestoreError, queryEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف محسن لجلب المجموعات يعالج مشكلة "دائرة التحميل اللانهائية" وأخطاء التضارب السحابي.
 * تم تنفيذ بروتوكول الحماية لضمان عدم تحديث الحالة بعد إلغاء الاشتراك.
 */
export function useCollection<T = DocumentData>(query: Query<any, any> | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(!!query);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  // تثبيت مرجع الاستعلام (Stabilization) لمنع إعادة الاشتراك المتكرر
  const memoQuery = useRef<Query<any, any> | null>(null);
  if (query && (!memoQuery.current || !queryEqual(query as any, memoQuery.current as any))) {
    memoQuery.current = query;
  } else if (!query) {
    memoQuery.current = null;
  }
  const stableQuery = memoQuery.current;

  useEffect(() => {
    let isMounted = true;

    if (!stableQuery) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      stableQuery,
      (snapshot) => {
        if (!isMounted) return;
        
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as unknown as T[];
        
        setData(items);
        setLoading(false);
      },
      (serverError: FirestoreError) => {
        if (!isMounted) return;
        
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

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [stableQuery]);

  return { data, loading, error };
}

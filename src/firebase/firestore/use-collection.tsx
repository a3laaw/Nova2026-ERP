'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, Query, DocumentData, FirestoreError, queryEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف محسن لجلب المجموعات يعالج مشكلة "دائرة التحميل اللانهائية".
 * يقوم بتثبيت مرجع الاستعلام (Stabilization) لضمان عدم إعادة تشغيل Effect 
 * إلا إذا تغيرت محتويات الاستعلام فعلياً.
 */
export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(!!query);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  // تثبيت مرجع الاستعلام (Stabilization)
  const memoQuery = useRef<Query<T> | null>(null);
  if (query && (!memoQuery.current || !queryEqual(query, memoQuery.current))) {
    memoQuery.current = query;
  } else if (!query) {
    memoQuery.current = null;
  }
  const stableQuery = memoQuery.current;

  useEffect(() => {
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
  }, [stableQuery]); // الاعتماد الآن على المرجع المستقر فقط

  return { data, loading, error };
}

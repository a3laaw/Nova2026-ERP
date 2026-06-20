'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, Query, DocumentData, FirestoreError, queryEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * Hook محسن لجلب المجموعات مع معالجة ذكية للأخطاء ومنع الحلقات اللانهائية.
 */
export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(!!query);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastQueryRef = useRef<Query<T> | null>(null);

  useEffect(() => {
    // 1. التعامل مع الاستعلام الفارغ
    if (!query) {
      if (lastQueryRef.current !== null) {
        lastQueryRef.current = null;
        setData([]);
        setLoading(false);
        setError(null);
      }
      return;
    }

    // 2. منع إعادة التحميل إذا كان الاستعلام مطابقاً للسابق منطقياً
    if (lastQueryRef.current && queryEqual(query, lastQueryRef.current)) {
      return;
    }

    // 3. تحديث المرجع وبدء التحميل
    lastQueryRef.current = query;
    setLoading(true);
    setError(null);

    // 4. تنظيف المراقب السابق قبل بدء الجديد
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    try {
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
        (serverError: FirestoreError) => {
          setLoading(false);
          setError(serverError);
          
          if (serverError.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
              path: 'collection_query',
              operation: 'list',
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
          } else {
            console.error("Firestore Query Error:", serverError.code, serverError.message);
          }
        }
      );

      unsubscribeRef.current = unsubscribe;
    } catch (e: any) {
      setLoading(false);
      setError(e);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [query]);

  return { data, loading, error };
}

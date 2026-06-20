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
  
  // مرجع ثابت لمراقبة الاستعلام النشط حالياً
  const activeQueryRef = useRef<Query<T> | null>(null);

  useEffect(() => {
    // 1. التعامل مع الاستعلام الفارغ
    if (!query) {
      activeQueryRef.current = null;
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    // 2. منع إعادة التحميل إذا كان الاستعلام مطابقاً للاستعلام النشط حالياً
    if (activeQueryRef.current && queryEqual(query, activeQueryRef.current)) {
      return;
    }

    // 3. تحديث المرجع وبدء التحميل
    activeQueryRef.current = query;
    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        // التحقق من أن هذا الرد يخص آخر استعلام تم طلبه
        if (activeQueryRef.current && queryEqual(query, activeQueryRef.current)) {
          const items = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as unknown as T[];
          setData(items);
          setLoading(false);
          setError(null);
        }
      },
      (serverError: FirestoreError) => {
        if (activeQueryRef.current && queryEqual(query, activeQueryRef.current)) {
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
      }
    );

    return () => {
      unsubscribe();
    };
  }, [query]);

  return { data, loading, error };
}

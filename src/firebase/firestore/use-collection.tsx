'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, Query, DocumentData, FirestoreError, queryEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف جلب المجموعات السيادي المحصن (Sovereign Hardened Collection Hook).
 * يستخدم تقنية queryEqual وحارس البصمة لمنع حلقة الاشتراك اللانهائية (ID: ca9).
 */
export function useCollection<T = DocumentData>(q: Query<any, any> | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(q !== null);
  const [error, setError] = useState<Error | null>(null);

  // 1. المثبت المنطقي للاستعلام
  const stableQueryRef = useRef<Query<any, any> | null>(null);
  const [stableQuery, setStableQuery] = useState<Query<any, any> | null>(null);

  // 2. حارس بصمة البيانات لمنع الرندر غير الضروري
  const lastDataHashRef = useRef<string>("");

  useEffect(() => {
    if (!q) {
      if (stableQueryRef.current !== null) {
        stableQueryRef.current = null;
        setStableQuery(null);
      }
      return;
    }

    if (!stableQueryRef.current || !queryEqual(q, stableQueryRef.current)) {
      stableQueryRef.current = q;
      setStableQuery(q);
    }
  }, [q]);

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
        
        // التحقق من البصمة: لا تحديث إلا لو تغير المحتوى فعلياً
        const currentHash = JSON.stringify(items);
        if (currentHash !== lastDataHashRef.current) {
          lastDataHashRef.current = currentHash;
          setData(items);
        }
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
  }, [stableQuery]);

  return { data, loading, error };
}

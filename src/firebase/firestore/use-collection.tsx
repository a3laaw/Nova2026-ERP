
'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, Query, DocumentData, FirestoreError, queryEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * Hook محسن لجلب المجموعات مع معالجة ذكية للأخطاء ومنع حلقات التكرار.
 */
export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(!!query);
  const [error, setError] = useState<Error | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastQueryRef = useRef<Query<T> | null>(null);

  useEffect(() => {
    // التحقق من استقرار الاستعلام لمنع الحلقات اللانهائية
    if (!query) {
      if (lastQueryRef.current !== null) {
        lastQueryRef.current = null;
        setData([]);
        setLoading(false);
      }
      return;
    }

    if (lastQueryRef.current && queryEqual(query, lastQueryRef.current)) {
      return;
    }

    lastQueryRef.current = query;
    setLoading(true);

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

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
        if (serverError.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: 'collection_query',
            operation: 'list',
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
          setError(permissionError);
        } else {
          console.error("Firestore Collection Error:", serverError.message);
          setError(serverError);
        }
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [query]);

  return { data, loading, error };
}

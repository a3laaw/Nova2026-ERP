'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, Query, DocumentData, FirestoreError, queryEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف محسن لجلب المجموعات يضمن عدم الدخول في حلقات تكرار لا نهائية.
 */
export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(!!query);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  // حفظ الاستعلام الفعلي لمقارنته بعمق
  const queryRef = useRef<Query<T> | null>(null);

  useEffect(() => {
    // التحقق من التغيير الحقيقي للاستعلام باستخدام queryEqual
    const isSameQuery = query && queryRef.current && queryEqual(query, queryRef.current);
    
    if (!query) {
      if (queryRef.current !== null) {
        queryRef.current = null;
        setData([]);
        setLoading(false);
      }
      return;
    }

    if (isSameQuery) return;

    queryRef.current = query;
    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      query,
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
  }, [query]);

  return { data, loading, error };
}

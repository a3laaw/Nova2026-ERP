'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, Query, DocumentData, FirestoreError } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف جلب المجموعات السيادي المحصن (Sovereign Hardened Collection Hook).
 * يعتمد على بصمة البيانات (JSON Hashing) لمنع حلقة الرندر اللانهائية.
 */
export function useCollection<T = DocumentData>(query: Query<any, any> | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(query !== null);
  const [error, setError] = useState<Error | null>(null);

  const lastDataHashRef = useRef<string>("");

  useEffect(() => {
    if (!query) {
      setData([]);
      setLoading(false);
      setError(null);
      lastDataHashRef.current = "";
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as unknown as T[];
        
        // حارس البصمة الذري: لا نحدث الحالة إلا إذا تغيرت محتويات البيانات فعلياً
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
  }, [query]);

  return { data, loading, error };
}

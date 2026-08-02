'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, Query, DocumentData, FirestoreError, queryEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف جلب المجموعات المحصن (Sovereign Deep-Comparison Hook).
 * يمنع حلقة التحميل اللانهائية عبر المقارنة الذرية للاستعلامات.
 */
export function useCollection<T = DocumentData>(query: Query<any, any> | null) {
  const [state, setState] = useState<{
    data: T[];
    loading: boolean;
    error: Error | null;
  }>({
    data: [],
    loading: query !== null,
    error: null,
  });

  const lastQueryRef = useRef<Query<any, any> | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // التحقق من استقرار الاستعلام (Sovereign Stability Check)
    const isSameQuery = query && lastQueryRef.current && queryEqual(query, lastQueryRef.current);
    
    if (isSameQuery) return;

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (!query) {
      setState({ data: [], loading: false, error: null });
      lastQueryRef.current = null;
      return;
    }

    lastQueryRef.current = query;
    setState(prev => ({ ...prev, loading: true, error: null }));

    let isMounted = true;

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        if (!isMounted) return;
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as unknown as T[];
        setState({ data: items, loading: false, error: null });
      },
      (serverError: FirestoreError) => {
        if (!isMounted) return;
        setState(prev => ({ ...prev, loading: false, error: serverError }));
        if (serverError.code === 'permission-denied') {
           errorEmitter.emit('permission-error', new FirestorePermissionError({
             path: 'collection_query',
             operation: 'list',
           } satisfies SecurityRuleContext));
        }
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      isMounted = false;
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [query]);

  return state;
}

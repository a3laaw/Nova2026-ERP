'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, Query, DocumentData, FirestoreError, queryEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف جلب المجموعات المطور (Sovereign Atomic Collection Hook).
 * تم تحديثه لضمان استقرار الحالة ومنع "حلقات البحث" المفرغة ca9.
 */
export function useCollection<T = DocumentData>(query: Query<any, any> | null) {
  const [state, setState] = useState<{
    data: T[];
    loading: boolean;
    error: Error | null;
  }>({
    data: [],
    loading: true,
    error: null,
  });

  const lastQueryRef = useRef<Query<any, any> | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // التحقق من استقرار الاستعلام (Query Stability Check)
    const isSameQuery = query && lastQueryRef.current && queryEqual(query, lastQueryRef.current);
    
    if (isSameQuery) return;

    // تنظيف المراقب السابق فوراً
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
        
        console.error("Firestore Collection Error:", serverError);
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
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [query]);

  return state;
}
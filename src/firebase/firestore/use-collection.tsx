'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, Query, DocumentData, FirestoreError, queryEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف جلب المجموعات المحصن ضد حلقة البحث اللانهائية (ca9 loop).
 * يستخدم queryEqual لضمان استقرار الاستعلام ومنع إعادة التحميل غير المبررة.
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

  useEffect(() => {
    if (!query) {
      setState({ data: [], loading: false, error: null });
      lastQueryRef.current = null;
      return;
    }

    // المقارنة الذرية العميقة: إذا كان الاستعلام مطابقاً للسابق، لا تفعل شيئاً
    if (lastQueryRef.current && queryEqual(query, lastQueryRef.current)) {
      return;
    }

    lastQueryRef.current = query;
    setState(prev => ({ ...prev, loading: true, error: null }));

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as unknown as T[];
        setState({ data: items, loading: false, error: null });
      },
      (serverError: FirestoreError) => {
        setState({ data: [], loading: false, error: serverError });
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

  return state;
}

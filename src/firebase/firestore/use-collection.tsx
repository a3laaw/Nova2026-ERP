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
    // 1. معالجة حالة الاستعلام الفارغ
    if (!query) {
      if (lastQueryRef.current !== null) {
        setState({ data: [], loading: false, error: null });
        lastQueryRef.current = null;
      }
      return;
    }

    // 2. التحقق من استقرار الاستعلام (Deep Equality Check)
    // هذا يمنع حلقة البحث اللانهائية في حال تم إعادة إنشاء كائن الاستعلام في الرندر
    const isSameQuery = lastQueryRef.current && queryEqual(query, lastQueryRef.current);
    if (isSameQuery) return;

    // 3. تنظيف الاشتراك السابق قبل البدء بجديد
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // 4. تحديث المرجع وبدء حالة التحميل
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

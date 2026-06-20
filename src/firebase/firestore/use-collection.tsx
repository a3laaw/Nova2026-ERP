
'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, Query, DocumentData, FirestoreError } from 'firebase/firestore';
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

  useEffect(() => {
    // إذا لم يتوفر الاستعلام، ننهي حالة التحميل
    if (!query) {
      setLoading(false);
      setData([]);
      return;
    }

    // تعيين حالة التحميل عند تغيير الاستعلام الفعلي
    setLoading(true);

    // تنظيف أي مراقب قديم قبل بدء الجديد لمنع Assertion Failed
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
        
        // التحقق مما إذا كان الخطأ فعلياً بسبب الصلاحيات
        if (serverError.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: 'collection_query',
            operation: 'list',
          } satisfies SecurityRuleContext);

          errorEmitter.emit('permission-error', permissionError);
          setError(permissionError);
        } else {
          // أخطاء أخرى (مثل نقص الفهارس) تظهر في الكونسول للتشخيص
          console.error("Firestore Collection Error:", serverError.message, "Path:", (query as any).path);
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
  }, [query]); // يعتمد على استقرار مرجع الاستعلام من المكون الأب

  return { data, loading, error };
}

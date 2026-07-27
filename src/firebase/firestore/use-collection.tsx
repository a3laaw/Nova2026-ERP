'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, Query, DocumentData, FirestoreError, queryEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف جلب المجموعات المطور (Hardened Collection Hook).
 * يعالج مشكلة Assertion Failure و Infinite Loops عبر ضمان استقرار الاستعلامات والبيانات.
 */
export function useCollection<T = DocumentData>(query: Query<any, any> | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(!!query);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  // مراجع لتتبع الحالة والاشتراك النشط بشكل سيادي
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const activeQueryRef = useRef<Query<any, any> | null>(null);
  const lastDataRef = useRef<string>(""); // تخزين البيانات بصيغة نصية للمقارنة العميقة

  useEffect(() => {
    // بروتوكول الاستقرار: إذا كان الاستعلام منطقياً هو نفسه، لا نقم بإعادة الاشتراك
    if (query && activeQueryRef.current && queryEqual(query, activeQueryRef.current)) {
      return;
    }

    // تنظيف أي اشتراك سابق فوراً قبل البدء بالجديد
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    activeQueryRef.current = query;

    if (!query) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let isMounted = true;

    // بدء الاشتراك الفوري مع حماية المحاذاة الداخلية لـ Firestore
    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        if (!isMounted) return;
        
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as unknown as T[];
        
        // مقارنة عميقة لمنع حلقة التحديث المفرطة (Infinite Loop Prevention)
        const dataStr = JSON.stringify(items);
        if (dataStr !== lastDataRef.current) {
          lastDataRef.current = dataStr;
          setData(items);
        }
        
        setLoading(false);
      },
      (serverError: FirestoreError) => {
        if (!isMounted) return;
        
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

    unsubscribeRef.current = unsubscribe;

    return () => {
      isMounted = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      // ملاحظة سيادية: لا نقوم بتصفير activeQueryRef هنا للسماح بالمقارنة عبر دورات التصيير
    };
  }, [query]);

  return { data, loading, error };
}

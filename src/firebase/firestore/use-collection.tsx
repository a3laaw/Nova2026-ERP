
'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, Query, DocumentData, FirestoreError, queryEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف جلب المجموعات المدرع (Sovereign Hardened Collection Hook).
 * يحل مشكلة الانهيار ca9 عبر تثبيت الاستعلامات وتجنب إعادة الاشتراك المتكرر.
 */
export function useCollection<T = DocumentData>(query: Query<any, any> | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastQueryRef = useRef<Query<any, any> | null>(null);
  const lastDataHashRef = useRef<string>("");

  useEffect(() => {
    // 1. التحقق من استقرار الاستعلام (Query Stability)
    // هذا يمنع خطأ ca9 (INTERNAL ASSERTION FAILED) الناتج عن إعادة الاشتراك اللانهائي
    const isSameQuery = query && lastQueryRef.current && queryEqual(query, lastQueryRef.current);
    
    if (isSameQuery && !loading) {
       return; 
    }

    // تنظيف المستمع القديم فوراً
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (!query) {
      setData([]);
      setLoading(false);
      lastQueryRef.current = null;
      return;
    }

    lastQueryRef.current = query;
    setLoading(true);
    setError(null);

    let isMounted = true;

    // 2. تفعيل المستمع الجديد مع معالجة الصدمات
    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        if (!isMounted) return;
        
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as unknown as T[];
        
        // المقارنة العميقة للبيانات لمنع الرندر المتكرر
        const currentHash = JSON.stringify(items);
        if (currentHash !== lastDataHashRef.current) {
          lastDataHashRef.current = currentHash;
          setData(items);
        }
        
        setLoading(false);
      },
      (serverError: FirestoreError) => {
        if (!isMounted) return;
        
        setLoading(false);
        setError(serverError);
        
        // معالجة أخطاء الصلاحيات مركزياً لتجنب إزعاج المستخدم
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

  return { data, loading, error };
}

'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, Query, DocumentData, FirestoreError, queryEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف جلب المجموعات السيادي المحصن (Sovereign Hardened Collection Hook).
 * يستخدم تقنية "حارس البصمة" (Data Hashing) لكسر حلقة الرندر اللانهائية.
 */
export function useCollection<T = DocumentData>(query: Query<any, any> | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastQueryRef = useRef<Query<any, any> | null>(null);
  const lastDataHashRef = useRef<string>("");

  useEffect(() => {
    // 1. التحقق من مطابقة الاستعلام برمجياً (Sovereign Query Guard)
    const isSameQuery = query && lastQueryRef.current && queryEqual(query, lastQueryRef.current);
    
    // إذا كان الاستعلام مطابقاً، لا تفعل شيئاً (يمنع الـ Loop الناتج عن رندر الأب)
    if (isSameQuery) {
      return;
    }

    // تنظيف الاشتراك السابق
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (!query) {
      setData([]);
      setLoading(false);
      lastQueryRef.current = null;
      lastDataHashRef.current = "";
      return;
    }

    lastQueryRef.current = query;
    setLoading(true);
    setError(null);

    let isMounted = true;

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        if (!isMounted) return;
        
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as unknown as T[];
        
        // 2. حارس البصمة الذري (Deep Hash Comparison)
        // لن يتم تحديث الحالة (setState) إلا إذا تغيرت محتويات البيانات فعلياً
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

'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, Query, DocumentData, FirestoreError, queryEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف جلب المجموعات المدرع (Sovereign Hardened Collection Hook).
 * تم تحديثه للقضاء على خطأ ca9 عبر تثبيت الاستعلامات ومنع التكرار اللحظي.
 */
export function useCollection<T = DocumentData>(query: Query<any, any> | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastQueryRef = useRef<Query<any, any> | null>(null);
  const lastDataHashRef = useRef<string>("");

  useEffect(() => {
    // بروتوكول تثبيت الاستعلام (Query Stabilization Protocol)
    // نستخدم queryEqual المدمجة في SDK للمقارنة العميقة بدلاً من المراجع
    const isSameQuery = query && lastQueryRef.current && queryEqual(query, lastQueryRef.current);
    
    // إذا كان الاستعلام هو نفسه، نتوقف فوراً لمنع حلقة ca9 المفرغة
    if (isSameQuery) {
       return; 
    }

    // تنظيف المراقب السابق قبل بدء الجديد
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

    // البدء في مراقبة البيانات بنمط حماية الذاكرة
    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        if (!isMounted) return;
        
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as unknown as T[];
        
        // منع تحديث الواجهة إذا لم تتغير البيانات فعلياً (Data Integrity Check)
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

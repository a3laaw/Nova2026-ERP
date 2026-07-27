'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, DocumentReference, DocumentData, FirestoreError, refEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف جلب المستندات المطور (Hardened Document Hook).
 * يمنع تضارب الحالات الداخلية في محرك Firestore ويضمن سيولة عرض البيانات.
 */
export function useDoc<T = DocumentData>(docRef: DocumentReference<any, any> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!docRef);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const activeRef = useRef<DocumentReference<any, any> | null>(null);
  const lastDataRef = useRef<string>(""); // للمقارنة العميقة

  useEffect(() => {
    // التحقق من المطابقة المرجعية والمنطقية للمستند
    if (docRef && activeRef.current && refEqual(docRef, activeRef.current)) {
      return;
    }

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    activeRef.current = docRef;

    if (!docRef) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let isMounted = true;

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (!isMounted) return;
        
        const docData = snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null;
        
        // منع التحديثات المتكررة لنفس البيانات (Deep Equality Guard)
        const dataStr = JSON.stringify(docData);
        if (dataStr !== lastDataRef.current) {
          lastDataRef.current = dataStr;
          setData(docData);
        }
        
        setLoading(false);
      },
      (serverError: FirestoreError) => {
        if (!isMounted) return;
        
        setLoading(false);
        setError(serverError);
        
        if (serverError.code === 'permission-denied') {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path || 'document',
            operation: 'get',
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
      // الحفاظ على مرجع المستند للمقارنة في الرندرة القادمة
    };
  }, [docRef]);

  return { data, loading, error };
}

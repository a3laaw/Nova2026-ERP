'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, DocumentReference, DocumentData, FirestoreError, refEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف جلب المستندات السيادي المحصن (Sovereign Hardened Document Hook).
 * محصن ضد تكرار التحديث عبر بصمة البيانات العميقة.
 */
export function useDoc<T = DocumentData>(docRef: DocumentReference<any, any> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastRefRef = useRef<DocumentReference<any, any> | null>(null);
  const lastDataHashRef = useRef<string>("");

  useEffect(() => {
    // حارس المرجع الموحد لكسر حلقات الرندر
    if (docRef && lastRefRef.current && refEqual(docRef, lastRefRef.current)) {
      return;
    }

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (!docRef) {
      setData(null);
      setLoading(false);
      lastRefRef.current = null;
      lastDataHashRef.current = "";
      return;
    }

    lastRefRef.current = docRef;
    setLoading(true);
    setError(null);

    let isMounted = true;

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (!isMounted) return;
        
        const docData = snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null;
        
        // مقارنة البصمة (Deep Hash Guard)
        const currentHash = JSON.stringify(docData);
        if (currentHash !== lastDataHashRef.current) {
          lastDataHashRef.current = currentHash;
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
    };
  }, [docRef]);

  return { data, loading, error };
}

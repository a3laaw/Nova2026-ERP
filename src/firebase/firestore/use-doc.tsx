'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, DocumentReference, DocumentData, FirestoreError } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف جلب المستندات السيادي المحصن (Sovereign Hardened Document Hook).
 * محصن ضد تكرار التحديث عبر بصمة البيانات العميقة.
 */
export function useDoc<T = DocumentData>(docRef: DocumentReference<any, any> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(docRef !== null);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  const lastDataHashRef = useRef<string>("");

  useEffect(() => {
    if (!docRef) {
      setData(null);
      setLoading(false);
      lastDataHashRef.current = "";
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        const docData = snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null;
        
        // مقارنة البصمة العميقة (Deep Hash Guard)
        const currentHash = JSON.stringify(docData);
        if (currentHash !== lastDataHashRef.current) {
          lastDataHashRef.current = currentHash;
          setData(docData);
        }
        
        setLoading(false);
      },
      (serverError: FirestoreError) => {
        setLoading(false);
        setError(serverError);
        if (serverError.code === 'permission-denied') {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'get',
          } satisfies SecurityRuleContext));
        }
      }
    );

    return () => unsubscribe();
  }, [docRef]);

  return { data, loading, error };
}

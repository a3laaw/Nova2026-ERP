'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, DocumentReference, DocumentData, FirestoreError, refEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف جلب المستندات السيادي المحصن (Sovereign Hardened Document Hook).
 * يطبق استراتيجية التثبيت المنطقي وحماية البصمة لقتل الـ Loop.
 */
export function useDoc<T = DocumentData>(docRef: DocumentReference<any, any> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(docRef !== null);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  const stableRefInternal = useRef<DocumentReference<any, any> | null>(null);
  const [stableRef, setStableRef] = useState<DocumentReference<any, any> | null>(null);
  const lastDataHashRef = useRef<string>("");

  useEffect(() => {
    if (!docRef) {
      if (stableRefInternal.current !== null) {
        stableRefInternal.current = null;
        setStableRef(null);
      }
      return;
    }

    if (!stableRefInternal.current || !refEqual(docRef, stableRefInternal.current)) {
      stableRefInternal.current = docRef;
      setStableRef(docRef);
    }
  }, [docRef]);

  useEffect(() => {
    if (!stableRef) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      stableRef,
      (snapshot) => {
        const docData = snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null;
        
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
            path: stableRef.path,
            operation: 'get',
          } satisfies SecurityRuleContext));
        }
      }
    );

    return () => unsubscribe();
  }, [stableRef]);

  return { data, loading, error };
}

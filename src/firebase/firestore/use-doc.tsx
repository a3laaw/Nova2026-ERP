'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, DocumentReference, DocumentData, FirestoreError, refEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف محسن لجلب مستند واحد مع تثبيت المرجع لمنع تكرار الطلبات اللانهائي.
 */
export function useDoc<T = DocumentData>(docRef: DocumentReference<T> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!docRef);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  // تثبيت مرجع المستند
  const memoRef = useRef<DocumentReference<T> | null>(null);
  if (docRef && (!memoRef.current || !refEqual(docRef, memoRef.current))) {
    memoRef.current = docRef;
  } else if (!docRef) {
    memoRef.current = null;
  }
  const stableRef = memoRef.current;

  useEffect(() => {
    if (!stableRef) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      stableRef,
      (snapshot) => {
        setData(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null);
        setLoading(false);
      },
      (serverError: FirestoreError) => {
        setLoading(false);
        setError(serverError);
        
        if (serverError.code === 'permission-denied') {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: stableRef.path || 'document',
            operation: 'get',
          } satisfies SecurityRuleContext));
        }
      }
    );

    return () => unsubscribe();
  }, [stableRef]);

  return { data, loading, error };
}

'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, DocumentReference, DocumentData, FirestoreError, refEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف محسن لجلب مستند واحد يضمن عدم الدخول في حلقات تكرار لا نهائية.
 */
export function useDoc<T = DocumentData>(docRef: DocumentReference<T> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!docRef);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  const currentRef = useRef<DocumentReference<T> | null>(null);

  useEffect(() => {
    const isSameRef = docRef && currentRef.current && refEqual(docRef, currentRef.current);

    if (!docRef) {
      if (currentRef.current !== null) {
        currentRef.current = null;
        setData(null);
        setLoading(false);
      }
      return;
    }

    if (isSameRef) return;

    currentRef.current = docRef;
    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        setData(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null);
        setLoading(false);
      },
      (serverError: FirestoreError) => {
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

    return () => unsubscribe();
  }, [docRef]);

  return { data, loading, error };
}

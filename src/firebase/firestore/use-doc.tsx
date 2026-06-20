
'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, DocumentReference, DocumentData, FirestoreError, refEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * Hook محسن لجلب مستند واحد مع معالجة ذكية للأخطاء ومنع الحلقات اللانهائية.
 */
export function useDoc<T = DocumentData>(docRef: DocumentReference<T> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!docRef);
  const [error, setError] = useState<Error | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastRef = useRef<DocumentReference<T> | null>(null);

  useEffect(() => {
    if (!docRef) {
      if (lastRef.current !== null) {
        lastRef.current = null;
        setData(null);
        setLoading(false);
      }
      return;
    }

    if (lastRef.current && refEqual(docRef, lastRef.current)) {
      return;
    }

    lastRef.current = docRef;
    setLoading(true);

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        setData(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null);
        setLoading(false);
        setError(null);
      },
      (serverError: FirestoreError) => {
        setLoading(false);
        if (serverError.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: docRef.path || 'document_reference',
            operation: 'get',
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
          setError(permissionError);
        } else {
          console.error("Firestore Document Error:", serverError.message);
          setError(serverError);
        }
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [docRef]);

  return { data, loading, error };
}

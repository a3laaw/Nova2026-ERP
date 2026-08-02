'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, DocumentReference, DocumentData, FirestoreError, refEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف جلب المستندات المحصن ضد التحديثات المكررة.
 * يضمن ثبات المرجع ومنع Spinner التحميل من العودة بعد أول استجابة.
 */
export function useDoc<T = DocumentData>(docRef: DocumentReference<any, any> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(docRef !== null);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  const lastRefRef = useRef<DocumentReference<any, any> | null>(null);

  useEffect(() => {
    if (!docRef) {
      setData(null);
      setLoading(false);
      lastRefRef.current = null;
      return;
    }

    if (lastRefRef.current && refEqual(docRef, lastRefRef.current)) {
      return;
    }

    lastRefRef.current = docRef;
    setLoading(true);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        const docData = snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null;
        setData(docData);
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

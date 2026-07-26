'use client';

import { useEffect, useState, useRef } from 'react';
import { onSnapshot, DocumentReference, DocumentData, FirestoreError, refEqual } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * خطاف محسن لجلب مستند واحد مع حماية من أخطاء التضارب (Race Conditions).
 * يضمن استقرار الواجهة حتى في حالات التحديث السريع (HMR).
 */
export function useDoc<T = DocumentData>(docRef: DocumentReference<any, any> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!docRef);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  // تثبيت مرجع المستند (Stabilization)
  const memoRef = useRef<DocumentReference<any, any> | null>(null);
  if (docRef && (!memoRef.current || !refEqual(docRef as any, memoRef.current as any))) {
    memoRef.current = docRef;
  } else if (!docRef) {
    memoRef.current = null;
  }
  const stableRef = memoRef.current;

  useEffect(() => {
    let isMounted = true;

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
        if (!isMounted) return;
        
        setData(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null);
        setLoading(false);
      },
      (serverError: FirestoreError) => {
        if (!isMounted) return;
        
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

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [stableRef]);

  return { data, loading, error };
}

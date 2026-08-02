'use client';
/**
 * @fileOverview محرك العدادات التسلسلية الآمن (Atomic Counters).
 */
import { Firestore, runTransaction, doc } from 'firebase/firestore';

/**
 * يولّد رقماً تسلسلياً آمناً عبر عدّاد مستند لكل (collection, year).
 * يضمن عدم تكرار الأرقام حتى في حالات الضغط العالي.
 */
export async function nextSequential(
  db: Firestore,
  companyId: string,
  counterKey: string,
  prefix: string,
  pad: number
): Promise<string> {
  const counterRef = doc(db, 'companies', companyId, 'counters', counterKey);
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? (snap.data().seq as number) : 0;
    const next = current + 1;
    tx.set(counterRef, { seq: next, updatedAt: new Date() }, { merge: true });
    return next;
  });
  return `${prefix}${pad > 0 ? String(seq).padStart(pad, '0') : seq}`;
}

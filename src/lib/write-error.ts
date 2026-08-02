'use client';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * معالجة موحَّدة لأخطاء الكتابة في Firestore:
 * - تعرض خطأ "صلاحيات" فقط للسماحيات الفعلية (permission-denied).
 * - تعيد رمي الخطأ دائماً لتعرف الواجهة بنتيجة العملية.
 */
export async function handleWriteError(
  err: any,
  context: SecurityRuleContext
): Promise<never> {
  const isPermission = err?.code === 'permission-denied';
  if (isPermission) {
    errorEmitter.emit('permission-error', new FirestorePermissionError(context));
  }
  throw err;
}

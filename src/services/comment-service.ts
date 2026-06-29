'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  getDocs,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { TransactionComment, CommentType } from '@/types/transaction';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';

export class CommentService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  async addTransactionComment(
    transactionId: string, 
    content: string, 
    userId: string, 
    userName: string,
    stageInstanceId?: string | null,
    stageName?: string,
    type: CommentType = 'general'
  ) {
    ensureActionPermission(this.permissions, 'projects:view');
    
    const path = paths.transactionComments(this.companyId, transactionId);
    const commentData: TransactionComment = {
      transactionId,
      stageInstanceId: stageInstanceId || null,
      stageName: stageName || '',
      content,
      commentType: type,
      createdBy: userId,
      createdByName: userName || 'User', // ضمان وجود اسم دائماً
      companyId: this.companyId,
      isArchived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    return addDoc(collection(this.db, path), commentData).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path, operation: 'create', requestResourceData: commentData
      }));
      throw err;
    });
  }

  /**
   * أرشفة تعليقات مرحلة محددة (تستخدم عند التراجع)
   * تم تحسينها لتعمل بدون الحاجة لفهارس معقدة عبر الفلترة البرمجية
   */
  async archiveStageComments(transactionId: string, stageInstanceId: string) {
    const path = paths.transactionComments(this.companyId, transactionId);
    
    // جلب كافة التعليقات لهذا المعاملة (MVP Scale)
    const snap = await getDocs(collection(this.db, path));
    if (snap.empty) return;

    const batch = writeBatch(this.db);
    let count = 0;

    snap.docs.forEach(d => {
      const data = d.data();
      // فلترة برمجية لضمان الدقة وتجنب مشاكل الفهارس
      if (data.stageInstanceId === stageInstanceId && data.isArchived !== true) {
        batch.update(d.ref, { 
          isArchived: true, 
          archivedAt: serverTimestamp(),
          updatedAt: serverTimestamp() 
        });
        count++;
      }
    });

    if (count > 0) {
      return batch.commit();
    }
  }

  async deleteComment(path: string, commentId: string) {
    const commentRef = doc(this.db, path, commentId);
    return deleteDoc(commentRef).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: commentRef.path, operation: 'delete'
      }));
      throw err;
    });
  }
}

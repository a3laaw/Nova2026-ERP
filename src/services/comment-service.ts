'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { TransactionComment, CommentType } from '@/types/transaction';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';

/**
 * خدمة إدارة التعليقات التفاعلية (Comments Service).
 * تدعم التعليقات على مستوى المعاملة وعلى مستوى النسخ التنفيذية للمراحل.
 */
export class CommentService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  /**
   * إضافة تعليق عام على المعاملة
   */
  async addTransactionComment(
    transactionId: string, 
    content: string, 
    userId: string, 
    userName: string,
    type: CommentType = 'general'
  ) {
    ensureActionPermission(this.permissions, 'projects:view');
    
    const path = paths.transactionComments(this.companyId, transactionId);
    const commentData: TransactionComment = {
      transactionId,
      content,
      commentType: type,
      createdBy: userId,
      createdByName: userName,
      companyId: this.companyId,
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
   * إضافة تعليق متخصص على مرحلة فنية
   */
  async addStageComment(
    transactionId: string, 
    stageInstanceId: string, 
    content: string, 
    userId: string, 
    userName: string,
    type: CommentType = 'note'
  ) {
    ensureActionPermission(this.permissions, 'projects:view');
    
    const path = paths.stageComments(this.companyId, transactionId, stageInstanceId);
    const commentData: TransactionComment = {
      transactionId,
      stageInstanceId,
      content,
      commentType: type,
      createdBy: userId,
      createdByName: userName,
      companyId: this.companyId,
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
   * تحديث محتوى تعليق (يسمح لصاحب التعليق فقط أو الأدمن)
   */
  async updateComment(
    path: string, 
    commentId: string, 
    content: string, 
    userId: string
  ) {
    const commentRef = doc(this.db, path, commentId);
    const updateData = {
      content,
      isEdited: true,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    };

    return updateDoc(commentRef, updateData).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: commentRef.path, operation: 'update', requestResourceData: updateData
      }));
      throw err;
    });
  }

  /**
   * حذف تعليق
   */
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

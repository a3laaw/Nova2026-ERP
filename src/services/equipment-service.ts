'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Equipment } from '@/types/equipment';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { AccountingService } from './accounting-service';

/**
 * خدمة إدارة المعدات والآليات (Equipment Service).
 * تم تحديثها لتوليد مراكز ربحية للمعدات لتتبع ROI التشغيلي.
 */
export class EquipmentService {
  constructor(private db: Firestore, private companyId: string) {}

  async createEquipment(data: Partial<Equipment>, userId: string) {
    if (!this.db || !this.companyId) return;

    const path = paths.equipment(this.companyId);
    const equipRef = doc(collection(this.db, path));
    
    const docData = {
      ...data,
      id: equipRef.id,
      companyId: this.companyId,
      status: data.status || 'available',
      isActive: true,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(equipRef, docData)
      .catch((serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: equipRef.path,
          operation: 'create',
          requestResourceData: docData
        } satisfies SecurityRuleContext));
      });

    // الأتمتة المحاسبية والتحليلية:
    const accService = new AccountingService(this.db, this.companyId);

    // 1. إنشاء حساب أصل ثابت (في حال كانت مملوكة)
    if (data.ownershipType === 'owned') {
       await accService.ensureControlAccount('1101', 'آليات ومعدات ثقيلة', 'Heavy Machinery & Equipment', 'asset');
       await accService.createAutomaticSubAccount('1101', equipRef.id, data.name || 'معدة جديدة', 'asset');
    }

    // 2. إنشاء مركز تكلفة: لتتبع مصاريف الوقود والصيانة
    await accService.createAutomaticCostCenter(
       equipRef.id, 
       `تكلفة المعدة: ${data.name}`, 
       `CC-EQP-${data.code}`
    );

    // 3. إنشاء مركز ربحية: لتتبع العائد التشغيلي (القيمة المنتجة)
    await accService.createAutomaticProfitCenter(
       equipRef.id,
       `ربحية المعدة: ${data.name}`,
       `PC-EQP-${data.code}`
    );
      
    return equipRef.id;
  }

  updateEquipment(id: string, data: Partial<Equipment>, userId: string) {
    const ref = doc(this.db, paths.equipment(this.companyId), id);
    const docData = {
      ...data,
      updatedBy: userId,
      updatedAt: serverTimestamp()
    };

    updateDoc(ref, docData)
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
          path: ref.path,
          operation: 'update',
          requestResourceData: docData
        } satisfies SecurityRuleContext);

        errorEmitter.emit('permission-error', permissionError);
      });
  }
}

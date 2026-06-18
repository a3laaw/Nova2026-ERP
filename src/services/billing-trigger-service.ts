
'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  updateDoc, 
  getDocs, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Contract, StageInstance } from '@/types/reference';

/**
 * خدمة ذكاء الربط المالي (Billing Intelligence Service).
 * مسؤولة عن مراقبة اكتمال مراحل التنفيذ (StageInstances) وتحويلها إلى استحقاقات مالية.
 */
export class BillingTriggerService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إكمال مرحلة تنفيذية والتحقق من التبعات المالية
   */
  async completeStageInstance(projectId: string, instanceId: string, userId: string) {
    const instanceRef = doc(this.db, paths.stageInstances(this.companyId, projectId), instanceId);
    
    try {
      // 1. تحديث حالة النسخة التنفيذية
      await updateDoc(instanceRef, {
        status: 'completed',
        completedAt: serverTimestamp(),
        completedBy: userId,
        updatedAt: serverTimestamp()
      });

      // 2. فحص الأثر المالي
      return await this.checkFinancialImpact(projectId, instanceId);
    } catch (error) {
      console.error('Failed to complete stage instance:', error);
      throw error;
    }
  }

  /**
   * فحص الأثر المالي لاكتمال النسخة التنفيذية
   */
  private async checkFinancialImpact(projectId: string, stageInstanceId: string) {
    const contractsRef = collection(this.db, paths.projectContracts(this.companyId, projectId));
    const contractsSnap = await getDocs(contractsRef);

    const affectedContracts: string[] = [];

    for (const contractDoc of contractsSnap.docs) {
      const contract = contractDoc.data() as Contract;
      let hasChange = false;

      // تحديث الـ Milestones المرتبطة
      const updatedMilestones = contract.milestones.map(milestone => {
        // الربط يتم عبر معرف النسخة التنفيذية أو عبر مفتاح المرحلة (Milestone Key)
        if (milestone.linkedStageInstanceId === stageInstanceId || (milestone.linkedMilestoneKey && milestone.status === 'pending')) {
          hasChange = true;
          return { ...milestone, status: 'due' as const };
        }
        return milestone;
      });

      if (hasChange) {
        await updateDoc(contractDoc.ref, { 
          milestones: updatedMilestones,
          updatedAt: serverTimestamp()
        });
        affectedContracts.push(contractDoc.id);
      }
    }

    return affectedContracts;
  }

  /**
   * تهيئة مراحل المشروع (Instances) بناءً على القالب المرجعي (Template)
   */
  async instantiateTechnicalStages(projectId: string, subServiceId: string, templateStages: any[]) {
    const batch = writeBatch(this.db);
    const instancesRef = collection(this.db, paths.stageInstances(this.companyId, projectId));

    templateStages.forEach(template => {
      const newInstanceRef = doc(instancesRef);
      const instanceData: StageInstance = {
        projectId,
        templateStageId: template.id,
        subServiceId,
        name: template.name,
        code: template.code,
        status: 'pending',
        billableTrigger: template.billableTrigger || false,
        milestoneKey: template.milestoneKey || '',
        order: template.order,
        companyId: this.companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(newInstanceRef, instanceData);
    });

    await batch.commit();
  }
}

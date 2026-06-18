
'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { StageInstance, Contract, ContractMilestone } from '@/types/reference';

/**
 * خدمة ذكاء الربط المالي (Billing Intelligence Service).
 * مسؤولة عن مراقبة اكتمال المراحل الفنية وتحويلها إلى استحقاقات مالية.
 */
export class BillingTriggerService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * إكمال مرحلة فنية والتحقق من التبعات المالية
   */
  async completeStage(projectId: string, instanceId: string, userId: string) {
    const stageRef = doc(this.db, paths.projectStages(this.companyId, projectId), instanceId);
    
    try {
      // 1. تحديث حالة المرحلة
      await updateDoc(stageRef, {
        status: 'completed',
        completedAt: serverTimestamp(),
        completedBy: userId,
        updatedAt: serverTimestamp()
      });

      // سنحتاج لقراءة بيانات المرحلة المكتملة لمعرفة ما إذا كانت Billable
      // (يفضل جلبها قبل التحديث أو استخدام snapshot)
      // للتبسيط، سنفترض وجود وظيفة تكتشف العقود المتأثرة
      return await this.checkFinancialImpact(projectId, instanceId);
    } catch (error) {
      console.error('Failed to complete stage:', error);
      throw error;
    }
  }

  /**
   * فحص الأثر المالي لاكتمال المرحلة
   */
  private async checkFinancialImpact(projectId: string, stageInstanceId: string) {
    // 1. جلب بيانات المرحلة المكتملة
    // 2. جلب عقود المشروع
    const contractsRef = collection(this.db, paths.projectContracts(this.companyId, projectId));
    const contractsSnap = await getDocs(contractsRef);

    const affectedContracts: string[] = [];

    for (const contractDoc of contractsSnap.docs) {
      const contract = contractDoc.data() as Contract;
      let hasChange = false;

      // تحديث الـ Milestones المرتبطة
      const updatedMilestones = contract.milestones.map(milestone => {
        // إذا كان الربط عبر معرف المرحلة أو المفتاح المرجعي (مثل M1)
        if (milestone.linkedStageId === stageInstanceId || (milestone.linkedMilestoneKey && milestone.status === 'pending')) {
          hasChange = true;
          return { ...milestone, status: 'due' as const };
        }
        return milestone;
      });

      if (hasChange) {
        await updateDoc(contractDoc.ref, { milestones: updatedMilestones });
        affectedContracts.push(contractDoc.id);
        
        // هنا يمكن توليد تنبيه (Notification) أو مسودة مستخلص (Payment Application Draft)
        console.log(`Milestone triggered for contract: ${contract.title}`);
      }
    }

    return affectedContracts;
  }

  /**
   * تهيئة مراحل المشروع بناءً على القالب المرجعي
   */
  async initializeProjectStages(projectId: string, templateStages: any[]) {
    const batch = writeBatch(this.db);
    const stagesRef = collection(this.db, paths.projectStages(this.companyId, projectId));

    templateStages.forEach(stage => {
      const newStageRef = doc(stagesRef);
      batch.set(newStageRef, {
        projectId,
        stageId: stage.id,
        name: stage.name,
        code: stage.code,
        status: 'pending',
        billableTrigger: stage.billableTrigger || false,
        milestoneKey: stage.milestoneKey || '',
        order: stage.order,
        companyId: this.companyId,
        createdAt: serverTimestamp()
      });
    });

    await batch.commit();
  }
}

'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  setDoc,
  getDocs, 
  serverTimestamp,
  writeBatch,
  updateDoc
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { Project, StageInstance } from '@/types/project';
import { TechnicalStage } from '@/types/reference';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ensureActionPermission } from '@/lib/permissions';

export class ProjectService {
  constructor(
    private db: Firestore, 
    private companyId: string,
    private permissions: string[] = []
  ) {}

  async createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) {
    ensureActionPermission(this.permissions, 'projects:create');

    // توليد المرجع مسبقاً للحصول على ID دون انتظار الكتابة
    const projectRef = doc(collection(this.db, paths.projects(this.companyId)));
    const projectId = projectRef.id;

    const fullProjectData = {
      ...projectData,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // كتابة - غير محظورة
    setDoc(projectRef, fullProjectData).catch((err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: projectRef.path, 
        operation: 'create',
        requestResourceData: fullProjectData
      }));
    });

    // استنساخ المراحل الفنية (قراءة - تتطلب await)
    const stagesPath = paths.technicalStages(
      this.companyId, 
      projectData.activityTypeId, 
      projectData.serviceId, 
      projectData.subServiceId
    );
    const stagesSnap = await getDocs(collection(this.db, stagesPath));
    
    if (!stagesSnap.empty) {
      const batch = writeBatch(this.db);
      const instancesRef = collection(this.db, paths.stageInstances(this.companyId, projectId));

      stagesSnap.docs.forEach(stageDoc => {
        const stage = stageDoc.data() as TechnicalStage;
        const instanceRef = doc(instancesRef);
        
        batch.set(instanceRef, {
          projectId,
          templateStageId: stageDoc.id,
          name: stage.name,
          nameEn: stage.nameEn,
          description: stage.description,
          status: 'pending',
          isNumeric: stage.isNumeric,
          numericTarget: stage.numericTarget,
          numericValue: 0,
          isTimed: stage.isTimed,
          timeTargetDays: stage.timeTargetDays,
          nextStageIds: stage.nextStageIds || [],
          companyId: this.companyId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      batch.commit().catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ 
          path: `batch_stages_${projectId}`, 
          operation: 'write' 
        }));
      });
    }

    return projectId;
  }

  completeStage(projectId: string, stageId: string, userId: string) {
    ensureActionPermission(this.permissions, 'projects:edit');
    const stageRef = doc(this.db, paths.stageInstances(this.companyId, projectId), stageId);
    
    updateDoc(stageRef, { 
      status: 'completed', 
      completedAt: serverTimestamp(),
      completedBy: userId,
      updatedAt: serverTimestamp() 
    }).catch(() => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: stageRef.path, 
        operation: 'update' 
      }));
    });
  }
}

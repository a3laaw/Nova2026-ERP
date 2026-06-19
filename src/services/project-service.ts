'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  addDoc, 
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
    // Phase 3 Guard
    ensureActionPermission(this.permissions, 'projects:create');

    const projectRef = collection(this.db, paths.projects(this.companyId));
    const fullProjectData = {
      ...projectData,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const projectDoc = await addDoc(projectRef, fullProjectData);
      const projectId = projectDoc.id;

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
          
          const instanceData: Omit<StageInstance, 'id'> = {
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
          };

          batch.set(instanceRef, instanceData);
        });

        await batch.commit();
      }

      return projectId;
    } catch (err: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: `projects_creation_flow`, 
        operation: 'create' 
      }));
      throw err;
    }
  }

  completeStage(projectId: string, stageId: string, userId: string) {
    // Phase 3 Guard
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

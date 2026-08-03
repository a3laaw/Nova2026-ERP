'use client';

import { 
  Firestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  serverTimestamp,
  writeBatch,
  increment,
  limit
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQItem, Contract, InterimPaymentCertificate } from '@/types/documents';
import { nextSequential } from '@/lib/counters';

/**
 * محرك الفوترة والمستخلصات السيادي (Sovereign Billing Engine).
 * يطبق منهجية تجميد الكميات (Snapshot) وحساب الاحتجازات واسترداد الدفعة المقدمة.
 */
export class BillingService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * توليد مستخلص جديد بناءً على "الكميات المعتمدة غير المفوترة"
   */
  async generateIPC(transactionId: string, userId: string, userName: string) {
    // 1. جلب العقد النشط لجلب سياسات الاحتجاز والمقدم
    const contractsSnap = await getDocs(query(
      collection(this.db, paths.contracts(this.companyId)), 
      where('transactionId', '==', transactionId),
      where('status', 'in', ['approved', 'active', 'paid']),
      limit(1)
    ));
    
    if (contractsSnap.empty) throw new Error('NO_ACTIVE_CONTRACT');
    const contract = { id: contractsSnap.docs[0].id, ...contractsSnap.docs[0].data() } as Contract;

    // 2. جلب المقايسة والبنود
    const boqsSnap = await getDocs(query(collection(this.db, paths.boqs(this.companyId)), where('transactionId', '==', transactionId)));
    if (boqsSnap.empty) throw new Error('NO_ACTIVE_BOQ');
    const boqId = boqsSnap.docs[0].id;
    
    const itemsSnap = await getDocs(collection(this.db, paths.boqItems(this.companyId, boqId)));
    const allItems = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BOQItem));
    
    // 3. فلترة البنود القابلة للفوترة (المعتمد > المفوتر)
    const billableItems = allItems.filter(i => (i.verifiedQuantity || 0) > (i.billedQuantity || 0));
    if (billableItems.length === 0) throw new Error('NO_UNBILLED_QUANTITIES');

    const batch = writeBatch(this.db);
    const ipcRef = doc(collection(this.db, getTenantPath(this.companyId, 'ipcs')));
    const ipcNumber = await nextSequential(this.db, this.companyId, `ipc_${contract.id}`, '', 0, 0);

    let grossAmount = 0;

    // 4. بناء الـ Snapshot للبنود
    const lineItems = billableItems.map(item => {
      const currentQty = (item.verifiedQuantity || 0) - (item.billedQuantity || 0);
      const amount = currentQty * (item.estimatedRate || 0);
      grossAmount += amount;

      return {
        boqItemId: item.id,
        description: item.referenceTitle,
        contractQty: item.contractQty || item.plannedQuantity,
        approvedVariationQty: item.approvedVariationQty || 0,
        previousCumulativeQty: item.billedQuantity || 0,
        currentQty: currentQty,
        unitRate: item.estimatedRate || 0,
        amount: amount
      };
    });

    // 5. حساب الاحتجاز واسترداد المقدم
    const retentionAmount = grossAmount * (contract.retentionRate || 0);
    
    let advanceRecovery = 0;
    if (contract.advancePayment) {
       const remainingAdvance = contract.advancePayment.amount - (contract.advancePayment.recoveredToDate || 0);
       const targetRecovery = grossAmount * (contract.advancePayment.recoveryRate || 0);
       advanceRecovery = Math.min(targetRecovery, remainingAdvance);
    }

    const netPayable = grossAmount - retentionAmount - advanceRecovery;

    const ipcData: Partial<InterimPaymentCertificate> = {
      id: ipcRef.id,
      ipcNumber: Number(ipcNumber),
      transactionId,
      contractId: contract.id,
      clientId: contract.clientId,
      clientName: contract.clientName,
      status: 'draft',
      lineItems,
      grossAmount,
      retentionAmount,
      advanceRecovery,
      netPayable,
      companyId: this.companyId,
      createdBy: userId,
      generatedAt: serverTimestamp() as any,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    batch.set(ipcRef, ipcData);
    await batch.commit();

    return ipcRef.id;
  }

  /**
   * الاعتماد النهائي للمستخلص والترحيل المالي
   */
  async approveIPC(ipcId: string, userId: string) {
    const ipcRef = doc(this.db, getTenantPath(this.companyId, 'ipcs'), ipcId);
    const ipcSnap = await getDoc(ipcRef);
    if (!ipcSnap.exists() || ipcSnap.data().status === 'approved') return;
    
    const ipc = ipcSnap.data() as InterimPaymentCertificate;
    const batch = writeBatch(this.db);

    // 1. تحديث billedQuantity في بنود المقايسة (التجميد النهائي)
    const boqsSnap = await getDocs(query(collection(this.db, paths.boqs(this.companyId)), where('transactionId', '==', ipc.transactionId)));
    const boqId = boqsSnap.docs[0].id;

    ipc.lineItems.forEach(line => {
      const itemRef = doc(this.db, paths.boqItems(this.companyId, boqId), line.boqItemId);
      batch.update(itemRef, {
        billedQuantity: increment(line.currentQty)
      });
    });

    // 2. تحديث رصيد استرداد الدفعة المقدمة في العقد
    if (ipc.advanceRecovery > 0) {
      const contractRef = doc(this.db, paths.contracts(this.companyId), ipc.contractId);
      batch.update(contractRef, {
        'advancePayment.recoveredToDate': increment(ipc.advanceRecovery)
      });
    }

    // 3. تحديث حالة المستخلص
    batch.update(ipcRef, {
      status: 'approved',
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  }
}

function getTenantPath(companyId: string, sub: string) {
  return `companies/${companyId}/${sub}`;
}

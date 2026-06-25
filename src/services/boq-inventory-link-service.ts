'use client';

import { 
  Firestore, 
  collection, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';
import { paths } from '@/firebase/multi-tenant';
import { BOQItem } from '@/types/documents';

export interface BOQItemMaterialVariance {
  boqItemId: string;
  expectedQuantity: number;
  actualIssuedQuantity: number;
  remainingQuantity: number;
  variance: number;
  varianceStatus: 'normal' | 'excess' | 'shortage';
}

export interface BOQInventorySummary {
  totalLinkedItems: number;
  totalIssuedLines: number;
  itemsWithExcess: number;
  itemsWithShortage: number;
  itemsBalanced: number;
}

/**
 * خدمة الربط التحليلي بين المقايسة وحركات المخزون (BOQ-Inventory Analytics Service).
 */
export class BOQInventoryLinkService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * جلب حركات الصرف المرتبطة ببند مقايسة محدد
   */
  async getInventoryUsageByBOQItem(boqId: string, boqItemId: string) {
    const q = query(
      collection(this.db, paths.inventoryTransactions(this.companyId)),
      where('boqId', '==', boqId),
      where('boqItemId', '==', boqItemId),
      where('type', '==', 'issue') // حركات الصرف فقط
    );

    const snap = await getDocs(q);
    const transactions = snap.docs.map(d => d.data());
    
    const totalIssuedQuantity = transactions.reduce((sum, t) => sum + (t.quantity || 0), 0);

    return {
      totalIssuedQuantity,
      movementCount: transactions.length,
      transactions
    };
  }

  /**
   * حساب الانحراف المخزني لبند مقايسة (Expected vs Actual)
   */
  async getBOQItemMaterialVariance(item: BOQItem): Promise<BOQItemMaterialVariance> {
    const usage = await this.getInventoryUsageByBOQItem(item.boqId, item.id);
    
    const expected = item.plannedQuantity || 0;
    const actual = usage.totalIssuedQuantity;
    const variance = actual - expected;
    const remaining = Math.max(0, expected - actual);

    let varianceStatus: 'normal' | 'excess' | 'shortage' = 'normal';
    if (variance > 0) varianceStatus = 'excess'; // صرف زائد (هدر)
    else if (actual < expected && actual > 0) varianceStatus = 'shortage'; // نقص في التوريد

    return {
      boqItemId: item.id,
      expectedQuantity: expected,
      actualIssuedQuantity: actual,
      remainingQuantity: remaining,
      variance,
      varianceStatus
    };
  }

  /**
   * ملخص لوجستي كامل للمقايسة
   */
  async getBOQInventorySummary(boqId: string): Promise<BOQInventorySummary> {
    const q = query(
      collection(this.db, paths.inventoryTransactions(this.companyId)),
      where('boqId', '==', boqId),
      where('type', '==', 'issue')
    );
    const snap = await getDocs(q);
    const transactions = snap.docs.map(d => d.data());

    // ملاحظة: التحليل الدقيق يتطلب مطابقة كل بند، سنقوم هنا بعملية تجميع سريعة
    const usageMap: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.boqItemId) {
        usageMap[t.boqItemId] = (usageMap[t.boqItemId] || 0) + (t.quantity || 0);
      }
    });

    const itemsSnap = await getDocs(collection(this.db, paths.boqItems(this.companyId, boqId)));
    const boqItems = itemsSnap.docs.map(d => d.data() as BOQItem);

    let itemsWithExcess = 0;
    let itemsWithShortage = 0;
    let itemsBalanced = 0;

    boqItems.forEach(item => {
      const actual = usageMap[item.id] || 0;
      const expected = item.plannedQuantity || 0;
      
      if (actual > expected) itemsWithExcess++;
      else if (actual < expected && actual > 0) itemsWithShortage++;
      else if (actual === expected && actual > 0) itemsBalanced++;
    });

    return {
      totalLinkedItems: boqItems.length,
      totalIssuedLines: transactions.length,
      itemsWithExcess,
      itemsWithShortage,
      itemsBalanced
    };
  }
}

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
  expectedQuantity: number;      // الكمية المخططة في المقايسة
  actualIssuedQuantity: number;  // الكمية المصروفة من المخزن أو المشتراة
  executedQuantity: number;      // الكمية المنفذة فعلياً في الميدان
  variance: number;              // الانحراف
  varianceStatus: 'normal' | 'excess' | 'shortage';
}

/**
 * خدمة الربط التحليلي بين المقايسة وحركات المشتريات/المخزون (BOQ-Procurement Analytics).
 * تقوم هذه الخدمة بالمقارنة التي طلبتها بين "المالي/المصروف" و "الميداني/المنفذ".
 */
export class BOQInventoryLinkService {
  constructor(private db: Firestore, private companyId: string) {}

  /**
   * تحليل الانحراف لبند محدد (المنفذ ميدانياً vs المصروف مخزنياً)
   */
  async analyzeItemVariance(boqId: string, boqItemId: string): Promise<BOQItemMaterialVariance> {
    // 1. جلب بيانات البند من المقايسة (لمعرفة المخطط والمنفذ)
    const itemSnap = await getDocs(query(collection(this.db, paths.boqItems(this.companyId, boqId)), where('id', '==', boqItemId)));
    const itemData = itemSnap.docs[0]?.data() as BOQItem;

    if (!itemData) throw new Error('ITEM_NOT_FOUND');

    // 2. جلب كافة المشتريات/المصروفات المرتبطة بهذا البند
    // نبحث في بنود أوامر الشراء التي تشير لهذا الـ boqItemId
    const poItemsQuery = query(
      collection(this.db, 'purchase_orders_items'), // افتراض وجود مجموعة مسطحة أو استعلام collectionGroup
      where('companyId', '==', this.companyId),
      where('boqItemId', '==', boqItemId)
    );
    
    const poSnap = await getDocs(poItemsQuery);
    const totalPurchased = poSnap.docs.reduce((sum, d) => sum + (d.data().quantity || 0), 0);

    const executed = itemData.executedQuantity || 0;
    const planned = itemData.plannedQuantity || 0;
    const variance = totalPurchased - executed;

    let varianceStatus: 'normal' | 'excess' | 'shortage' = 'normal';
    if (variance > 0) varianceStatus = 'excess'; // صرف مالي أكثر من الإنجاز الميداني (هدر محتمل)
    else if (variance < 0) varianceStatus = 'shortage'; // إنجاز ميداني لم يقابله شراء كافٍ (تحت المراجعة)

    return {
      boqItemId,
      expectedQuantity: planned,
      actualIssuedQuantity: totalPurchased,
      executedQuantity: executed,
      variance,
      varianceStatus
    };
  }
}

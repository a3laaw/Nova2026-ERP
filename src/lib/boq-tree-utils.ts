/**
 * @fileOverview أدوات تحويل بيانات المقايسات الديناميكية إلى هيكل شجري للعرض.
 * يعتمد على ancestorIds لبناء المجموعات بشكل هرمي.
 */

import { BOQTemplateItem, BOQTreeNode } from '@/types/templates';
import { BOQReferenceNode } from '@/types/reference';

/**
 * تحويل مصفوفة بنود المقايسة المسطحة إلى هيكل شجري ديناميكي.
 * يقوم بتجميع البنود تحت آبائهم الافتراضيين بناءً على ancestorIds و ancestorTitles.
 */
export function transformToBOQTree(items: BOQTemplateItem[]): BOQTreeNode[] {
  const rootNodes: BOQTreeNode[] = [];
  const nodesMap: Record<string, BOQTreeNode> = {};

  // 1. معالجة كافة البنود وبناء الهيكل المحيط بها
  items.forEach((item) => {
    const ancestors = item.ancestorIds || [];
    const titles = item.ancestorTitles || [];

    let currentParent: BOQTreeNode | null = null;

    // بناء/تتبع مسار الأسلاف
    ancestors.forEach((id, idx) => {
      if (!nodesMap[id]) {
        const newNode: BOQTreeNode = {
          id,
          title: titles[idx] || `Section ${idx + 1}`,
          depth: idx,
          order: 0, // سيتم ترتيبه لاحقاً
          children: [],
          items: []
        };
        nodesMap[id] = newNode;

        if (idx === 0) {
          rootNodes.push(newNode);
        } else if (currentParent) {
          currentParent.children.push(newNode);
        }
      }
      currentParent = nodesMap[id];
    });

    // إضافة البند الفعلي إلى مجموعته الأخيرة
    if (currentParent) {
      (currentParent as BOQTreeNode).items.push(item);
    } else {
      // حالة نادرة: بند بدون أسلاف (Root Item)
      const orphanId = `orphan_${item.boqReferenceNodeId}`;
      if (!nodesMap[orphanId]) {
        const orphanNode: BOQTreeNode = {
          id: orphanId,
          title: item.referenceTitle,
          depth: 0,
          order: item.order,
          children: [],
          items: [item]
        };
        nodesMap[orphanId] = orphanNode;
        rootNodes.push(orphanNode);
      }
    }
  });

  // 2. دالة الفرز العميق
  const sortNode = (node: BOQTreeNode) => {
    node.children.sort((a, b) => a.order - b.order);
    node.items.sort((a, b) => a.order - b.order);
    node.children.forEach(sortNode);
  };

  rootNodes.sort((a, b) => a.order - b.order).forEach(sortNode);

  return rootNodes;
}

/**
 * دالة حل الخدمات الفعالة للعقدة (Effective Services Resolver)
 * تقوم بالبحث عن الخدمات المعرفة مباشرة، أو الصعود في سلسلة النسب للعثور على أول أب يحمل تعريفاً.
 */
export function resolveNodeEffectiveServices(
  nodeId: string, 
  allNodes: BOQReferenceNode[]
): { serviceIds: string[]; serviceNames: string[]; isInherited: boolean } {
  const node = allNodes.find(n => n.id === nodeId);
  if (!node) return { serviceIds: [], serviceNames: [], isInherited: false };

  // 1. إذا كان لديه تعريف مباشر، نستخدمه ونوقف الوراثة
  if (node.allowedServiceIds && node.allowedServiceIds.length > 0) {
    return { 
      serviceIds: node.allowedServiceIds, 
      serviceNames: node.allowedServiceNames || [], 
      isInherited: false 
    };
  }

  // 2. إذا كان مسموحاً له بالوراثة ولديه أب، نصعد للأعلى
  if (node.inheritServices !== false && node.parentId) {
    const parentResult = resolveNodeEffectiveServices(node.parentId, allNodes);
    return { ...parentResult, isInherited: true };
  }

  // 3. لا يوجد تعريف ولا وراثة
  return { serviceIds: [], serviceNames: [], isInherited: false };
}

/**
 * دالة مماثلة للأنشطة
 */
export function resolveNodeEffectiveActivities(
  nodeId: string, 
  allNodes: BOQReferenceNode[]
): { activityIds: string[]; activityNames: string[]; isInherited: boolean } {
  const node = allNodes.find(n => n.id === nodeId);
  if (!node) return { activityIds: [], activityNames: [], isInherited: false };

  if (node.allowedActivityTypeIds && node.allowedActivityTypeIds.length > 0) {
    return { 
      activityIds: node.allowedActivityTypeIds, 
      activityNames: node.allowedActivityTypeNames || [], 
      isInherited: false 
    };
  }

  if (node.inheritServices !== false && node.parentId) {
    const parentResult = resolveNodeEffectiveActivities(node.parentId, allNodes);
    return { ...parentResult, isInherited: true };
  }

  return { activityIds: [], activityNames: [], isInherited: false };
}

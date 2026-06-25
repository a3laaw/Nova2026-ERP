/**
 * @fileOverview أدوات تحويل بيانات المقايسات الديناميكية إلى هيكل شجري للعرض.
 * يعتمد على ancestorIds لبناء المجموعات بشكل هرمي.
 */

import { BOQTemplateItem, BOQTreeNode } from '@/types/templates';

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

/**
 * @fileOverview أدوات تحويل بيانات المقايسات المسطحة إلى هيكل شجري.
 * - transformToBOQTree: المحرك الرئيسي لتحويل المصفوفة المسطحة إلى شجرة هندسية.
 */

import { 
  BOQTemplateItem, 
  BOQTreeSection, 
  BOQTreeMainCategory, 
  BOQTreeComponent 
} from '@/types/templates';

/**
 * تحويل مصفوفة بنود المقايسة المسطحة إلى هيكل شجري ثلاثي المستويات + البنود النهائية.
 * الترتيب يتم بناءً على حقل 'order' في كل مستوى.
 */
export function transformToBOQTree(items: BOQTemplateItem[]): BOQTreeSection[] {
  const sectionsMap: Record<string, BOQTreeSection> = {};

  items.forEach((item, index) => {
    // 1. معالجة مستوى القسم (Section)
    if (!sectionsMap[item.sectionId]) {
      sectionsMap[item.sectionId] = {
        id: item.sectionId,
        name: item.sectionName,
        order: item.order, 
        children: []
      };
    }
    const section = sectionsMap[item.sectionId];

    // 2. معالجة مستوى الفئة الرئيسية (Main Category)
    let mainCategory = section.children.find(c => c.id === item.mainCategoryId);
    if (!mainCategory) {
      mainCategory = {
        id: item.mainCategoryId,
        name: item.mainCategoryName,
        order: item.order,
        children: []
      };
      section.children.push(mainCategory);
    }

    // 3. معالجة مستوى العنصر (Component)
    let component = mainCategory.children.find(c => c.id === item.componentId);
    if (!component) {
      component = {
        id: item.componentId,
        name: item.componentName,
        order: item.order,
        children: []
      };
      mainCategory.children.push(component);
    }

    // 4. إضافة البند النهائي (Leaf Node) مع الاحتفاظ بالفهرس الأصلي للتعديل
    component.children.push({ ...item, originalIndex: index } as any);
  });

  // فرز كافة المستويات بناءً على حقل الترتيب (Order)
  const sortedSections = Object.values(sectionsMap)
    .sort((a, b) => a.order - b.order)
    .map(section => ({
      ...section,
      children: section.children
        .sort((a, b) => a.order - b.order)
        .map(category => ({
          ...category,
          children: category.children
            .sort((a, b) => a.order - b.order)
            .map(comp => ({
              ...comp,
              children: comp.children.sort((a, b) => (a as any).order - (b as any).order)
            }))
        }))
    }));

  return sortedSections;
}

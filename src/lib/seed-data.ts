/**
 * @fileOverview البيانات المرجعية الأساسية لنظام Nova ERP (النموذج الهندسي الكويتي).
 * تم تحديثها لتشمل القوائم الموحدة والقابلة للتوسعة.
 */

export const SEED_DATA = {
  // الهيكل التنظيمي
  departments: [
    {
      code: 'ARCH',
      name: 'القسم المعماري',
      nameEn: 'Architectural Dept',
      order: 1,
      jobs: [
        { code: 'S-ARCH', name: 'مهندس معماري أول', nameEn: 'Senior Architect', order: 1 },
        { code: 'J-ARCH', name: 'مهندس معماري', nameEn: 'Junior Architect', order: 2 },
      ]
    },
    {
      code: 'ADMIN',
      name: 'الشؤون الإدارية والمالية',
      nameEn: 'Admin & Finance',
      order: 2,
      jobs: [
        { code: 'ACC', name: 'محاسب', nameEn: 'Accountant', order: 1 },
      ]
    }
  ],

  // البيانات الجغرافية
  governorates: [
    {
      name: 'العاصمة',
      nameEn: 'Al-Asimah',
      order: 1,
      areas: [
        { name: 'الروضة', nameEn: 'Rawda', order: 1 },
        { name: 'كيفان', nameEn: 'Kaifan', order: 2 },
      ]
    }
  ],

  // الهيكل الفني الرباعي
  activityTypes: [
    {
      code: 'CONSULTING',
      name: 'استشارات هندسية',
      nameEn: 'Engineering Consulting',
      order: 1,
      services: [
        {
          code: 'RESIDENTIAL',
          name: 'بناء وتصميم سكني',
          nameEn: 'Residential Design',
          order: 1,
          subServices: [
            {
              code: 'MUN-PERMIT',
              name: 'تراخيص البلدية',
              nameEn: 'Municipality Permits',
              order: 1,
              technicalStages: [
                { code: 'FILE-OPEN', name: 'فتح ملف', nameEn: 'File Opening', order: 1, isTimed: true, timeTargetDays: 2 },
                { code: 'ARCH-APPR', name: 'اعتماد معماري', nameEn: 'Arch Approval', order: 2, isTimed: true, timeTargetDays: 14 },
              ]
            }
          ]
        }
      ]
    }
  ],

  // القوائم المرجعية (Reference Lists)
  unitTypes: [
    { code: 'TON', name: 'طن', nameEn: 'Ton', symbol: 'tn', category: 'weight', order: 1 },
    { code: 'SQM', name: 'متر مربع', nameEn: 'Square Meter', symbol: 'm2', category: 'area', order: 2 },
    { code: 'CUM', name: 'متر مكعب', nameEn: 'Cubic Meter', symbol: 'm3', category: 'volume', order: 3 },
    { code: 'LM', name: 'متر طولي', nameEn: 'Linear Meter', symbol: 'm', category: 'length', order: 4 },
    { code: 'BOX', name: 'كرتون', nameEn: 'Box', symbol: 'bx', category: 'package', order: 5 },
    { code: 'UNIT', name: 'حبة', nameEn: 'Unit', symbol: 'u', category: 'count', order: 6 },
    { code: 'PCS', name: 'قطعة', nameEn: 'Piece', symbol: 'pcs', category: 'count', order: 7 },
    { code: 'LS', name: 'مقطوعية', nameEn: 'Lumpsum', symbol: 'ls', category: 'service', order: 8 },
    { code: 'ITEM', name: 'بند', nameEn: 'Item', symbol: 'it', category: 'service', order: 9 },
    { code: 'KG', name: 'كيلو', nameEn: 'Kilogram', symbol: 'kg', category: 'weight', order: 10 },
    { code: 'LTR', name: 'لتر', nameEn: 'Liter', symbol: 'l', category: 'volume', order: 11 },
  ],

  paymentMethods: [
    { code: 'CASH', name: 'نقدي', nameEn: 'Cash', order: 1 },
    { code: 'BANK_TRANSFER', name: 'تحويل بنكي', nameEn: 'Bank Transfer', order: 2 },
    { code: 'CHECK', name: 'شيك', nameEn: 'Check', order: 3 },
    { code: 'KNET', name: 'KNET', nameEn: 'KNET', order: 4 },
    { code: 'CREDIT', name: 'آجل', nameEn: 'Credit', order: 5 },
    { code: 'ADVANCE', name: 'دفعة مقدمة', nameEn: 'Advance Payment', order: 6 },
  ],

  paymentConditionTypes: [
    { code: 'ON_SIGNING', name: 'عند التوقيع', nameEn: 'Upon Signing', order: 1 },
    { code: 'PRE_EXECUTION', name: 'قبل التنفيذ', nameEn: 'Pre-Execution', order: 2 },
    { code: 'DURING_EXECUTION', name: 'أثناء التنفيذ', nameEn: 'During Execution', order: 3 },
    { code: 'POST_EXECUTION', name: 'بعد الإنجاز', nameEn: 'Post-Execution', order: 4 },
    { code: 'UPON_DELIVERY', name: 'عند التسليم', nameEn: 'Upon Delivery', order: 5 },
    { code: 'FINAL_PAYMENT', name: 'دفعة ختامية', nameEn: 'Final Payment', order: 6 },
    { code: 'MANUAL', name: 'يدوي', nameEn: 'Manual Trigger', order: 7 },
  ],

  milestoneTimingTypes: [
    { code: 'AT', name: 'عند', nameEn: 'At', order: 1 },
    { code: 'DURING', name: 'أثناء', nameEn: 'During', order: 2 },
    { code: 'AFTER', name: 'بعد', nameEn: 'After', order: 3 },
  ],

  itemCategories: [
    { code: 'CIVIL_MAT', name: 'مواد مدنية', nameEn: 'Civil Materials', order: 1 },
    { code: 'ELEC_MAT', name: 'مواد كهربائية', nameEn: 'Electrical Materials', order: 2 },
    { code: 'PLUMB_MAT', name: 'مواد صحية', nameEn: 'Plumbing Materials', order: 3 },
    { code: 'FINISHING', name: 'تشطيبات', nameEn: 'Finishing Materials', order: 4 },
    { code: 'EQUIPMENT', name: 'معدات', nameEn: 'Equipment', order: 5 },
    { code: 'SPARE_PARTS', name: 'قطع غيار', nameEn: 'Spare Parts', order: 6 },
  ],

  costTypeCategories: [
    { code: 'MATERIAL', name: 'مواد', nameEn: 'Material', order: 1 },
    { code: 'LABOR', name: 'عمالة', nameEn: 'Labor', order: 2 },
    { code: 'EQUIPMENT', name: 'معدات', nameEn: 'Equipment', order: 3 },
    { code: 'SUB_CON', name: 'مقاول باطن', nameEn: 'Sub-Contractor', order: 4 },
    { code: 'INDIRECT', name: 'مصاريف غير مباشرة', nameEn: 'Indirect Costs', order: 5 },
  ]
};

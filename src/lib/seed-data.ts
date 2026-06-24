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

  // القوائم المرجعية (Seeded Lists)
  unitTypes: [
    { code: 'TON', name: 'طن', nameEn: 'Ton', symbol: 'tn', category: 'weight' },
    { code: 'SQM', name: 'متر مربع', nameEn: 'Square Meter', symbol: 'm2', category: 'area' },
    { code: 'CUM', name: 'متر مكعب', nameEn: 'Cubic Meter', symbol: 'm3', category: 'volume' },
    { code: 'LM', name: 'متر طولي', nameEn: 'Linear Meter', symbol: 'm', category: 'length' },
    { code: 'BOX', name: 'كرتون', nameEn: 'Box', symbol: 'bx', category: 'package' },
    { code: 'UNIT', name: 'حبة', nameEn: 'Unit', symbol: 'u', category: 'count' },
    { code: 'PCS', name: 'قطعة', nameEn: 'Piece', symbol: 'pcs', category: 'count' },
    { code: 'LS', name: 'مقطوعية', nameEn: 'Lumpsum', symbol: 'ls', category: 'service' },
    { code: 'ITEM', name: 'بند', nameEn: 'Item', symbol: 'it', category: 'service' },
    { code: 'KG', name: 'كيلو', nameEn: 'Kilogram', symbol: 'kg', category: 'weight' },
    { code: 'LTR', name: 'لتر', nameEn: 'Liter', symbol: 'l', category: 'volume' },
  ],

  paymentMethods: [
    { code: 'CASH', name: 'نقدي', nameEn: 'Cash' },
    { code: 'BANK_TRANSFER', name: 'تحويل بنكي', nameEn: 'Bank Transfer' },
    { code: 'CHECK', name: 'شيك', nameEn: 'Check' },
    { code: 'KNET', name: 'KNET', nameEn: 'KNET' },
    { code: 'CREDIT', name: 'آجل', nameEn: 'Credit' },
    { code: 'ADVANCE', name: 'دفعة مقدمة', nameEn: 'Advance Payment' },
  ],

  paymentConditionTypes: [
    { code: 'ON_SIGNING', name: 'عند التوقيع', nameEn: 'Upon Signing' },
    { code: 'PRE_EXECUTION', name: 'قبل التنفيذ', nameEn: 'Pre-Execution' },
    { code: 'DURING_EXECUTION', name: 'أثناء التنفيذ', nameEn: 'During Execution' },
    { code: 'POST_EXECUTION', name: 'بعد الإنجاز', nameEn: 'Post-Execution' },
    { code: 'UPON_DELIVERY', name: 'عند التسليم', nameEn: 'Upon Delivery' },
    { code: 'FINAL_PAYMENT', name: 'دفعة ختامية', nameEn: 'Final Payment' },
    { code: 'MANUAL', name: 'يدوي', nameEn: 'Manual Trigger' },
  ],

  milestoneTimingTypes: [
    { code: 'AT', name: 'عند', nameEn: 'At' },
    { code: 'DURING', name: 'أثناء', nameEn: 'During' },
    { code: 'AFTER', name: 'بعد', nameEn: 'After' },
  ],

  itemCategories: [
    { code: 'CIVIL_MAT', name: 'مواد مدنية', nameEn: 'Civil Materials' },
    { code: 'ELEC_MAT', name: 'مواد كهربائية', nameEn: 'Electrical Materials' },
    { code: 'PLUMB_MAT', name: 'مواد صحية', nameEn: 'Plumbing Materials' },
    { code: 'FINISHING', name: 'تشطيبات', nameEn: 'Finishing Materials' },
    { code: 'EQUIPMENT', name: 'معدات', nameEn: 'Equipment' },
    { code: 'SPARE_PARTS', name: 'قطع غيار', nameEn: 'Spare Parts' },
  ],

  costTypeCategories: [
    { code: 'MATERIAL', name: 'مواد', nameEn: 'Material' },
    { code: 'LABOR', name: 'عمالة', nameEn: 'Labor' },
    { code: 'EQUIPMENT', name: 'معدات', nameEn: 'Equipment' },
    { code: 'SUB_CON', name: 'مقاول باطن', nameEn: 'Sub-Contractor' },
    { code: 'INDIRECT', name: 'مصاريف غير مباشرة', nameEn: 'Indirect Costs' },
  ]
};

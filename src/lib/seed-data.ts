/**
 * @fileOverview البيانات المرجعية الأساسية لنظام Nova ERP (النموذج الهندسي الكويتي).
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
      code: 'CIVIL',
      name: 'القسم الإنشائي (ميداني)',
      nameEn: 'Civil & Site Dept',
      order: 2,
      jobs: [
        { code: 'SITE-ENG', name: 'مهندس موقع', nameEn: 'Site Engineer', order: 1 },
        { code: 'SUPERVISOR', name: 'مراقب تنفيذ', nameEn: 'Site Supervisor', order: 2 },
      ]
    },
    {
      code: 'ADMIN',
      name: 'الشؤون الإدارية والمالية',
      nameEn: 'Admin & Finance',
      order: 3,
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
    },
    {
      name: 'حولي',
      nameEn: 'Hawalli',
      order: 2,
      areas: [
        { name: 'الجابرية', nameEn: 'Jabriya', order: 1 },
        { name: 'السالمية', nameEn: 'Salmiya', order: 2 },
      ]
    }
  ],

  // الهيكل الفني الرباعي (المسارات التشغيلية)
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
    },
    {
      code: 'CONSTRUCTION',
      name: 'أعمال المقاولات والإنشاءات',
      nameEn: 'Construction Works',
      order: 2,
      services: [
        {
          code: 'STRUCTURAL',
          name: 'أعمال الهيكل والأساسات',
          nameEn: 'Structural Works',
          order: 1,
          subServices: [
            {
              code: 'VILLA-SKELETON',
              name: 'هيكل أسود - فيلا سكنية',
              nameEn: 'Residential Villa Skeleton',
              order: 1,
              technicalStages: [
                { code: 'EXCAVATION', name: 'أعمال الحفريات', nameEn: 'Excavation', order: 1, isTimed: true, timeTargetDays: 3 },
                { code: 'BLINDING', name: 'خرسانة النظافة', nameEn: 'Blinding Concrete', order: 2, isTimed: true, timeTargetDays: 2 },
                { code: 'FOOTINGS', name: 'القواعد والأساسات', nameEn: 'Footings & Foundations', order: 3, isTimed: true, timeTargetDays: 7 },
                { code: 'COLUMNS-G', name: 'أعمدة الدور الأرضي', nameEn: 'Ground Floor Columns', order: 4, isTimed: true, timeTargetDays: 5 },
                { code: 'SLAB-G', name: 'سقف الدور الأرضي', nameEn: 'Ground Floor Slab', order: 5, isTimed: true, timeTargetDays: 10 },
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
    { code: 'UNIT', name: 'حبة', nameEn: 'Unit', symbol: 'u', category: 'count' },
    { code: 'LS', name: 'مقطوعية', nameEn: 'Lumpsum', symbol: 'ls', category: 'service' },
  ],

  paymentMethods: [
    { code: 'CASH', name: 'نقدي', nameEn: 'Cash' },
    { code: 'BANK_TRANSFER', name: 'تحويل بنكي', nameEn: 'Bank Transfer' },
    { code: 'KNET', name: 'KNET', nameEn: 'KNET' },
  ],

  paymentConditionTypes: [
    { code: 'ON_SIGNING', name: 'عند التوقيع', nameEn: 'Upon Signing' },
    { code: 'DURING_EXECUTION', name: 'أثناء التنفيذ', nameEn: 'During Execution' },
    { code: 'FINAL_PAYMENT', name: 'دفعة ختامية', nameEn: 'Final Payment' },
  ],

  milestoneTimingTypes: [
    { code: 'AT', name: 'عند', nameEn: 'At' },
    { code: 'DURING', name: 'أثناء', nameEn: 'During' },
    { code: 'AFTER', name: 'بعد', nameEn: 'After' },
  ],

  itemCategories: [
    { code: 'CIVIL_MAT', name: 'مواد مدنية', nameEn: 'Civil Materials' },
    { code: 'EQUIPMENT', name: 'معدات', nameEn: 'Equipment' },
  ],

  costTypeCategories: [
    { code: 'MATERIAL', name: 'مواد', nameEn: 'Material' },
    { code: 'LABOR', name: 'عمالة', nameEn: 'Labor' },
    { code: 'EQUIPMENT', name: 'معدات', nameEn: 'Equipment' },
  ]
};

/**
 * @fileOverview البيانات المرجعية الأساسية لنظام Nova ERP (النموذج الهندسي الكويتي).
 * تم تحديثها لتتوافق مع الهيكل الرباعي (ActivityType -> Service -> SubService -> TechnicalStage).
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
  ]
};
/**
 * @fileOverview البيانات المرجعية الأساسية لنظام Nova ERP (النموذج الهندسي الكويتي).
 * تشمل الهيكل التنظيمي، الجغرافي، المسارات الفنية، وأنواع الأنشطة.
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
        { code: 'D-ARCH', name: 'رسام معماري', nameEn: 'Architectural Drafter', order: 3 },
      ]
    },
    {
      code: 'STR',
      name: 'القسم الإنشائي',
      nameEn: 'Structural Dept',
      order: 2,
      jobs: [
        { code: 'S-STR', name: 'مهندس إنشائي أول', nameEn: 'Senior Structural Engineer', order: 1 },
        { code: 'J-STR', name: 'مهندس إنشائي', nameEn: 'Structural Engineer', order: 2 },
      ]
    },
    {
      code: 'MEP',
      name: 'قسم الكهرباء والصحي',
      nameEn: 'MEP Dept',
      order: 3,
      jobs: [
        { code: 'E-ENG', name: 'مهندس كهرباء', nameEn: 'Electrical Engineer', order: 1 },
        { code: 'P-ENG', name: 'مهندس صحي', nameEn: 'Plumbing Engineer', order: 2 },
      ]
    },
    {
      code: 'ADMIN',
      name: 'الشؤون الإدارية والمالية',
      nameEn: 'Admin & Finance',
      order: 4,
      jobs: [
        { code: 'ACC', name: 'محاسب', nameEn: 'Accountant', order: 1 },
        { code: 'PRO', name: 'مندوب علاقات عامة', nameEn: 'Public Relations Officer', order: 2 },
      ]
    }
  ],

  // البيانات الجغرافية (دولة الكويت)
  governorates: [
    {
      name: 'العاصمة',
      nameEn: 'Al-Asimah',
      order: 1,
      areas: [
        { name: 'الروضة', nameEn: 'Rawda', order: 1 },
        { name: 'كيفان', nameEn: 'Kaifan', order: 2 },
        { name: 'المنصورية', nameEn: 'Mansouriya', order: 3 },
      ]
    },
    {
      name: 'حولي',
      nameEn: 'Hawalli',
      order: 2,
      areas: [
        { name: 'السالمية', nameEn: 'Salmiya', order: 1 },
        { name: 'الجابرية', nameEn: 'Jabriya', order: 2 },
        { name: 'بيان', nameEn: 'Bayan', order: 3 },
      ]
    },
    {
      name: 'الفروانية',
      nameEn: 'Farwaniya',
      order: 3,
      areas: [
        { name: 'إشبيلية', nameEn: 'Ishbilia', order: 1 },
        { name: 'خيطان', nameEn: 'Khaitan', order: 2 },
      ]
    }
  ],

  // أنواع الأنشطة الكبرى
  serviceTypes: [
    { code: 'CONS', name: 'استشارات هندسية', nameEn: 'Engineering Consulting', moduleScope: 'technical', color: '#f57c00', order: 1 },
    { code: 'CONTRACT', name: 'مقاولات عامة', nameEn: 'General Contracting', moduleScope: 'technical', color: '#1976d2', order: 2 },
    { code: 'INTERIOR', name: 'تصميم داخلي', nameEn: 'Interior Design', moduleScope: 'technical', color: '#7b1fa2', order: 3 },
  ],

  // المسارات الفنية النموذجية
  transactionTypes: [
    {
      code: 'MUN-DESIGN',
      name: 'تصميم وترخيص بلدية',
      nameEn: 'Municipality Design & Permit',
      serviceTypeCode: 'CONS',
      order: 1,
      subServices: [
        {
          code: 'ARCH-DSG',
          name: 'المخططات المعمارية',
          nameEn: 'Architectural Drawings',
          order: 1,
          isCore: true,
          isBillable: true,
          requiresTechnicalStages: true,
          stages: [
            { code: 'PRE-S', name: 'دراسة أولية', nameEn: 'Preliminary Study', order: 1, duration: 3, type: 'Internal' },
            { code: 'CON-D', name: 'تصميم المفهوم', nameEn: 'Concept Design', order: 2, duration: 7, type: 'ClientReview' },
            { code: 'FIN-D', name: 'المخططات النهائية', nameEn: 'Final Drawings', order: 3, duration: 5, type: 'Internal' },
          ]
        },
        {
          code: 'MUN-PRM',
          name: 'اعتماد البلدية',
          nameEn: 'Municipality Approval',
          order: 2,
          isCore: true,
          isBillable: true,
          requiresTechnicalStages: true,
          stages: [
            { code: 'FILE-O', name: 'فتح ملف', nameEn: 'File Opening', order: 1, duration: 2, type: 'Permit' },
            { code: 'ARCH-A', name: 'اعتماد المعماري', nameEn: 'Arch Approval', order: 2, duration: 14, type: 'Permit' },
            { code: 'STR-A', name: 'اعتماد الإنشائي', nameEn: 'Structural Approval', order: 3, duration: 10, type: 'Permit' },
          ]
        }
      ]
    }
  ]
};
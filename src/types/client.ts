import { BaseReference } from './reference';

export type ClientStatus = 'new' | 'prospective' | 'contracted' | 'inactive';

export interface Client extends BaseReference {
  fileNumber: string;         // رقم الملف (قابل للتسلسل)
  nameAr: string;             // الاسم بالعربي
  nameEn?: string;            // الاسم بالإنجليزي
  mobile: string;             // رقم الهاتف
  email?: string;             // البريد الإلكتروني
  civilId?: string;           // الرقم المدني
  governorateId?: string;     // معرف المحافظة
  governorateName?: string;   // اسم المحافظة
  areaId?: string;            // معرف المنطقة
  areaName?: string;          // اسم المنطقة
  block?: string;             // القطعة
  street?: string;            // الشارع
  houseNumber?: string;       // رقم المنزل
  locationUrl?: string;       // رابط Google Maps
  assignedEngineerId?: string;   // المهندس المسؤول
  assignedEngineerName?: string; // اسم المهندس المسؤول
  status: ClientStatus;       // حالة العميل (تدار آلياً)
  source?: string;            // مصدر العميل (إعلان، توصية، إلخ)
  notes?: string;             // ملاحظات عامة
  transactionCounter: number; // عداد المعاملات (يبدأ من 0)
  isActive: boolean;          // حالة التفعيل
  createdBy?: string;         // معرف منشئ السجل
  updatedBy?: string;         // معرف آخر من قام بالتحديث
  departmentId?: string;      // القسم المرجعي للسجل (لأغراض عزل البيانات)
}

export interface ClientHistory extends BaseReference {
  clientId: string;
  type: 'status_change' | 'note_added' | 'engineer_assigned' | 'system_log' | 'transaction_created' | 'visit_logged';
  content: string;            // وصف الحدث
  userId?: string;            // المستخدم الذي قام بالإجراء
  userName?: string;          // اسم المستخدم
}

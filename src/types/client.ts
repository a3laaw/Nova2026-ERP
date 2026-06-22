import { BaseReference } from './reference';

export type ClientStatus = 'new' | 'prospective' | 'contracted' | 'inactive';

export interface Client extends BaseReference {
  fileNumber: string;         // رقم الملف المحترف (مثل C-0001/2026)
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
  locationUrl?: string;       // رابط Google Maps المستخرج منه الإحداثيات
  assignedEngineerId?: string;   // المهندس المسؤول (اختياري عند التسجيل)
  assignedEngineerName?: string; 
  status: ClientStatus;       // حالة العميل (new -> prospective -> contracted)
  transactionCounter: number; // عداد المعاملات لإنشاء أرقام متسلسلة
  isActive: boolean;
  createdBy?: string;
  departmentId?: string;
}

export interface ClientHistory extends BaseReference {
  clientId: string;
  type: 'status_change' | 'note_added' | 'engineer_assigned' | 'system_log' | 'transaction_created' | 'visit_logged';
  content: string;            // وصف الحدث (رقم معاملة مهني بدلاً من ID تقني)
  userId?: string;            
  userName?: string;
}

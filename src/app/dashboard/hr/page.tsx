'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserCircle, FileText, ShieldAlert, Sparkles, UploadCloud, Loader2, CheckCircle } from "lucide-react";
import { analyzeEmployeeDoc } from "@/ai/flows/analyzeEmployeeDoc";
import { toast } from "@/hooks/use-toast";

export default function HRPage() {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  // سيمثل هذا محاكاة سريعة ومبسطة لرفع المستند بـ Base64 لخدمة الفلو الخاص بالمؤهلات والاقامات
  const triggerSimulatedAnalysis = async () => {
    setAnalyzing(true);
    try {
      // استخدام عينة نصية مشفرة لملف عقد افتراضي كـ Data URI
      const dummyDataUri = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/";
      const response = await analyzeEmployeeDoc({ documentDataUri: dummyDataUri });
      setResult(response);
      toast({
        title: "اكتمل التدقيق الهيكلي للمستند",
        description: "تم استخراج معلومات الموظف وملاحظات الامتثال القانوني.",
      });
    } catch (error) {
      toast({
        title: "فشل التحليل الذكي",
        description: "تعذر على نظام الرؤية الحاسوبية قراءة محتوى الملف.",
        variant: "destructive"
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8" dir="rtl">
      <div>
        <h1 className="text-3xl font-black font-headline text-right">إدارة الموارد البشرية والامتثال</h1>
        <p className="text-muted-foreground mt-1 text-right">فحص المستندات الرسمية، العقود الهندسية، والإقامات عبر الذكاء الاصطناعي</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="border-0 shadow-lg rounded-2xl bg-white lg:col-span-1">
          <CardHeader className="text-right">
            <CardTitle className="text-lg font-bold">بوابة المستندات والتعيين</CardTitle>
            <CardDescription>اسحب وأفلت عقد العمل أو شهادة المهندس الأجنبي هنا لتدقيق الهوية والامتثال للبلدية</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-muted rounded-2xl p-8 text-center bg-muted/10 hover:bg-muted/20 transition-all cursor-pointer group">
              <UploadCloud className="h-12 w-12 text-muted-foreground mx-auto group-hover:scale-110 transition-transform mb-4" />
              <p className="text-sm font-bold">اضغط هنا لمحاكاة رفع عقد أو بطاقة مدنية</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPEG (بحد أقصى 5 ميجابايت)</p>
            </div>

            <Button
              onClick={triggerSimulatedAnalysis}
              disabled={analyzing}
              className="w-full bg-primary text-white font-bold py-6 rounded-xl shadow-md"
            >
              {analyzing ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري المسح وقراءة البيانات...
                </>
              ) : (
                <>
                  <Sparkles className="ml-2 h-4 w-4" />
                  تحليل المستند فورياً بالذكاء الاصطناعي
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg rounded-2xl bg-white lg:col-span-2 overflow-hidden">
          <CardHeader className="bg-secondary/40 border-b p-6 text-right">
            <CardTitle className="text-lg font-bold flex items-center gap-2 flex-row-reverse"><UserCircle className="text-primary h-5 w-5" /> بيانات الامتثال المستخرجة من الملف</CardTitle>
            <CardDescription>مستخرجة مباشرة من الكود البصري للمستندات والملفات المرفوعة</CardDescription>
          </CardHeader>
          <CardContent className="p-6 text-right">
            {result ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-muted/40 rounded-xl">
                    <span className="text-xs text-muted-foreground">اسم الموظف المستخرج:</span>
                    <p className="font-bold text-sm text-secondary-foreground mt-0.5">{result.employeeName || "أحمد محمود حسن (مهندس موقع)"}</p>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-xl">
                    <span className="text-xs text-muted-foreground">نوع المستند:</span>
                    <p className="font-bold text-sm text-primary mt-0.5">{result.documentType || "عقد عمل محدد المدة"}</p>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-xl">
                    <span className="text-xs text-muted-foreground">رقم الوثيقة / القيد الإنشائي:</span>
                    <p className="font-mono text-sm font-bold mt-0.5">{result.documentNumber || "9483021948"}</p>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-xl">
                    <span className="text-xs text-muted-foreground">الجهة المصدرة للشهادة:</span>
                    <p className="font-bold text-sm text-secondary-foreground mt-0.5">{result.issuer || "جمعية المهندسين الكويتية"}</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border bg-amber-50/50 space-y-2">
                  <div className="flex items-center gap-1.5 flex-row-reverse font-bold text-sm text-amber-800">
                    <ShieldAlert className="h-4 w-4" />
                    <h6>ملاحظات وتوجيهات الامتثال والقوانين المحلية (AI)</h6>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    {result.complianceNotes || "المستند مستوفي لجميع شروط الفحص القانوني المبدئي، يرجى مطابقة الشهادة مع الهيئة العامة للقوى العاملة وتدقيق تاريخ انتهاء الإقامة لمنع الغرامات التشغيلية."}
                  </p>
                </div>

                {result.summary && (
                  <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 text-xs leading-relaxed text-blue-900">
                    <strong>ملخص محتوى المستند الكلي:</strong> {result.summary}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground space-y-2">
                <FileText className="h-12 w-12 mx-auto opacity-30" />
                <p className="text-sm">لم يتم تحليل أي وثيقة موظف حتى الآن.</p>
                <p className="text-xs">اضغط على زر التحليل لمحاكاة عمل النظام واستخراج البيانات.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

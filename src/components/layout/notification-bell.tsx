"use client"

import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/context/language-context"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function NotificationBell() {
  const { t, tSafe } = useLanguage();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-primary transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-destructive" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="bg-muted p-4 border-b">
          <h4 className="text-sm font-bold font-headline">{tSafe('inline.intelligence.notifications', 'إشعارات الذكاء الاصطناعي', 'Intelligence Notifications')}</h4>
          <p className="text-xs text-muted-foreground">{tSafe('inline.notification.desc', 'لديك 3 تحديثات غير مقروءة من مسار العمليات.', 'You have 3 unread updates from the operational pipeline.')}</p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {[
            { title: tSafe('inline.notif.grn', 'تم إنشاء سند استلام جديد', 'New GRN Generated'), time: tSafe('inline.time.5m', 'قبل 5 دقائق', '5m ago'), desc: tSafe('inline.notif.grn.desc', 'استلم المخزن أصنافاً للمشروع س', 'Warehouse received items for Project X'), color: "text-primary" },
            { title: tSafe('inline.notif.ai', 'تحليل عرض السعر بالذكاء الاصطناعي جاهز', 'AI Quote Analysis Ready'), time: tSafe('inline.time.1h', 'قبل ساعة', '1h ago'), desc: tSafe('inline.notif.ai.desc', 'المورد ب يقدم سعراً أقل بنسبة 12%', 'Supplier B offers 12% lower price'), color: "text-primary" },
            { title: tSafe('inline.notif.payment', 'تنبيه استحقاق دفعة', 'Payment Due Warning'), time: tSafe('inline.time.2h', 'قبل ساعتين', '2h ago'), desc: tSafe('inline.notif.payment.desc', 'الفاتورة رقم 4232 متأخرة عن موعد الاستحقاق', 'Invoice #4232 is past due date'), color: "text-destructive" },
          ].map((notif, i) => (
            <div key={i} className="p-4 border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors">
              <div className="flex justify-between items-start mb-1">
                <span className={`text-xs font-bold ${notif.color}`}>{notif.title}</span>
                <span className="text-[10px] text-muted-foreground">{notif.time}</span>
              </div>
              <p className="text-xs text-muted-foreground">{notif.desc}</p>
            </div>
          ))}
        </div>
        <Button variant="ghost" className="w-full text-xs py-2 h-auto text-primary rounded-none">{tSafe('inline.view.all.notifications', 'عرض كافة الإشعارات', 'View All Notifications')}</Button>
      </PopoverContent>
    </Popover>
  )
}
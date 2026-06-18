
"use client"

import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function NotificationBell() {
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
          <h4 className="text-sm font-bold font-headline">Intelligence Notifications</h4>
          <p className="text-xs text-muted-foreground">You have 3 unread updates from the operational pipeline.</p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {[
            { title: "New GRN Generated", time: "5m ago", desc: "Warehouse received items for Project X", color: "text-primary" },
            { title: "AI Quote Analysis Ready", time: "1h ago", desc: "Supplier B offers 12% lower price", color: "text-primary" },
            { title: "Payment Due Warning", time: "2h ago", desc: "Invoice #4232 is past due date", color: "text-destructive" },
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
        <Button variant="ghost" className="w-full text-xs py-2 h-auto text-primary rounded-none">View All Notifications</Button>
      </PopoverContent>
    </Popover>
  )
}

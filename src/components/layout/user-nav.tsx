
"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/context/language-context"
import { useAuthContext } from "@/context/auth-context"
import { usePermissions } from "@/hooks/use-permissions"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function UserNav() {
  const { t, lang } = useLanguage();
  const { user, globalUser, roleData, logout } = useAuthContext();
  const { isAdmin } = usePermissions();
  const router = useRouter();
  const isRtl = lang === 'ar';

  // استخراج المسمى الوظيفي الفعلي من بيانات الدور أو السجل العالمي
  const roleDisplay = roleData 
    ? (isRtl ? roleData.name : roleData.nameEn) 
    : (globalUser?.role || 'User');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full ring-2 ring-primary/20 ring-offset-2 ring-offset-background hover:ring-primary/40 transition-all">
          <Avatar className="h-8 w-8">
            <AvatarImage src={`https://picsum.photos/seed/${user?.uid}/40/40`} alt="User" />
            <AvatarFallback>{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 rounded-2xl border-2 shadow-2xl" align={isRtl ? 'start' : 'end'} forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className={cn("flex flex-col space-y-1", isRtl ? 'text-right' : 'text-left')}>
            <p className="text-sm font-black font-headline leading-none text-slate-900">{roleDisplay}</p>
            <p className="text-[10px] leading-none text-muted-foreground font-mono mt-1">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/dashboard/settings/profile')} className={cn("cursor-pointer font-bold", isRtl ? 'flex-row-reverse' : '')}>
            {t('profile')}
          </DropdownMenuItem>
          
          {/* إظهار الإعدادات والفوترة فقط للمدير (Admin) لضمان الاحترافية */}
          {isAdmin && (
            <>
              <DropdownMenuItem onClick={() => router.push('/dashboard/settings')} className={cn("cursor-pointer font-bold", isRtl ? 'flex-row-reverse' : '')}>
                {t('settings')}
              </DropdownMenuItem>
              <DropdownMenuItem className={cn("cursor-pointer font-bold", isRtl ? 'flex-row-reverse' : '')}>
                {t('billing')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className={cn("text-destructive font-black cursor-pointer", isRtl ? 'flex-row-reverse' : '')}>
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

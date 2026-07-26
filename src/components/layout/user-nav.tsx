
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

  // استخراج الاسم السيادي المعتمد
  const displayName = globalUser?.fullName || user?.displayName || 'User';

  // استخراج المسمى الوظيفي الفعلي
  const roleDisplay = roleData 
    ? (isRtl ? roleData.name : roleData.nameEn) 
    : (globalUser?.role || 'User');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-2 ring-primary/20 ring-offset-2 ring-offset-background hover:ring-primary/40 transition-all">
          <Avatar className="h-9 w-9 rounded-full overflow-hidden border">
            <AvatarImage src={globalUser?.photoUrl || `https://picsum.photos/seed/${user?.uid}/40/40`} alt="User" />
            <AvatarFallback className="bg-primary/10 text-primary font-black">{displayName.charAt(0)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 rounded-[1.5rem] border-2 shadow-3xl bg-white p-2" align={isRtl ? 'start' : 'end'} forceMount>
        <DropdownMenuLabel className="font-normal p-4">
          <div className={cn("flex flex-col space-y-1", isRtl ? 'text-right' : 'text-left')}>
            <p className="text-base font-black font-headline leading-none text-slate-900">{displayName}</p>
            <div className="flex items-center gap-2 mt-2">
               <Badge className="bg-primary/5 text-primary border-primary/20 text-[8px] font-black h-4 px-2 uppercase">{roleDisplay}</Badge>
               <p className="text-[9px] leading-none text-muted-foreground font-mono truncate max-w-[120px]">
                 {user?.email}
               </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-100" />
        <DropdownMenuGroup className="p-1">
          <DropdownMenuItem onClick={() => router.push('/dashboard/settings/profile')} className={cn("cursor-pointer font-black text-xs py-3 rounded-xl hover:bg-slate-50 transition-all", isRtl ? 'flex-row-reverse' : '')}>
            {t('profile')}
          </DropdownMenuItem>
          
          {isAdmin && (
            <>
              <DropdownMenuItem onClick={() => router.push('/dashboard/settings')} className={cn("cursor-pointer font-black text-xs py-3 rounded-xl hover:bg-slate-50 transition-all", isRtl ? 'flex-row-reverse' : '')}>
                {t('settings')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-slate-100" />
        <DropdownMenuItem onClick={logout} className={cn("text-rose-600 font-black cursor-pointer py-3 rounded-xl hover:bg-rose-50 transition-all", isRtl ? 'flex-row-reverse' : '')}>
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

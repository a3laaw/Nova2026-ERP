"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/context/language-context"
import { useAuthContext } from "@/context/auth-context"
import { cn } from "@/lib/utils"
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
  const { user, logout } = useAuthContext();

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
      <DropdownMenuContent className="w-56" align={lang === 'ar' ? 'start' : 'end'} forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className={cn("flex flex-col space-y-1", lang === 'ar' ? 'text-right' : 'text-left')}>
            <p className="text-sm font-bold font-headline leading-none">Admin Executive</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className={lang === 'ar' ? 'flex-row-reverse' : ''}>
            {t('profile')}
          </DropdownMenuItem>
          <DropdownMenuItem className={lang === 'ar' ? 'flex-row-reverse' : ''}>
            {t('billing')}
          </DropdownMenuItem>
          <DropdownMenuItem className={lang === 'ar' ? 'flex-row-reverse' : ''}>
            {t('settings')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className={cn("text-destructive", lang === 'ar' ? 'flex-row-reverse' : '')}>
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

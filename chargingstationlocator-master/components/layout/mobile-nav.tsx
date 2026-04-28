'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from '@/components/ui/sheet';
import {
  Settings,
  LogOut,
  Menu,
  Battery,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  session: {
    user: {
      id: string;
      email: string;
      name: string;
      role: 'user' | 'admin';
    };
  };
  navigationItems: Array<{
    title: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNav({ session, navigationItems, isOpen, onOpenChange }: MobileNavProps) {
  const pathname = usePathname();

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  const NavItems = () => (
    <>
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onOpenChange(false)}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {item.title}
          </Link>
        );
      })}
    </>
  );

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="md:hidden"
          size="icon"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Battery className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">ChargeSense</span>
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex flex-col gap-4 mt-4">
          {/* Navigation Items */}
          <nav className="flex flex-col gap-2">
            <NavItems />
          </nav>

          {/* User Info and Actions */}
          <div className="mt-auto pt-4 border-t">
            <div className="flex flex-col gap-2">
              {/* User Info */}
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{session.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {session.user.email}
                </p>
                {session.user.role === 'admin' && (
                  <p className="text-xs text-muted-foreground capitalize">
                    Role: {session.user.role}
                  </p>
                )}
              </div>
              
              {/* Admin Panel Access */}
              {session.user.role === 'admin' && (
                <Button
                  variant="ghost"
                  className="justify-start"
                  asChild
                  onClick={() => onOpenChange(false)}
                >
                  <Link href="/admin/dashboard">
                    <Shield className="mr-2 h-4 w-4" />
                    Admin Panel
                  </Link>
                </Button>
              )}
              
              {/* Settings */}
              <Button
                variant="ghost"
                className="justify-start"
                asChild
                onClick={() => onOpenChange(false)}
              >
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </Button>
              
              {/* Sign Out */}
              <Button
                variant="ghost"
                className="justify-start text-destructive hover:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
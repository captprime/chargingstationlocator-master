'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    LayoutDashboard,
    MapPin,
    Battery,
} from 'lucide-react';
import { UserNav } from '@/components/layout/user-nav';
import { MobileNav } from '@/components/layout/mobile-nav';
import { cn } from '@/lib/utils';

const navigationItems = [
    { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { title: 'Battery', href: '/battery-dashboard', icon: Battery },
    { title: 'Stations', href: '/stations', icon: MapPin },
];

export function Navigation() {
    const { data: session, status } = useSession();
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Don't render navigation if not authenticated
    if (status === 'loading') {
        return null;
    }

    if (!session) {
        return null;
    }

    const NavItems = ({ mobile = false }: { mobile?: boolean }) => (
        <>
            {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={mobile ? () => setIsMobileMenuOpen(false) : undefined}
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
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center px-4">
                {/* Logo and Brand */}
                <div className="flex items-center">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                            <Battery className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <span className="font-semibold">ChargeSense</span>
                    </Link>
                </div>

                {/* Desktop Navigation - Centered */}
                <nav className="hidden md:flex items-center gap-1 flex-1 justify-center max-w-md mx-auto">
                    <NavItems />
                </nav>

                {/* User Menu and Mobile Navigation */}
                <div className="flex items-center gap-4">
                    {/* User Dropdown */}
                    <UserNav session={session} />

                    {/* Mobile Menu */}
                    <MobileNav
                        session={session}
                        navigationItems={navigationItems}
                        isOpen={isMobileMenuOpen}
                        onOpenChange={setIsMobileMenuOpen}
                    />
                </div>
            </div>
        </header>
    );
}
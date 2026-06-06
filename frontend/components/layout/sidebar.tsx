'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '../../stores/auth.store';
import type { UserRole } from '../../types/auth';

interface NavItem {
  label: string;
  href: string;
  roles: UserRole[];
}

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/', roles: ['ADMIN', 'MANAGER', 'STAFF', 'WAREHOUSE'] },
  { label: 'Đơn nhập', href: '/purchase-orders', roles: ['ADMIN', 'MANAGER', 'STAFF'] },
  { label: 'Đơn xuất', href: '/sales-orders', roles: ['ADMIN', 'MANAGER', 'STAFF'] },
  { label: 'Nhập kho', href: '/goods-receipts', roles: ['ADMIN', 'WAREHOUSE'] },
  { label: 'Xuất kho', href: '/delivery-orders', roles: ['ADMIN', 'WAREHOUSE'] },
  { label: 'Tồn kho', href: '/inventory', roles: ['ADMIN', 'MANAGER', 'STAFF', 'WAREHOUSE'] },
  { label: 'Báo cáo', href: '/reports', roles: ['ADMIN', 'MANAGER'] },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Người dùng', href: '/admin/users', roles: ['ADMIN'] },
  { label: 'Kho hàng', href: '/admin/warehouses', roles: ['ADMIN'] },
  { label: 'Sản phẩm', href: '/admin/products', roles: ['ADMIN'] },
  { label: 'Đối tác', href: '/admin/partners', roles: ['ADMIN'] },
  { label: 'Tiền tệ & Tỷ giá', href: '/admin/currencies', roles: ['ADMIN'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  if (!user) return null;

  const visibleNav = NAV.filter((n) => n.roles.includes(user.role));
  const visibleAdmin = ADMIN_NAV.filter((n) => n.roles.includes(user.role));

  const linkClass = (href: string) =>
    `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      pathname === href || pathname.startsWith(href + '/')
        ? 'bg-blue-700 text-white'
        : 'text-blue-100 hover:bg-blue-700 hover:text-white'
    }`;

  return (
    <aside className="w-60 min-h-screen bg-blue-900 flex flex-col shrink-0">
      <div className="p-4 border-b border-blue-800">
        <span className="text-white font-bold text-lg">Eureka ERP</span>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleNav.map((n) => (
          <Link key={n.href} href={n.href} className={linkClass(n.href)}>
            {n.label}
          </Link>
        ))}

        {visibleAdmin.length > 0 && (
          <>
            <div className="pt-4 pb-1 px-3 text-xs font-semibold text-blue-400 uppercase tracking-wider">
              Quản trị
            </div>
            {visibleAdmin.map((n) => (
              <Link key={n.href} href={n.href} className={linkClass(n.href)}>
                {n.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-blue-800">
        <div className="text-blue-200 text-xs mb-1">{user.name}</div>
        <div className="text-blue-400 text-xs mb-3">{user.role}</div>
        <button
          onClick={() => logout()}
          className="w-full text-left text-blue-300 hover:text-white text-sm py-1"
        >
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}

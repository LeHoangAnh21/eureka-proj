'use client';
import Link from 'next/link';
import { AuthGuard } from '../../../components/layout/auth-guard';

export default function GoodsReceiptsPage() {
  return (
    <AuthGuard allowedRoles={['ADMIN', 'MANAGER', 'STAFF', 'WAREHOUSE']}>
      <div className="p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Phiếu Nhập Kho</h1>
        <p className="text-gray-500 text-sm mb-4">Xem phiếu nhập qua Đơn nhập</p>
        <Link
          href="/purchase-orders"
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
        >
          ← Đi đến Đơn nhập
        </Link>
      </div>
    </AuthGuard>
  );
}

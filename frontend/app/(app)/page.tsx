'use client';
import { useState } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { api } from '../../lib/api';

interface SeedResult {
  warehouses: number;
  partners: number;
  products: number;
  currencies: number;
  exchangeRates: number;
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);
  const [seedError, setSeedError] = useState('');

  const handleSeedDemo = async () => {
    setSeeding(true);
    setSeedResult(null);
    setSeedError('');
    try {
      const res = await api.post<SeedResult>('/admin/seed-demo', {});
      setSeedResult(res);
    } catch (e) {
      setSeedError(e instanceof Error ? e.message : 'Lỗi import');
    } finally {
      setSeeding(false);
    }
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Chào mừng, {user?.name}</h1>
      <p className="text-gray-500 text-sm mb-8">Role: {user?.role}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Đơn nhập', desc: 'Quản lý PO & nhập kho', href: '/purchase-orders' },
          { label: 'Đơn xuất', desc: 'Quản lý SO & xuất kho', href: '/sales-orders' },
          { label: 'Tồn kho', desc: 'Xem số lượng hiện tại', href: '/inventory' },
          { label: 'Báo cáo', desc: 'Thống kê theo kỳ', href: '/reports' },
        ].map((card) => (
          <a
            key={card.href}
            href={card.href}
            className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="font-semibold text-gray-800 mb-1">{card.label}</div>
            <div className="text-sm text-gray-500">{card.desc}</div>
          </a>
        ))}
      </div>

      {isAdmin && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Dữ liệu demo</h2>
          <p className="text-xs text-gray-400 mb-4">
            Import nhanh: 3 kho, 7 đối tác (NCC + KH), 10 sản phẩm, tiền tệ USD/EUR/CNY kèm tỷ giá.
            Bỏ qua các mục đã tồn tại.
          </p>

          <button
            onClick={handleSeedDemo}
            disabled={seeding}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
          >
            {seeding ? 'Đang import...' : 'Import mock data'}
          </button>

          {seedResult && (
            <div className="mt-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              ✓ Đã import —
              Kho: <strong>{seedResult.warehouses}</strong>,
              Đối tác: <strong>{seedResult.partners}</strong>,
              Sản phẩm: <strong>{seedResult.products}</strong>,
              Tiền tệ: <strong>{seedResult.currencies}</strong>,
              Tỷ giá: <strong>{seedResult.exchangeRates}</strong>
              {' '}(0 = đã tồn tại, bỏ qua)
            </div>
          )}

          {seedError && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {seedError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

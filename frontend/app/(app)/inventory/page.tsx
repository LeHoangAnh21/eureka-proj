'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../../../lib/api';
import { AuthGuard } from '../../../components/layout/auth-guard';

interface Warehouse { id: string; name: string; code: string; }

interface StockItem {
  productCode: string;
  productName: string;
  unit: string;
  warehouseName: string;
  balance: number;
}

export default function InventoryPage() {
  return (
    <AuthGuard allowedRoles={['ADMIN', 'MANAGER', 'STAFF', 'WAREHOUSE']}>
      <PageContent />
    </AuthGuard>
  );
}

function PageContent() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (warehouseId) params.set('warehouseId', warehouseId);
      if (productSearch) params.set('search', productSearch);
      const data = await api.get<StockItem[]>(`/inventory/stock${params.toString() ? `?${params}` : ''}`);
      setStock(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [warehouseId, productSearch]);

  useEffect(() => {
    api.get<Warehouse[]>('/warehouses').then((data) => setWarehouses(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const visibleStock = stock.filter((s) => s.balance > 0);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Tồn Kho</h1>
        <p className="text-sm text-gray-500 mt-0.5">Số lượng hàng hoá hiện có trong kho</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm min-w-[180px]"
        >
          <option value="">Tất cả kho</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <input
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          placeholder="Tìm theo mã hoặc tên sản phẩm..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          onClick={load}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
        >
          Tìm kiếm
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Đang tải...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Mã SP', 'Tên sản phẩm', 'ĐVT', 'Kho', 'Tồn kho'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleStock.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">Không có dữ liệu tồn kho</td></tr>
              ) : visibleStock.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{item.productCode}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{item.productName}</td>
                  <td className="px-4 py-3 text-gray-600">{item.unit}</td>
                  <td className="px-4 py-3 text-gray-600">{item.warehouseName}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{item.balance.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleStock.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
              Hiển thị {visibleStock.length} mục có tồn kho &gt; 0
            </div>
          )}
        </div>
      )}
    </div>
  );
}

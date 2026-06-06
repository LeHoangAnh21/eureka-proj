'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth.store';
import { AuthGuard } from '../../../components/layout/auth-guard';
import { Modal } from '../../../components/ui/modal';

interface Supplier { id: string; name: string; code: string; type: string; }
interface Warehouse { id: string; name: string; code: string; }
interface Currency { id: string; code: string; name: string; }
interface Product { id: string; code: string; name: string; unit: string; }

interface POLine {
  productId: string;
  orderedQty: number;
  unitPrice: number;
}

interface PurchaseOrder {
  id: string;
  code: string;
  supplier: { name: string };
  warehouse: { name: string };
  status: string;
  orderDate: string;
}

type POStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT:            { label: 'Nháp',         cls: 'bg-gray-100 text-gray-700' },
    PENDING_APPROVAL: { label: 'Chờ duyệt',    cls: 'bg-yellow-100 text-yellow-700' },
    APPROVED:         { label: 'Đã duyệt',     cls: 'bg-blue-100 text-blue-700' },
    PARTIAL:          { label: 'Nhập 1 phần',  cls: 'bg-orange-100 text-orange-700' },
    COMPLETED:        { label: 'Hoàn thành',   cls: 'bg-green-100 text-green-700' },
    CANCELLED:        { label: 'Đã huỷ',       cls: 'bg-red-100 text-red-700' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

export default function PurchaseOrdersPage() {
  return (
    <AuthGuard allowedRoles={['ADMIN', 'MANAGER', 'STAFF', 'WAREHOUSE']}>
      <PageContent />
    </AuthGuard>
  );
}

function PageContent() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<POLine[]>([{ productId: '', orderedQty: 1, unitPrice: 0 }]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data: PurchaseOrder[] }>('/purchase-orders');
      setOrders(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = async () => {
    setCreateOpen(true);
    setFormError('');
    setSupplierId(''); setWarehouseId(''); setCurrencyId('');
    setOrderDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setLines([{ productId: '', orderedQty: 1, unitPrice: 0 }]);
    try {
      const [s, w, c, p] = await Promise.all([
        api.get<{ data: Supplier[] }>('/partners?type=SUPPLIER&limit=200'),
        api.get<{ data: Warehouse[] }>('/warehouses?limit=200'),
        api.get<Currency[]>('/currencies'),
        api.get<{ data: Product[] }>('/products?limit=200'),
      ]);
      setSuppliers(s.data ?? []);
      setWarehouses(w.data ?? []);
      setCurrencies(Array.isArray(c) ? c : []);
      setProducts(p.data ?? []);
    } catch {
      // ignore — will show empty selects
    }
  };

  const addLine = () => setLines((prev) => [...prev, { productId: '', orderedQty: 1, unitPrice: 0 }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof POLine, value: string | number) => {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await api.post('/purchase-orders', {
        supplierId, warehouseId, currencyId,
        orderDate, notes,
        lines: lines.map((l) => ({
          productId: l.productId,
          orderedQty: Number(l.orderedQty),
          unitPrice: Number(l.unitPrice),
        })),
      });
      setCreateOpen(false);
      load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Lỗi tạo đơn');
    } finally {
      setSubmitting(false);
    }
  };

  const canCreate = user && ['ADMIN', 'MANAGER', 'STAFF'].includes(user.role);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Đơn Nhập Hàng</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quản lý Purchase Orders</p>
        </div>
        {canCreate && (
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg cursor-pointer"
          >
            + Tạo đơn nhập
          </button>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Đang tải...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Mã đơn', 'Nhà cung cấp', 'Kho', 'Trạng thái', 'Ngày đặt', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">Chưa có đơn nhập nào</td></tr>
              ) : orders.map((o) => (
                <tr
                  key={o.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/purchase-orders/${o.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-blue-700">{o.code}</td>
                  <td className="px-4 py-3 text-gray-700">{o.supplier?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{o.warehouse?.name ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{o.orderDate ? o.orderDate.slice(0, 10) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="text-blue-600 hover:underline text-xs"
                      onClick={(e) => { e.stopPropagation(); router.push(`/purchase-orders/${o.id}`); }}
                    >Chi tiết</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo đơn nhập hàng" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nhà cung cấp <span className="text-red-500">*</span></label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">-- Chọn nhà cung cấp --</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {suppliers.length === 0 && (
                <p className="text-xs text-orange-500 mt-1">
                  Chưa có nhà cung cấp.{' '}
                  <a href="/admin/partners" className="underline hover:text-orange-700">Thêm đối tác tại đây</a>
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kho nhập <span className="text-red-500">*</span></label>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">-- Chọn kho --</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tiền tệ <span className="text-red-500">*</span></label>
              <select value={currencyId} onChange={(e) => setCurrencyId(e.target.value)} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">-- Chọn tiền tệ --</option>
                {currencies.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày đặt <span className="text-red-500">*</span></label>
              <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Danh sách sản phẩm</span>
              <button type="button" onClick={addLine}
                className="text-xs text-blue-600 hover:underline">+ Thêm dòng</button>
            </div>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-[1fr,auto,auto,auto] gap-2 items-center">
                  <select value={line.productId} onChange={(e) => updateLine(i, 'productId', e.target.value)} required
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
                    <option value="">-- Sản phẩm --</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                  </select>
                  <input type="number" min={1} value={line.orderedQty}
                    onChange={(e) => updateLine(i, 'orderedQty', e.target.value)}
                    placeholder="Số lượng" required
                    className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                  <input type="number" min={0} step="0.01" value={line.unitPrice}
                    onChange={(e) => updateLine(i, 'unitPrice', e.target.value)}
                    placeholder="Đơn giá" required
                    className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                  <button type="button" onClick={() => removeLine(i)}
                    className="text-red-500 hover:text-red-700 text-lg leading-none px-1">×</button>
                </div>
              ))}
            </div>
          </div>

          {formError && <p className="text-red-500 text-sm">{formError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Hủy</button>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">
              {submitting ? 'Đang tạo...' : 'Tạo đơn'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

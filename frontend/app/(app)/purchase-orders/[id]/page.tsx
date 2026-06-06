'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useAuthStore } from '../../../../stores/auth.store';
import { AuthGuard } from '../../../../components/layout/auth-guard';
import { Modal } from '../../../../components/ui/modal';

interface POLine {
  id: string;
  product: { code: string; name: string; unit: string };
  orderedQty: number;
  receivedQty: number;
  unitPrice: number;
  lineTotal: number;
}

interface GRNLine {
  id: string;
  poLine: { id: string; product: { code: string; name: string }; orderedQty: number; receivedQty: number };
  receivedQty: number;
}

interface GoodsReceipt {
  id: string;
  code: string;
  status: string;
  receiptDate: string;
  lines: GRNLine[];
}

interface PurchaseOrderDetail {
  id: string;
  code: string;
  status: string;
  orderDate: string;
  expectedDate?: string;
  notes?: string;
  supplier: { name: string; code: string };
  warehouse: { name: string; code: string };
  currency: { code: string };
  lines: POLine[];
  goodsReceipts?: GoodsReceipt[];
}

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
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function GRNStatusBadge({ status }: { status: string }) {
  const cls = status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
  const label = status === 'CONFIRMED' ? 'Đã xác nhận' : 'Nháp';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

export default function PurchaseOrderDetailPage() {
  return (
    <AuthGuard allowedRoles={['ADMIN', 'MANAGER', 'STAFF', 'WAREHOUSE']}>
      <PageContent />
    </AuthGuard>
  );
}

function PageContent() {
  const params = useParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const id = params?.id as string;

  const [po, setPO] = useState<PurchaseOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // GRN create modal
  const [grnOpen, setGrnOpen] = useState(false);
  const [grnDate, setGrnDate] = useState('');
  const [grnLines, setGrnLines] = useState<{ poLineId: string; receivedQty: number }[]>([]);
  const [grnSubmitting, setGrnSubmitting] = useState(false);
  const [grnError, setGrnError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<PurchaseOrderDetail>(`/purchase-orders/${id}`);
      setPO(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (action: 'submit' | 'approve' | 'cancel') => {
    setActionError('');
    setActionLoading(true);
    try {
      await api.post(`/purchase-orders/${id}/${action}`, {});
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Lỗi thao tác');
    } finally {
      setActionLoading(false);
    }
  };

  const openGRN = () => {
    if (!po) return;
    setGrnDate(new Date().toISOString().slice(0, 10));
    setGrnLines(po.lines.map((l) => ({ poLineId: l.id, receivedQty: 0 })));
    setGrnError('');
    setGrnOpen(true);
  };

  const handleCreateGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    setGrnError('');
    setGrnSubmitting(true);
    try {
      await api.post(`/purchase-orders/${id}/goods-receipts`, {
        receiptDate: grnDate,
        lines: grnLines.filter((l) => l.receivedQty > 0).map((l) => ({
          poLineId: l.poLineId,
          receivedQty: Number(l.receivedQty),
        })),
      });
      setGrnOpen(false);
      load();
    } catch (e) {
      setGrnError(e instanceof Error ? e.message : 'Lỗi tạo phiếu nhập');
    } finally {
      setGrnSubmitting(false);
    }
  };

  const confirmGRN = async (grnId: string) => {
    setActionError('');
    setActionLoading(true);
    try {
      await api.post(`/purchase-orders/goods-receipts/${grnId}/confirm`, {});
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Lỗi xác nhận phiếu');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Đang tải...</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">{error}</div>
        <button onClick={() => router.push('/purchase-orders')} className="mt-4 text-blue-600 hover:underline text-sm">← Quay lại</button>
      </div>
    );
  }

  if (!po) return null;

  const role = user?.role;
  const canSubmit = po.status === 'DRAFT';
  const canApproveCancel = po.status === 'PENDING_APPROVAL' && (role === 'ADMIN' || role === 'MANAGER');
  const canCreateGRN = (po.status === 'APPROVED' || po.status === 'PARTIAL') && (role === 'ADMIN' || role === 'WAREHOUSE');
  const showGRNSection = ['APPROVED', 'PARTIAL', 'COMPLETED'].includes(po.status);

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => router.push('/purchase-orders')} className="text-sm text-blue-600 hover:underline mb-2 block">← Danh sách đơn nhập</button>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-3">
            {po.code}
            <StatusBadge status={po.status} />
          </h1>
        </div>
        <div className="flex gap-2">
          {canSubmit && (
            <button disabled={actionLoading} onClick={() => doAction('submit')}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg disabled:opacity-50">
              Gửi duyệt
            </button>
          )}
          {canApproveCancel && (
            <>
              <button disabled={actionLoading} onClick={() => doAction('approve')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                Duyệt
              </button>
              <button disabled={actionLoading} onClick={() => doAction('cancel')}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg disabled:opacity-50">
                Huỷ
              </button>
            </>
          )}
          {canCreateGRN && (
            <button onClick={openGRN}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg">
              + Tạo phiếu nhập
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{actionError}</div>
      )}

      {/* Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">Nhà cung cấp:</span> <span className="font-medium ml-1">{po.supplier?.name}</span></div>
        <div><span className="text-gray-500">Kho:</span> <span className="font-medium ml-1">{po.warehouse?.name}</span></div>
        <div><span className="text-gray-500">Tiền tệ:</span> <span className="font-medium ml-1">{po.currency?.code}</span></div>
        <div><span className="text-gray-500">Ngày đặt:</span> <span className="font-medium ml-1">{po.orderDate?.slice(0, 10)}</span></div>
        {po.notes && <div className="col-span-2"><span className="text-gray-500">Ghi chú:</span> <span className="ml-1">{po.notes}</span></div>}
      </div>

      {/* Lines */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200 font-semibold text-gray-800 text-sm">Danh sách sản phẩm</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Sản phẩm', 'ĐVT', 'SL đặt', 'SL nhận', 'Đơn giá', 'Thành tiền'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {po.lines.map((line) => (
              <tr key={line.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800">{line.product.name}</div>
                  <div className="text-xs text-gray-500">{line.product.code}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{line.product.unit}</td>
                <td className="px-4 py-3 text-gray-800">{line.orderedQty.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-800">{line.receivedQty.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-800">{line.unitPrice.toLocaleString()}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{line.lineTotal.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* GRN Section */}
      {showGRNSection && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 font-semibold text-gray-800 text-sm">Phiếu nhập kho</div>
          {!po.goodsReceipts || po.goodsReceipts.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">Chưa có phiếu nhập nào</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {po.goodsReceipts.map((grn) => (
                <div key={grn.id} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-800">{grn.code}</span>
                      <GRNStatusBadge status={grn.status} />
                      <span className="text-sm text-gray-500">{grn.receiptDate?.slice(0, 10)}</span>
                    </div>
                    {grn.status === 'DRAFT' && (role === 'ADMIN' || role === 'WAREHOUSE') && (
                      <button onClick={() => confirmGRN(grn.id)} disabled={actionLoading}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg disabled:opacity-50">
                        Xác nhận
                      </button>
                    )}
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left pb-1">Sản phẩm</th>
                        <th className="text-right pb-1">SL nhận</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grn.lines.map((gl) => (
                        <tr key={gl.id}>
                          <td className="py-0.5 text-gray-700">{gl.poLine?.product?.name}</td>
                          <td className="py-0.5 text-right text-gray-800 font-medium">{gl.receivedQty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* GRN Create Modal */}
      <Modal open={grnOpen} onClose={() => setGrnOpen(false)} title="Tạo phiếu nhập kho" size="md">
        <form onSubmit={handleCreateGRN} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ngày nhập kho <span className="text-red-500">*</span>
            </label>
            <input type="date" value={grnDate} onChange={(e) => setGrnDate(e.target.value)} required
              className="w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Số lượng thực nhận</p>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Sản phẩm</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Đặt</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Đã nhận</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Còn lại</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Nhận lần này</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {po?.lines.map((line, i) => {
                    const remaining = Number(line.orderedQty) - Number(line.receivedQty);
                    return (
                      <tr key={line.id} className={remaining === 0 ? 'opacity-40' : ''}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{line.product.name}</div>
                          <div className="text-xs text-gray-400">{line.product.code}</div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">{Number(line.orderedQty).toLocaleString()}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{Number(line.receivedQty).toLocaleString()}</td>
                        <td className="px-4 py-3 text-center font-medium text-orange-600">{remaining.toLocaleString()}</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number" min={0} max={remaining}
                            value={grnLines[i]?.receivedQty ?? 0}
                            disabled={remaining === 0}
                            onChange={(e) => setGrnLines((prev) => prev.map((gl, idx) => idx === i ? { ...gl, receivedQty: Number(e.target.value) } : gl))}
                            className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {grnError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{grnError}</div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setGrnOpen(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">Hủy</button>
            <button type="submit" disabled={grnSubmitting}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">
              {grnSubmitting ? 'Đang tạo...' : 'Xác nhận tạo phiếu nhập'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

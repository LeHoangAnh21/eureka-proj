'use client';
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthGuard } from '../../../../components/layout/auth-guard';
import { DataTable } from '../../../../components/ui/data-table';
import { Pagination } from '../../../../components/ui/pagination';
import { Badge } from '../../../../components/ui/badge';
import { Modal } from '../../../../components/ui/modal';
import { api } from '../../../../lib/api';
import type { Partner, Paginated } from '../../../../types/master-data';

const TYPES = ['SUPPLIER', 'CUSTOMER', 'BOTH'] as const;

const schema = z.object({
  code: z.string().min(1, 'Bắt buộc'),
  name: z.string().min(2, 'Tối thiểu 2 ký tự'),
  type: z.enum(TYPES),
  taxCode: z.string().optional(),
  address: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const typeColors: Record<string, 'info' | 'success' | 'warning'> = {
  SUPPLIER: 'info', CUSTOMER: 'success', BOTH: 'warning',
};
const typeLabel: Record<string, string> = { SUPPLIER: 'NCC', CUSTOMER: 'KH', BOTH: 'Cả hai' };

export default function PartnersPage() {
  const [items, setItems] = useState<Partner[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editItem, setEditItem] = useState<Partner | null>(null);
  const [serverError, setServerError] = useState('');
  const [importResult, setImportResult] = useState('');

  const createForm = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { type: 'SUPPLIER' } });
  const editForm = useForm<Partial<FormValues>>({ resolver: zodResolver(schema.partial()) });
  const importRaw = useForm<{ raw: string }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (filterType) params.set('type', filterType);
      const res = await api.get<Paginated<Partner>>(`/partners?${params}`);
      setItems(res.data); setTotal(res.total);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [page, search, filterType]);

  useEffect(() => { load(); }, [load]);

  const onCreate = async (v: FormValues) => {
    setServerError('');
    try { await api.post('/partners', v); setCreateOpen(false); createForm.reset({ type: 'SUPPLIER' }); load(); }
    catch (e) { setServerError(e instanceof Error ? e.message : 'Lỗi'); }
  };

  const onEdit = async (v: Partial<FormValues>) => {
    if (!editItem) return;
    setServerError('');
    try { await api.patch(`/partners/${editItem.id}`, v); setEditItem(null); load(); }
    catch (e) { setServerError(e instanceof Error ? e.message : 'Lỗi'); }
  };

  const onImport = async (v: { raw: string }) => {
    setServerError(''); setImportResult('');
    try {
      const items = JSON.parse(v.raw) as FormValues[];
      const res = await api.post<{ status: string }[]>('/partners/import', { items });
      setImportResult(`${res.filter((r) => r.status === 'created').length} tạo mới, ${res.filter((r) => r.status === 'skipped').length} bỏ qua.`);
      load();
    } catch (e) { setServerError(e instanceof Error ? e.message : 'JSON không hợp lệ'); }
  };

  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Quản lý Đối tác</h1>
            <p className="text-sm text-gray-500 mt-0.5">Tổng: {total} đối tác</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setImportOpen(true); setImportResult(''); setServerError(''); importRaw.reset(); }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Import JSON</button>
            <button onClick={() => { setCreateOpen(true); setServerError(''); createForm.reset({ type: 'SUPPLIER' }); }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">+ Tạo mới</button>
          </div>
        </div>

        <div className="flex gap-2 mb-5">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo mã hoặc tên..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">Tất cả loại</option>
            {TYPES.map((t) => <option key={t} value={t}>{typeLabel[t]}</option>)}
          </select>
          <button onClick={() => { setPage(1); load(); }} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">Lọc</button>
        </div>

        <DataTable data={items} keyField="id" loading={loading} columns={[
          { key: 'code', header: 'Mã' },
          { key: 'name', header: 'Tên đối tác' },
          { key: 'type', header: 'Loại', render: (p) => <Badge variant={typeColors[p.type]}>{typeLabel[p.type]}</Badge> },
          { key: 'taxCode', header: 'MST', render: (p) => p.taxCode || '—' },
          { key: 'isActive', header: 'Trạng thái', render: (p) => <Badge variant={p.isActive ? 'success' : 'error'}>{p.isActive ? 'Hoạt động' : 'Vô hiệu'}</Badge> },
          { key: 'actions', header: '', render: (p) => (
            <button onClick={() => { setEditItem(p); setServerError(''); editForm.reset({ name: p.name, type: p.type, taxCode: p.taxCode, address: p.address ?? '' }); }}
              className="text-blue-600 hover:underline text-xs">Sửa</button>
          )},
        ]} />
        <Pagination page={page} limit={20} total={total} onChange={setPage} />

        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo đối tác mới" size="lg">
          <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mã</label>
                <input {...createForm.register('code')} placeholder="NCC-001" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                {createForm.formState.errors.code && <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.code.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại</label>
                <select {...createForm.register('type')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  {TYPES.map((t) => <option key={t} value={t}>{typeLabel[t]}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên đối tác</label>
              <input {...createForm.register('name')} placeholder="Công ty TNHH ABC" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              {createForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mã số thuế</label>
                <input {...createForm.register('taxCode')} placeholder="0123456789" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                <input {...createForm.register('address')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
            {serverError && <p className="text-red-500 text-sm">{serverError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Hủy</button>
              <button type="submit" disabled={createForm.formState.isSubmitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">
                {createForm.formState.isSubmitting ? 'Đang tạo...' : 'Tạo'}
              </button>
            </div>
          </form>
        </Modal>

        <Modal open={!!editItem} onClose={() => setEditItem(null)} title={`Sửa: ${editItem?.name}`} size="lg">
          <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên đối tác</label>
              <input {...editForm.register('name')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại</label>
                <select {...editForm.register('type')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  {TYPES.map((t) => <option key={t} value={t}>{typeLabel[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mã số thuế</label>
                <input {...editForm.register('taxCode')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
              <input {...editForm.register('address')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            {serverError && <p className="text-red-500 text-sm">{serverError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditItem(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Hủy</button>
              <button type="submit" disabled={editForm.formState.isSubmitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">Lưu</button>
            </div>
          </form>
        </Modal>

        <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import đối tác từ JSON" size="lg">
          <div className="mb-3 text-sm text-gray-600">Format: <code className="bg-gray-100 px-1 rounded text-xs">{`[{"code":"NCC-001","name":"...","type":"SUPPLIER"}]`}</code></div>
          <form onSubmit={importRaw.handleSubmit(onImport)} className="space-y-3">
            <textarea {...importRaw.register('raw')} rows={8} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
              placeholder={`[\n  {"code": "NCC-001", "name": "Công ty A", "type": "SUPPLIER"}\n]`} />
            {serverError && <p className="text-red-500 text-sm">{serverError}</p>}
            {importResult && <p className="text-green-600 text-sm font-medium">{importResult}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setImportOpen(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Đóng</button>
              <button type="submit" disabled={importRaw.formState.isSubmitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">
                {importRaw.formState.isSubmitting ? 'Đang import...' : 'Import'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AuthGuard>
  );
}

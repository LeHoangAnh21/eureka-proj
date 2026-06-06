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
import type { Warehouse, Paginated } from '../../../../types/master-data';

const createSchema = z.object({
  code: z.string().min(1, 'Bắt buộc').regex(/^[A-Z0-9_-]+$/, 'Chỉ dùng chữ in hoa, số, -_'),
  name: z.string().min(2, 'Tối thiểu 2 ký tự'),
});
type CreateForm = z.infer<typeof createSchema>;

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
});
type UpdateForm = z.infer<typeof updateSchema>;

const importSchema = z.object({ raw: z.string().min(1) });
type ImportForm = z.infer<typeof importSchema>;

export default function WarehousesPage() {
  const [items, setItems] = useState<Warehouse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editItem, setEditItem] = useState<Warehouse | null>(null);
  const [serverError, setServerError] = useState('');
  const [importResult, setImportResult] = useState<string>('');

  const createForm = useForm<CreateForm>({ resolver: zodResolver(createSchema) });
  const updateForm = useForm<UpdateForm>({ resolver: zodResolver(updateSchema) });
  const importForm = useForm<ImportForm>({ resolver: zodResolver(importSchema) });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const res = await api.get<Paginated<Warehouse>>(`/warehouses?${params}`);
      setItems(res.data);
      setTotal(res.total);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const onCreate = async (v: CreateForm) => {
    setServerError('');
    try { await api.post('/warehouses', v); setCreateOpen(false); createForm.reset(); load(); }
    catch (e) { setServerError(e instanceof Error ? e.message : 'Lỗi'); }
  };

  const onUpdate = async (v: UpdateForm) => {
    if (!editItem) return;
    setServerError('');
    try { await api.patch(`/warehouses/${editItem.id}`, v); setEditItem(null); load(); }
    catch (e) { setServerError(e instanceof Error ? e.message : 'Lỗi'); }
  };

  const onImport = async (v: ImportForm) => {
    setServerError('');
    setImportResult('');
    try {
      const items = JSON.parse(v.raw) as CreateForm[];
      const res = await api.post<{ status: string; code: string }[]>('/warehouses/import', { items });
      setImportResult(`Hoàn thành: ${res.filter((r) => r.status === 'created').length} tạo mới, ${res.filter((r) => r.status === 'skipped').length} bỏ qua.`);
      load();
    } catch (e) { setServerError(e instanceof Error ? e.message : 'JSON không hợp lệ'); }
  };

  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Quản lý Kho hàng</h1>
            <p className="text-sm text-gray-500 mt-0.5">Tổng: {total} kho</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setImportOpen(true); setImportResult(''); setServerError(''); importForm.reset(); }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">
              Import JSON
            </button>
            <button onClick={() => { setCreateOpen(true); setServerError(''); createForm.reset(); }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
              + Tạo mới
            </button>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }} className="flex gap-2 mb-5">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo mã hoặc tên..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <button type="submit" className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">Tìm kiếm</button>
        </form>

        <DataTable data={items} keyField="id" loading={loading} columns={[
          { key: 'code', header: 'Mã kho' },
          { key: 'name', header: 'Tên kho' },
          { key: 'isActive', header: 'Trạng thái', render: (w) => <Badge variant={w.isActive ? 'success' : 'error'}>{w.isActive ? 'Hoạt động' : 'Vô hiệu'}</Badge> },
          { key: 'actions', header: 'Thao tác', render: (w) => (
            <button onClick={() => { setEditItem(w); setServerError(''); updateForm.reset({ name: w.name, isActive: w.isActive }); }}
              className="text-blue-600 hover:underline text-xs">Sửa</button>
          )},
        ]} />
        <Pagination page={page} limit={20} total={total} onChange={setPage} />

        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo kho mới">
          <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mã kho (viết hoa)</label>
              <input {...createForm.register('code')} placeholder="WH-01" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase" />
              {createForm.formState.errors.code && <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.code.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên kho</label>
              <input {...createForm.register('name')} placeholder="Kho Hà Nội" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              {createForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.name.message}</p>}
            </div>
            {serverError && <p className="text-red-500 text-sm">{serverError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Hủy</button>
              <button type="submit" disabled={createForm.formState.isSubmitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {createForm.formState.isSubmitting ? 'Đang tạo...' : 'Tạo'}
              </button>
            </div>
          </form>
        </Modal>

        <Modal open={!!editItem} onClose={() => setEditItem(null)} title={`Sửa kho: ${editItem?.code}`}>
          <form onSubmit={updateForm.handleSubmit(onUpdate)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên kho</label>
              <input {...updateForm.register('name')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <input {...updateForm.register('isActive')} type="checkbox" id="wa" className="rounded" />
              <label htmlFor="wa" className="text-sm text-gray-700">Hoạt động</label>
            </div>
            {serverError && <p className="text-red-500 text-sm">{serverError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditItem(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Hủy</button>
              <button type="submit" disabled={updateForm.formState.isSubmitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">Lưu</button>
            </div>
          </form>
        </Modal>

        <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import kho từ JSON" size="lg">
          <div className="mb-3 text-sm text-gray-600">
            Paste JSON array với format: <code className="bg-gray-100 px-1 rounded text-xs">{`[{"code":"WH-01","name":"Kho HN"}]`}</code>
          </div>
          <form onSubmit={importForm.handleSubmit(onImport)} className="space-y-3">
            <textarea {...importForm.register('raw')} rows={8} placeholder={`[\n  {"code": "WH-01", "name": "Kho Hà Nội"},\n  {"code": "WH-02", "name": "Kho TP.HCM"}\n]`}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" />
            {serverError && <p className="text-red-500 text-sm">{serverError}</p>}
            {importResult && <p className="text-green-600 text-sm font-medium">{importResult}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setImportOpen(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Đóng</button>
              <button type="submit" disabled={importForm.formState.isSubmitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {importForm.formState.isSubmitting ? 'Đang import...' : 'Import'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AuthGuard>
  );
}

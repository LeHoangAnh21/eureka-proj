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
import type { Product, Paginated } from '../../../../types/master-data';

const schema = z.object({
  code: z.string().min(1, 'Bắt buộc'),
  name: z.string().min(2, 'Tối thiểu 2 ký tự'),
  unit: z.string().min(1, 'Bắt buộc'),
});
type FormValues = z.infer<typeof schema>;

const importSchema = z.object({ raw: z.string().min(1) });

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editItem, setEditItem] = useState<Product | null>(null);
  const [serverError, setServerError] = useState('');
  const [importResult, setImportResult] = useState('');

  const createForm = useForm<FormValues>({ resolver: zodResolver(schema) });
  const editForm = useForm<Partial<FormValues>>({ resolver: zodResolver(schema.partial()) });
  const importForm = useForm<{ raw: string }>({ resolver: zodResolver(importSchema) });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const res = await api.get<Paginated<Product>>(`/products?${params}`);
      setItems(res.data); setTotal(res.total);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const onCreate = async (v: FormValues) => {
    setServerError('');
    try { await api.post('/products', v); setCreateOpen(false); createForm.reset(); load(); }
    catch (e) { setServerError(e instanceof Error ? e.message : 'Lỗi'); }
  };

  const onEdit = async (v: Partial<FormValues>) => {
    if (!editItem) return;
    setServerError('');
    try { await api.patch(`/products/${editItem.id}`, v); setEditItem(null); load(); }
    catch (e) { setServerError(e instanceof Error ? e.message : 'Lỗi'); }
  };

  const onImport = async (v: { raw: string }) => {
    setServerError(''); setImportResult('');
    try {
      const items = JSON.parse(v.raw) as FormValues[];
      const res = await api.post<{ status: string }[]>('/products/import', { items });
      setImportResult(`${res.filter((r) => r.status === 'created').length} tạo mới, ${res.filter((r) => r.status === 'skipped').length} bỏ qua.`);
      load();
    } catch (e) { setServerError(e instanceof Error ? e.message : 'JSON không hợp lệ'); }
  };

  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Quản lý Sản phẩm (SKU)</h1>
            <p className="text-sm text-gray-500 mt-0.5">Tổng: {total} sản phẩm</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setImportOpen(true); setImportResult(''); setServerError(''); importForm.reset(); }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Import JSON</button>
            <button onClick={() => { setCreateOpen(true); setServerError(''); createForm.reset(); }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">+ Tạo mới</button>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }} className="flex gap-2 mb-5">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo mã hoặc tên..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <button type="submit" className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">Tìm kiếm</button>
        </form>

        <DataTable data={items} keyField="id" loading={loading} columns={[
          { key: 'code', header: 'Mã SP' },
          { key: 'name', header: 'Tên sản phẩm' },
          { key: 'unit', header: 'Đơn vị' },
          { key: 'isActive', header: 'Trạng thái', render: (p) => <Badge variant={p.isActive ? 'success' : 'error'}>{p.isActive ? 'Hoạt động' : 'Vô hiệu'}</Badge> },
          { key: 'actions', header: '', render: (p) => (
            <button onClick={() => { setEditItem(p); setServerError(''); editForm.reset({ code: p.code, name: p.name, unit: p.unit }); }}
              className="text-blue-600 hover:underline text-xs">Sửa</button>
          )},
        ]} />
        <Pagination page={page} limit={20} total={total} onChange={setPage} />

        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Thêm sản phẩm mới">
          <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-4">
            {([['code','Mã sản phẩm','SP-001'],['name','Tên sản phẩm','Gạo ST25'],['unit','Đơn vị','KG']] as [keyof FormValues, string, string][]).map(([k,l,p]) => (
              <div key={k}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                <input {...createForm.register(k)} placeholder={p} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                {createForm.formState.errors[k] && <p className="text-red-500 text-xs mt-1">{createForm.formState.errors[k]?.message}</p>}
              </div>
            ))}
            {serverError && <p className="text-red-500 text-sm">{serverError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Hủy</button>
              <button type="submit" disabled={createForm.formState.isSubmitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">
                {createForm.formState.isSubmitting ? 'Đang tạo...' : 'Tạo'}
              </button>
            </div>
          </form>
        </Modal>

        <Modal open={!!editItem} onClose={() => setEditItem(null)} title={`Sửa: ${editItem?.code}`}>
          <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4">
            {([['name','Tên sản phẩm'],['unit','Đơn vị']] as [string, string][]).map(([k,l]) => (
              <div key={k}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                <input {...editForm.register(k as keyof FormValues)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            ))}
            {serverError && <p className="text-red-500 text-sm">{serverError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditItem(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Hủy</button>
              <button type="submit" disabled={editForm.formState.isSubmitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">Lưu</button>
            </div>
          </form>
        </Modal>

        <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import sản phẩm từ JSON" size="lg">
          <div className="mb-3 text-sm text-gray-600">Format: <code className="bg-gray-100 px-1 rounded text-xs">{`[{"code":"SP-001","name":"Gạo ST25","unit":"KG"}]`}</code></div>
          <form onSubmit={importForm.handleSubmit(onImport)} className="space-y-3">
            <textarea {...importForm.register('raw')} rows={8} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
              placeholder={`[\n  {"code": "SP-001", "name": "Gạo ST25", "unit": "KG"}\n]`} />
            {serverError && <p className="text-red-500 text-sm">{serverError}</p>}
            {importResult && <p className="text-green-600 text-sm font-medium">{importResult}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setImportOpen(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Đóng</button>
              <button type="submit" disabled={importForm.formState.isSubmitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">
                {importForm.formState.isSubmitting ? 'Đang import...' : 'Import'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AuthGuard>
  );
}

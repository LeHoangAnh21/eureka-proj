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
import type { AuthUser } from '../../../../types/auth';
import type { Paginated } from '../../../../types/master-data';

const ROLES = ['ADMIN', 'MANAGER', 'STAFF', 'WAREHOUSE'] as const;

const createSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  name: z.string().min(2, 'Tối thiểu 2 ký tự'),
  password: z.string().min(6, 'Tối thiểu 6 ký tự'),
  role: z.enum(ROLES),
});
type CreateForm = z.infer<typeof createSchema>;

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(ROLES).optional(),
  password: z.string().min(6).optional().or(z.literal('')),
});
type UpdateForm = z.infer<typeof updateSchema>;

export default function UsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AuthUser | null>(null);
  const [serverError, setServerError] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importRaw, setImportRaw] = useState('');
  const [importResult, setImportResult] = useState('');
  const [importError, setImportError] = useState('');

  const createForm = useForm<CreateForm>({ resolver: zodResolver(createSchema), defaultValues: { role: 'STAFF' } });
  const updateForm = useForm<UpdateForm>({ resolver: zodResolver(updateSchema) });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const res = await api.get<Paginated<AuthUser>>(`/users?${params}`);
      setUsers(res.data);
      setTotal(res.total);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const onCreate = async (values: CreateForm) => {
    setServerError('');
    try {
      await api.post('/users', values);
      setCreateOpen(false);
      createForm.reset();
      load();
    } catch (e) { setServerError(e instanceof Error ? e.message : 'Lỗi'); }
  };

  const onUpdate = async (values: UpdateForm) => {
    if (!editUser) return;
    setServerError('');
    try {
      const payload: Record<string, unknown> = {};
      if (values.name) payload.name = values.name;
      if (values.role) payload.role = values.role;
      if (values.password) payload.password = values.password;
      await api.patch(`/users/${editUser.id}`, payload);
      setEditUser(null);
      load();
    } catch (e) { setServerError(e instanceof Error ? e.message : 'Lỗi'); }
  };

  const onImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(''); setImportResult('');
    try {
      const users = JSON.parse(importRaw) as unknown[];
      if (!Array.isArray(users)) throw new Error('Phải là mảng JSON');
      const res = await api.post<{ status: string }[]>('/users/import', users);
      const created = res.filter((r) => r.status === 'created').length;
      const skipped = res.filter((r) => r.status === 'skipped').length;
      setImportResult(`✓ Tạo mới: ${created}, Bỏ qua (đã tồn tại): ${skipped}`);
      load();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'JSON không hợp lệ');
    }
  };

  const toggleActive = async (user: AuthUser) => {
    const endpoint = user.isActive ? `/users/${user.id}/deactivate` : `/users/${user.id}/activate`;
    await api.patch(endpoint, {});
    load();
  };

  const roleColors: Record<string, 'info' | 'success' | 'warning' | 'error'> = {
    ADMIN: 'error', MANAGER: 'info', STAFF: 'success', WAREHOUSE: 'warning',
  };

  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Quản lý Người dùng</h1>
            <p className="text-sm text-gray-500 mt-0.5">Tổng: {total} tài khoản</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setImportOpen(true); setImportRaw(''); setImportResult(''); setImportError(''); }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg"
            >
              Import JSON
            </button>
            <button
              onClick={() => { setCreateOpen(true); setServerError(''); createForm.reset({ role: 'STAFF' }); }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
            >
              + Tạo mới
            </button>
          </div>
        </div>

        <form onSubmit={onSearch} className="flex gap-2 mb-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc email..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button type="submit" className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">
            Tìm kiếm
          </button>
        </form>

        <DataTable
          data={users}
          keyField="id"
          loading={loading}
          columns={[
            { key: 'name', header: 'Tên' },
            { key: 'email', header: 'Email' },
            { key: 'role', header: 'Role', render: (u) => <Badge variant={roleColors[u.role]}>{u.role}</Badge> },
            { key: 'isActive', header: 'Trạng thái', render: (u) => <Badge variant={u.isActive ? 'success' : 'error'}>{u.isActive ? 'Hoạt động' : 'Vô hiệu'}</Badge> },
            {
              key: 'actions', header: 'Thao tác', render: (u) => (
                <div className="flex gap-2">
                  <button onClick={() => { setEditUser(u); setServerError(''); updateForm.reset({ name: u.name, role: u.role }); }} className="text-blue-600 hover:underline text-xs">Sửa</button>
                  <button onClick={() => toggleActive(u)} className="text-gray-500 hover:underline text-xs">
                    {u.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                  </button>
                </div>
              ),
            },
          ]}
        />
        <Pagination page={page} limit={20} total={total} onChange={setPage} />

        {/* Create Modal */}
        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo người dùng mới">
          <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-4">
            {[
              { name: 'email' as const, label: 'Email', type: 'email', placeholder: 'user@example.com' },
              { name: 'name' as const, label: 'Họ tên', type: 'text', placeholder: 'Nguyen Van A' },
              { name: 'password' as const, label: 'Mật khẩu', type: 'password', placeholder: '••••••••' },
            ].map((f) => (
              <div key={f.name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                <input {...createForm.register(f.name)} type={f.type} placeholder={f.placeholder}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                {createForm.formState.errors[f.name] && (
                  <p className="text-red-500 text-xs mt-1">{createForm.formState.errors[f.name]?.message}</p>
                )}
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select {...createForm.register('role')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
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

        {/* Import Modal */}
        <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import người dùng từ JSON" size="lg">
          <form onSubmit={onImport} className="space-y-3">
            <p className="text-xs text-gray-500">Dán mảng JSON, mỗi phần tử gồm: email, name, password, role (ADMIN/MANAGER/STAFF/WAREHOUSE)</p>
            <pre className="text-xs bg-gray-50 border rounded p-2 text-gray-600 overflow-x-auto">{`[
  { "email": "manager@eureka.local", "name": "Nguyen Van A", "password": "Pass@123", "role": "MANAGER" }
]`}</pre>
            <textarea
              value={importRaw}
              onChange={(e) => setImportRaw(e.target.value)}
              rows={8}
              placeholder='[{"email":"...","name":"...","password":"...","role":"STAFF"}]'
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
              required
            />
            {importError && <p className="text-red-500 text-sm">{importError}</p>}
            {importResult && <p className="text-green-600 text-sm">{importResult}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setImportOpen(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Đóng</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Import</button>
            </div>
          </form>
        </Modal>

        {/* Edit Modal */}
        <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Sửa: ${editUser?.name}`}>
          <form onSubmit={updateForm.handleSubmit(onUpdate)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên</label>
              <input {...updateForm.register('name')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select {...updateForm.register('role')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới (để trống nếu không đổi)</label>
              <input {...updateForm.register('password')} type="password" placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            {serverError && <p className="text-red-500 text-sm">{serverError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditUser(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Hủy</button>
              <button type="submit" disabled={updateForm.formState.isSubmitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {updateForm.formState.isSubmitting ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AuthGuard>
  );
}

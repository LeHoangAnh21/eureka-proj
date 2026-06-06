'use client';
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthGuard } from '../../../../components/layout/auth-guard';
import { DataTable } from '../../../../components/ui/data-table';
import { Pagination } from '../../../../components/ui/pagination';
import { Modal } from '../../../../components/ui/modal';
import { api } from '../../../../lib/api';
import type { Currency, ExchangeRate, Paginated } from '../../../../types/master-data';

const currencySchema = z.object({
  code: z.string().regex(/^[A-Z]{3}$/, 'Phải là 3 chữ in hoa (VD: USD)'),
  name: z.string().min(2, 'Tối thiểu 2 ký tự'),
});
const rateSchema = z.object({
  currencyId: z.string().min(1, 'Chọn tiền tệ'),
  rate: z.coerce.number().positive('Phải > 0'),
  effectiveDate: z.string().min(1, 'Bắt buộc'),
});

type CurrencyForm = z.infer<typeof currencySchema>;
type RateForm = z.infer<typeof rateSchema>;

export default function CurrenciesPage() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [rateTotal, setRateTotal] = useState(0);
  const [ratePage, setRatePage] = useState(1);
  const [loadingC, setLoadingC] = useState(false);
  const [loadingR, setLoadingR] = useState(false);
  const [createCOpen, setCreateCOpen] = useState(false);
  const [createROpen, setCreateROpen] = useState(false);
  const [serverError, setServerError] = useState('');

  const cForm = useForm<CurrencyForm>({ resolver: zodResolver(currencySchema) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rForm = useForm<RateForm>({ resolver: zodResolver(rateSchema) as any, defaultValues: { effectiveDate: new Date().toISOString().slice(0, 10), rate: 0 } });

  const loadCurrencies = useCallback(async () => {
    setLoadingC(true);
    try { const res = await api.get<Currency[]>('/currencies'); setCurrencies(res); }
    catch { /* ignore */ } finally { setLoadingC(false); }
  }, []);

  const loadRates = useCallback(async () => {
    setLoadingR(true);
    try {
      const res = await api.get<Paginated<ExchangeRate>>(`/exchange-rates?page=${ratePage}&limit=20`);
      setRates(res.data); setRateTotal(res.total);
    } catch { /* ignore */ } finally { setLoadingR(false); }
  }, [ratePage]);

  useEffect(() => { loadCurrencies(); }, [loadCurrencies]);
  useEffect(() => { loadRates(); }, [loadRates]);

  const onCreateCurrency = async (v: CurrencyForm) => {
    setServerError('');
    try { await api.post('/currencies', v); setCreateCOpen(false); cForm.reset(); loadCurrencies(); }
    catch (e) { setServerError(e instanceof Error ? e.message : 'Lỗi'); }
  };

  const onCreateRate = async (v: RateForm) => {
    setServerError('');
    try { await api.post('/exchange-rates', v); setCreateROpen(false); rForm.reset({ effectiveDate: new Date().toISOString().slice(0, 10) }); loadRates(); }
    catch (e) { setServerError(e instanceof Error ? e.message : 'Lỗi'); }
  };

  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <div className="p-8 space-y-10">
        {/* Currencies */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">Tiền tệ</h1>
            <button onClick={() => { setCreateCOpen(true); setServerError(''); cForm.reset(); }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">+ Thêm tiền tệ</button>
          </div>
          <DataTable data={currencies} keyField="id" loading={loadingC} columns={[
            { key: 'code', header: 'Mã tiền tệ' },
            { key: 'name', header: 'Tên' },
          ]} />
        </section>

        {/* Exchange rates */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Lịch sử tỷ giá</h2>
            <button onClick={() => { setCreateROpen(true); setServerError(''); rForm.reset({ effectiveDate: new Date().toISOString().slice(0, 10) }); }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg">+ Thêm tỷ giá</button>
          </div>
          <DataTable data={rates} keyField="id" loading={loadingR} columns={[
            { key: 'currency', header: 'Tiền tệ', render: (r) => `${r.currency.code} — ${r.currency.name}` },
            { key: 'rate', header: 'Tỷ giá (VND)', render: (r) => Number(r.rate).toLocaleString('vi-VN') },
            { key: 'effectiveDate', header: 'Ngày hiệu lực', render: (r) => new Date(r.effectiveDate).toLocaleDateString('vi-VN') },
          ]} />
          <Pagination page={ratePage} limit={20} total={rateTotal} onChange={setRatePage} />
        </section>

        {/* Modal: Tạo tiền tệ */}
        <Modal open={createCOpen} onClose={() => setCreateCOpen(false)} title="Thêm loại tiền tệ">
          <form onSubmit={cForm.handleSubmit(onCreateCurrency)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mã tiền tệ (ISO 4217)</label>
              <input {...cForm.register('code')} placeholder="USD" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase" />
              {cForm.formState.errors.code && <p className="text-red-500 text-xs mt-1">{cForm.formState.errors.code.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên</label>
              <input {...cForm.register('name')} placeholder="US Dollar" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              {cForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{cForm.formState.errors.name.message}</p>}
            </div>
            {serverError && <p className="text-red-500 text-sm">{serverError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCreateCOpen(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Hủy</button>
              <button type="submit" disabled={cForm.formState.isSubmitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50">
                {cForm.formState.isSubmitting ? 'Đang thêm...' : 'Thêm'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Modal: Thêm tỷ giá */}
        <Modal open={createROpen} onClose={() => setCreateROpen(false)} title="Thêm tỷ giá mới">
          <form onSubmit={rForm.handleSubmit(onCreateRate)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tiền tệ</label>
              <select {...rForm.register('currencyId')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">— Chọn tiền tệ —</option>
                {currencies.filter((c) => c.code !== 'VND').map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
              {rForm.formState.errors.currencyId && <p className="text-red-500 text-xs mt-1">{rForm.formState.errors.currencyId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tỷ giá (1 ngoại tệ = ? VND)</label>
              <input {...rForm.register('rate')} type="number" step="0.000001" placeholder="25400" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              {rForm.formState.errors.rate && <p className="text-red-500 text-xs mt-1">{rForm.formState.errors.rate.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày hiệu lực</label>
              <input {...rForm.register('effectiveDate')} type="date" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              {rForm.formState.errors.effectiveDate && <p className="text-red-500 text-xs mt-1">{rForm.formState.errors.effectiveDate.message}</p>}
            </div>
            {serverError && <p className="text-red-500 text-sm">{serverError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCreateROpen(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Hủy</button>
              <button type="submit" disabled={rForm.formState.isSubmitting} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg disabled:opacity-50">
                {rForm.formState.isSubmitting ? 'Đang thêm...' : 'Thêm tỷ giá'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AuthGuard>
  );
}

'use client';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, limit, total, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
      <span>Hiển thị {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}</span>
      <div className="flex gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
        >
          ‹
        </button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`px-3 py-1 rounded border ${p === page ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold' : 'border-gray-300 hover:bg-gray-100'}`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
        >
          ›
        </button>
      </div>
    </div>
  );
}

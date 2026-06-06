# Eureka ERP

Hệ thống quản lý thương mại & xuất nhập khẩu nội bộ.

**Stack:** NestJS 11 · Prisma 7 · PostgreSQL · Next.js 16 · Tailwind CSS v4

---

## Yêu cầu

| Công cụ | Phiên bản |
|---------|-----------|
| Node.js | ≥ 20 |
| npm     | ≥ 10 |
| Docker  | ≥ 24 |

---

## Cài đặt & chạy

### 1. Clone và cài dependencies

```bash
git clone <repo-url>
cd eureka-test

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Khởi động PostgreSQL

```bash
cd backend
docker compose up -d
```

> Container tên `eureka_postgres`, port `5432`, database `eureka_db`.

### 3. Cấu hình môi trường

**Backend** — tạo file `backend/.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/eureka_db?schema=public"
PORT=3001
JWT_SECRET="eureka-dev-secret-change-in-production"
JWT_EXPIRES_IN="7d"
FRONTEND_URL="http://localhost:3000"
```

**Frontend** — tạo file `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 4. Migrate database

```bash
cd backend
npx prisma migrate deploy
```

### 5. Seed dữ liệu ban đầu

```bash
cd backend
npm run seed
```

Seed tạo:
- **Admin:** `admin@eureka.local` / `Admin@123`
- **Tiền tệ:** VND, USD

### 6. Chạy servers

Mở 2 terminal:

```bash
# Terminal 1 — Backend (port 3001)
cd backend
npm run start:dev

# Terminal 2 — Frontend (port 3000)
cd frontend
npm run dev
```

Truy cập: **http://localhost:3000**

---

## Tài khoản mặc định

| Email | Mật khẩu | Role |
|-------|-----------|------|
| `admin@eureka.local` | `Admin@123` | ADMIN |

---

## API Docs (Swagger)

Sau khi backend chạy: **http://localhost:3001/api/docs**

1. Gọi `POST /api/auth/login` với email/password
2. Copy `token` từ response
3. Click **Authorize** → dán token vào Bearer

---

## Cấu trúc thư mục

```
eureka-test/
├── backend/          # NestJS API
│   ├── prisma/       # Schema & migrations
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   └── src/
│       ├── auth/
│       ├── users/
│       ├── purchase-orders/
│       ├── sales-orders/
│       ├── inventory/
│       └── ...       # warehouses, partners, products, currencies
└── frontend/         # Next.js App Router
    └── app/
        ├── (app)/    # Trang cần đăng nhập
        │   ├── purchase-orders/
        │   ├── sales-orders/
        │   ├── inventory/
        │   └── admin/
        └── login/
```

---

## Roles & Quyền hạn

| Role | Quyền |
|------|-------|
| **ADMIN** | Toàn quyền, import master data |
| **MANAGER** | Tạo & duyệt đơn (không tự duyệt đơn mình tạo) |
| **STAFF** | Tạo đơn, xem báo cáo |
| **WAREHOUSE** | Xác nhận phiếu nhập/xuất kho |

---

## Luồng nghiệp vụ

### Đơn nhập (Purchase Order)
```
Tạo PO (DRAFT) → Gửi duyệt → Manager duyệt (APPROVED) → Warehouse tạo & xác nhận GRN → Tồn kho tăng
```

### Đơn xuất (Sales Order)
```
Tạo SO (DRAFT) → Gửi duyệt → Manager duyệt (APPROVED) → Warehouse tạo & xác nhận DO → Tồn kho giảm
```

---

## Lệnh hữu ích

```bash
# Xem DB qua giao diện (chạy trong thư mục backend)
npx prisma studio

# Reset DB và seed lại
npx prisma migrate reset
npm run seed

# Build production backend
npm run build

# Lint
npm run lint
```

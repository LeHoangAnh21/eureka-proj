# PLAN — Hệ thống Thương mại & Xuất nhập khẩu (v1)

> Phiên bản kế hoạch: 2026-06-06  
> Trạng thái: CHỜ DUYỆT — chưa viết code

---

## 1. Tổng quan & Phạm vi

### In-scope (bản này)

| # | Module |
|---|--------|
| 1 | Quản lý Role & Phân quyền (RBAC) |
| 2 | Đơn nhập — Purchase Order, Invoice NCC, Goods Receipt (nhập kho) |
| 3 | Đơn xuất — Sales Order, Delivery Order (xuất kho), Thu công nợ |
| 4 | Tồn kho — Inventory Ledger, Snapshot, Balance query |

### Out-of-scope (bản này — ghi nhận cho tương lai)

- Tính giá vốn / COGS / FIFO / AVCO
- Lãi-lỗ chênh lệch tỷ giá (FX gain/loss kế toán)
- Thuế & Hải quan chi tiết (chỉ ghi trạng thái, không tính)
- Hoàn thuế GTGT
- Tiền lương & nhân sự
- Báo cáo tài chính (P&L, Balance Sheet)

---

## 2. Stack Đề xuất

Stack tuân theo những gì đã có sẵn trong repo; không đổi ngôn ngữ hay framework.

### Backend — `backend/`

| Lớp | Công nghệ | Lý do |
|-----|-----------|-------|
| Runtime | Node.js + TypeScript | Đã có sẵn |
| Framework | NestJS 11 | Đã có sẵn; module hóa tốt, Guard/Interceptor phù hợp RBAC |
| ORM | Prisma 7 | Đã có sẵn; migration rõ ràng, type-safe |
| DB | PostgreSQL | Đã có sẵn; hỗ trợ transaction ACID, `DECIMAL`, row-level locking |
| Validation | class-validator + class-transformer | Đã có sẵn |
| Auth | JWT (access token) + HttpOnly cookie | `credentials: 'include'` ở FE gợi ý cookie; JWT stateless phù hợp |
| Decimal | Prisma `Decimal` → `decimal.js` | Đáp ứng R7 — không dùng float |

### Frontend — `frontend/`

| Lớp | Công nghệ | Lý do |
|-----|-----------|-------|
| Framework | Next.js 16 (App Router) | Đã có sẵn |
| Language | TypeScript | Đã có sẵn |
| Styling | Tailwind CSS v4 | Đã có sẵn |
| State | Zustand | Đã có sẵn |
| Form | React Hook Form + Zod | Đã có sẵn |
| HTTP | `lib/api.ts` (fetch wrapper) | Đã có sẵn |
| UI Components | shadcn/ui | `components/ui/` đã có thư mục; cần cài component; phụ thuộc **câu hỏi Q9** |

> **Lưu ý Next.js**: `AGENTS.md` cảnh báo phiên bản này có breaking changes so với phiên bản chuẩn. Khi triển khai phải đọc `node_modules/next/dist/docs/` trước khi viết code.

---

## 3. Mô hình Dữ liệu

### 3.1 Sơ đồ quan hệ tổng thể (text)

```
User ──────────────────────────────────────────────────────────────┐
 │ createdBy/approvedBy/confirmedBy                               │
 ▼                                                                  │
PurchaseOrder ──lines──► PurchaseOrderLine                         │
     │                        │                                     │
     ├──► PurchaseInvoice      │                                     │
     │                        │                                     │
     └──► GoodsReceipt ──lines──► GoodsReceiptLine                  │
               │ (confirm)         │                                 │
               └──────────────────┴──► InventoryMovement ◄──────────┘
                                            │
SalesOrder ────lines──► SalesOrderLine      │
     │                       │             │
     ├──► SalesPayment        │             │
     │                       │             │
     └──► DeliveryOrder ──lines──► DeliveryOrderLine                 │
               │ (confirm)         │                                 │
               └──────────────────┴──► InventoryMovement            │
                                            │
                                    InventorySnapshot
```

### 3.2 Bảng chi tiết

#### `users`
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid PK | |
| email | varchar unique | |
| password_hash | varchar | bcrypt |
| name | varchar | |
| role | enum(ADMIN, MANAGER, STAFF, WAREHOUSE) | |
| is_active | boolean default true | |
| created_at, updated_at | timestamptz | |

#### `audit_logs`
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid PK | |
| user_id | uuid FK users | ai thực hiện |
| action | varchar | VD: `PO_APPROVED`, `GRN_CONFIRMED`, `DO_REVERSED` |
| entity_type | varchar | VD: `PurchaseOrder` |
| entity_id | uuid | |
| old_value | jsonb nullable | snapshot trước thay đổi |
| new_value | jsonb nullable | snapshot sau thay đổi |
| reason | text nullable | bắt buộc với reversal |
| created_at | timestamptz | |

> `audit_logs` chỉ INSERT, không bao giờ UPDATE/DELETE (đáp ứng R10).

---

#### Master Data

**`warehouses`**
| Cột | Kiểu |
|-----|------|
| id | uuid PK |
| code | varchar unique |
| name | varchar |
| is_active | boolean |
| created_at, updated_at | timestamptz |

**`partners`** (Nhà cung cấp & Khách hàng)
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid PK | |
| code | varchar unique | |
| name | varchar | |
| type | enum(SUPPLIER, CUSTOMER, BOTH) | |
| tax_code | varchar nullable | |
| address | text nullable | |
| is_active | boolean | |
| created_at, updated_at | timestamptz | |

**`products`** (SKU)
| Cột | Kiểu |
|-----|------|
| id | uuid PK |
| code | varchar unique |
| name | varchar |
| unit | varchar |
| is_active | boolean |
| created_at, updated_at | timestamptz |

**`currencies`**
| Cột | Kiểu |
|-----|------|
| id | uuid PK |
| code | varchar(10) unique |
| name | varchar |

**`exchange_rates`**
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid PK | |
| currency_id | uuid FK currencies | |
| rate | decimal(20,6) | 1 ngoại tệ = rate VND |
| effective_date | date | |
| created_by | uuid FK users | |
| created_at | timestamptz | |

---

#### Module Nhập

**`purchase_orders`**
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid PK | |
| code | varchar unique | PO-YYYY-NNNNN, sequential |
| supplier_id | uuid FK partners | |
| warehouse_id | uuid FK warehouses | kho dự kiến nhập |
| currency_id | uuid FK currencies | |
| exchange_rate | decimal(20,6) nullable | chốt khi post (R6) |
| status | enum(DRAFT, PENDING_APPROVAL, APPROVED, PARTIAL, COMPLETED, CANCELLED) | |
| order_date | date | |
| expected_date | date nullable | |
| notes | text nullable | |
| created_by | uuid FK users | |
| approved_by | uuid FK users nullable | |
| approved_at | timestamptz nullable | |
| posted_at | timestamptz nullable | thời điểm chuyển APPROVED |
| created_at, updated_at | timestamptz | |

**`purchase_order_lines`**
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid PK | |
| purchase_order_id | uuid FK | |
| product_id | uuid FK products | |
| ordered_qty | decimal(20,4) | |
| received_qty | decimal(20,4) default 0 | cộng dồn từ GRN |
| unit_price | decimal(20,4) | nguyên tệ |
| unit_price_vnd | decimal(20,4) nullable | quy đổi khi post |
| line_total | decimal(20,4) | nguyên tệ |
| line_total_vnd | decimal(20,4) nullable | |

**`purchase_invoices`** (Invoice từ NCC)
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid PK | |
| purchase_order_id | uuid FK | |
| invoice_no | varchar | số hóa đơn NCC |
| invoice_date | date | |
| amount | decimal(20,4) | nguyên tệ |
| amount_vnd | decimal(20,4) | |
| payment_status | enum(UNPAID, PARTIAL, PAID) | |
| paid_amount | decimal(20,4) default 0 | |
| paid_amount_vnd | decimal(20,4) default 0 | |
| due_date | date nullable | |
| notes | text nullable | |
| created_by | uuid FK users | |
| created_at, updated_at | timestamptz | |

**`goods_receipts`** (Phiếu nhập kho — do Warehouse tạo & xác nhận)
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid PK | |
| code | varchar unique | GRN-YYYY-NNNNN |
| purchase_order_id | uuid FK | |
| warehouse_id | uuid FK | |
| receipt_date | date | |
| status | enum(DRAFT, CONFIRMED, REVERSED) | |
| reversal_of | uuid FK goods_receipts nullable | GRN gốc bị đảo |
| reversal_reason | text nullable | bắt buộc nếu là reversal |
| confirmed_by | uuid FK users nullable | |
| confirmed_at | timestamptz nullable | |
| notes | text nullable | |
| created_by | uuid FK users | |
| created_at, updated_at | timestamptz | |

**`goods_receipt_lines`**
| Cột | Kiểu |
|-----|------|
| id | uuid PK |
| goods_receipt_id | uuid FK |
| purchase_order_line_id | uuid FK |
| product_id | uuid FK products |
| received_qty | decimal(20,4) |

---

#### Module Xuất

**`sales_orders`**
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid PK | |
| code | varchar unique | SO-YYYY-NNNNN |
| customer_id | uuid FK partners | |
| warehouse_id | uuid FK warehouses | kho xuất |
| currency_id | uuid FK currencies | |
| exchange_rate | decimal(20,6) nullable | chốt khi post (R6) |
| status | enum(DRAFT, PENDING_APPROVAL, APPROVED, PARTIAL, COMPLETED, CANCELLED) | |
| order_date | date | |
| expected_date | date nullable | |
| contract_no | varchar nullable | số hợp đồng |
| notes | text nullable | |
| created_by | uuid FK users | |
| approved_by | uuid FK users nullable | |
| approved_at | timestamptz nullable | |
| posted_at | timestamptz nullable | |
| created_at, updated_at | timestamptz | |

**`sales_order_lines`**
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid PK | |
| sales_order_id | uuid FK | |
| product_id | uuid FK products | |
| ordered_qty | decimal(20,4) | |
| shipped_qty | decimal(20,4) default 0 | cộng dồn từ DO |
| unit_price | decimal(20,4) | nguyên tệ |
| unit_price_vnd | decimal(20,4) nullable | |
| line_total | decimal(20,4) | |
| line_total_vnd | decimal(20,4) nullable | |

**`delivery_orders`** (Phiếu xuất kho — do Warehouse tạo & xác nhận)
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid PK | |
| code | varchar unique | DO-YYYY-NNNNN |
| sales_order_id | uuid FK | |
| warehouse_id | uuid FK | |
| delivery_date | date | |
| status | enum(DRAFT, CONFIRMED, REVERSED) | |
| reversal_of | uuid FK delivery_orders nullable | |
| reversal_reason | text nullable | |
| confirmed_by | uuid FK users nullable | |
| confirmed_at | timestamptz nullable | |
| notes | text nullable | |
| created_by | uuid FK users | |
| created_at, updated_at | timestamptz | |

**`delivery_order_lines`**
| Cột | Kiểu |
|-----|------|
| id | uuid PK |
| delivery_order_id | uuid FK |
| sales_order_line_id | uuid FK |
| product_id | uuid FK products |
| shipped_qty | decimal(20,4) |

**`sales_payments`** (Thu công nợ)
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid PK | |
| sales_order_id | uuid FK | |
| payment_date | date | |
| amount | decimal(20,4) | nguyên tệ |
| amount_vnd | decimal(20,4) | |
| exchange_rate | decimal(20,6) | tỷ giá tại ngày thu — chốt riêng (R6) |
| payment_method | varchar | |
| notes | text nullable | |
| created_by | uuid FK users | |
| created_at | timestamptz | chỉ INSERT |

---

#### Kho — Inventory Ledger

**`inventory_movements`** — Nguồn sự thật duy nhất (R1)
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid PK | |
| movement_type | enum(RECEIPT, ISSUE, REVERSAL_RECEIPT, REVERSAL_ISSUE) | |
| product_id | uuid FK products | |
| warehouse_id | uuid FK warehouses | |
| qty | decimal(20,4) | dương = nhập, âm = xuất |
| movement_date | date | |
| source_type | enum(GOODS_RECEIPT, DELIVERY_ORDER) | |
| source_id | uuid | FK tới GRN hoặc DO |
| source_line_id | uuid nullable | FK tới line cụ thể |
| reference_code | varchar | mã chứng từ gốc (GRN/DO code) |
| idempotency_key | varchar unique nullable | chống insert trùng khi retry (R9) |
| notes | text nullable | |
| created_by | uuid FK users | |
| created_at | timestamptz | KHÔNG có updated_at — bất biến |

> Index: `(product_id, warehouse_id, movement_date)` để query tồn nhanh.  
> Bảng này chỉ INSERT, không bao giờ UPDATE/DELETE.

**`inventory_snapshots`** — Snapshot số dư theo kỳ (R2)
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid PK | |
| product_id | uuid FK products | |
| warehouse_id | uuid FK warehouses | |
| snapshot_date | date | ngày cuối kỳ (thường cuối tháng) |
| opening_qty | decimal(20,4) | tồn tích lũy đến hết ngày snapshot_date |
| created_by | uuid FK users | |
| created_at | timestamptz | |

> Index: `(product_id, warehouse_id, snapshot_date DESC)` — UNIQUE trên `(product_id, warehouse_id, snapshot_date)`.

**Cơ chế query tồn hiện tại (R2):**
```sql
-- Bước 1: Lấy snapshot gần nhất (trước hoặc bằng hôm nay)
SELECT opening_qty, snapshot_date
FROM inventory_snapshots
WHERE product_id = ? AND warehouse_id = ?
  AND snapshot_date <= CURRENT_DATE
ORDER BY snapshot_date DESC
LIMIT 1;

-- Bước 2: Cộng dồn movement sau mốc snapshot
SELECT COALESCE(SUM(qty), 0)
FROM inventory_movements
WHERE product_id = ? AND warehouse_id = ?
  AND movement_date > <snapshot_date>;

-- Kết quả: opening_qty + SUM(movements_after_snapshot)
-- Nếu không có snapshot: chỉ dùng SUM(tất cả movements)
```

**Cơ chế tạo snapshot:**
- Admin kích hoạt thủ công qua API (hoặc có thể lên lịch cron sau).
- Snapshot tạo tại ngày được chỉ định (thường ngày cuối tháng).
- Logic: tính `SUM(qty)` của tất cả movements `<= snapshot_date` cho từng cặp `(product_id, warehouse_id)`.

---

## 4. State Machine

### 4.1 Đơn nhập (PurchaseOrder)

```
                    Staff/Manager/Admin
                          │ tạo
                          ▼
                        DRAFT ◄─────────────────────────────────┐
                          │                                      │ reject (Manager, ≠ creator)
                          │ submit (Staff/Manager/Admin)         │
                          ▼                                      │
                   PENDING_APPROVAL ──────────────────────────────
                          │
                          │ approve (Manager ≠ creator, Admin)
                          ▼
                       APPROVED ──────────────── cancel ──────► CANCELLED
                          │                   (Manager/Admin,
                          │ Warehouse tạo GRN   chưa có GRN)
                          │ + confirm một phần
                          ▼
                        PARTIAL ──────────────── cancel ──────► CANCELLED
                          │                   (Manager/Admin,
                          │ Warehouse tạo GRN   sau reversal GRN)
                          │ + confirm đủ
                          ▼
                       COMPLETED
```

**Điều kiện chuyển trạng thái:**
- `DRAFT → PENDING_APPROVAL`: đơn có ít nhất 1 line, supplier, warehouse hợp lệ.
- `PENDING_APPROVAL → APPROVED`: Manager/Admin, không phải người tạo đơn (tách biệt nhiệm vụ).
- `APPROVED/PARTIAL → PARTIAL`: sau khi có GRN CONFIRMED, `received_qty < ordered_qty` trên ít nhất 1 line.
- `PARTIAL → COMPLETED`: tất cả lines có `received_qty >= ordered_qty`.
- `CANCELLED`: chỉ khi không còn GRN CONFIRMED nào (đã reversal hết, hoặc chưa có).

### 4.2 Đơn xuất (SalesOrder)

```
                    Staff/Manager/Admin
                          │ tạo
                          ▼
                        DRAFT ◄─────────────────────────────────┐
                          │                                      │ reject (Manager, ≠ creator)
                          │ submit                               │
                          ▼                                      │
                   PENDING_APPROVAL ──────────────────────────────
                          │
                          │ approve (Manager ≠ creator, Admin)
                          ▼
                       APPROVED ──────────────── cancel ──────► CANCELLED
                          │
                          │ Warehouse tạo DO + confirm (kiểm tra tồn)
                          ▼
                        PARTIAL ──────────────── cancel ──────► CANCELLED
                          │                   (sau reversal DO)
                          │ Warehouse confirm đủ
                          ▼
                       COMPLETED
```

### 4.3 Phiếu nhập kho (GoodsReceipt) & Phiếu xuất kho (DeliveryOrder)

```
DRAFT ──── confirm (Warehouse) ──── CONFIRMED
                                        │
                                        │ reverse (Manager/Admin + lý do)
                                        ▼
                                    REVERSED
                    [tạo GRN/DO mới với reversal_of = id cũ, movement ngược]
```

---

## 5. Ma trận Phân quyền

`✓` = được phép | `✗` = không được phép | `✓*` = chỉ với đơn của chính mình (created_by = me)

### 5.1 Phân quyền theo hành động

| Hành động | Admin | Manager | Staff | Warehouse |
|-----------|:-----:|:-------:|:-----:|:---------:|
| **User & Cấu hình** | | | | |
| Tạo / sửa / vô hiệu hóa User | ✓ | ✗ | ✗ | ✗ |
| Xem danh sách User | ✓ | ✗ | ✗ | ✗ |
| Cấu hình hệ thống (currencies, exchange rates) | ✓ | ✗ | ✗ | ✗ |
| CRUD master data (warehouses, products, partners) | ✓ | ✗ | ✗ | ✗ |
| Tạo Snapshot tồn kho | ✓ | ✗ | ✗ | ✗ |
| **Đơn nhập / xuất — Tạo & Sửa** | | | | |
| Tạo đơn nhập/xuất (DRAFT) | ✓ | ✓ | ✓ | ✗ |
| Sửa đơn DRAFT (của mình) | ✓ | ✓ | ✓* | ✗ |
| Sửa đơn DRAFT (của người khác) | ✓ | ✓ | ✗ | ✗ |
| Submit đơn → PENDING_APPROVAL | ✓ | ✓ | ✓* | ✗ |
| **Đơn nhập / xuất — Duyệt** | | | | |
| Duyệt đơn (PENDING → APPROVED) | ✓ | ✓ (≠ người tạo) | ✗ | ✗ |
| Từ chối đơn (PENDING → DRAFT) | ✓ | ✓ (≠ người tạo) | ✗ | ✗ |
| Hủy đơn APPROVED/PARTIAL → CANCELLED | ✓ | ✓ | ✗ | ✗ |
| **Kho — Nhập** | | | | |
| Tạo GRN (phiếu nhập kho) | ✓ | ✗ | ✗ | ✓ |
| Sửa GRN DRAFT | ✓ | ✗ | ✗ | ✓ |
| Xác nhận GRN (DRAFT → CONFIRMED) | ✓ | ✗ | ✗ | ✓ |
| Đảo GRN (CONFIRMED → REVERSED) | ✓ | ✓ | ✗ | ✗ |
| **Kho — Xuất** | | | | |
| Tạo DO (phiếu xuất kho) | ✓ | ✗ | ✗ | ✓ |
| Sửa DO DRAFT | ✓ | ✗ | ✗ | ✓ |
| Xác nhận DO (DRAFT → CONFIRMED) | ✓ | ✗ | ✗ | ✓ |
| Đảo DO (CONFIRMED → REVERSED) | ✓ | ✓ | ✗ | ✗ |
| **Xem & Báo cáo** | | | | |
| Xem tất cả đơn nhập/xuất | ✓ | ✓ | ✗ | ✗ |
| Xem đơn nhập/xuất của mình | ✓ | ✓ | ✓* | ✗ |
| Xem GRN/DO | ✓ | ✓ | ✗ | ✓ |
| Xem tồn kho (số lượng) | ✓ | ✓ | ✓ | ✓ |
| Xem lịch sử movement | ✓ | ✓ | ✗ | ✓ |
| Xem báo cáo tổng hợp | ✓ | ✓ | ✗ | ✗ |

### 5.2 Nguyên tắc tách biệt nhiệm vụ (Segregation of Duties)

- **Người tạo đơn ≠ người duyệt đơn**: kiểm tra `approved_by ≠ created_by` ở tầng service khi approve.
- **Staff không approve**: role guard cứng ở endpoint `/approve` và `/reject`.
- **Warehouse chỉ xử lý kho**: không tạo/duyệt đơn nhập/xuất, chỉ tạo và xác nhận GRN/DO.
- **Phiếu CONFIRMED chỉ Manager/Admin mới đảo**: không phải Warehouse — người thực hiện không tự hủy chứng từ của mình.

---

## 6. Đối chiếu Ràng buộc

### R1 — Tồn kho tính từ lịch sử movement
Bảng `inventory_movements` là bảng append-only (chỉ INSERT), mỗi hàng đại diện cho một sự kiện nhập (+) hoặc xuất (-). Tồn kho tại bất kỳ thời điểm nào = `SUM(qty)` của tất cả movements cho cặp `(product_id, warehouse_id)` tính đến thời điểm đó. Không có cột "current_stock" riêng.

### R2 — Snapshot để tăng tốc query
Bảng `inventory_snapshots` lưu `opening_qty` tích lũy đến cuối một ngày nhất định (thường cuối tháng). Query tồn hiện tại = `snapshot.opening_qty + SUM(movements sau snapshot_date)`. Index composite `(product_id, warehouse_id, snapshot_date DESC)` đảm bảo lookup O(log n). Khi chưa có snapshot, fallback về `SUM(tất cả movements)`. Admin tạo snapshot thủ công, có thể tự động hóa bằng cron job (ngoài phạm vi v1).

### R3 — Không xóa, chứng từ POSTED bất biến
- DRAFT: tự do UPDATE.
- POSTED (APPROVED/PARTIAL/COMPLETED/CANCELLED và GRN/DO CONFIRMED): không cho UPDATE trực tiếp. NestJS Guard kiểm tra status trước khi cho phép PATCH.
- Sửa sai: tạo GRN/DO mới với `reversal_of = <id_gốc>`, ghi movement ngược (`REVERSAL_RECEIPT` hoặc `REVERSAL_ISSUE`), bắt buộc nhập `reversal_reason`. Sau đó tạo GRN/DO đúng mới.
- `inventory_movements`: chỉ INSERT, không có endpoint UPDATE/DELETE.

### R4 — Trạng thái & số lượng còn lại
Enum status đầy đủ: `DRAFT → PENDING_APPROVAL → APPROVED → PARTIAL → COMPLETED / CANCELLED`. Cột `received_qty` (PO) và `shipped_qty` (SO) trên từng line cộng dồn qua mỗi GRN/DO được confirm. `remaining_qty = ordered_qty - received_qty/shipped_qty` có thể tính on-the-fly hoặc expose qua API.

### R5 — Gác cổng chuyển trạng thái theo role
Mỗi endpoint action (`/submit`, `/approve`, `/reject`, `/cancel`, `/confirm`, `/reverse`) đều có `@Roles(...)` decorator + `RolesGuard` ở NestJS. Logic nghiệp vụ bổ sung (VD: `≠ người tạo`) kiểm tra trong Service, throw `ForbiddenException` nếu vi phạm.

### R6 — Chốt tỷ giá khi post
Khi chuyển trạng thái sang APPROVED (PO/SO), service lấy exchange rate hiện hành của `currency_id`, ghi vào `purchase_orders.exchange_rate` / `sales_orders.exchange_rate` và tính `unit_price_vnd`, `line_total_vnd` cho tất cả lines. Sau đó không cho sửa. `sales_payments.exchange_rate` chốt riêng tại thời điểm ghi nhận thanh toán.

### R7 — Tiền dùng Decimal, cấm float
Tất cả cột tiền và số lượng trong schema dùng kiểu `Decimal` của Prisma (ánh xạ sang `NUMERIC` trong PostgreSQL). Prisma trả về `Decimal` object (từ `decimal.js`) — không phải JavaScript `number` (float). Mọi phép tính tiền thực hiện trên `Decimal` object, không ép sang `number`.

### R8 — Post chứng từ là atomic transaction
Toàn bộ thao tác confirm GRN/DO (ghi `inventory_movements`, cập nhật `received_qty/shipped_qty` trên lines, cập nhật status PO/SO) nằm trong một `prisma.$transaction([...])`. Nếu bất kỳ bước nào fail, toàn bộ rollback.

### R9 — Chống tồn âm & kiểm soát đồng thời
Khi confirm DO, trong cùng transaction: (1) query `SELECT ... FOR UPDATE` trên cặp `(product_id, warehouse_id)` để khóa row, (2) tính tồn hiện tại, (3) nếu `tồn - shipped_qty < 0` thì throw lỗi và rollback. Cột `idempotency_key` trên `inventory_movements` (UNIQUE) chống việc retry tạo movement trùng — nếu insert trùng key thì Postgres raise `unique_violation`, service bắt và trả về success idempotent.

### R10 — Audit đầy đủ
Mọi chuyển trạng thái, mọi approve/reject, mọi confirm/reverse đều ghi một hàng vào `audit_logs` với `(user_id, action, entity_type, entity_id, old_value, new_value, reason)`. Ghi trong cùng transaction với hành động nghiệp vụ. `audit_logs` chỉ INSERT.

### R11 — Số chứng từ tuần tự, không trùng
Dùng PostgreSQL sequence riêng cho từng loại (PO, GRN, SO, DO). Format: `PO-YYYY-NNNNN`. Gán trong transaction khi tạo record, không để application tự generate. Cột `code` là `UNIQUE NOT NULL`. Sequence không bao giờ reset (không nhảy cóc, không trùng).

---

## 7. Thiết kế API

Base URL: `http://localhost:3001/api`  
Auth: JWT trong HttpOnly cookie, gửi qua `credentials: 'include'`.  
Mọi endpoint (trừ login) yêu cầu token hợp lệ.

### 7.1 Auth

| Method | Path | Mục đích | Role |
|--------|------|---------|------|
| POST | `/auth/login` | Đăng nhập, trả cookie JWT | Public |
| POST | `/auth/logout` | Xóa cookie | Authenticated |
| GET | `/auth/me` | Lấy thông tin user hiện tại + role | Authenticated |

### 7.2 Users (Admin only)

| Method | Path | Mục đích |
|--------|------|---------|
| GET | `/users` | Danh sách users (có filter/pagination) |
| POST | `/users` | Tạo user mới |
| GET | `/users/:id` | Chi tiết user |
| PATCH | `/users/:id` | Cập nhật thông tin, đổi role |
| PATCH | `/users/:id/deactivate` | Vô hiệu hóa user |
| PATCH | `/users/:id/activate` | Kích hoạt lại user |

### 7.3 Master Data (Admin CRUD, các role khác GET)

| Method | Path | Mục đích |
|--------|------|---------|
| GET/POST | `/warehouses` | Danh sách / Tạo kho |
| GET/PATCH | `/warehouses/:id` | Chi tiết / Sửa kho |
| GET/POST | `/partners` | Danh sách / Tạo đối tác |
| GET/PATCH | `/partners/:id` | Chi tiết / Sửa đối tác |
| GET/POST | `/products` | Danh sách / Tạo sản phẩm |
| GET/PATCH | `/products/:id` | Chi tiết / Sửa sản phẩm |
| GET/POST | `/currencies` | Danh sách / Tạo tiền tệ |
| GET/POST | `/exchange-rates` | Danh sách / Thêm tỷ giá |
| GET | `/exchange-rates/latest` | Tỷ giá mới nhất mỗi currency |

### 7.4 Purchase Orders

| Method | Path | Mục đích | Role |
|--------|------|---------|------|
| GET | `/purchase-orders` | Danh sách (Staff: chỉ của mình) | All auth |
| POST | `/purchase-orders` | Tạo đơn DRAFT | Admin, Manager, Staff |
| GET | `/purchase-orders/:id` | Chi tiết + lines | All auth (phân quyền xem) |
| PATCH | `/purchase-orders/:id` | Sửa đơn DRAFT | Admin, Manager, Staff (owner) |
| POST | `/purchase-orders/:id/submit` | DRAFT → PENDING_APPROVAL | Admin, Manager, Staff (owner) |
| POST | `/purchase-orders/:id/approve` | PENDING → APPROVED + chốt tỷ giá | Admin, Manager (≠ creator) |
| POST | `/purchase-orders/:id/reject` | PENDING → DRAFT | Admin, Manager (≠ creator) |
| POST | `/purchase-orders/:id/cancel` | APPROVED/PARTIAL → CANCELLED | Admin, Manager |

### 7.5 Purchase Invoices

| Method | Path | Mục đích | Role |
|--------|------|---------|------|
| GET | `/purchase-invoices` | Danh sách (filter by PO) | Admin, Manager |
| POST | `/purchase-invoices` | Tạo invoice cho PO | Admin, Manager, Staff |
| GET | `/purchase-invoices/:id` | Chi tiết | Admin, Manager |
| PATCH | `/purchase-invoices/:id` | Sửa invoice | Admin, Manager |
| POST | `/purchase-invoices/:id/pay` | Ghi nhận thanh toán | Admin, Manager |

### 7.6 Goods Receipts (Phiếu nhập kho)

| Method | Path | Mục đích | Role |
|--------|------|---------|------|
| GET | `/goods-receipts` | Danh sách | Admin, Manager, Warehouse |
| POST | `/goods-receipts` | Tạo GRN DRAFT | Admin, Warehouse |
| GET | `/goods-receipts/:id` | Chi tiết + lines | Admin, Manager, Warehouse |
| PATCH | `/goods-receipts/:id` | Sửa GRN DRAFT | Admin, Warehouse |
| POST | `/goods-receipts/:id/confirm` | DRAFT → CONFIRMED (atomic: ghi movement, cập nhật PO) | Admin, Warehouse |
| POST | `/goods-receipts/:id/reverse` | CONFIRMED → REVERSED (bút toán đảo, yêu cầu reason) | Admin, Manager |

### 7.7 Sales Orders

| Method | Path | Mục đích | Role |
|--------|------|---------|------|
| GET | `/sales-orders` | Danh sách | All auth (phân quyền xem) |
| POST | `/sales-orders` | Tạo đơn DRAFT | Admin, Manager, Staff |
| GET | `/sales-orders/:id` | Chi tiết + lines | All auth |
| PATCH | `/sales-orders/:id` | Sửa đơn DRAFT | Admin, Manager, Staff (owner) |
| POST | `/sales-orders/:id/submit` | DRAFT → PENDING | Admin, Manager, Staff (owner) |
| POST | `/sales-orders/:id/approve` | PENDING → APPROVED + chốt tỷ giá | Admin, Manager (≠ creator) |
| POST | `/sales-orders/:id/reject` | PENDING → DRAFT | Admin, Manager (≠ creator) |
| POST | `/sales-orders/:id/cancel` | APPROVED/PARTIAL → CANCELLED | Admin, Manager |

### 7.8 Delivery Orders (Phiếu xuất kho)

| Method | Path | Mục đích | Role |
|--------|------|---------|------|
| GET | `/delivery-orders` | Danh sách | Admin, Manager, Warehouse |
| POST | `/delivery-orders` | Tạo DO DRAFT | Admin, Warehouse |
| GET | `/delivery-orders/:id` | Chi tiết + lines | Admin, Manager, Warehouse |
| PATCH | `/delivery-orders/:id` | Sửa DO DRAFT | Admin, Warehouse |
| POST | `/delivery-orders/:id/confirm` | DRAFT → CONFIRMED (atomic: kiểm tra tồn + khóa + ghi movement) | Admin, Warehouse |
| POST | `/delivery-orders/:id/reverse` | CONFIRMED → REVERSED (bút toán đảo) | Admin, Manager |

### 7.9 Sales Payments

| Method | Path | Mục đích | Role |
|--------|------|---------|------|
| GET | `/sales-payments` | Danh sách (filter by SO) | Admin, Manager |
| POST | `/sales-payments` | Ghi nhận thu tiền (chốt tỷ giá tại ngày thu) | Admin, Manager |
| GET | `/sales-payments/:id` | Chi tiết | Admin, Manager |

### 7.10 Inventory

| Method | Path | Mục đích | Role |
|--------|------|---------|------|
| GET | `/inventory/balance` | Tồn hiện tại (filter: product, warehouse) | All auth |
| GET | `/inventory/movements` | Lịch sử movement (filter + pagination) | Admin, Manager, Warehouse |
| GET | `/inventory/snapshots` | Danh sách snapshot | Admin, Manager |
| POST | `/inventory/snapshots` | Tạo snapshot thủ công | Admin |

---

## 8. Thiết kế Frontend

### 8.1 Layout & Navigation

- Một layout chung với sidebar điều hướng.
- Sidebar render các menu item khác nhau tùy role (đọc từ `auth/me`).
- Route guard: redirect về `/login` nếu chưa đăng nhập; redirect về `/403` nếu không đủ quyền.

### 8.2 Danh sách màn hình theo Role

#### Tất cả role (sau đăng nhập)

| Màn hình | Route | Mô tả |
|----------|-------|-------|
| Đăng nhập | `/login` | Form email + password |
| Dashboard | `/` | Tổng quan nhanh (số liệu phù hợp role) |
| Tồn kho | `/inventory` | Bảng tồn theo product+warehouse, filter, search |

#### Staff

| Màn hình | Route | Mô tả |
|----------|-------|-------|
| Danh sách đơn nhập | `/purchase-orders` | Danh sách đơn của mình, filter status |
| Tạo đơn nhập | `/purchase-orders/new` | Form header + dynamic lines, chọn supplier/warehouse/currency |
| Chi tiết đơn nhập | `/purchase-orders/:id` | Xem chi tiết, sửa nếu DRAFT, nút Submit |
| Danh sách đơn xuất | `/sales-orders` | Danh sách đơn của mình |
| Tạo đơn xuất | `/sales-orders/new` | Form header + lines, chọn customer/warehouse/currency |
| Chi tiết đơn xuất | `/sales-orders/:id` | Xem chi tiết, sửa nếu DRAFT, nút Submit |

#### Manager (bao gồm màn hình Staff + thêm)

| Màn hình | Route | Mô tả |
|----------|-------|-------|
| Tất cả đơn nhập | `/purchase-orders` | Xem tất cả, filter status/supplier/date |
| Duyệt đơn nhập | `/purchase-orders/:id` | Nút Approve / Reject / Cancel (nếu ≠ creator) |
| Tất cả đơn xuất | `/sales-orders` | Xem tất cả |
| Duyệt đơn xuất | `/sales-orders/:id` | Nút Approve / Reject / Cancel |
| Đảo GRN | `/goods-receipts/:id` | Form lý do + nút Reverse |
| Đảo DO | `/delivery-orders/:id` | Form lý do + nút Reverse |
| Báo cáo tồn kho | `/reports/inventory` | Bảng tồn + filter kỳ |
| Báo cáo đơn nhập/xuất | `/reports/orders` | Thống kê theo kỳ |

#### Warehouse

| Màn hình | Route | Mô tả |
|----------|-------|-------|
| Đơn nhập cần nhập kho | `/goods-receipts/pending` | Danh sách PO APPROVED/PARTIAL |
| Tạo / Sửa GRN | `/goods-receipts/new`, `/goods-receipts/:id` | Form: chọn PO, nhập số lượng thực nhận từng line |
| Xác nhận GRN | `/goods-receipts/:id` | Nút Confirm (POST confirm) |
| Đơn xuất cần xuất kho | `/delivery-orders/pending` | Danh sách SO APPROVED/PARTIAL |
| Tạo / Sửa DO | `/delivery-orders/new`, `/delivery-orders/:id` | Form: chọn SO, nhập số lượng xuất từng line |
| Xác nhận DO | `/delivery-orders/:id` | Nút Confirm (POST confirm, hiển thị cảnh báo nếu tồn sắp âm) |
| Tồn kho | `/inventory` | Xem tồn (read-only) |

#### Admin (toàn bộ + thêm)

| Màn hình | Route | Mô tả |
|----------|-------|-------|
| Quản lý User | `/admin/users` | Danh sách, tạo, sửa role, vô hiệu hóa |
| Tạo / Sửa User | `/admin/users/new`, `/admin/users/:id` | Form |
| Master data — Kho | `/admin/warehouses` | CRUD |
| Master data — SP | `/admin/products` | CRUD |
| Master data — Đối tác | `/admin/partners` | CRUD |
| Tiền tệ & Tỷ giá | `/admin/currencies` | Danh sách currency, thêm tỷ giá |
| Snapshot tồn kho | `/admin/inventory/snapshots` | Danh sách snapshot + nút tạo snapshot mới |

### 8.3 Luồng người dùng chính

**Luồng nhập kho (end-to-end):**
```
Staff: /purchase-orders/new → submit
  → Manager: /purchase-orders/:id → approve
    → Warehouse: /goods-receipts/new (chọn PO) → confirm
      → Tồn kho tăng, PO status → PARTIAL/COMPLETED
```

**Luồng xuất kho (end-to-end):**
```
Staff: /sales-orders/new → submit
  → Manager: /sales-orders/:id → approve
    → Warehouse: /delivery-orders/new (chọn SO, kiểm tra tồn) → confirm
      → Tồn kho giảm, SO status → PARTIAL/COMPLETED
```

**Luồng đảo phiếu:**
```
Manager: /goods-receipts/:id hoặc /delivery-orders/:id
  → Nhập lý do → Reverse
    → Movement ngược được ghi, GRN/DO status → REVERSED
      → PO/SO status tự động recalculate
```

### 8.4 Xử lý chung ở Frontend

- Loading state: skeleton hoặc spinner trên mọi fetch.
- Error state: toast notification cho lỗi API, hiển thị message từ response.
- Optimistic update: không dùng (nghiệp vụ tài chính cần kết quả chính xác từ server).
- Phân quyền hiển thị: nút/action chỉ render nếu role thỏa điều kiện (bảo vệ UX, không thay thế server-side guard).
- Form validation: Zod schema ở client, server trả lại lỗi validate class-validator nếu bypass.

---

## 9. Kế hoạch Triển khai (Milestone)

### M1 — Foundation (ưu tiên 1)

**Backend:**
- [ ] Prisma schema đầy đủ + migration lần đầu (tất cả bảng)
- [ ] Auth module: login/logout/me, JWT + HttpOnly cookie
- [ ] RolesGuard + `@Roles()` decorator
- [ ] Audit log service (ghi vào `audit_logs`)
- [ ] Master data API: warehouses, products, partners, currencies, exchange-rates
- [ ] Document number generator (PostgreSQL sequence)

**Frontend:**
- [ ] Layout với sidebar động theo role
- [ ] Trang Login + auth store (Zustand)
- [ ] Route guard (redirect nếu chưa đăng nhập hoặc sai role)
- [ ] Màn hình master data (Admin): warehouses, products, partners, currencies
- [ ] Màn hình quản lý User (Admin)

**Dependency:** M2 và M3 đều phụ thuộc M1.

---

### M2 — Đơn nhập (ưu tiên 2)

**Backend:**
- [ ] Purchase Order API + state machine (submit/approve/reject/cancel)
- [ ] Purchase Invoice API
- [ ] Goods Receipt API + confirm (atomic transaction: movement + update PO lines + audit)
- [ ] Reverse GRN API

**Frontend:**
- [ ] Staff: tạo/sửa/submit PO
- [ ] Manager: danh sách PO chờ duyệt, approve/reject
- [ ] Warehouse: danh sách PO APPROVED, tạo GRN, xác nhận GRN
- [ ] Manager: reverse GRN

**Dependency:** M1 hoàn thành.

---

### M3 — Đơn xuất (ưu tiên 2, song song M2)

**Backend:**
- [ ] Sales Order API + state machine
- [ ] Delivery Order API + confirm (atomic: kiểm tra tồn + khóa + movement + audit)
- [ ] Reverse DO API
- [ ] Sales Payment API

**Frontend:**
- [ ] Staff: tạo/sửa/submit SO
- [ ] Manager: danh sách SO chờ duyệt, approve/reject
- [ ] Warehouse: danh sách SO APPROVED, tạo DO, xác nhận DO (hiển thị tồn khả dụng)
- [ ] Manager: reverse DO
- [ ] Ghi nhận thanh toán (Manager)

**Dependency:** M1 hoàn thành. M3 có thể chạy song song với M2.

---

### M4 — Tồn kho & Snapshot (ưu tiên 3)

**Backend:**
- [ ] Inventory balance API (ledger + snapshot query)
- [ ] Inventory movements list API
- [ ] Snapshot creation API

**Frontend:**
- [ ] Màn hình tồn kho (tất cả role): bảng product × warehouse, search
- [ ] Màn hình lịch sử movement (Admin, Manager, Warehouse)
- [ ] Admin: tạo snapshot

**Dependency:** M2 và M3 hoàn thành (cần có movement thực tế để test).

---

### M5 — Audit & Reversal UX (ưu tiên 3)

**Backend:**
- [ ] Audit log API (GET `/audit-logs?entityType=&entityId=`)
- [ ] Đảm bảo mọi action ghi audit

**Frontend:**
- [ ] Tab "Lịch sử" trong chi tiết đơn/phiếu (hiển thị audit trail)
- [ ] Modal xác nhận + nhập lý do khi reverse

**Dependency:** M2, M3.

---

### M6 — Báo cáo & Polish (ưu tiên 4)

**Backend:**
- [ ] Báo cáo tổng hợp đơn nhập/xuất theo kỳ
- [ ] Báo cáo tồn kho theo kỳ

**Frontend:**
- [ ] Màn hình báo cáo (Manager, Admin): filter kỳ, export cơ bản
- [ ] Dashboard với số liệu nhanh theo role
- [ ] Xử lý lỗi nhất quán, loading state đầy đủ

**Dependency:** M4, M5.

---

## 10. Rủi ro & Câu hỏi cần xác nhận

### Câu hỏi bắt buộc phải có câu trả lời trước khi code

**Q1 — Chiều theo dõi tồn kho (quan trọng nhất, ảnh hưởng schema)**  
Tồn kho theo dõi theo chiều nào?  
- (a) SKU + Kho (warehouse) — thiết kế hiện tại  
- (b) SKU + Kho + Lô hàng (batch/lot) — cần thêm bảng `batches`, cột `batch_id` trên lines và movement  
- (c) Chỉ SKU (không phân biệt kho) — đơn giản nhất nhưng ít thực tế  

**Q2 — Giá trị tồn kho hay chỉ số lượng?**  
Hiện tại plan chỉ track số lượng (qty). Có cần track giá trị (cost per unit, total value) không? Nếu có, cần thêm `unit_cost` vào `inventory_movements` và `inventory_snapshots`, và làm rõ phương pháp tính giá vốn (FIFO/AVCO/nhập trực tiếp).

**Q3 — Trạng thái PENDING_APPROVAL có cần không?**  
Hay Staff submit xong thì Manager thấy đơn ở trạng thái APPROVED ngay (skip PENDING)? Nếu skip, đơn giản hơn nhưng mất khả năng kiểm soát 2 bước.

**Q4 — Staff có thể sửa đơn của người khác không?**  
Hiện tại plan: Staff chỉ sửa đơn của mình (`created_by = me`). Manager có thể sửa mọi đơn DRAFT. Xác nhận?

**Q5 — Warehouse có cần tạo GRN/DO cho đơn ở trạng thái PARTIAL không?**  
Tức là một PO đã có một GRN, Warehouse có tạo GRN thứ 2 không? Hiện tại plan: có (nhập nhiều đợt). Xác nhận?

**Q6 — Invoice nhà cung cấp có bắt buộc trước khi nhập kho không?**  
Hay GRN và Invoice là 2 quy trình song song độc lập (chỉ cùng tham chiếu PO)?

**Q7 — Định dạng số chứng từ**  
`PO-YYYY-NNNNN` (theo năm, reset mỗi năm) hay `PO-YYYYMM-NNNNN` (theo tháng) hay `PO-NNNNNNN` (global, không reset)?

**Q8 — Cơ chế Auth**  
`lib/api.ts` dùng `credentials: 'include'` — xác nhận dùng **JWT trong HttpOnly cookie** (stateless, không cần Redis)? Hay session-based (cần Redis/store)?

**Q9 — UI Component library**  
`components/ui/` rỗng. Có dùng **shadcn/ui** không? Nếu có, cài phiên bản nào và theme gì? Hay dùng thuần Tailwind?

**Q10 — Ai có thể tạo GRN/DO: Warehouse tạo rồi confirm, hay Manager/Staff tạo rồi Warehouse confirm?**  
Hiện tại plan: Warehouse tạo và confirm GRN/DO. Có cần Staff/Manager tạo GRN/DO trước (nhập số lượng kỳ vọng) rồi Warehouse confirm số lượng thực không?

### Rủi ro kỹ thuật

| Rủi ro | Mức độ | Biện pháp |
|--------|--------|-----------|
| Next.js 16 breaking changes (cảnh báo từ AGENTS.md) | Cao | Đọc docs trong `node_modules/next/dist/docs/` trước khi viết bất kỳ dòng FE nào |
| Deadlock khi nhiều DO confirm đồng thời cho cùng SKU/Warehouse | Trung bình | `SELECT ... FOR UPDATE` theo thứ tự nhất định (product_id ASC), timeout ngắn |
| Drift giữa `received_qty`/`shipped_qty` và tổng movement (nếu transaction fail một phần) | Cao | Luôn cập nhật trong cùng `prisma.$transaction`, thêm test kiểm tra consistency |
| Số chứng từ có gap nếu sequence bị rollback | Thấp | Chấp nhận — gap trong sequence không vi phạm yêu cầu "không trùng, không nhảy" theo nghĩa nghiệp vụ |
| Prisma 7 API changes (version mới) | Thấp | Đọc changelog Prisma 7 trước khi viết service |

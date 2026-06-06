# Hướng dẫn sử dụng — Eureka ERP

> Hệ thống quản lý đơn nhập, đơn xuất và tồn kho nội bộ.
> URL: **http://localhost:3000**

---

## Mục lục

1. [Đăng nhập](#1-đăng-nhập)
2. [Màn hình Dashboard](#2-màn-hình-dashboard)
3. [Quản lý đơn nhập hàng (Purchase Order)](#3-quản-lý-đơn-nhập-hàng)
4. [Quản lý đơn xuất hàng (Sales Order)](#4-quản-lý-đơn-xuất-hàng)
5. [Xem tồn kho](#5-xem-tồn-kho)
6. [Quản trị hệ thống (Admin)](#6-quản-trị-hệ-thống)
7. [Quyền hạn theo Role](#7-quyền-hạn-theo-role)

---

## 1. Đăng nhập

Truy cập `http://localhost:3000` — hệ thống tự chuyển về trang đăng nhập.

**Điền thông tin:**
- **Email:** `admin@eureka.local`
- **Mật khẩu:** `Admin@123`

Nhấn **Đăng nhập**. Sau khi thành công, hệ thống chuyển về Dashboard.

> Nếu sai thông tin, thông báo lỗi hiện đỏ bên dưới form.

---

## 2. Màn hình Dashboard

Sau đăng nhập, hiển thị 4 thẻ chức năng chính:

| Thẻ | Chức năng |
|-----|-----------|
| **Đơn nhập** | Quản lý Purchase Order & nhập kho |
| **Đơn xuất** | Quản lý Sales Order & xuất kho |
| **Tồn kho** | Xem số lượng tồn hiện tại |
| **Báo cáo** | Thống kê theo kỳ *(đang phát triển)* |

Thanh sidebar bên trái liệt kê toàn bộ menu. Các mục hiển thị phụ thuộc vào **role** của tài khoản đang đăng nhập.

---

## 3. Quản lý đơn nhập hàng

Menu: **Đơn nhập** → `http://localhost:3000/purchase-orders`

### 3.1 Xem danh sách

Bảng hiển thị tất cả đơn nhập với các cột:

| Cột | Ý nghĩa |
|-----|---------|
| Mã đơn | PO-0001, PO-0002… |
| Nhà cung cấp | Tên đối tác |
| Kho | Kho nhận hàng |
| Trạng thái | Badge màu (xem bên dưới) |
| Ngày đặt | |

**Màu trạng thái:**

| Badge | Trạng thái | Ý nghĩa |
|-------|-----------|---------|
| Xám | **Nháp** | Vừa tạo, chưa gửi duyệt |
| Vàng | **Chờ duyệt** | Đã gửi, đợi Manager duyệt |
| Xanh dương | **Đã duyệt** | Được duyệt, chờ nhập kho |
| Cam | **Nhập 1 phần** | Đã nhập một phần hàng |
| Xanh lá | **Hoàn thành** | Nhập đủ hàng |
| Đỏ | **Đã huỷ** | |

Click vào bất kỳ hàng nào để mở chi tiết.

### 3.2 Tạo đơn nhập mới

*(Role: Admin, Manager, Staff)*

1. Nhấn nút **+ Tạo đơn nhập** góc trên phải
2. Điền form:
   - **Nhà cung cấp** — chọn từ danh sách (type Supplier/Both)
   - **Kho nhập** — kho sẽ nhận hàng
   - **Tiền tệ** — VND hoặc ngoại tệ
   - **Ngày đặt** — mặc định hôm nay
   - **Ghi chú** *(tuỳ chọn)*
3. Thêm sản phẩm:
   - Nhấn **+ Thêm dòng** để thêm sản phẩm
   - Mỗi dòng: chọn sản phẩm → nhập số lượng → nhập đơn giá
   - Nhấn **×** để xoá dòng
4. Nhấn **Tạo đơn** → đơn tạo ở trạng thái **Nháp**

### 3.3 Luồng xử lý đơn nhập

Mở chi tiết đơn nhập (click vào hàng trong danh sách):

```
[Nháp] ──→ Gửi duyệt ──→ [Chờ duyệt] ──→ Duyệt ──→ [Đã duyệt]
                                    └──→ Huỷ ──→ [Đã huỷ]
```

**Bước 1 — Gửi duyệt** *(Staff / Manager / Admin)*

Khi đơn đang ở **Nháp**, nhấn nút **Gửi duyệt**. Trạng thái chuyển sang **Chờ duyệt**.

**Bước 2 — Duyệt hoặc Huỷ** *(Manager / Admin)*

Khi đơn đang ở **Chờ duyệt**, xuất hiện 2 nút:
- **Duyệt** → chuyển sang **Đã duyệt**
- **Huỷ** → chuyển sang **Đã huỷ**

> Lưu ý: Manager **không thể tự duyệt** đơn do chính mình tạo (phân quyền chéo).

**Bước 3 — Tạo phiếu nhập kho (GRN)** *(Warehouse / Admin)*

Khi đơn ở **Đã duyệt** hoặc **Nhập 1 phần**, nhấn **+ Tạo phiếu nhập**:
1. Chọn ngày nhập kho
2. Nhập số lượng thực nhận cho từng sản phẩm
3. Nhấn **Tạo phiếu nhập** → phiếu tạo ở trạng thái **Nháp**

**Bước 4 — Xác nhận phiếu nhập** *(Warehouse / Admin)*

Trong phần **Phiếu nhập kho** của chi tiết đơn, nhấn **Xác nhận** trên phiếu DRAFT:
- Tồn kho tăng theo số lượng nhận
- Nếu nhập đủ → PO chuyển **Hoàn thành**
- Nếu nhập một phần → PO chuyển **Nhập 1 phần** (có thể tạo thêm GRN)

---

## 4. Quản lý đơn xuất hàng

Menu: **Đơn xuất** → `http://localhost:3000/sales-orders`

Luồng tương tự đơn nhập nhưng chiều ngược lại — **trừ tồn kho** thay vì cộng.

### 4.1 Tạo đơn xuất mới

*(Role: Admin, Manager, Staff)*

1. Nhấn **+ Tạo đơn xuất**
2. Điền form:
   - **Khách hàng** — chọn từ danh sách (type Customer/Both)
   - **Kho xuất** — kho sẽ xuất hàng đi
   - **Tiền tệ**, **Ngày đặt**, **Ghi chú**
3. Thêm sản phẩm và số lượng cần xuất
4. Nhấn **Tạo đơn**

### 4.2 Luồng xử lý đơn xuất

```
[Nháp] ──→ Gửi duyệt ──→ [Chờ duyệt] ──→ Duyệt ──→ [Đã duyệt]
                                    └──→ Huỷ ──→ [Đã huỷ]
```

**Bước 1 & 2** — Gửi duyệt / Duyệt / Huỷ: giống đơn nhập.

**Bước 3 — Tạo phiếu xuất kho (DO)** *(Warehouse / Admin)*

Khi đơn ở **Đã duyệt** hoặc **Xuất 1 phần**, nhấn **+ Tạo phiếu xuất**:
1. Chọn ngày xuất
2. Nhập số lượng thực xuất cho từng sản phẩm
3. Nhấn **Tạo phiếu xuất**

**Bước 4 — Xác nhận phiếu xuất** *(Warehouse / Admin)*

Nhấn **Xác nhận** trên phiếu DRAFT:
- Hệ thống **kiểm tra tồn kho** tự động — nếu không đủ hàng, hiện thông báo lỗi cụ thể từng sản phẩm
- Nếu đủ → tồn kho giảm, phiếu chuyển **Đã xác nhận**
- SO tự cập nhật **Xuất 1 phần** hoặc **Hoàn thành**

---

## 5. Xem tồn kho

Menu: **Tồn kho** → `http://localhost:3000/inventory`

Bảng hiển thị số lượng tồn hiện tại theo từng sản phẩm và kho.

**Lọc dữ liệu:**
- **Kho** — chọn kho cụ thể hoặc xem tất cả
- **Tìm sản phẩm** — gõ tên hoặc mã sản phẩm

> Sản phẩm có tồn kho = 0 được ẩn tự động.

Tồn kho được tính theo công thức:
```
Tồn = Tổng nhập (GRN đã xác nhận) − Tổng xuất (DO đã xác nhận)
```

---

## 6. Quản trị hệ thống

*(Chỉ dành cho Admin)*

Menu **Quản trị** trong sidebar gồm 5 mục:

### 6.1 Người dùng — `/admin/users`

| Thao tác | Cách thực hiện |
|----------|---------------|
| Xem danh sách | Bảng với tìm kiếm theo tên/email |
| Tạo người dùng | Nút **+ Tạo người dùng** → điền email, tên, mật khẩu, role |
| Sửa thông tin | Nút **Sửa** trên từng hàng |
| Khoá/Mở khoá | Nút **Khoá** / **Kích hoạt** |
| Import hàng loạt | Nút **Import JSON** → dán mảng JSON, xem ví dụ bên dưới |

**Ví dụ JSON import người dùng:**
```json
[
  {
    "email": "manager1@eureka.local",
    "name": "Nguyễn Văn A",
    "password": "Manager@123",
    "role": "MANAGER"
  },
  {
    "email": "warehouse1@eureka.local",
    "name": "Trần Thị B",
    "password": "Warehouse@123",
    "role": "WAREHOUSE"
  }
]
```

Roles hợp lệ: `ADMIN` | `MANAGER` | `STAFF` | `WAREHOUSE`

### 6.2 Kho hàng — `/admin/warehouses`

| Thao tác | Cách thực hiện |
|----------|---------------|
| Tạo kho | Điền mã kho (VD: `WH-01`), tên kho |
| Sửa | Nút **Sửa** |
| Import JSON | Mỗi phần tử: `{ "code": "WH-01", "name": "Kho Hà Nội" }` |

### 6.3 Sản phẩm — `/admin/products`

Tạo sản phẩm với mã SKU, tên, đơn vị tính (cái, kg, hộp…).

**Ví dụ JSON import:**
```json
[
  { "code": "SP-001", "name": "Bàn phím cơ", "unit": "cái" },
  { "code": "SP-002", "name": "Chuột gaming", "unit": "cái" }
]
```

### 6.4 Đối tác — `/admin/partners`

Đối tác có thể là nhà cung cấp, khách hàng hoặc cả hai.

| Trường | Giá trị |
|--------|---------|
| Type | `SUPPLIER` / `CUSTOMER` / `BOTH` |
| Mã số thuế | Tuỳ chọn |

**Ví dụ JSON import:**
```json
[
  { "code": "NCC-001", "name": "Công ty TNHH ABC", "type": "SUPPLIER" },
  { "code": "KH-001", "name": "Công ty Cổ phần XYZ", "type": "CUSTOMER" }
]
```

### 6.5 Tiền tệ & Tỷ giá — `/admin/currencies`

- Thêm loại tiền tệ (VD: USD, EUR, CNY)
- Cập nhật tỷ giá theo ngày hiệu lực — hệ thống tự lấy tỷ giá mới nhất khi tạo đơn

---

## 7. Quyền hạn theo Role

| Chức năng | Admin | Manager | Staff | Warehouse |
|-----------|:-----:|:-------:|:-----:|:---------:|
| Xem đơn nhập/xuất | ✓ | ✓ | ✓ | ✓ |
| Tạo đơn nhập/xuất | ✓ | ✓ | ✓ | — |
| Gửi duyệt | ✓ | ✓ | ✓ | — |
| Duyệt / Huỷ đơn | ✓ | ✓* | — | — |
| Tạo phiếu nhập/xuất kho | ✓ | — | — | ✓ |
| Xác nhận phiếu kho | ✓ | — | — | ✓ |
| Xem tồn kho | ✓ | ✓ | ✓ | ✓ |
| Quản trị hệ thống | ✓ | — | — | — |

> \* Manager không thể duyệt đơn do chính mình tạo.

---

## Lưu ý

- **Phiếu nhập/xuất đã xác nhận không thể sửa** — chỉ có thể tạo phiếu đảo ngược (Admin).
- **Tồn kho được tính real-time** — mỗi lần xác nhận phiếu, tồn kho cập nhật ngay.
- **Đơn bị huỷ không thể khôi phục** — tạo đơn mới nếu cần.

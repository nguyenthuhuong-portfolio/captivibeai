# WORK PROGRESS — CaptiVibe AI

Cập nhật lần cuối: 2026-11-06

Nhiệm vụ hiện tại: **MOBILE UX POLISH & TIKTOK PREVIEW REFINEMENT** (3 checkpoint — xem §4d).

Đã xong trước đó: **MOBILE UI POLISH — RESULTS TOOLBAR & PREVIEW SCALE** (Mục 1–4 — xem §4c);
**MOBILE-FIRST RESPONSIVE REWORK** (Mục I–IV — xem §4b); **MOBILE-FIRST PREVIEW +
FIX MOBILE STORAGE** (PHẦN A/B/C — xem §2–§4).

Thứ tự ưu tiên nhiệm vụ hiện tại: Checkpoint 1 (TikTok Preview refinement) → Checkpoint 2
(navigation ổn định + vùng trắng phía dưới) → Checkpoint 3 (tổng kiểm tra Mobile UX) → test/build.

> Lưu ý về nguồn dữ liệu: dự án **không có Git** (`fatal: not a git repository`), nên tiến độ được
> xác định bằng cách đọc trực tiếp source + chạy test/build, không dựa vào `git diff`.

---

## 1. Bảng tiến độ

| Hạng mục | Trạng thái | Bằng chứng |
| --- | --- | --- |
| **PHẦN B — LocalStorage + IndexedDB** | **HOÀN THÀNH** (code + test) | 4 lỗi đã sửa; test storage/IDB pass |
| **PHẦN A — Mobile Preview (frameless)** | **HOÀN THÀNH** (code + test); chưa xác nhận trên máy thật | `PhonePreview.tsx`, test mới |
| **PHẦN C — Responsive Results Panel** | **HOÀN THÀNH** (code); chưa xác nhận trên máy thật | `ResultsPanel.tsx`, `PhonePreview.tsx` |
| **MỤC I — Navigation mobile** | **HOÀN THÀNH** (code); chưa xác nhận trên máy thật | `Header.tsx`, `i18n.ts` |
| **MỤC II — Phone/PC switcher trên mobile** | **HOÀN THÀNH** (code + test) | `PhonePreview.tsx`, `PhonePreview.test.tsx` |
| **MỤC III — Responsive Results Panel (Caption + Headline)** | **HOÀN THÀNH** (code); chưa xác nhận trên máy thật | `ResultsPanel.tsx` |
| **MỤC IV — TikTok mobile preview 9:16** | **HOÀN THÀNH** (code); chưa xác nhận trên máy thật | `PhonePreview.tsx` |
| **Kiểm thử (mục I–IV)** | **HOÀN THÀNH** | `npx vitest run` = 132/132 pass (11 file); `npm run build` OK |
| **MỤC 1 — Card menu không bị badge Previewing đẩy xuống** | **HOÀN THÀNH** (code + test) | `ResultsPanel.tsx`, `ResultsPanel.test.tsx` |
| **MỤC 2 — Nút regenerate từng item icon-only trên mobile** | **HOÀN THÀNH** (code + test) | `ResultsPanel.tsx`, `i18n.ts` |
| **MỤC 3 — Gộp 4 nút điều khiển một hàng trên mobile** | **HOÀN THÀNH** (code); chưa xác nhận layout thật ở 320px | `ResultsPanel.tsx` |
| **MỤC 4A — Tăng diện tích Mobile Preview** | **HOÀN THÀNH** (code); chưa xác nhận trên máy thật | `PhonePreview.tsx` |
| **MỤC 4B — Scale PC Preview khi focus trên điện thoại** | **HOÀN THÀNH** (code); chưa xác nhận trên máy thật | `PhonePreview.tsx` |
| **Kiểm thử (mục 1–4)** | **HOÀN THÀNH** | `npx vitest run` = 136/136 pass (12 file); `npm run build` OK |
| **CP1 — TikTok Preview refinement** | **HOÀN THÀNH** (code + test); chưa xác nhận trên máy thật | `PhonePreview.tsx`, `i18n.ts` |
| **CP2 — Navigation + vùng trắng dưới màn hình** | **HOÀN THÀNH** (code + test); chưa xác nhận trên máy thật | 9 thay đổi — `App.tsx`, `Header.tsx`, `index.css`, `ControlPanel.tsx`, `PhonePreview.tsx`, `PillGroup.tsx`, `AudiencePicker.tsx`, `index.html` |
| **CP3 — Tổng kiểm tra Mobile UX** | **HOÀN THÀNH** (rà tĩnh, có bảng đối chiếu §4d); chưa đo trên máy thật | 1 lỗi overflow ngang 320px tìm thấy & đã sửa |
| **Kiểm thử (CP1–CP3)** | **HOÀN THÀNH** | `npx vitest run` = 136/136 pass (12 file); `npm run build` OK |

Chỉ đánh dấu "HOÀN THÀNH" khi đã sửa code thật và chạy test/build thật. Phần "chưa xác nhận trên
máy thật" nghĩa là **không có thiết bị Chrome Android / Safari iOS trong môi trường này** — xem §6.

---

## 2. PHẦN B — LocalStorage + IndexedDB (đã hoàn thành)

### Nguyên nhân gốc (4 lỗi thực tế đã xác định bằng cách đọc code, không đoán)

1. `useHistory.ts` gọi `crypto.randomUUID()` **không guard** → trên HTTP (non-secure context, ví dụ
   mở qua LAN IP) `crypto.randomUUID` không tồn tại → ném lỗi khi thêm history.
2. `imageStore.ts` → `putImage` resolve trên **`request.onsuccess`** → báo "đã lưu" trước khi
   transaction commit thật.
3. `imageStore.ts` → `openDatabase` **cache `null` vĩnh viễn** khi `onerror`/`onblocked` → sau một lần
   mở DB thất bại thì không bao giờ thử lại.
4. `storage.ts` → `saveHistory` có `await hasQuotaFor()` xen giữa read/write → hai lần lưu chồng lấn có
   thể khiến snapshot cũ ghi đè snapshot mới.

### File đã sửa (Phần B)

- [src/lib/utils.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/utils.ts) — thêm `createId()` có guard
  `crypto.randomUUID`, `createImageId()` dùng `createId('img')`.
- [src/hooks/useHistory.ts](file:///Users/a/Desktop/Apps/CapAI/src/hooks/useHistory.ts) — dùng
  `createId('entry')`; thêm `HistorySaveState` (`idle|saving|saved|failed|unavailable`), `saveState`,
  probe `isStorageAvailable()`, `unmigratedImages`.
- [src/lib/imageStore.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/imageStore.ts) — `putImage` resolve
  trên `transaction.oncomplete`; `openDatabase` thêm cooldown retry + `onversionchange`.
- [src/lib/storage.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/storage.ts) — `saveHistory` serialize
  qua `writeQueue`; thêm `isStorageAvailable()`.
- [src/lib/i18n.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/i18n.ts) — chuỗi mới EN + VI cho trạng
  thái lưu và cảnh báo ảnh chờ migration.
- [src/components/HistoryDrawer.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/HistoryDrawer.tsx)
  — component `StorageStatus` hiển thị trạng thái lưu.
- [src/App.tsx](file:///Users/a/Desktop/Apps/CapAI/src/App.tsx) — truyền `saveState` +
  `unmigratedImages` xuống drawer.

### Test (Phần B)

- [src/lib/storage.test.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/storage.test.ts)
- [src/lib/imageStore.transaction.test.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/imageStore.transaction.test.ts) (mới)
- [src/lib/imageStore.unavailable.test.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/imageStore.unavailable.test.ts) (mới)
- [src/hooks/useHistory.test.tsx](file:///Users/a/Desktop/Apps/CapAI/src/hooks/useHistory.test.tsx)

**Kiến trúc lưu trữ KHÔNG thay đổi**: text ở localStorage (`captivibe.history.v2`), Blob ở IndexedDB
(DB `captivibe`, version 1, store `images`). Không đổi schema, không reset DB version, không tạo store
trùng lặp → dữ liệu history cũ được bảo toàn.

---

## 3. PHẦN A — Mobile Preview frameless (đã hoàn thành)

### Vấn đề
Trên điện thoại thật, mockup hiển thị **một chiếc điện thoại giả nằm trong điện thoại thật**: viền dày,
status bar / Dynamic Island / home indicator giả, mockup quá cao và không tận dụng chiều rộng.

### Thay đổi
[src/components/PhonePreview.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/PhonePreview.tsx)

- Thêm hook `useIsPhoneViewport()` — dùng `matchMedia('(max-width: 639px)')` để phát hiện **viewport
  thật của trình duyệt**, tách biệt hoàn toàn với `device` do người dùng chọn trong app.
- `const frameless = isPhoneViewport && device === 'mobile'`.
- Nhánh frameless: **bỏ** outer frame, status bar, Dynamic Island, home indicator; render trực tiếp
  giao diện nền tảng trong card `w-full` + `px-3 sm:px-4`, `h-[min(68dvh,600px)]`, `max-w-[560px]`.
- Tách JSX 3 screen (`InstagramScreen` / `TikTokScreen` / `FacebookScreen`) thành một biến `screen`
  dùng chung cho cả 2 shell → **giữ nguyên quy tắc cô lập theme** (Instagram/Facebook light, TikTok
  dark, màu hard-coded).
- Desktop và tablet **giữ nguyên** mockup cũ (handset frame + `BrowserPreview` + fullscreen).
- Thêm `data-preview-shell="frameless" | "handset"` (theo convention `data-platform-menu` sẵn có) làm
  điểm neo cho test.
- `PreviewControls`: **ẩn device selector** khi viewport thật là điện thoại.

Test mới: [src/components/PhonePreview.test.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/PhonePreview.test.tsx)
- Phone viewport (390px) + device mobile → shell = `frameless`.
- Desktop viewport (1280px) + device mobile → shell = `handset`.
- Device desktop ở cả hai width → không có handset shell.
- `PreviewControls`: ẩn device group trên phone, hiện trên desktop.

---

## 4. PHẦN C — Responsive Results Panel (đã hoàn thành)

- [src/components/ResultsPanel.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/ResultsPanel.tsx)
  — `TabButton` dùng `px-2.5 sm:px-3.5` để hàng toolbar không bị wrap ở 320px (device selector đã được ẩn
  trên phone nên hàng có thêm chỗ).
- [src/components/PhonePreview.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/PhonePreview.tsx)
  — bộ đếm ký tự thêm `max-w-full` + `min-w-0` để chuỗi dài (ví dụ "Over Instagram's limit") **wrap
  xuống dòng thay vì tràn ngang**.

---

## 4b. MỤC I–IV — Mobile-First Responsive Rework (đã hoàn thành, chưa xác nhận máy thật)

Mục tiêu: CaptiVibe AI phải có cảm giác là **app web thiết kế riêng cho điện thoại**, không phải
giao diện desktop bị thu nhỏ.

### MỤC I — Navigation mobile — [src/components/Header.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/Header.tsx)
- Giảm chiều cao header trên mobile: `px-3 py-2` (từ `px-4 py-3`), logo `size-9 rounded-xl`
  (từ `size-11 rounded-2xl`), tiêu đề `text-[15px]` (từ `text-base`).
- Giữ lại logo + tên sản phẩm + **nút History** (hành động chính) ở mọi kích thước; trên mobile nút
  History chỉ còn icon (`h-10`) + badge.
- **Gom mục phụ vào menu thu gọn**: nút `MoreHorizontal` (`size-10`, chỉ hiện dưới `sm`) chứa bộ chọn
  ngôn ngữ và nút đổi theme. Trên `sm+` hai mục này vẫn nằm trực tiếp trong thanh như trước.
- Menu có `aria-haspopup`/`aria-expanded`, đóng khi click ra ngoài hoặc nhấn `Escape`.
- Thêm key i18n `header.more` (EN "More options" / VI "Tùy chọn khác").
- **Không** chuyển sang bottom navigation (giữ kiến trúc thanh trên hiện có).

### MỤC II — Phone / PC preview switcher — [src/components/PhonePreview.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/PhonePreview.tsx)
- **Đảo ngược quyết định cũ**: bỏ điều kiện `{!isPhoneViewport && …}` — device selector (Phone/PC)
  **luôn hiển thị**, kể cả trên điện thoại thật.
- `PreviewControls` không còn phụ thuộc `useIsPhoneViewport`; lựa chọn Phone/PC là **trạng thái độc
  lập** với thiết bị đang dùng, **không** dùng User-Agent hay bề rộng viewport để chặn PC Preview.
- Giảm padding trigger `PlatformMenu` (`px-2.5 sm:px-3.5`) và `DeviceButton` (`px-2.5 sm:px-3.5`) để
  hàng toolbar vừa 320px mà ít phải wrap hơn.
- Shell preview giữ nguyên logic: frameless khi (viewport ≤639px **và** device = mobile); nếu chọn PC
  thì `BrowserPreview` (đã có sẵn cơ chế scale theo bề rộng + fullscreen) tự co vừa màn hình điện thoại.

### MỤC III — Responsive Results Panel — [src/components/ResultsPanel.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/ResultsPanel.tsx)
- `ActionsMenu` trigger: `size-11` (ô vuông 44px) → **`size-9`** (36px), khớp chuẩn chiều cao `h-9` của
  toolbar (tiêu chuẩn đã đặt trước đó), tránh "ô vuông quá lớn chỉ để chứa icon".
- **Caption card**: phần đuôi mô tả dài (`limit for Instagram` / `limit for TikTok`) được ẩn trên
  mobile (`hidden sm:inline` khi mức `ok`); **vẫn hiện** cảnh báo "Approaching the limit" và
  "Over the … limit" vì màu sắc một mình không truyền đạt đủ. Thêm `whitespace-nowrap` cho cụm
  `count / limit`.
- Thu gọn khoảng cách header/card (`gap-x-2 gap-y-1.5`) ở cả headline và caption để hàng đầu ít wrap.

### MỤC IV — TikTok mobile preview — [src/components/PhonePreview.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/PhonePreview.tsx)
- Ở chế độ frameless, TikTok được tách nhánh riêng: canvas **dọc 9:16** (`aspect-[9/16]`), bo góc
  `rounded-[28px]`, **viền mảnh** `border border-white/10`, **shadow nhẹ** `shadow-xl shadow-black/40`
  — thay cho khung máy dày.
- Bề rộng canvas bị chặn bởi chiều cao khả dụng: `maxWidth: min(100%, calc((100dvh - 210px) * 0.5625))`
  → không tràn ngang, không vượt quá màn hình.
- Toàn bộ UI TikTok (video stage, avatar + badge, caption, nhạc, rail tim/bình luận/lưu/chia sẻ và
  bottom nav) **giữ nguyên bên trong canvas** — không có nút nào bị đẩy ra ngoài video viewport.
- Instagram/Facebook frameless tăng nhẹ chiều cao `h-[min(72dvh,640px)]` để tận dụng thêm diện tích.

---

## 4c. MỤC 1–4 — Mobile UI Polish: Results Toolbar & Preview Scale (đã hoàn thành, chưa xác nhận máy thật)

### MỤC 1 — Nút menu card không bị badge `Previewing` đẩy xuống — [src/components/ResultsPanel.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/ResultsPanel.tsx)

**Nguyên nhân**: `ActionsMenu` (và trước đó là `MenuItem` regenerate) nằm **chung một nhóm
`flex-wrap`** với badge `Previewing` (caption) / chung hàng `ml-auto` (headline). Khi badge xuất hiện,
tổng bề rộng vượt dòng → flex-wrap đẩy nút "⋯" xuống hàng dưới.

**Cách sửa**: tách mỗi card thành **3 khu vực riêng biệt**:
1. **Header** `flex items-center justify-between gap-2` — nhãn card (trái) + cluster action
   (`flex shrink-0 items-center gap-1.5` chứa `RegenerateItemButton` + `ActionsMenu`) ở **góc trên
   bên phải**. Vì cluster là `shrink-0` và nằm trên hàng của chính nó, metadata dài/wrap bên dưới
   **không thể** đẩy nó xuống.
2. **Metadata** `mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5` — điểm AI, số ký tự, trạng thái
   Previewing/nút Preview. Wrap **có kiểm soát** trên hàng riêng.
3. **Content** — caption `<p className="mt-2 …">` / `<textarea className="… mt-2 …">`; headline
   `<p className="mt-1.5 break-words …">` / `<input …>`.

**Không** dùng fixed width hay absolute positioning — chỉ dùng thứ tự hàng + `shrink-0`.

Test bảo vệ: [src/components/ResultsPanel.test.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/ResultsPanel.test.tsx)
— case "keeps the action cluster out of the row that holds the Previewing badge".

### MỤC 2 — Rút gọn nút "Regenerate this item" — [src/components/ResultsPanel.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/ResultsPanel.tsx) + [src/lib/i18n.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/i18n.ts)

- Thêm component `RegenerateItemButton`: mobile (`< sm`) chỉ hiển thị icon `RefreshCw`; từ `sm` trở lên
  hiện thêm chữ "Regenerate" (`sm:w-auto sm:px-2.5`, mặc định `size-9`).
- **Accessible name bắt buộc**: `aria-label`/`title` = `results.regenerateCaption` ("Regenerate this
  caption") hoặc `results.regenerateHeadline` ("Regenerate this headline") tuỳ loại card — phân biệt
  rõ với "Regenerate all" ở toolbar.
- Thêm 3 key i18n EN + VI: `results.regenerate`, `results.regenerateCaption`, `results.regenerateHeadline`.
- Chức năng không đổi: vẫn gọi `onRegenerateCaption(index)` / `onRegenerateHeadline(index)`.

### MỤC 3 — Gộp 4 nút điều khiển trên một hàng (mobile) — [src/components/ResultsPanel.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/ResultsPanel.tsx)

- `section` `p-4 sm:p-5` → `p-3 sm:p-5`; toolbar gap `gap-2` → `gap-1.5 sm:gap-2`.
- Nhóm action: bỏ `flex-wrap`/`ml-auto`, dùng `flex min-w-0 shrink-0 items-center gap-1 sm:gap-2`.
- **Copy Post / Undo All / Regenerate All**: `size-9 shrink-0 justify-center … sm:w-auto sm:px-3(.5)`;
  nhãn bọc `<span className="hidden sm:inline">` → mobile chỉ còn icon, đủ 36px vùng chạm.
  Mỗi nút có `aria-label` + `title`.
- `TabButton` (segmented `[ Preview | Results ]`): `gap-1`, `px-1.5 xs:px-2.5 sm:px-3.5` để hàng vừa
  320px kể cả khi nhãn tiếng Việt ("Xem trước"/"Kết quả") dài hơn tiếng Anh.
- Kết quả: bốn điều khiển nằm **một hàng** `[ Preview | Results ] [ Copy icon ] [ Regenerate icon ]`
  trên mobile; desktop/tablet vẫn giữ label đầy đủ.

### MỤC 4A — Tăng diện tích Mobile Preview — [src/components/PhonePreview.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/PhonePreview.tsx)

- Frameless wrapper: `px-3 pb-2 sm:px-4` → `px-0 pb-1 sm:px-4 sm:pb-2` → canvas chiếm **toàn bộ** bề
  rộng panel trên điện thoại.
- Outer wrapper `pb-4` → `pb-2 sm:pb-4`.
- IG/FB frameless: `h-[min(72dvh,640px)]` → `h-[min(76dvh,640px)]`.
- TikTok canvas: `maxWidth: min(100%, calc((100dvh - 210px) * 0.5625))` → `(100dvh - 150px)` → canvas
  9:16 cao hơn, rộng hơn ở cùng chiều cao màn hình.
- Khoảng cách selector → canvas đã tối thiểu: toolbar `pb-3` + `PhonePreview` `pt-0`.
- **Không** crop/biến dạng: IG/FB dùng `max-w-[560px] w-full` cố định tỉ lệ theo chiều cao; TikTok giữ
  `aspect-[9/16]`.

### MỤC 4B — Scale PC Preview khi focus trên điện thoại — [src/components/PhonePreview.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/PhonePreview.tsx)

**Nguyên nhân**: khi viewport thật là điện thoại nhưng người dùng chọn PC Preview rồi bấm phóng to,
nhánh fullscreen desktop cũ chỉ **reflow** canvas 1100×700 vào màn hình dọc → chỉ thấy một lát cắt và
tràn khỏi màn hình.

**Cách sửa** (chỉ áp dụng khi `isPhoneViewport` thật):
- Thêm hằng `FULLSCREEN_GUTTER = 10`, `FULLSCREEN_CHROME_HEIGHT = 48`.
- Trong `useLayoutEffect` đo viewport: tính `fullscreenScale = min(availableWidth / 1100,
  availableHeight / 700)` với `available*` = chiều landscape (sau khi xoay 90°) trừ chrome bar (đo
  thật qua `fullscreenChromeRef`) và gutter 2 mép.
- Render fullscreen: nếu `isPhoneViewport` → wrapper `padding: FULLSCREEN_GUTTER` + box
  `width/height = 1100×700 × scale` + inner `transform: scale(scale)` với `transformOrigin: top left`
  → **toàn bộ mô phỏng desktop thu nhỏ vừa khung**, giữ nguyên tỉ lệ, không cắt cạnh, không tràn.
- Nhánh desktop (không phải phone) **giữ nguyên** hoàn toàn (scroller như cũ) → không ảnh hưởng
  fullscreen trên desktop.

---

## 4d. MOBILE UX POLISH & TIKTOK PREVIEW REFINEMENT (3 checkpoint)

Nhiệm vụ: tối ưu trải nghiệm trên **điện thoại thật** — cuộn trang, navigation, vùng hiển thị,
Preview và các thành phần cố định. Chia 3 checkpoint; sau mỗi checkpoint lưu file + cập nhật tài liệu.

### CP1 — TikTok Mobile Preview refinement — [src/components/PhonePreview.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/PhonePreview.tsx) + [src/lib/i18n.ts](file:///Users/a/Desktop/Apps/CapAI/src/lib/i18n.ts) — HOÀN THÀNH

**Vấn đề**: `TikTokScreen` có thanh tab feed "Following / For You" ở mép trên; media stage bị khoan
`top-7` (28px) để chừa chỗ cho tab đó → vừa thừa thành phần, vừa để lại dải trống phía trên ảnh.

**Thay đổi**:
1. **Bỏ hoàn toàn** khối tab Following/For You trong `TikTokScreen`; xóa 2 prop `forYou`/`following`
   khỏi signature + call site. **Giữ** key i18n `preview.following` (vẫn dùng ở `TikTokDesktop` —
   sidebar desktop); xóa key `preview.forYou` (EN + VI) vì không còn nơi dùng.
2. **Media full-bleed** `inset-x-0 bottom-11 top-7` → `inset-0`: ảnh/track phủ trọn canvas 9:16 đúng
   như player TikTok thật, nên ảnh 9:16 **lấp đầy khung chính xác** — không còn dải trống do bỏ tab,
   cũng không còn cột đen hai bên như khi stage thấp hơn tỉ lệ ảnh. Ảnh vẫn `object-contain` →
   **không crop ngoài ý muốn**.
3. **Đồng nhất icon**: `RailItem` (tim / bình luận / lưu / chia sẻ) từ `size-[21px]` → `size-[22px]`,
   khớp đúng cỡ icon của `NavItem` (bottom nav) → toàn mockup dùng một cỡ icon 22px, `strokeWidth 2.5`
   (nét đậm, không mảnh).
4. Bottom nav (`bg-black/90`) và rail/caption giữ nguyên lớp `z-20/z-30` → nav nổi trên media đúng
   như TikTok; caption vẫn tựa `bottom-[60px]` trên scrim gradient nên **không che vùng giữa ảnh**.

**Không** đổi: `aspect-[9/16]`, `object-contain` (không crop), theme dark hard-coded của TikTok,
`maxWidth: min(100%, calc(100svh - 150px) * 0.5625)` (đơn vị `svh` — xem CP2), cơ chế tap trái/phải
để chuyển ảnh, badge `N/M`.

### CP2 — Navigation ổn định + vùng trắng phía dưới — HOÀN THÀNH (code + test)

**Kết luận điều tra (có bằng chứng, không phỏng đoán):**

1. **Navigation "lúc ẩn lúc hiện" KHÔNG do JavaScript.** Đã grep toàn bộ `src` cho
   `addEventListener` — **không có listener `scroll`/`scrollY`/`scrollTop` nào** điều khiển ẩn/hiện
   navigation. Nguyên nhân gốc là **shell cao cố định `h-[100dvh] overflow-hidden`** ở [src/App.tsx](file:///Users/a/Desktop/Apps/CapAI/src/App.tsx#L510):
   `dvh` được giải lại **mỗi lần URL bar Chrome Android trượt** (do `interactive-widget=resizes-content`),
   nên cả app — header gồm — reflow giữa lúc cuộn. Đây chính là "giật / nhấp nháy".
2. **Vùng trắng phía dưới = footer `sticky bottom-0` của card form** ở
   [src/components/ControlPanel.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/ControlPanel.tsx#L149).
   `position: sticky` chỉ "dính" trong một **scroll box có biên**; ở mobile card cao bằng nội dung và
   **document** mới là scroll container → `sticky bottom-0` không dính trong card mà trôi theo
   viewport, **nâng nguyên một thanh đục `bg-card` (trắng ở light mode) lên sát đáy màn hình** chừng
   nào form còn vượt quá fold → đúng "dải trắng che mất field cuối".
   Đã **loại trừ có kiểm chứng**: `NoticeStack` (`pointer-events-none`, chỉ render khi có notice),
   toast `fixed bottom-5` (chỉ khi copy), `ConfirmDialog`/`HistoryDrawer` (overlay thật, có khóa
   body), `*::before/*::after` (chỉ nằm trong `prefers-reduced-motion`), `.app-shell padding-bottom: env(safe-area-inset-bottom)`
   (hợp lệ, cần cho home indicator).
3. **Nguyên nhân gốc thứ hai — 4 chỗ `dvh`/`vh` trong preview** cũng giải lại khi URL bar trượt →
   canvas/khung preview **đổi kích thước giữa lúc cuộn**, làm chiều cao document thay đổi theo.

**Thay đổi (sửa nguyên nhân gốc, không dùng `z-index:-1` / `display:none`):**

| # | File | Thay đổi |
| --- | --- | --- |
| 1 | [src/App.tsx](file:///Users/a/Desktop/Apps/CapAI/src/App.tsx#L510) | Shell: `min-h-[100dvh]` → **`min-h-[100svh]`**, chỉ còn `lg:h-[100dvh] lg:overflow-hidden`. `svh` = chiều cao khi browser UI lớn nhất, **không đổi khi cuộn** → shell không còn là thứ nhảy. Bỏ scroll nội bộ + `scroll-pb-28` khỏi `main` (mobile: **document là scroll container duy nhất**). |
| 2 | [src/components/ControlPanel.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/ControlPanel.tsx#L149) | Footer card: bỏ `sticky bottom-0 z-10` + `lg:static` → **normal flow ở mọi kích thước**, giữ `lg:shrink-0`. Không còn lớp đục nào nổi trên field. |
| 3 | [src/index.css](file:///Users/a/Desktop/Apps/CapAI/src/index.css#L44) | `html,body,#root`: `height:100%` → **`min-height:100%`** (phải được phép cao theo nội dung khi document cuộn). Thêm `html { scroll-padding-top: calc(3.5625rem + env(safe-area-inset-top)) }` (+ `sm`: `4.3125rem`) khớp **đúng chiều cao header thật** (57px / 69px). Chuyển `env(safe-area-inset-top)` khỏi `.app-shell` sang header (xem #4) để bar không trượt lên dưới notch khi cuộn; `.app-shell` giữ `padding-bottom: env(safe-area-inset-bottom)`. |
| 4 | [src/components/Header.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/Header.tsx#L52) | `sticky top-0` dính vào **đỉnh scrollport**, không phải mép đã đệm của shell → inset notch phải nằm trên chính header: `py-2`/`py-3` viết lại thành `pb-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]` (+ `sm`). Trên màn không có notch, inset = 0 → header cao y như cũ. |
| 5 | [src/components/PhonePreview.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/PhonePreview.tsx#L399) | 3 chỗ `dvh` → **`svh`**: `maxWidth: min(100%, calc((100svh - 150px) * 0.5625))`, `h-[min(76svh,640px)]`, `h-[min(680px,calc(100svh_-_266px))]`. Kích thước canvas được tính một lần và **giữ nguyên khi cuộn**. |
| 6 | [src/components/PhonePreview.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/PhonePreview.tsx#L220) | `PlatformMenu`: dưới `sm` menu neo vào **toolbar** (`relative` → `shrink-0 sm:relative`) thay vì vào trigger 54px. Ở 320px toolbar wrap và trigger nằm sát mép trái panel → menu `right-0` (160px) tràn ~78px ra ngoài mép trái viewport, mà trang LTR **không cuộn về trái được** → nửa menu không thể chạm tới. |
| 7 | [src/components/PillGroup.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/PillGroup.tsx#L41) + [src/components/AudiencePicker.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/AudiencePicker.tsx#L65) | Bỏ `scroll-mt-24` (96px) trên 2 anchor của "error summary". `html { scroll-padding-top }` đã lo phần offset header; để lại sẽ **cộng dồn** thành ~153px, nhảy quá xa. |
| 8 | [src/App.tsx](file:///Users/a/Desktop/Apps/CapAI/src/App.tsx#L539) | Bỏ `scroll-mt-[4.5rem] sm:scroll-mt-24 lg:scroll-mt-4` trên `resultsRef` — cùng lý do cộng dồn (56 + 72 = 128px). Offset giờ do `scroll-padding-top` của `html` quyết định. |
| 9 | [index.html](file:///Users/a/Desktop/Apps/CapAI/index.html#L6) | Cập nhật comment viewport (nhắc "sticky mobile action bar" đã bị bỏ ở #2) — chỉ sửa tài liệu, không đổi hành vi. |

**Đánh đổi đã ghi nhận (không giấu):** nút Generate **không còn `sticky`** ở mobile. Nút vẫn nằm ngay
dưới field cuối cùng của form, nên không cần cuộn thêm để tới; đổi lại **không còn lớp đục nào che
field**. Ràng buộc cũ trong memory ("nút Generate phải sticky ở mobile") xung đột trực tiếp với yêu cầu
PHẦN 3 của nhiệm vụ này (không để thành phần che nội dung) → chọn bỏ sticky, và ghi rõ ở đây để người
dùng quyết định lại nếu muốn ưu tiên tính tiện lợi.

**Thay đổi hành vi theo dải viewport:** dải `640–1023px` (tablet/`sm`–`lg`) chuyển từ "shell cao cố
định + panel tự cuộn" sang **document cuộn** (vì ở dải này layout vẫn là 1 cột dọc, grid chỉ bật từ
`lg`). Desktop `≥1024px` **giữ nguyên hoàn toàn** shell cao cố định + 2 cột tự cuộn.

**Không** đổi: logic generate, AI contract, storage/history, theme isolation của mockup (`IG/FB` luôn
light, `TikTok` luôn dark), fullscreen PC preview, `aspect-[9/16]`, cơ chế paging ảnh.

### CP3 — Tổng kiểm tra Mobile UX — HOÀN THÀNH (rà tĩnh có bằng chứng)

Rà 11 bước hành trình (PHẦN 4) + 7 viewport 320/360/375/390/414/430/768 (PHẦN 5) bằng **đọc code +
tính toán hình học**, không có screenshot (máy không có engine Blink — xem §6).

| Hạng mục PHẦN 3/5 | Kết luận |
| --- | --- |
| Bottom navigation | **Không có** bottom nav trong app → không phải nguồn vùng trắng |
| Fixed bottom toolbar / sticky footer / floating action bar | Đã bỏ hết (CP2 #2). Chỉ còn 3 overlay thật: toast (chỉ khi copy), `ConfirmDialog`, `HistoryDrawer` |
| `position: fixed` / `sticky` | `Header` (`sticky top-0`, đã sửa inset), `NoticeStack` (chỉ render khi có notice), toast, fullscreen preview (khóa body), 2 dialog |
| Pseudo-element `::before/::after` | Chỉ có trong `@media (prefers-reduced-motion)` → không tạo vùng phủ |
| Safe-area inset dưới | `.app-shell padding-bottom: env(safe-area-inset-bottom)` — **giữ**, cần cho home indicator; không nhân đôi ở nơi khác |
| `padding-bottom`/`margin-bottom` của body/main | `main` = `py-4` (16px) + inset đáy → ~16px + inset, không có khoảng trắng thừa |
| Spacer bù fixed element | **Không còn** (không còn fixed bottom bar) |
| `100vh` / `100dvh` / `min-height` | Chỉ còn `lg:h-[100dvh]` (App shell, desktop) và `h-[min(640px,calc(100vh_-_190px))]` (mockup desktop không-compact) — cả hai **chỉ chạy từ `lg`/1024px**, nơi URL bar không trượt |
| Scroll container lồng nhau | Mobile = **1 scroll container duy nhất (document)**. Scroller còn lại là scroller *bên trong* mockup (`screenScrollerRef`) — có biên, đúng như app thật |
| `overflow: hidden` trên body | **Không có** trong CSS. Chỉ set inline khi mở fullscreen preview / HistoryDrawer (có restore) → không dùng để che lỗi cuộn |
| Overflow ngang 320px | **Đã tìm và sửa 1 lỗi**: menu platform tràn trái ở ≤357px (CP2 #6). Toolbar Preview `flex-wrap` nên wrap thành 2 hàng ở 320–357px — chấp nhận được, không đẩy trang ngang |
| Bàn phím che nội dung | `interactive-widget=resizes-content` → layout resize theo bàn phím; nút Generate ở cuối form nên khi gõ field cuối nút nằm ngay dưới field đó |

### CP3 — phần KHÔNG thể xác nhận (xem §6, không nhận là đã xong)

Các kết luận CP3 ở trên là **suy luận từ đọc code + tính hình học** (jsdom không có layout engine và
máy này không có Chrome/Chromium/Playwright/Puppeteer — chỉ có Firefox.app + Safari.app). Những điểm
dưới đây **chưa được đo trên máy thật**: xem danh sách đầy đủ ở §6.

---

## 5. Test đã chạy & kết quả

| Lệnh | Kết quả |
| --- | --- |
| `npx tsc --noEmit` | pass |
| `npx vitest run` | **136/136 pass — 12 file** |
| `npm run build` | **OK** (1699 modules, `dist/`, CSS 86.25 kB / JS 389.54 kB) |

Test mới của nhiệm vụ hiện tại: [src/components/ResultsPanel.test.tsx](file:///Users/a/Desktop/Apps/CapAI/src/components/ResultsPanel.test.tsx)
(4 case — mỗi card có re-roll riêng đúng tên, re-roll đúng index và không gọi `onRegenerate`,
action cluster tách khỏi hàng chứa badge Previewing, badge không nằm trong header row của nhãn).

Độ phủ 12 storage test case yêu cầu ở PHẦN C (đã đối chiếu file test thực tế):

| # | Case | Ở đâu |
| --- | --- | --- |
| 1 | Lưu history mới & đọc lại | `storage.test.ts` round-trip |
| 2 | Refresh trang dữ liệu vẫn còn | localStorage round-trip |
| 3 | Đóng/mở lại tab | như #2 (giới hạn của unit test) |
| 4 | Lưu nhiều history liên tiếp | `useHistory.test.tsx` vòng lặp 41 mục |
| 5 | Cập nhật 1 row không mất row khác | `storage.test.ts` |
| 6 | Xóa 1 history + dữ liệu liên quan | `useHistory.test.tsx` remove + GC ảnh |
| 7 | Lưu/đọc lại ảnh Blob | `imageStore.test.ts` |
| 8 | Giữ đúng thứ tự ảnh | `imageStore.test.ts` `loadProductImages` |
| 9 | JSON không hợp lệ | `storage.test.ts` truncated/not-a-list |
| 10 | LocalStorage quota error | `storage.test.ts` `QuotaExceededError` |
| 11 | IndexedDB open/transaction error | `imageStore.transaction.test.ts`, `imageStore.unavailable.test.ts` |
| 12 | Browser từ chối/không hỗ trợ storage | `storage.test.ts` `isStorageAvailable`, `useHistory.test.tsx` |

---

## 6. CHƯA XÁC NHẬN (không được coi là đã kiểm chứng)

- **Chưa có thiết bị thật**: không chạy được Chrome Android / Safari iOS. Toàn bộ kết luận về
  IndexedDB/localStorage trên mobile hiện dựa trên test jsdom + `fake-indexeddb` + đọc code, **không
  phải** bằng chứng runtime trên máy thật.
- Breakpoint 320 / 360 / 375 / 390 / 414 / 430 / 768 / 1024 / 1440 px: mới kiểm tra bằng **suy luận
  layout + test jsdom**, chưa đo bằng DevTools/thiết bị thật.
- Hành vi mobile lifecycle (background/foreground, tab bị evict, mất mạng) chưa test thực tế.
- `dvh` / safe-area / bàn phím che nội dung: chưa xác nhận trên trình duyệt thật.
- **Mục I–IV mới chỉ được kiểm bằng `tsc` + test jsdom + build.** Chưa quan sát bằng mắt trên
  Chrome Android: chiều cao header thực tế, việc rơi menu thu gọn, canvas TikTok 9:16 có vừa màn
  hình không, và toolbar Preview có wrap đẹp ở 320px không.
- **Mục 1–4 (nhiệm vụ hiện tại) cũng chỉ được kiểm bằng `tsc` + test jsdom + build.** jsdom không có
  layout engine, nên các kết luận sau là **suy luận từ số đo font/mô hình flex**, chưa đo thật:
  - Hàng toolbar 4 nút ở 320px: ước tính bề rộng khả dụng 296px (320 − padding `p-3`) so với nhu cầu
    ≈ 253px (EN, không có nút Undo) … ≈ 293px (VI, có nút Undo) → **vừa**, nhưng chỉ còn ~3px dư ở
    trường hợp xấu nhất. Cần đo lại bằng DevTools thật ở 320px với ngôn ngữ Tiếng Việt **và** trạng
    thái có nút Undo.
  - Scale PC Preview trong fullscreen trên phone: công thức dựa trên `window.innerWidth/Height` +
    `fullscreenChromeRef.offsetHeight`; chrome bar đo được thật khi chạy. Cần xác nhận canvas không bị
    quá nhỏ ở các máy có safe-area/ thanh địa chỉ động (Safari iOS `dvh` co giãn).
  - Vùng chạm tối thiểu 44px: các nút toolbar dùng `size-9` (36px) — **thấp hơn 44px**; đây là chủ ý
    để 4 nút vừa một hàng (đã dùng từ trước), cần cân nhắc nếu ưu tiên khả năng truy cập hơn mật độ.

### Riêng CP1–CP3 (MOBILE UX POLISH & TIKTOK PREVIEW REFINEMENT)

- **Không có engine Blink để chụp ảnh.** Máy chỉ có `Firefox.app` + `Safari.app`; không có
  Chrome/Chromium/Edge/Playwright/Puppeteer → **không thể** screenshot hay đo layout bằng engine mà
  Chrome Android dùng. Mọi kết luận về giật/cuộn/vùng trắng là **phân tích nguyên nhân gốc từ code**,
  không phải quan sát runtime.
- **Chưa xác nhận trên máy thật**: (a) header còn nhảy khi cuộn nhanh hay không, (b) có còn dải trắng
  nào ở đáy khi cuộn hết form, (c) canvas TikTok 9:16 có vừa màn hình ở 320–430px không, (d) menu
  platform ở 320px đã nằm trọn trong màn hình chưa, (e) `svh` có ổn định khi URL bar trượt trên
  Chrome Android và Safari iOS.
- **Đánh đổi có chủ ý của `svh`**: chiều cao canvas/khung mockup giảm khoảng bằng chiều cao URL bar
  (≈56px trên máy 360px) so với `dvh` khi URL bar đã ẩn — đổi lại kích thước **cố định trong suốt
  lúc cuộn**. Đây là nguyên nhân "diện tích preview nhỏ hơn một chút" so với MỤC 4A trước đó.
- **Nút Generate mất trạng thái sticky ở mobile** (xem đánh đổi ở §4d CP2) — cần người dùng xác nhận
  đây là lựa chọn mong muốn, vì nó đổi hành vi so với ràng buộc cũ.
- **PC Preview (compact) đổi `scale` theo `window.resize`**: trên điện thoại dọc, `widthScale` luôn
  nhỏ hơn `heightScale` nên `scale` **không** đổi khi URL bar trượt (không giật). Trên máy nằm ngang
  thấp thì `heightScale` mới là ràng buộc → **về lý thuyết** `scale` có thể đổi khi URL bar trượt;
  chưa đo được trên máy thật. Không sửa để tránh phá vỡ PC Preview/fullscreen (PHẦN 6).
- **Vùng trắng có thể là UI của hệ điều hành**: nếu trên máy thật vẫn còn một dải ở đáy mà **không**
  phải do app (ví dụ thanh điều hướng/gesture bar của Android hoặc thanh công cụ Safari), thì đó là
  giao diện trình duyệt/hệ điều hành — **không can thiệp** theo đúng yêu cầu PHẦN 3.

---

## 7. Việc tiếp theo

1. Kiểm tra thủ công trên Chrome Android (và Safari iOS nếu có): header gọn, menu ⋯, chuyển
   Phone/PC trên điện thoại, canvas TikTok 9:16, frameless preview, upload ảnh, lưu/khôi phục
   history, refresh, đóng/mở tab.
2. Đối chiếu overflow ngang ở 320px–430px bằng DevTools thật (đặc biệt hàng toolbar Preview và
   các card Headline/Caption).
3. Đo thật 4 case của Mục 1–4 trong §6 (toolbar 4 nút ở 320px VI + Undo; PC Preview focus trên phone;
   vùng chạm).
4. Tích hợp Gemini API — đã được triển khai trong source; xem `docs/ai/IMPLEMENTATION_GUIDE.md`. Còn cần cấu hình API key riêng và chạy benchmark thật.

---

## 8. File đã thay đổi trong phiên này

Nhiệm vụ hiện tại — CP1 (TikTok Preview refinement):

- `src/components/PhonePreview.tsx` — `TikTokScreen`: bỏ tab Following/For You + 2 prop; media
  `inset-0` (full-bleed); `RailItem` icon `size-[22px]`.
- `src/lib/i18n.ts` — xóa `preview.forYou` (EN + VI); giữ `preview.following` cho `TikTokDesktop`.
- `docs/WORK_PROGRESS.md` — §4d + bảng tiến độ CP1–CP3.

Nhiệm vụ hiện tại — CP2 (Navigation ổn định + vùng trắng phía dưới) + CP3 (tổng kiểm tra Mobile UX):

- `src/App.tsx` — shell `min-h-[100svh]` (chỉ `lg:h-[100dvh] lg:overflow-hidden`); `main` bỏ
  `h-auto min-h-0 scroll-pb-28 overflow-y-auto` (document là scroll container ở mobile); bỏ
  `scroll-mt-*` trên `resultsRef`.
- `src/index.css` — `html,body,#root` dùng `min-height: 100%`; thêm `html { scroll-padding-top }`
  (3.5625rem / `sm` 4.3125rem + `env(safe-area-inset-top)`); `.app-shell` bỏ `padding-top`
  (chuyển sang header), giữ `padding-bottom: env(safe-area-inset-bottom)`.
- `src/components/ControlPanel.tsx` — footer card bỏ hẳn `sticky bottom-0 z-10` (+ `lg:static`)
  → normal flow, không còn thanh đục che field.
- `src/components/Header.tsx` — `py-2`/`py-3` → `pb-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]`
  (+ `sm`) để bar sticky không trượt lên dưới notch.
- `src/components/PhonePreview.tsx` — 3 chỗ `dvh` → `svh` (TikTok `maxWidth`, IG/FB frameless,
  handset shell); `PlatformMenu` neo vào toolbar dưới `sm` (sửa overflow ngang ở 320px).
- `src/components/PillGroup.tsx`, `src/components/AudiencePicker.tsx` — bỏ `scroll-mt-24` (cộng dồn
  với `scroll-padding-top` của `html`).
- `index.html` — comment viewport cập nhật theo thay đổi CP2.

Nhiệm vụ trước (Mục 1–4):

- `src/components/ResultsPanel.tsx` — tách card Headline/Caption thành Header / Metadata / Content;
  thêm `RegenerateItemButton` (icon-only trên mobile, có aria-label riêng); gộp 4 nút toolbar một hàng
  (`size-9`, `gap-1`, `TabButton` `px-1.5 xs:px-2.5 sm:px-3.5`).
- `src/lib/i18n.ts` — thêm `results.regenerate`, `results.regenerateCaption`,
  `results.regenerateHeadline` (EN + VI).
- `src/components/PhonePreview.tsx` — frameless `px-0 pb-1`; IG/FB `h-[min(76dvh,640px)]`; TikTok
  `(100dvh - 150px)`; fullscreen PC Preview scale trên phone (`FULLSCREEN_GUTTER`,
  `FULLSCREEN_CHROME_HEIGHT`, `fullscreenChromeRef`, `fullscreenScale`).
- `src/components/ResultsPanel.test.tsx` (mới) — 4 case bảo vệ cấu trúc card + re-roll từng item.

Nhiệm vụ trước (Mục I–IV):

- `src/components/Header.tsx` (viết lại: thanh gọn mobile + menu thu gọn)
- `src/lib/i18n.ts` (thêm `header.more` EN + VI)
- `src/components/PhonePreview.tsx` (device selector luôn hiện; canvas TikTok 9:16; padding gọn)
- `src/components/ResultsPanel.tsx` (ActionsMenu `size-9`; caption header responsive)
- `src/components/PhonePreview.test.tsx` (sửa 2 test PreviewControls theo yêu cầu mới)

Nhiệm vụ trước (PHẦN A/C):
- `src/components/PhonePreview.tsx`, `src/components/ResultsPanel.tsx`
- `src/components/PhonePreview.test.tsx` (mới)

(Phần B được hoàn thành ở phiên trước — danh sách file ở §2.)


---

## 9. Tích hợp Gemini AI (2026-11-07)

- Đọc và đối chiếu `docs/ai/AI_SPECIFICATION.md`, `PROMPTS.md`, `OUTPUT_SCHEMA.json` và
  `BENCHMARK_TEST_CASES.md`.
- Thêm Node same-origin API (`server/`) gọi Gemini Interactions API; API key chỉ nằm trong
  environment của server, không nằm trong bundle React.
- Thêm Zod input/output validation, tối đa một lượt sửa JSON sai schema, kiểm tra độ dài caption,
  trùng strategy/hashtag và gần-trùng nội dung khi tạo lại từng mục.
- Upload ảnh từ IndexedDB dưới dạng multipart binary; không gửi `blob:` URL. Backend xác nhận MIME,
  chữ ký file, kích thước thực và giới hạn ảnh riêng cho request inline của Gemini.
- Kết nối tạo mới, tạo lại toàn bộ, tạo lại từng caption/headline; giữ local generator làm fallback
  khi thiếu key, mất mạng, vượt quota hoặc provider lỗi.
- Lưu/khôi phục AI score, feedback, image insights và nguồn sinh nội dung trong History/Undo.
- Thêm contract/provider/prompt/adapter tests và `docs/ai/IMPLEMENTATION_GUIDE.md`.
- Xác minh bằng Node syntax checks và 6 Node prompt/provider tests (đều pass). Chưa chạy được toàn bộ
  `npm test`/`npm run build` trong môi trường đóng gói này vì `npm install` bị timeout nên chưa có
  `node_modules`; cần cài dependency rồi chạy lại trên máy phát triển.
- Chưa chạy benchmark live vì chưa có API key của chủ dự án. Trước khi public cần cấu hình `.env`,
  test model/quota và chạy các case trong `docs/ai/BENCHMARK_TEST_CASES.md`.

---

## 10. Global DNA (Admin-owned system profile)

- Added a separate Global DNA source table for ten Admin-provided seed posts; it is isolated from user/community learning tables.
- Added compact profile analysis in one GPT request, versioned draft creation, preview and explicit activation with rollback history.
- Added Admin-only RLS and server-verified Admin routes; no service-role key is required.
- Wired active DNA into full Generate and single-item regeneration through a server memory cache; no synchronous Supabase lookup is added to Generate.
- The actual ten source posts have not yet been entered by the project Admin. Run migration 002, paste the ten posts in `/admin`, create a draft and activate after review.

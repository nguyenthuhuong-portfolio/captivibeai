# CaptiVibe AI — Hướng dẫn chạy GPT + Local Mock Fallback

Cập nhật: 08-11-2026

Tài liệu này mô tả luồng Generate hiện tại. Ứng dụng dùng một provider duy nhất là OpenAI GPT-6 Luna; khi API không khả dụng, frontend tự chuyển sang Local Generator/mẫu nội dung có sẵn. Không gọi Gemini và không thử model thứ hai.

## 1. Mô hình hoạt động

```text
ProductForm + ảnh trong IndexedDB
              |
              v
       src/lib/ai.ts
              |
      POST /api/ai/generate
              |
              v
       Node API server
   validate input + images
   build compact server-owned prompt
              |
              v
       OpenAI Responses API
       gpt-6-luna / effort=none
       Structured Outputs + image input
       exactly one request (no retry / repair)
              |
              v
      Zod validation
              |
              v
       GeneratedContent + metadata

Nếu API key thiếu, GPT lỗi, timeout hoặc output không hợp lệ:
       src/lib/generate.ts → Local Generator / mock content
       UI hiển thị thông báo fallback
```

## 2. Model và chi phí

- Model ID mặc định: `gpt-6-luna`.
- API: OpenAI Responses API (`POST https://api.openai.com/v1/responses`).
- Reasoning: `none` để tránh tốn thời gian/token suy luận cho tác vụ tạo nội dung theo mẫu rõ ràng.
- Structured Outputs: JSON Schema strict, sau đó server vẫn kiểm tra lại bằng Zod.
- Giá niêm yết được OpenAI công bố tại thời điểm cập nhật: **$0.10 / 1 triệu input tokens** và **$0.50 / 1 triệu output tokens**. Giá có thể thay đổi; xem [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing) trước khi triển khai thực tế.
- Giá API được tính riêng, không bao gồm trong gói ChatGPT.

## 3. Cấu hình môi trường

Node.js 22.12 trở lên và npm.

Tạo hoặc mở file `.env` ở thư mục gốc và thêm:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL_ID=gpt-6-luna
AI_MONTHLY_REQUEST_LIMIT=300
RATE_LIMIT_SALT=put_a_long_random_value_here
PORT=8788
HOST=127.0.0.1
```

`OPENAI_API_KEY` là secret server-side. Không đặt tên biến là `VITE_OPENAI_API_KEY`, không dán key vào React, file `src/`, prompt, browser storage hoặc commit `.env` lên Git.

Cài dependency và chạy cả API server lẫn Vite:

```bash
npm install
npm run dev
```

Mở địa chỉ Vite hiển thị trong terminal (mặc định `http://127.0.0.1:5173`). Script `scripts/dev.mjs` khởi động API server ở `127.0.0.1:8788`; Vite proxy `/api` về server này.

## 4. Luồng Generate

### Tạo nội dung mới

- Gửi brief, audience, tone, ngôn ngữ, mục tiêu, extra details và platform.
- Ảnh được đọc từ IndexedDB bằng ID và gửi dạng multipart binary; không gửi `blob:` URL.
- GPT trả 3 caption, 3 headline, 5 hashtag, score/feedback cho 6 nội dung và tối đa 3 nhận xét hình ảnh.
- Server kiểm tra JSON bằng Zod trước khi frontend nhận dữ liệu.
- Không truy vấn Supabase đồng bộ trong đường Generate; server gắn Global DNA active từ cache bộ nhớ nếu có.

### Tạo lại toàn bộ

- Một request GPT mới, gửi brief và các bản trước để tránh lặp ý.
- Không upload lại ảnh; tái sử dụng image insights đã có.

### Tạo lại một caption/headline

- Một request GPT riêng cho item được chọn.
- Không gửi ảnh; giữ nguyên siblings và image insights.

## 5. Tối ưu tốc độ và token

- Một thao tác Generate chỉ gọi GPT đúng một lần.
- Không retry 429/5xx, không chờ `Retry-After`, không gọi repair request.
- `reasoning.effort` đặt `none`; verbosity đặt `low`.
- Giới hạn output: 2.000 tokens cho full generation và 600 tokens cho single-item regeneration.
- Ảnh gửi với `detail: low` để phù hợp mục tiêu tiết kiệm token; GPT vẫn nhận được tín hiệu thị giác tổng quát.
- Backend provider deadline: 18 giây tính sau khi nhận xong request body/ảnh. Frontend timeout: 30 giây để có thời gian upload ảnh.
- Server log model, prompt version, provider latency, prompt-build time, số request (tối đa 1) và outcome; không log brief, caption, ảnh hoặc API key.

Đây là giới hạn bảo vệ trải nghiệm, không phải cam kết thời gian phản hồi của OpenAI. Latency thực tế phụ thuộc model capacity, network, image size, API tier và tải hệ thống.

## 6. GPT lỗi hoặc chưa cấu hình API key

Nếu thiếu `OPENAI_API_KEY`, lỗi xác thực, rate limit, lỗi 5xx, timeout, mất mạng hoặc output không qua validation:

1. Backend trả lỗi đã chuẩn hóa ngay sau lần gọi duy nhất (hoặc không gọi nếu thiếu key).
2. Frontend tự chạy `src/lib/generate.ts`.
3. UI hiển thị nhãn/thông báo nội dung mẫu để người dùng không nhầm với nội dung từ GPT.
4. Brief và kết quả trước đó không bị xóa do lỗi API.

Không có Gemini fallback, không có model GPT thứ hai, không có retry hoặc repair call.

## 7. Dữ liệu và ảnh

- Brief và ảnh được gửi đến OpenAI để xử lý khi người dùng chọn Generate.
- Ảnh được truyền dưới dạng data URL từ backend tới Responses API; hiện gửi ở mức `detail: low`.
- Request dùng `store: false`, nhưng người vận hành vẫn cần đọc [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data) và điều khoản hiện hành trước khi đưa dữ liệu nhạy cảm vào hệ thống.
- Không đưa API key, credentials, dữ liệu cá nhân nhạy cảm hoặc thông tin mà người dùng không chấp thuận gửi tới AI bên thứ ba.

## 8. Test và build

```bash
npm test
npm run build
npm start
```

Trước khi public, cần chạy benchmark thực tế bằng API key của dự án và kiểm tra cả: text-only, có ảnh, regenerate all, regenerate một item, API key sai, thiếu key, 429, 5xx và timeout. Không có live API key trong gói source nên test ở đây chỉ xác nhận request shape và fallback/error handling; latency thật cần đo ở môi trường của bạn.

## 9. File chính

- `server/index.mjs`: HTTP API, multipart/image checks, rate limits, quota, Zod validation và static build.
- `server/provider.mjs`: OpenAI Responses API client, một request duy nhất.
- `server/contract.mjs`: Zod input/output schema và provider JSON Schema.
- `server/prompts.mjs`: system instruction và prompt builders.
- `src/lib/ai.ts`: frontend adapter và timeout.
- `src/lib/generate.ts`: Local Generator / mock fallback.
- `src/App.tsx`: generate, regenerate, fallback, undo và history.

## 10. Global DNA (Admin-owned)

- Run `supabase/migrations/002_global_dna.sql` after migration 001.
- In `/admin` → **CaptiVibe Global DNA**, the Admin enters ten source posts in ten dedicated slots and saves them to `global_dna_sources`.
- `POST /api/learning/dna/build` verifies the caller is Admin, loads the ten rows itself, validates their count/positions/length, and submits them to GPT in one request. It creates a compact versioned draft through the Admin-only `create_global_style_draft` RPC.
- The Admin previews the generated profile and explicitly activates it with `POST /api/learning/dna/activate`. The `activate_global_style_profile` RPC archives the previous active profile and activates the selected draft atomically.
- Source content is hashed into the draft. Activation is blocked with `dna_sources_changed_rebuild_required` when Admin edits the source posts after the draft was generated.
- The active compact profile is warmed into a Node memory cache before the API accepts traffic and has a five-minute TTL. After expiry, the next Generate uses the last cached snapshot while triggering a background refresh; activation explicitly refreshes the cache before returning. Generate does not await Supabase.
- `server/global-dna.mjs` validates source/profile schema and owns the active-DNA cache. `server/prompts.mjs` appends the active profile to full and one-item prompts as style-only guidance.
- Global DNA is not influenced by community, personal or existing `learning_patterns` rows. The approved Inspiration Cards workflow remains a separate phase.


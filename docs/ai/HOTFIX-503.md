# GPT provider errors — one request then local mock fallback

Cập nhật: 08-11-2026.

## Hành vi hiện tại

- Provider duy nhất: OpenAI `gpt-6-luna` qua Responses API.
- Mỗi thao tác Generate gọi API tối đa **một lần**.
- Không retry 429/5xx, không đợi `Retry-After`, không gọi lượt sửa JSON thứ hai.
- JSON dùng Structured Outputs strict và vẫn được Zod kiểm tra ở backend.
- Backend giới hạn provider deadline 18 giây sau khi đã nhận xong body/ảnh; frontend timeout 30 giây.
- Nếu API key thiếu, lỗi xác thực, 429, 5xx, timeout, network hoặc output invalid, frontend tự dùng Local Generator/mock content.
- Không gọi Gemini hoặc model thứ hai.
- Log chỉ ghi status, model, latency, prompt version và số request; không ghi body lỗi, brief, ảnh hoặc API key.

## Lý do thiết kế

Mục tiêu của CaptiVibe hiện tại là tạo số lượng lớn với chi phí thấp và phản hồi nhanh. Retry hoặc repair làm tăng token, chi phí và thời gian chờ mà không đảm bảo lần sau thành công. JSON Schema strict giúp giảm lỗi cấu trúc; khi model vẫn lỗi, mock fallback đảm bảo người dùng có nội dung để tiếp tục.

## Verify

```bash
node --check server/provider.mjs
node --check server/index.mjs
node --test server/provider.test.mjs server/prompts.test.mjs
```

Cần benchmark bằng API key thật để đo latency và token usage thực tế. Không được diễn giải deadline 18 giây thành cam kết rằng OpenAI luôn phản hồi trong 18 giây.

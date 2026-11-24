# Mai Anh Chatbot — Backend

Server nhỏ (Node.js, không cần cài thêm gói nào) nhận tin nhắn từ trang web
"Chat với Mai Anh" và gọi **Meta Model API** để trả lời với tính cách Mai Anh.

## 1. Lấy API key (miễn phí đăng ký, trả theo lượng dùng)

1. Mở https://dev.meta.ai và đăng nhập tài khoản Meta.
2. Mở tab **API keys** → bấm **Create API key**, đặt tên ví dụ `mai-anh-chatbot` → **Create**.
3. Copy key ngay (key chỉ hiện **một lần**, bắt đầu bằng `LLM_`). Cất giữ cẩn thận, đừng đăng công khai.

Giá tham khảo (xem lại trên trang giá của Meta khi làm): model Muse tính phí theo
số token (1.000 token ≈ 750 từ tiếng Anh). Dùng ít thì chi phí rất nhỏ; bạn theo
dõi mức dùng trong tab Usage của dashboard.

## 1b. Lấy API key FPT.AI để Mai Anh nói giọng nữ tiếng Việt thật

Trang web ưu tiên đọc câu trả lời bằng giọng nữ tiếng Việt thật qua FPT.AI
(giọng `banmai`: nữ, miền Bắc, nhẹ nhàng). Nếu chưa có key này, trang sẽ dùng
tạm giọng của trình duyệt.

1. Mở https://console.fpt.ai và đăng nhập bằng tài khoản FPT ID (đăng ký miễn phí
   nếu chưa có).
2. Tạo một **Project** mới, bật dịch vụ **Text to Speech**.
3. Copy **API key** của project. Gói miễn phí cho 100.000 ký tự mỗi tháng —
   đủ cho hàng nghìn câu trả lời ngắn.
4. Khi deploy ở bước 3 dưới đây, thêm biến môi trường:
   - Key: `FPT_API_KEY` — Value: dán API key FPT.AI vừa lấy.
   - (Không bắt buộc) Key: `FPT_TTS_VOICE` — Value: `banmai` (muốn đổi giọng nữ
     khác thì dùng `lannhi` hoặc `linhsan`).

## 2. Đưa code lên GitHub (không cần biết dùng git)

1. Mở https://github.com/new, tạo repository mới tên `mai-anh-chatbot` (để Public).
2. Trong repo mới, bấm **uploading an existing file** và tải lên 3 file trong thư
   mục này: `server.js`, `package.json`, `.env.example` (không tải file `.env`
   thật lên — file đó chỉ ở máy bạn).
3. Bấm **Commit changes**.

## 3. Deploy miễn phí trên Render

1. Mở https://render.com, đăng ký/đăng nhập (dùng tài khoản GitHub cho nhanh).
2. Bấm **New +** → **Web Service** → chọn repository `mai-anh-chatbot` → **Connect**.
3. Điền:
   - **Name:** `mai-anh-chatbot`
   - **Runtime:** Node
   - **Build Command:** để trống (không cần build)
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
4. Mục **Environment Variables** → **Add Environment Variable**:
   - Key: `MODEL_API_KEY` — Value: dán API key vừa lấy ở bước 1.
   - (Không bắt buộc) Key: `MODEL_NAME` — Value: `muse-spark-1.3`
5. Bấm **Create Web Service** và chờ deploy xong (vài phút). Render sẽ cấp một
   địa chỉ dạng `https://mai-anh-chatbot.onrender.com`.
6. Kiểm tra: mở `https://mai-anh-chatbot.onrender.com/health` trên trình duyệt,
   thấy `{"ok":true,...}` là chạy rồi.

Lưu ý: gói Free của Render sẽ "ngủ" khi không có ai dùng một lúc; tin nhắn đầu
tiên sau lúc ngủ có thể chờ khoảng 30–60 giây để server tỉnh dậy, các tin sau
đó nhanh bình thường.

## 4. Nối trang web Chat với Mai Anh vào backend

1. Mở trang web **Chat với Mai Anh** → mở phần **Cài đặt** (biểu tượng bánh răng).
2. Dán địa chỉ backend (ví dụ `https://mai-anh-chatbot.onrender.com`) vào ô
   **Địa chỉ backend**, bấm Lưu.
3. Trạng thái trên trang sẽ đổi từ "Chế độ demo" sang "AI thật" — từ lúc này
   mọi người chat trên trang đều được Mai Anh (AI thật) trả lời.

## Chạy thử trên máy của bạn (không bắt buộc)

```bash
cd chatbot-server
cp .env.example .env   # rồi mở .env điền MODEL_API_KEY thật
node server.js
curl http://localhost:3000/health
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Chào Mai Anh!"}]}'
```

## Bảo mật

- **Không bao giờ** đưa `MODEL_API_KEY` vào code, không đăng lên mạng, không
  dán vào khung chat công khai. Key chỉ nằm trong biến môi trường của server.
- Nếu lộ key: vào dashboard https://dev.meta.ai → **Delete** key cũ → tạo key
  mới → cập nhật lại biến môi trường trên Render và deploy lại.

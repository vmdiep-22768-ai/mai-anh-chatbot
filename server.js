// Mai Anh Chatbot — backend server (Node.js, không cần cài thêm gói nào)
// Gọi Meta Model API (OpenAI-compatible) để trả lời với tính cách Mai Anh.
const http = require('http');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.MODEL_API_KEY || '';
const MODEL = process.env.MODEL_NAME || 'muse-spark-1.3';
const API_URL = 'https://api.meta.ai/v1/chat/completions';

// Giọng nữ tiếng Việt thật của Mai Anh qua FPT.AI TTS (giọng banmai: nữ, miền Bắc, nhẹ nhàng).
const FPT_API_KEY = process.env.FPT_API_KEY || '';
const FPT_TTS_VOICE = process.env.FPT_TTS_VOICE || 'banmai';
const FPT_TTS_URL = 'https://api.fpt.ai/hmi/tts/v5';

const PERSONA = `Bạn là Mai Anh, một KOL streamer AI người Việt, ấm áp, thân thiện và duyên dáng.
- Luôn trả lời bằng tiếng Việt, xưng "em", gọi người đang trò chuyện là "bạn".
- Câu trả lời ngắn gọn, tự nhiên như đang trò chuyện (thường 1-3 câu), thỉnh thoảng dùng emoji nhẹ nhàng.
- Bạn trò chuyện về đời sống, tình cảm, gia đình, hôn nhân, công việc, giải trí; chia sẻ góc nhìn tích cực, nhẹ nhàng.
- Bạn là nhân vật AI, không bao giờ tự nhận là người thật.
- Không đưa ra lời khuyên y tế, pháp lý hay tài chính chuyên sâu; chỉ chia sẻ thông tin chung và khuyên gặp chuyên gia khi cần.
- Không nói về chính trị, không công kích cá nhân hay nhóm người nào.`;

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;
const hits = new Map(); // ip -> [timestamps]

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > RATE_LIMIT_MAX;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 200000) req.destroy();
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true, model: MODEL, keyConfigured: Boolean(API_KEY), ttsConfigured: Boolean(FPT_API_KEY) });
    return;
  }
  if (req.method === 'POST' && req.url === '/api/speak') {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    if (rateLimited(ip)) {
      sendJson(res, 429, { error: 'Bạn nhắn nhanh quá, chờ một chút rồi nhắn lại nhé.' });
      return;
    }
    if (!FPT_API_KEY) {
      sendJson(res, 500, { error: 'Server chưa cấu hình FPT_API_KEY.' });
      return;
    }
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      sendJson(res, 400, { error: 'Dữ liệu gửi lên không đúng định dạng.' });
      return;
    }
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (text.length < 3 || text.length > 1000) {
      sendJson(res, 400, { error: 'Câu cần đọc phải từ 3 đến 1000 ký tự.' });
      return;
    }
    try {
      const r = await fetch(FPT_TTS_URL, {
        method: 'POST',
        headers: {
          api_key: FPT_API_KEY,
          voice: FPT_TTS_VOICE,
          speed: '0',
          format: 'mp3',
          'Content-Type': 'text/plain',
        },
        body: text,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.error !== 0 || !data.async) {
        sendJson(res, 502, { error: data.message || 'FPT.AI không tạo được giọng đọc.' });
        return;
      }
      // FPT.AI trả về đường dẫn file async: chờ file sẵn rồi tải về.
      let buf = null;
      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
          const a = await fetch(data.async);
          if (a.ok) {
            const b = Buffer.from(await a.arrayBuffer());
            if (b.length > 1000) { buf = b; break; }
          }
        } catch { /* thử lại */ }
      }
      if (!buf) {
        sendJson(res, 502, { error: 'FPT.AI chưa trả file âm thanh kịp, bạn thử lại nhé.' });
        return;
      }
      sendJson(res, 200, { audio: 'data:audio/mpeg;base64,' + buf.toString('base64') });
    } catch {
      sendJson(res, 502, { error: 'Không kết nối được tới FPT.AI, bạn thử lại sau nhé.' });
    }
    return;
  }
  if (req.method !== 'POST' || req.url !== '/api/chat') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  if (rateLimited(ip)) {
    sendJson(res, 429, { error: 'Bạn nhắn nhanh quá, chờ một chút rồi nhắn lại nhé.' });
    return;
  }
  if (!API_KEY) {
    sendJson(res, 500, { error: 'Server chưa cấu hình MODEL_API_KEY.' });
    return;
  }

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    sendJson(res, 400, { error: 'Dữ liệu gửi lên không đúng định dạng.' });
    return;
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const messages = incoming
    .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    sendJson(res, 400, { error: 'Cần có ít nhất một tin nhắn của người dùng.' });
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'developer', content: PERSONA }, ...messages],
        temperature: 0.8,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data?.error?.message || `Meta Model API trả về lỗi ${r.status}.`;
      sendJson(res, 502, { error: msg });
      return;
    }
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      sendJson(res, 502, { error: 'AI không trả về nội dung, bạn thử lại nhé.' });
      return;
    }
    sendJson(res, 200, { reply });
  } catch (e) {
    sendJson(res, 502, { error: 'Không kết nối được tới AI, bạn thử lại sau nhé.' });
  }
});

server.listen(PORT, () => {
  console.log(`Mai Anh chatbot backend đang chạy ở cổng ${PORT} (model: ${MODEL})`);
});

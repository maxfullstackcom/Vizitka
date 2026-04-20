export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const referer = request.headers.get('Referer') || '';
    const allowedOrigin = env.ALLOWED_ORIGIN;
    const cors = corsHeaders(allowedOrigin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405, cors);
    }

    if (origin !== allowedOrigin) {
      return json({ ok: false, error: 'Origin not allowed' }, 403, cors);
    }

    if (!referer.startsWith(allowedOrigin)) {
      return json({ ok: false, error: 'Referer not allowed' }, 403, cors);
    }

    try {
      const body = await request.json();
      const name = safe(body.name, 80);
      const contact = safe(body.contact, 200);
      const company = safe(body.company, 120);
      const message = safe(body.message, 2000);
      const source = safe(body.source, 500);
      const sentAt = safe(body.sent_at, 80);
      const hpField = safe(body.hp_field, 200);

      if (hpField) {
        return json({ ok: true }, 200, cors);
      }

      if (!contact || !message) {
        return json({ ok: false, error: 'Missing required fields' }, 400, cors);
      }

      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const rateKey = `rate:${ip}`;
      const existing = await env.CONTACT_KV.get(rateKey);
      if (existing) {
        return json({ ok: false, error: 'Too many requests, try later' }, 429, cors);
      }
      await env.CONTACT_KV.put(rateKey, '1', { expirationTtl: 60 });

      const text = [
        '📩 Новое обращение с сайта',
        '',
        `👤 Имя: ${name || '—'}`,
        `🏢 Компания: ${company || '—'}`,
        `📞 Контакт: ${contact}`,
        `💬 Сообщение: ${message}`,
        '',
        `🌐 Источник: ${source || '—'}`,
        `🕒 Время: ${sentAt || '—'}`,
        `🧭 IP: ${ip}`,
      ].join('\n');

      const tgResponse = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TG_CHAT_ID,
          text,
          disable_web_page_preview: true,
        }),
      });

      const tgData = await tgResponse.json();
      if (!tgResponse.ok || !tgData.ok) {
        return json({ ok: false, error: 'Telegram send failed', telegram: tgData }, 502, cors);
      }

      return json({ ok: true }, 200, cors);
    } catch (error) {
      return json({ ok: false, error: String(error) }, 500, cors);
    }
  },
};

function safe(value, maxLen) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLen);
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function json(data, status, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

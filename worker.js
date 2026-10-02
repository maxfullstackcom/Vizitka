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

    if (!env.RESEND_API_KEY || !env.CONTACT_TO_EMAIL) {
      console.error('Contact relay misconfigured: missing RESEND_API_KEY or CONTACT_TO_EMAIL');
      return json({ ok: false, error: 'Internal server error' }, 500, cors);
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

      const subjectLabel = name || company || contact;
      const text = [
        'New contact form submission from maxfullstack.com',
        '',
        `Name: ${name || '—'}`,
        `Company: ${company || '—'}`,
        `Contact: ${contact}`,
        '',
        'Message:',
        message,
        '',
        `Source: ${source || '—'}`,
        `Submitted at: ${sentAt || '—'}`,
        `IP: ${ip}`,
      ].join('\n');

      const from = env.CONTACT_FROM_EMAIL || 'Max Full Stack <onboarding@resend.dev>';
      const emailPayload = {
        from,
        to: [env.CONTACT_TO_EMAIL],
        subject: `Site inquiry: ${subjectLabel}`.slice(0, 200),
        text,
      };

      const replyTo = extractReplyTo(contact);
      if (replyTo) {
        emailPayload.reply_to = replyTo;
      }

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      if (!emailResponse.ok) {
        const detail = (await emailResponse.text()).slice(0, 300);
        console.error('Email send failed', emailResponse.status, detail);
        return json({ ok: false, error: 'Delivery failed' }, 502, cors);
      }

      return json({ ok: true }, 200, cors);
    } catch (error) {
      console.error('Contact relay failed', error);
      return json({ ok: false, error: 'Internal server error' }, 500, cors);
    }
  },
};

function extractReplyTo(contact) {
  const match = contact.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : null;
}

function safe(value, maxLen) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLen);
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function json(data, status, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      ...headers,
    },
  });
}

const CONTACT_ENDPOINT = '';

const form = document.querySelector('[data-contact-form]');
if (form) {
  const status = form.querySelector('[data-form-status]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.className = 'status';
    status.textContent = '';

    if (!form.reportValidity()) return;

    const data = Object.fromEntries(new FormData(form));
    const messageParts = [data.service, data.message].filter(Boolean);
    const payload = {
      name: data.name || '',
      company: data.company || '',
      contact: data.contact || '',
      message: messageParts.join('\n\n'),
      source: window.location.href,
      sent_at: new Date().toISOString(),
      hp_field: data.hp_field || '',
    };

    if (!CONTACT_ENDPOINT) {
      status.classList.add('err');
      status.textContent = 'Contact endpoint is not configured yet. Please email or message via your preferred channel.';
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const response = await fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Request failed');
      form.reset();
      status.classList.add('ok');
      status.textContent = 'Request sent. I will reply soon.';
    } catch (error) {
      status.classList.add('err');
      status.textContent = 'Could not send the request. Please try again later.';
    } finally {
      button.disabled = false;
    }
  });
}

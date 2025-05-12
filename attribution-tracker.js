console.log('[Attribution Tracker] Script loaded.');

document.addEventListener('DOMContentLoaded', function () {
  console.log('[Attribution Tracker] DOM fully loaded.');

  const ZAPIER_PROXY_URL = 'https://proferty-proxy-production.up.railway.app/api/zapier';
  const LOG_PREFIX = '[Attribution Tracker]';

  function getParam(name) {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get(name) || '';
    } catch (e) {
      console.warn(`${LOG_PREFIX} Failed to parse URL param: ${name}`, e);
      return '';
    }
  }

  try {
    const stored = localStorage.getItem('attribution_data');
    const existingSession = stored ? JSON.parse(stored) : {};

    if (!existingSession.session_id) {
      console.log(`${LOG_PREFIX} No existing session. Creating new attribution data...`);

      const newSession = {
        gclid: getParam('gclid'),
        utm_source: getParam('utm_source'),
        utm_medium: getParam('utm_medium'),
        utm_campaign: getParam('utm_campaign'),
        utm_term: getParam('utm_term'),
        utm_content: getParam('utm_content'),
        referrer: document.referrer,
        landing_page: window.location.href,
        user_agent: navigator.userAgent,
        screen_resolution: `${window.innerWidth}x${window.innerHeight}`,
        session_id: crypto.randomUUID(),
        first_touch: new Date().toISOString(),
        tel_click_log: {}
      };

      localStorage.setItem('attribution_data', JSON.stringify(newSession));
      console.log(`${LOG_PREFIX} Session initialized:`, newSession);
    } else {
      console.log(`${LOG_PREFIX} Existing session found:`, existingSession.session_id);
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} Error initializing attribution data:`, err);
  }

  document.body.addEventListener('click', function (event) {
    const link = event.target.closest('a[href^="tel:"]');
    if (!link) return;

    try {
      const href = link.getAttribute('href');
      console.log(`${LOG_PREFIX} tel: link clicked →`, href);

      const data = JSON.parse(localStorage.getItem('attribution_data') || '{}');
      if (!data.session_id) {
        console.warn(`${LOG_PREFIX} No session ID found, aborting send`);
        return;
      }

      const now = Date.now();
      const lastClickTime = data.tel_click_log?.[href]?.lastClick || 0;
      const alreadyLogged = data.tel_click_log?.[href]?.logged || false;

      if (alreadyLogged || now - lastClickTime < 30000) {
        console.log(`${LOG_PREFIX} Duplicate or rapid click detected — skipping send`);
        return;
      }

      data.tel_click_log = data.tel_click_log || {};
      data.tel_click_log[href] = { lastClick: now, logged: true };
      localStorage.setItem('attribution_data', JSON.stringify(data));

      const payload = {
        ...data,
        call_click_time: new Date().toISOString(),
        clicked_number: href
      };

      console.log(`${LOG_PREFIX} Sending to proxy:`, payload);

      fetch(ZAPIER_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(res => res.json())
        .then(data => console.log(`${LOG_PREFIX} Proxy success:`, data))
        .catch(err => console.error(`${LOG_PREFIX} Proxy fetch failed:`, err));
    } catch (err) {
      console.error(`${LOG_PREFIX} Error on tel: click`, err);
    }
  });
});

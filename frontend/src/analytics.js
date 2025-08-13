let initialized = false;

export function initAnalytics(measurementId) {
  if (initialized || !measurementId) return false;
  if (!window.dataLayer) window.dataLayer = [];
  function gtag(){ window.dataLayer.push(arguments); }
  window.gtag = gtag;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
  gtag('js', new Date());
  gtag('config', measurementId, { send_page_view: true });
  initialized = true;
  return true;
}

export function logEvent(name, params = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', name, params);
    return true;
  }
  return false;
}



(function () {
  const config = window.TRE_SENTRY_CONFIG || {};
  if (!config.dsn) return;

  const script = document.createElement("script");
  script.src = "https://browser.sentry-cdn.com/10.57.0/bundle.tracing.min.js";
  script.crossOrigin = "anonymous";
  script.onload = function () {
    if (!window.Sentry) return;
    const configuredTracesSampleRate = Number(config.tracesSampleRate);
    const tracesSampleRate =
      Number.isFinite(configuredTracesSampleRate) &&
      configuredTracesSampleRate >= 0 &&
      configuredTracesSampleRate <= 1
        ? configuredTracesSampleRate
        : 0.05;
    const integrations =
      typeof window.Sentry.browserTracingIntegration === "function"
        ? [
            window.Sentry.browserTracingIntegration({
              enableInp: true,
              instrumentNavigation: true,
              instrumentPageLoad: true,
            }),
          ]
        : [];

    window.Sentry.init({
      dsn: config.dsn,
      environment: config.environment || "production",
      release: config.release || undefined,
      sendDefaultPii: false,
      tracesSampleRate,
      integrations,
      beforeSend(event) {
        if (event.request) {
          delete event.request.cookies;
          delete event.request.data;
          if (event.request.headers) {
            delete event.request.headers.Authorization;
            delete event.request.headers.authorization;
            delete event.request.headers.Cookie;
            delete event.request.headers.cookie;
          }
        }
        return event;
      },
    });
  };
  document.head.appendChild(script);
})();

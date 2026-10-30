# Portal iframe deployment

Set `PORTAL_ALLOWED_ORIGINS` in the LS process environment (or its data directory `.env`), then restart LS:

```dotenv
PORTAL_ALLOWED_ORIGINS=https://portal.example.com:2443
FRONTEND_HMR=false
FRONTEND_HOSTNAME=
```

Replace the example with the real Portal origin. Include the scheme and port, omit paths.
Docker Compose passes `PORTAL_ALLOWED_ORIGINS` to the app container and defaults to
`http://csghub.example.com`. Override it in the Compose project `.env` or shell environment.
The app derives CORS, CSRF, cookie and framing settings from this single value; no separate flags are required.
Multiple origins are comma separated. With an empty/unset value the existing configuration remains unchanged.

This opt-in mode enables credentialed CORS for the configured origins, adds them to CSRF trusted origins,
sets Session/CSRF cookies to `SameSite=None; Secure`, and emits an enforced CSP `frame-ancestors`
allowing self and those Portal origins. It removes LS-generated X-Frame-Options when enabled.
Other CSP directives are preserved. Existing explicit CORS origins are retained; regex origin matching is
disabled in this mode. Cookie flags require HTTPS; use the HTTPS LS domain for login and iframe access.

## Existing login flow

Keep Portal → Dataflow → LS interfaces unchanged. Portal must send credentials on the browser login request:

```javascript
await fetch(`${lsOrigin}/user/login_verfy/?email=${encodeURIComponent(email)}`, {
  method: "POST",
  credentials: "include",
  body: formData, // existing fields; never put long-lived tokens in the iframe URL
});
// Then load the existing /user/login_reques/ URL in the iframe.
```

## Gateway and browser verification

- Serve Portal and LS over HTTPS, including all JS/CSS assets.
- The gateway must not inject `X-Frame-Options: DENY/SAMEORIGIN` or an additional CSP that blocks Portal.
  Application headers cannot remove headers added by the gateway.
- Portal's own CSP `frame-src` must permit the LS HTTPS origin.
- Verify OPTIONS and login responses include the exact Portal origin and
  `Access-Control-Allow-Credentials: true`, without duplicate CORS headers from the gateway.
- Verify the login response sets `SameSite=None; Secure` cookies and iframe requests send the session cookie.
- Third-party cookie blocking can still prevent login for fully cross-site iframes. Prefer a Portal same-site
  gateway deployment when that occurs; CORS does not override browser cookie policy.
- A different origin (including a different port) is not necessarily a different site. Final validation needs
  the actual Portal/LS domains and target browser.

Do not enable this mode with a guessed origin. Until the Portal address is confirmed, leave
`PORTAL_ALLOWED_ORIGINS` unset. End-to-end iframe login remains pending real-environment validation.

from django.core.exceptions import ImproperlyConfigured
from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase, override_settings
from corsheaders.middleware import CorsMiddleware

from core.portal_embed import PortalFrameMiddleware, portal_origins


class PortalEmbedTests(SimpleTestCase):
    def test_origins_are_trimmed_and_deduplicated(self):
        self.assertEqual(portal_origins(' https://portal.example:2443/,https://portal.example:2443 '),
                         ['https://portal.example:2443'])
        self.assertEqual(portal_origins(''), [])

    def test_invalid_origins_rejected(self):
        for value in ['*', 'null', 'https://*.example', 'https://user:pass@example',
                      'https://example/path', 'https://example?q=x', 'https://example#x',
                      'https://example:bad', "https://example;script-src"]:
            with self.subTest(value=value), self.assertRaises(ImproperlyConfigured):
                portal_origins(value)

    @override_settings(PORTAL_ALLOWED_ORIGINS=['https://portal.example:2443'])
    def test_frame_policy_preserves_other_directives(self):
        response = HttpResponse()
        response['X-Frame-Options'] = 'DENY'
        response['Content-Security-Policy'] = "default-src 'self'; frame-ancestors 'none'"
        result = PortalFrameMiddleware(lambda request: response)(RequestFactory().get('/'))
        self.assertEqual(result['Content-Security-Policy'],
                         "default-src 'self'; frame-ancestors 'self' https://portal.example:2443")
        self.assertFalse(result.has_header('X-Frame-Options'))

    @override_settings(PORTAL_ALLOWED_ORIGINS=[])
    def test_disabled_preserves_headers(self):
        response = HttpResponse()
        response['X-Frame-Options'] = 'SAMEORIGIN'
        self.assertEqual(PortalFrameMiddleware(lambda request: response)(None)['X-Frame-Options'], 'SAMEORIGIN')

    @override_settings(CORS_ALLOW_ALL_ORIGINS=False, CORS_ALLOWED_ORIGINS=['https://portal.example:2443'],
                       CORS_ALLOWED_ORIGIN_REGEXES=[], CORS_ALLOW_CREDENTIALS=True,
                       CORS_ALLOW_METHODS=['GET', 'POST', 'OPTIONS'])
    def test_credentialed_preflight_and_untrusted_origin(self):
        handler = CorsMiddleware(lambda request: HttpResponse())
        for origin, allowed in [('https://portal.example:2443', True), ('https://untrusted.example', False)]:
            request = RequestFactory().options('/user/login_verfy/', HTTP_ORIGIN=origin,
                                               HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
                                               HTTP_ACCESS_CONTROL_REQUEST_HEADERS='content-type')
            response = handler(request)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get('Access-Control-Allow-Origin'), origin if allowed else None)
            if allowed:
                self.assertEqual(response['Access-Control-Allow-Credentials'], 'true')

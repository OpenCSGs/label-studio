"""Opt-in settings and response headers for embedding LS in a trusted Portal."""
from urllib.parse import urlsplit

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


def portal_origins(value):
    origins = []
    for origin in value.split(','):
        origin = origin.strip().rstrip('/')
        if not origin:
            continue
        url = urlsplit(origin)
        if (url.scheme not in ('http', 'https') or not url.hostname or url.username
                or url.password or url.path or url.query or url.fragment
                or '*' in origin or any(c.isspace() for c in origin) or ';' in origin):
            raise ImproperlyConfigured('PORTAL_ALLOWED_ORIGINS must contain exact http(s) origins, including ports.')
        try:
            url.port
        except ValueError as exc:
            raise ImproperlyConfigured('Invalid port in PORTAL_ALLOWED_ORIGINS.') from exc
        if origin not in origins:
            origins.append(origin)
    return origins


class PortalFrameMiddleware:
    """Restrict framing to the configured Portal while preserving other CSP rules."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if settings.PORTAL_ALLOWED_ORIGINS:
            policy = response.get('Content-Security-Policy', '')
            directives = [item.strip() for item in policy.split(';') if item.strip()]
            directives = [item for item in directives if item.split()[0].lower() != 'frame-ancestors']
            directives.append("frame-ancestors 'self' " + ' '.join(settings.PORTAL_ALLOWED_ORIGINS))
            response['Content-Security-Policy'] = '; '.join(directives)
            if response.has_header('X-Frame-Options'):
                del response['X-Frame-Options']
        return response

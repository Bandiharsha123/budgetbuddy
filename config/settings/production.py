import os
from .base import *

DEBUG = False

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY')

if not SECRET_KEY:
    raise ValueError("DJANGO_SECRET_KEY environment variable is required.")

ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv('ALLOWED_HOSTS', '').split(',')
    if host.strip()
]

if not ALLOWED_HOSTS:
    raise ValueError("ALLOWED_HOSTS environment variable is required.")

# PostgreSQL is mandatory in production.
if not os.getenv('DATABASE_URL'):
    raise ValueError("DATABASE_URL environment variable is required.")

# Frontend configuration
FRONTEND_URL = os.getenv('FRONTEND_URL', '').rstrip('/')

if not FRONTEND_URL:
    raise ValueError("FRONTEND_URL environment variable is required.")

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv('CORS_ALLOWED_ORIGINS', FRONTEND_URL).split(',')
    if origin.strip()
]
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv('CSRF_TRUSTED_ORIGINS', FRONTEND_URL).split(',')
    if origin.strip()
]
# HTTPS security
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

SECURE_HSTS_SECONDS = 300
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
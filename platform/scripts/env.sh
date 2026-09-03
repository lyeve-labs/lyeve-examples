#!/usr/bin/env bash
# Prints the engine's environment. Kept separate so `make print-env` can show
# exactly what the engine is run with.
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
stack_secrets
cat <<EOF
APP_ENV=development

# Single-tenant. The examples are written for one tenant, and turning this on
# breaks more of them than it helps, so no example enables it.
# apps/saas-multitenant documents what that costs and what it still proves: the
# tenant admin API surface, not request-level isolation.
MULTI_TENANT=false

DATABASE_URL=postgres://postgres:postgres@localhost:$PG_PORT/$PG_DB?sslmode=disable
ADMIN_LISTEN_ADDR=0.0.0.0:$ADMIN_PORT
API_LISTEN_ADDR=0.0.0.0:$API_PORT

# Left at its default the engine cannot write its Ed25519 keypair and silently
# falls back to HS256, so it is pointed somewhere writable.
JWT_KEY_PATH=$STACK/jwt/jwt_key.json

JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
LYEVE_AUDIT_HMAC_KEY=$LYEVE_AUDIT_HMAC_KEY
LYEVE_SETUP_TOKEN=$LYEVE_SETUP_TOKEN
SECURE_COOKIE=false

# The apps are servers, not browsers, so these origins only matter to the admin UI.
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:$ADMIN_PORT

RATE_LIMIT_RPS=0
TRUSTED_PROXIES=127.0.0.1/32,::1/128

# The login route is rate limited per address, which is right in production and
# wrong for a machine that seeds thirteen examples in a row. This raises the
# ceiling for the local stack only. The shared client still backs off and
# retries a 429, because a real deployment will return one.
PUBLIC_RATE_LIMITS=POST:/api/admin/auth/login=2000:4000,POST:/api/v1/auth/token=2000:4000
STORAGE_DRIVER=local

# Outbound webhooks and SMTP refuse private and loopback addresses unless told
# otherwise, which is right in production and would stop the webhook example
# from delivering to its own receiver on this machine.
WEBHOOK_ALLOWED_PRIVATE_NETWORKS=127.0.0.0/8,::1/128
SMTP_ALLOWED_PRIVATE_NETWORKS=127.0.0.0/8,::1/128

SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@lyeve.example
SMTP_TLS=false
EOF

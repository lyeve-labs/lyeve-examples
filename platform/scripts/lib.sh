# Shared settings and helpers for the stack scripts.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STACK="$REPO/.stack"
ENGINE_SRC="${LYEVE_CORE_SRC:-$REPO/../lyeve-core}"
# A development license comes from LYEVE_LICENSE_KEY and LICENSE_PUBLIC_KEY_HEX
# in the environment. See up.sh.

# Ports sit in their own block, clear of the defaults other local development
# servers and databases commonly use, so this stack can run beside them.
PG_PORT="${LYEVE_PG_PORT:-4400}"
ADMIN_PORT="${LYEVE_ADMIN_PORT:-4401}"
API_PORT="${LYEVE_API_PORT:-4402}"
PG_CONTAINER="lyeve-examples-postgres"
PG_DB="lyeve_examples"

ADMIN_EMAIL="${LYEVE_EMAIL:-admin@lyeve.example}"
ADMIN_PASSWORD="${LYEVE_PASSWORD:-Admin12345678}"

# Every paid plugin and paid capability the engine gates. A license carrying
# these features meets no lock in any example, and up.sh does not read the
# list: it is the reference for what the license should carry. The baseline plugins and the free capabilities are granted to every
# install and need no entry. A paid name missing here does not error: the plugin
# starts without its license and its paid routes refuse. A free plugin's paid
# tier is a separate name ending in -pro, such as rate-limit-pro, which is what
# lets this stack raise the sign-in limit.
LICENSE_FEATURES="ab-testing,ai,apianalytics,apikey-pro,audit,audit-pro,audit-retention,cluster,config-sync,content-pro,cron-pro,data-export,data-residency,device-fingerprint,email-pro,events,flow-pro,graphql,grpc,localization-pro,media-pro,messagebroker,mfa-pro,migration-toolkit,multitenant-customization,multitenant-provisioning,oauth-pro,pii-mask,query-monitor,rate-limit-pro,rbac-pro,realtime,recommendations,saml,schema-pro,scim,search,support,synthetic-monitoring-pro,tenant-backup,usage-pro,waf,webhook-pro"

# The engine's three secrets, generated once into the gitignored stack
# directory rather than committed here.
#
# They are never literals in env.sh. This is the example catalog: a committed
# value would make every copy of it boot with the same JWT_SECRET, and anyone
# who has read the repo could forge a token against any stack a reader left
# running.
#
# Persisted so a restart keeps the sessions and the encrypted rows it already
# wrote. Delete .stack/secrets.env to roll them, and expect to sign in again.
stack_secrets() {
    local f="$STACK/secrets.env"
    if [ ! -s "$f" ]; then
        mkdir -p "$STACK"
        # ENCRYPTION_KEY must differ from JWT_SECRET: the engine falls back to
        # the latter for data encryption and warns that it is deprecated, and
        # one value doing both jobs is the thing that warning is about.
        # LYEVE_AUDIT_HMAC_KEY is exactly 64 hex characters or the engine
        # refuses to boot in production. It is generated to the same shape here
        # so an example cannot teach a value that would not deploy.
        umask 077
        {
            printf 'JWT_SECRET=%s\n'           "$(openssl rand -hex 24)"
            printf 'ENCRYPTION_KEY=%s\n'       "$(openssl rand -hex 24)"
            printf 'LYEVE_AUDIT_HMAC_KEY=%s\n' "$(openssl rand -hex 32)"
        } > "$f"
    fi
    # The engine creates the first admin only for a caller holding the setup
    # token. Without LYEVE_SETUP_TOKEN it prints a random one to its log, which
    # a script would have to scrape, so the stack sets its own. Appended on its
    # own so a stack whose secrets predate it keeps its other three.
    if ! grep -q '^LYEVE_SETUP_TOKEN=' "$f"; then
        umask 077
        printf 'LYEVE_SETUP_TOKEN=%s\n' "$(openssl rand -hex 24)" >> "$f"
    fi
    . "$f"
}

say()  { printf '\033[36m==\033[0m %s\n' "$*"; }
ok()   { printf '\033[32mok\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[31mxx\033[0m %s\n' "$*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "$1 is required but not installed"; }

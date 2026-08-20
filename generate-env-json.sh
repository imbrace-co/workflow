#!/bin/sh
set -e

# Frontend container entrypoint script
echo "Starting frontend container..."

# Load a mounted /app/.env into the environment (if present) so a single file can drive
# BOTH the runtime app config (env.json) and the nginx template (envsubst: BACKEND_UPSTREAM, WEBAPP_ORIGIN).
# Note: --env-file at `docker run` works without this; this is only for the mounted-file style.
if [ -f "/app/.env" ]; then
    echo "Loading /app/.env into environment..."
    set -a
    . /app/.env
    set +a
fi

# Set default values for environment variables if not provided
export AP_APP_TITLE="${AP_APP_TITLE:-Activepieces}"
export AP_FAVICON_URL="${AP_FAVICON_URL:-https://cdn.activepieces.com/brand/favicon.ico}"
export GATEWAY_URL="${GATEWAY_URL:-http://backend:3000}"
export AP_FRONTEND_URL="${AP_FRONTEND_URL:-http://localhost:4200}"
export AP_ENVIRONMENT="${AP_ENVIRONMENT:-production}"
export AP_CHAT_WIDGET="${AP_CHAT_WIDGET:-https://chat-widget.dev.imbrace.co}"
export AP_GATEWAY_URL="${AP_GATEWAY_URL:-https://app-gateway.dev.imbrace.co}"
# Constant shared by all envs; read from /app/.env if present, else this default list.
export AP_IMBRACE_ADDING_CONNECTION_PIECES="${AP_IMBRACE_ADDING_CONNECTION_PIECES:-@activepieces/piece-clickup,@activepieces/piece-calendly,@activepieces/piece-gmail,@activepieces/piece-google-calendar,@activepieces/piece-googlechat,@activepieces/piece-google-contacts,@activepieces/piece-google-docs,@activepieces/piece-google-drive,@activepieces/piece-google-forms,@activepieces/piece-google-sheets,@activepieces/piece-google-slides,@activepieces/piece-google-tasks,@activepieces/piece-linkedin,@activepieces/piece-line,@activepieces/piece-jira-cloud,@activepieces/piece-mailchimp,@activepieces/piece-microsoft-365-people,@activepieces/piece-microsoft-365-planner,@activepieces/piece-microsoft-dynamics-365-business-central,@activepieces/piece-microsoft-dynamics-crm,@activepieces/piece-microsoft-excel-365,@activepieces/piece-microsoft-onedrive,@activepieces/piece-microsoft-onenote,@activepieces/piece-microsoft-outlook,@activepieces/piece-microsoft-outlook-calendar,@activepieces/piece-microsoft-power-bi,@activepieces/piece-microsoft-sharepoint,@activepieces/piece-microsoft-teams,@activepieces/piece-microsoft-todo,@activepieces/piece-netsuite,@activepieces/piece-notion,@activepieces/piece-odoo,@activepieces/piece-salesforce,@activepieces/piece-slack,@activepieces/piece-telegram-bot,@activepieces/piece-trello,@activepieces/piece-whatsapp}"

# Per-environment nginx values (the ONLY things that differ between envs).
# These are REQUIRED — there is no fallback, so a misconfigured env fails loud
# instead of silently proxying to the wrong (dev) backend.
missing=""
[ -z "$BACKEND_UPSTREAM" ] && missing="$missing BACKEND_UPSTREAM"
[ -z "$WEBAPP_ORIGIN" ] && missing="$missing WEBAPP_ORIGIN"
if [ -n "$missing" ]; then
    echo "ERROR: required environment variable(s) not set:$missing" >&2
    echo "       Set them in /app/.env (mounted) or via --env-file. Aborting." >&2
    exit 1
fi
export BACKEND_UPSTREAM
export WEBAPP_ORIGIN

# Optional sub-path the app is served under. Default "" (root, "/").
# Normalize to either "" or "/segment" (leading slash, no trailing slash).
BASE_PATH=$(printf '%s' "${BASE_PATH:-}" | sed 's:/*$::')   # strip trailing slashes: "/" -> "", "/apwf/" -> "/apwf"
case "$BASE_PATH" in
    ""|/) BASE_PATH="" ;;
    /*)   ;;
    *)    BASE_PATH="/$BASE_PATH" ;;                          # add leading slash: "apwf" -> "/apwf"
esac
export BASE_PATH
echo "BASE_PATH: ${BASE_PATH:-/ (root)}"

# Render the single nginx template into the active config.
# Only the two vars below are substituted, so nginx runtime vars ($host, $uri, $1, ...) are left intact.
echo "Rendering nginx config (BACKEND_UPSTREAM=$BACKEND_UPSTREAM, WEBAPP_ORIGIN=$WEBAPP_ORIGIN)..."
envsubst '${BACKEND_UPSTREAM} ${WEBAPP_ORIGIN}' \
  < /etc/nginx/nginx.template.conf \
  > /etc/nginx/nginx.conf

# When served under a sub-path, strip it before location matching so static files (served from
# the root html dir) still resolve. When BASE_PATH is empty the marker stays a harmless comment.
if [ -n "$BASE_PATH" ]; then
    sed -i "s|# __BASE_PATH_REWRITE__|rewrite ^${BASE_PATH}/(.*)\$ /\$1 last;|" /etc/nginx/nginx.conf
fi

# Debug: Print environment variables
echo "Environment Configuration:"
echo "AP_APP_TITLE: $AP_APP_TITLE"
echo "AP_FAVICON_URL: $AP_FAVICON_URL"
echo "GATEWAY_URL: $GATEWAY_URL"
echo "AP_FRONTEND_URL: $AP_FRONTEND_URL"
echo "AP_ENVIRONMENT: $AP_ENVIRONMENT"
echo "AP_CHAT_WIDGET: $AP_CHAT_WIDGET"
echo "AP_GATEWAY_URL: $AP_GATEWAY_URL"
echo "AP_IMBRACE_ADDING_CONNECTION_PIECES: $AP_IMBRACE_ADDING_CONNECTION_PIECES"

# Generate env.json from .env file if it exists, otherwise from environment variables
if [ -f "/app/.env" ]; then
    echo "Converting /app/.env to JSON for /config endpoint..."

    # Start JSON output
    echo "{" > /usr/share/nginx/html/env.json

    # Process .env file
    first=1
    while IFS='=' read -r key value || [ -n "$key" ]; do
        # Skip empty lines and comments
        case "$key" in
            ''|'#'*) continue ;;
        esac

        # Trim spaces, newlines and strip quotes
        key=$(echo "$key" | tr -d '\r\n' | sed 's/^[ \t]*//;s/[ \t]*$//')
        value=$(echo "$value" | tr -d '\r\n' | sed 's/^[ \t]*//;s/[ \t]*$//;s/^"//;s/"$//')

        # Check for non-empty key and value
        if [ -n "$key" ] && [ -n "$value" ]; then
            if [ $first -eq 1 ]; then
                printf "\"%s\":\"%s\"" "$key" "$value" >> /usr/share/nginx/html/env.json
                first=0
            else
                printf ",\"%s\":\"%s\"" "$key" "$value" >> /usr/share/nginx/html/env.json
            fi
        fi
    done < /app/.env

    # Add additional frontend properties if not in .env
    printf ",\"AP_APP_TITLE\":\"%s\"" "$AP_APP_TITLE" >> /usr/share/nginx/html/env.json
    printf ",\"AP_FAVICON_URL\":\"%s\"" "$AP_FAVICON_URL" >> /usr/share/nginx/html/env.json
    printf ",\"AP_CHAT_WIDGET\":\"%s\"" "$AP_CHAT_WIDGET" >> /usr/share/nginx/html/env.json
    printf ",\"AP_GATEWAY_URL\":\"%s\"" "$AP_GATEWAY_URL" >> /usr/share/nginx/html/env.json
    printf ",\"AP_IMBRACE_ADDING_CONNECTION_PIECES\":\"%s\"" "$AP_IMBRACE_ADDING_CONNECTION_PIECES" >> /usr/share/nginx/html/env.json

    # Close JSON
    echo "}" >> /usr/share/nginx/html/env.json
else
    echo "No .env file found, generating config from environment variables..."
    printf '{"AP_APP_TITLE":"%s","AP_FAVICON_URL":"%s","GATEWAY_URL":"%s","AP_FRONTEND_URL":"%s","AP_ENVIRONMENT":"%s","AP_CHAT_WIDGET":"%s","AP_GATEWAY_URL":"%s","AP_IMBRACE_ADDING_CONNECTION_PIECES":"%s"}' \
        "$AP_APP_TITLE" "$AP_FAVICON_URL" "$GATEWAY_URL" "$AP_FRONTEND_URL" "$AP_ENVIRONMENT" "$AP_CHAT_WIDGET" "$AP_GATEWAY_URL" "$AP_IMBRACE_ADDING_CONNECTION_PIECES" \
        > /usr/share/nginx/html/env.json
fi

# Validate nginx configuration
echo "Validating nginx configuration..."
nginx -t
if [ $? -ne 0 ]; then
    echo "ERROR: nginx configuration validation failed!"
    exit 1
fi

# Replace the base-path placeholder baked into the build with the real value.
# "/__AP_BASE_PATH__/" -> "/" (root) or "/apwf/" — affects ASSET URLs only (not <base href>/routing).
echo "Applying base path '${BASE_PATH:-/}' to built files..."
find /usr/share/nginx/html -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) \
    -exec sed -i "s|/__AP_BASE_PATH__/|${BASE_PATH}/|g" {} +

# Process environment variables in index.html for fallback support
if [ -f /usr/share/nginx/html/index.html ]; then
    echo "Processing index.html with environment variables..."
    envsubst '${AP_APP_TITLE} ${AP_FAVICON_URL}' \
      < /usr/share/nginx/html/index.html \
      > /usr/share/nginx/html/index.html.tmp && \
      mv /usr/share/nginx/html/index.html.tmp /usr/share/nginx/html/index.html
fi

echo "Starting nginx server..."
# Start nginx in foreground
nginx -g "daemon off;"

# Alfred Live Environment Setup

This guide is the handoff for putting Alfred behind a secure HTTPS URL and assigning provider keys without committing secrets.

Do not paste API keys, publish profiles, access tokens or Microsoft refresh tokens into chat, issues, pull requests, README files or source code.

## 1. GitHub Deployment Settings

Configure these in GitHub repository settings:

`Settings -> Secrets and variables -> Actions`

Repository variables:

| Name | Environment | Example |
| --- | --- | --- |
| `AZURE_TESTING_WEBAPP_NAME` | testing | `alfred-ai-testing` |
| `AZURE_PRODUCTION_WEBAPP_NAME` | production | `alfred-ai-production` |

Repository secrets:

| Name | Environment | Source |
| --- | --- | --- |
| `AZURE_TESTING_PUBLISH_PROFILE` | testing | Azure App Service testing publish profile |
| `AZURE_PRODUCTION_PUBLISH_PROFILE` | production | Azure App Service production publish profile |

The GitHub Actions workflows deploy only when both the web app name variable and publish profile secret exist.

## 2. Azure App Service Settings

Use the templates in:

- `deploy/azure-app-settings.testing.example.json`
- `deploy/azure-app-settings.production.example.json`

Copy the relevant template values into:

`Azure Portal -> App Service -> Settings -> Environment variables`

Required production app settings:

| Name | Required value |
| --- | --- |
| `NODE_ENV` | `production` |
| `APP_ENV` | `production` |
| `APP_BASE_URL` | Final HTTPS Alfred URL |
| `HOST` | `0.0.0.0` |
| `AUTHENTICATION_ENABLED` | `true` |
| `AUTHENTICATION_PROVIDER` | `azure-app-service-easy-auth` |
| `AUTHENTICATED_USER_HEADER` | `x-ms-client-principal` |
| `ALFRED_ALLOWED_USERS` | Patrick's approved sign-in email address |
| `ALFRED_REQUIRE_USER_ALLOWLIST` | `true` |
| `ALFRED_DB_PATH` | `/home/data/alfred.db` |
| `ALFRED_BACKUP_STRATEGY` | `azure-app-service-backup` |
| `ENFORCE_HTTPS` | `true` |

Persistent storage notes:

- Alfred uses SQLite. The database path must be in persistent App Service storage, not the deployed package directory.
- Use `/home/data/alfred.db` for production unless the App Service storage design changes.
- Confirm App Service backups or an equivalent backup process before relying on live operating records.

## 3. Microsoft Entra Authentication

In Azure App Service:

1. Open `Authentication`.
2. Add Microsoft as an identity provider.
3. Require authentication.
4. Set unauthenticated requests to HTTP `401`.
5. Confirm the app receives the `x-ms-client-principal` header after login.
6. Set `ALFRED_ALLOWED_USERS` to Patrick's approved sign-in email address.

Alfred also enforces `ALFRED_ALLOWED_USERS` server-side. This is intentional: even if Azure authentication is accidentally broad, Alfred still blocks users outside the allowlist.

## 4. Provider Keys

Assign provider keys as Azure App Service environment variables or Key Vault references.

| Provider | Required setting | Notes |
| --- | --- | --- |
| Anthropic | `ANTHROPIC_API_KEY` | Claude reasoning. Keep server-side only. |
| Voyage | `VOYAGE_API_KEY` | Semantic memory embeddings. Missing key falls back gracefully. |
| Microsoft 365 | `MICROSOFT_CLIENT_ID`, `MICROSOFT_TENANT_ID` | Read-only OAuth configuration. |
| Monday.com | `MONDAY_API_TOKEN` | Read-only finance/operating intelligence. |
| Deepgram | `DEEPGRAM_API_KEY` | Voice speech-to-text. |
| ElevenLabs | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Spoken Alfred responses. |

Optional model/version settings:

- `ANTHROPIC_MODEL=claude-sonnet-4-6`
- `VOYAGE_MODEL=voyage-4-lite`
- `MONDAY_API_VERSION=2025-04`
- `DEEPGRAM_MODEL=nova-3`
- `ELEVENLABS_MODEL=eleven_multilingual_v2`

## 5. Verification

Before sharing a live URL:

1. Confirm GitHub Actions CI passes.
2. Confirm the relevant deploy workflow completes.
3. Sign in through Microsoft Entra.
4. Open `/api/health` after authentication.
5. Open `/api/deployment/preflight` after authentication.
6. Confirm `goLiveReady` is `true` or that remaining warnings are accepted fallbacks.
7. Confirm unauthenticated access returns `401`.
8. Confirm Alfred still reports external writes disabled.

Expected security boundary:

- No Microsoft writes.
- No Monday writes.
- No financial writes.
- No property actions.
- No voice-triggered execution.
- No autonomous execution.
- Approval safeguards remain required for any future write-capable path.

## 6. Current External Values Needed

These values cannot be discovered from the codebase:

- Testing Azure App Service name.
- Production Azure App Service name.
- Testing publish profile.
- Production publish profile.
- Final production HTTPS URL.
- Patrick's approved Microsoft sign-in email.
- Anthropic API key.
- Voyage API key.
- Microsoft client ID and tenant ID.
- Monday.com token and board IDs.
- Deepgram API key.
- ElevenLabs API key and voice ID.

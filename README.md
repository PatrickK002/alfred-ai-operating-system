# Alfred AI Operating System

Alfred Core is Patrick King's executive command centre and backend foundation for an AI Operating Partner.

This phase replaces browser-only persistence with a dependency-free Node.js API and SQLite database while preserving the Phase 1 dashboard. The browser uses `localStorage` only when the API is unavailable.

## Requirements

- Node.js 22.5 or newer
- Node.js 24 LTS recommended

No third-party packages are required. SQLite support comes from Node's built-in `node:sqlite` module.

## Run Alfred

The backend serves both the API and frontend:

```bash
npm start
```

Open [http://localhost:4173](http://localhost:4173).

For automatic server restarts during development:

```bash
npm run dev
```

To use another port:

```bash
PORT=4180 npm start
```

## Database

The SQLite database is created automatically at:

```text
data/alfred.db
```

Override the location when testing or deploying:

```bash
ALFRED_DB_PATH=/path/to/alfred.db npm start
```

The database is seeded only when the company registry is empty. Seed data includes:

- Digitize Consultants
- Product Studio
- AI Venture Studio
- Media Studio
- KSPF
- Westminster City Council
- RBKC
- Islington Council
- Council Construction Assurance Platform
- Sarah, Alex, Maya and James as planned agent definitions

Database files are excluded from Git.

## API

Health and aggregate workflows:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | API and database health |
| `GET` | `/api/dashboard` | Complete dashboard state |
| `GET` | `/api/morning-brief` | Backend-generated executive brief |

Resource collections:

| Resource | Endpoint |
| --- | --- |
| Companies | `/api/companies` |
| Clients | `/api/clients` |
| Projects | `/api/projects` |
| Actions | `/api/actions` |
| Risks | `/api/risks` |
| Opportunities | `/api/opportunities` |
| Decisions | `/api/decisions` |
| Agents | `/api/agents` |
| Memories | `/api/memories` |
| Integrations | `/api/integrations` |

Each resource supports:

- `GET /api/{resource}` to list records
- `GET /api/{resource}/{id}` to read one record
- `POST /api/{resource}` to create a record
- `PATCH /api/{resource}/{id}` to update a record
- `DELETE /api/{resource}/{id}` to delete a record

Example:

```bash
curl -X POST http://localhost:4173/api/actions \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "digitize",
    "title": "Prepare client review",
    "detail": "Compile delivery, risk and commercial position.",
    "priority": "high",
    "due": "Today",
    "status": "open"
  }'
```

## Morning Brief

`GET /api/morning-brief` generates the real briefing from:

- Open actions
- Open risks
- Calendar/meetings connection status
- Open opportunities
- Open decisions
- Agent definitions and their actual status

No agent is presented as active unless its stored status says it is connected. Calendar meetings are explicitly unavailable until the calendar integration is connected.

## Integration States

The database contains honest placeholders for:

- Microsoft Outlook
- Outlook Calendar
- OneDrive / SharePoint
- Monday.com
- Krisp
- ElevenLabs
- Deepgram
- Voyage AI
- Anthropic

Allowed states are:

- `Not connected`
- `Planned`
- `Connected`

No external service calls are implemented in this phase.

## Tests

```bash
npm test
```

Tests create temporary SQLite databases and cover seeding, CRUD persistence, dashboard aggregation and morning brief generation.

## Architecture

- `server.js` - HTTP server, REST routes and static frontend hosting
- `db.js` - schema, seed data, resource persistence and briefing queries
- `app.js` - dashboard rendering, API client and localStorage fallback
- `index.html` / `styles.css` - executive command centre interface
- `test/db.test.js` - database and workflow tests

## Next Integration Steps

1. Add environment-based secrets management.
2. Implement Microsoft OAuth and read-only Outlook/Calendar adapters.
3. Add Monday.com project and task synchronization.
4. Ingest Krisp transcripts into memories and actions.
5. Add Voyage embeddings while retaining SQLite as the source-of-record index.
6. Add an Anthropic reasoning adapter behind the morning brief workflow.
7. Add ElevenLabs and Deepgram only after text workflows are stable.

Each integration should remain disabled until credentials are configured and its connection has been verified.

## Microsoft 365 Read-Only Setup

Alfred uses Microsoft Graph delegated permissions through the OAuth device authorization flow. No client secret is required.

### 1. Register Alfred in Microsoft Entra

In the Microsoft Entra admin center:

1. Open **App registrations** and create a new registration.
2. Name it `Alfred AI Operating System`.
3. Select the account type appropriate for Patrick's Microsoft 365 tenant.
4. Under **Authentication**, enable **Allow public client flows**.
5. Under **API permissions**, add these Microsoft Graph delegated permissions:
   - `User.Read`
   - `Mail.Read`
   - `Calendars.Read`
   - `Files.Read`
6. Do not add `Mail.Send`, `Mail.ReadWrite`, `Calendars.ReadWrite`, `Files.ReadWrite`, or application permissions.

### 2. Configure Alfred

Copy the application/client ID from the registration and start Alfred with:

```bash
MICROSOFT_CLIENT_ID="your-application-client-id" \
MICROSOFT_TENANT_ID="your-tenant-id-or-organizations" \
npm start
```

`MICROSOFT_TENANT_ID` defaults to `organizations`.

For local development, you can instead create the ignored file `data/microsoft-config.json` using [microsoft-config.example.json](microsoft-config.example.json) as the template. Client and tenant IDs are identifiers rather than secrets, but the local file keeps tenant-specific configuration out of source control.

### 3. Connect

1. Open Alfred's **Integrations** screen.
2. Select **Connect Microsoft 365**.
3. Open the Microsoft sign-in link and enter the displayed device code.
4. Review and approve the read-only delegated permissions.

Alfred tests profile, mail, calendar, and OneDrive separately. An integration changes to `Connected` only after its read call succeeds.

### Read-Only Microsoft APIs

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/microsoft/status` | Configuration, profile and verified service status |
| `POST` | `/api/microsoft/connect` | Start device authorization; does not modify Microsoft 365 |
| `POST` | `/api/microsoft/connect/complete` | Complete OAuth token exchange |
| `GET` | `/api/microsoft/messages?search=` | Read or search Outlook messages |
| `GET` | `/api/microsoft/calendar?start=&end=` | Read calendar events |
| `GET` | `/api/microsoft/files?search=` | List or search the signed-in user's OneDrive files |

SharePoint-wide search is not included yet because it requires broader site permissions. The current file endpoint deliberately uses the narrower delegated `Files.Read` scope.

Microsoft access and refresh tokens are stored locally at `data/microsoft-token.json` with user-only file permissions and are excluded from Git. This is suitable for the local foundation, but production deployment should replace it with operating-system keychain or encrypted secret storage.

Alfred binds to `127.0.0.1` by default so the local API and Microsoft data are not exposed to the network. Override `HOST` only in a controlled deployment.

### Microsoft Write Boundary

This phase contains no Microsoft Graph methods for:

- Sending or replying to email
- Creating, changing, or deleting calendar events
- Uploading, editing, moving, or deleting files

Those capabilities must wait for an explicit approval workflow and a separate permission review.

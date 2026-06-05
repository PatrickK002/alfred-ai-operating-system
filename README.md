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

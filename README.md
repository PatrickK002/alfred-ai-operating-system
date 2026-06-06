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

For automatic server restarts when `server.js` changes:

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
- Westbridge Property Group
- Product Studio
- AI Venture Studio
- Media Studio
- KSPF
- Westminster City Council
- RBKC
- Islington Council
- Council Construction Assurance Platform
- Project intelligence profiles for KSPF, Westminster, RBKC, Islington and Council Construction Assurance Platform
- Sarah as an active advisory Executive Specialist, the Westbridge Property Director as an active advisory Investment Director, plus Alex, Maya, James and Olivia as planned agent definitions

Database files are excluded from Git.

Approval records include SHA-256 action fingerprints, retry-safe idempotency keys, expiry timestamps, audit events and persisted execution preflight reports.

AI analysis audit records are also stored in SQLite. They log the timestamp, user action, data categories, model, success/error status and whether output was saved. They do not store API keys.

Semantic memory records are stored in SQLite in `semantic_memory`. SQLite remains the source of truth: vector rows store source type, source ID, timestamp, compact summary, embedding, model and sensitivity label only. Alfred treats these records as local sensitive business data.

## API

Health and aggregate workflows:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | API and database health |
| `GET` | `/api/dashboard` | Complete dashboard state |
| `GET` | `/api/morning-brief` | Backend-generated executive brief |
| `GET` | `/api/anthropic/status` | Anthropic configuration and read-only status |
| `POST` | `/api/ai/briefing` | Claude-powered CEO analysis of the current briefing context |
| `POST` | `/api/ai/decision-support` | Claude-powered decision, risk or approval support |
| `GET` | `/api/ai/audit?limit=50` | Metadata-only AI analysis audit log |
| `GET` | `/api/memory/status` | Voyage configuration, indexing setting and vector stats |
| `GET` | `/api/memory/search?q=Westminster` | Semantic memory search with source references |
| `GET` | `/api/memory/settings` | Current semantic indexing setting |
| `PATCH` | `/api/memory/settings` | Enable or disable semantic indexing |
| `GET` | `/api/voice/status` | Voice settings, provider status, personas, supported commands and advisory boundary |
| `GET` | `/api/voice/settings` | Read voice enablement, transcript logging, voice selection and speech speed |
| `PATCH` | `/api/voice/settings` | Update local voice settings |
| `POST` | `/api/voice/sessions` | Create a local voice session |
| `POST` | `/api/voice/command` | Process a transcript or microphone audio command through Alfred |
| `GET` | `/api/voice/conversations?limit=20` | List locally stored voice conversation turns |
| `GET` | `/api/voice/audit?limit=50` | Metadata-only voice audit events |
| `GET` | `/api/property/dashboard` | Westbridge portfolio metrics, acquisition pipeline, due diligence, risks, decisions and property memory |
| `GET` | `/api/property/briefing` | Westbridge property signals for Alfred's executive briefing |
| `GET` | `/api/property/search?q=garage` | Property-aware search across opportunities, analyses, due diligence and memory |
| `GET` | `/api/property/opportunities` | List Westbridge acquisition opportunities |
| `POST` | `/api/property/opportunities` | Store a manual deal or URL reference; metadata only, no scraping |
| `GET` | `/api/property/opportunities/:id` | Read an opportunity with analyses and due diligence |
| `PATCH` | `/api/property/opportunities/:id` | Update a local Alfred opportunity record |
| `POST` | `/api/property/opportunities/:id/analyse` | Run advisory deal analysis and Westbridge rules review |
| `GET` | `/api/property/opportunities/:id/due-diligence` | List due diligence checks |
| `POST` | `/api/property/opportunities/:id/due-diligence` | Update local due diligence status |
| `GET` | `/api/property/audit` | Property audit events |
| `GET` | `/api/project-intelligence/dashboard` | Project portfolio dashboard, health scores and attention signals |
| `GET` | `/api/project-intelligence/projects` | List project intelligence profiles |
| `POST` | `/api/project-intelligence/projects` | Create a local Alfred project profile |
| `GET` | `/api/project-intelligence/projects/:id` | Project detail with risks, actions, documents, meetings, email signals, memory and finance context |
| `PATCH` | `/api/project-intelligence/projects/:id` | Update a local Alfred project profile |
| `GET` | `/api/project-intelligence/domains` | Digital Construction domain catalog and Sarah placeholder status |
| `POST` | `/api/project-intelligence/projects/:id/documents` | Import read-only Microsoft file metadata for a project |
| `POST` | `/api/project-intelligence/projects/:id/emails` | Import compact read-only Outlook email signals for a project |
| `POST` | `/api/project-intelligence/projects/:id/meetings` | Import read-only calendar meeting metadata for a project |
| `POST` | `/api/project-intelligence/discover-microsoft` | Discover project file/email/calendar metadata using existing Microsoft read-only access |
| `GET` | `/api/projects/search?q=Westminster` | Project-aware search across profiles, documents, risks, actions, decisions, meetings, emails, tags, memory and source references |
| `POST` | `/api/ai/project-analysis` | Claude project analysis with bounded Voyage memory and Olivia finance context |
| `GET` | `/api/sarah/dashboard` | Sarah's Digital Construction Director dashboard |
| `GET` | `/api/sarah/audit` | Sarah advisory-output audit events |
| `POST` | `/api/ai/sarah/analyse-project` | Claude-powered Sarah project review with project intelligence, memory and finance context |
| `POST` | `/api/ai/sarah/project-health-review` | Deterministic Sarah project health, BIM maturity and digital readiness review |
| `POST` | `/api/ai/sarah/client-review` | Claude-powered Sarah client portfolio review |
| `POST` | `/api/ai/sarah/draft-deliverable` | Draft an internal outline only; no document is created or edited |
| `GET` | `/api/financial/dashboard?scopeType=group&scopeId=group` | Olivia's scoped CFO dashboard |
| `GET` | `/api/financial/forecast?scopeType=business&scopeId=digitize` | Monthly, quarterly, annual and scenario forecasts for a reporting scope |
| `POST` | `/api/financial/order-book/import` | Import Excel/CSV order book data into local read-only intelligence tables for a `businessEntityId` |
| `GET` | `/api/financial/imports` | Order book import history and validation summaries |
| `GET` | `/api/financial/monday/status` | Monday.com finance connector status |
| `POST` | `/api/financial/monday/refresh` | Read Monday invoice/debtor summaries and store local summaries for a `businessEntityId` |
| `GET` | `/api/financial/board-reports` | List generated board reports |
| `POST` | `/api/financial/board-reports` | Generate a quarterly board report markdown snapshot |
| `POST` | `/api/financial/olivia-analysis` | Generate Olivia CFO insights and recommendations |
| `GET` | `/api/financial/audit` | Finance import, refresh, report and analysis audit events |
| `GET` | `/api/approvals` | Approval requests and status totals |
| `POST` | `/api/approvals` | Propose an external action for human review |
| `GET` | `/api/approvals/{id}` | Approval detail and immutable event history |
| `POST` | `/api/approvals/{id}/approve` | Record explicit approval |
| `POST` | `/api/approvals/{id}/reject` | Record explicit rejection |
| `POST` | `/api/approvals/{id}/cancel` | Cancel a pending request |
| `POST` | `/api/approvals/{id}/preflight` | Record execution-safeguard checks without executing |

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
- Westbridge property opportunity, due diligence and cashflow signals
- Sarah and Project Intelligence attention signals

No agent is presented as active unless its stored status says it is connected. Calendar meetings are explicitly unavailable until the calendar integration is connected.

## Westbridge Property Group

Westbridge is Alfred's first investment-focused business. It is modelled as a group business entity owned by Patrick King with a target of `£10,000-£15,000` net monthly property income within five years.

The Westbridge Property Director is advisory only. It can:

- Track portfolio metrics and acquisition pipeline stages
- Store manual deal intake and URL references from Rightmove, Zoopla, OnTheMarket or auction sites
- Store document upload placeholders as metadata only
- Calculate illustrative SDLT, acquisition costs, gross yield, net yield, ROI, ROCE, net monthly cashflow, refinance potential and cash left in deal
- Apply Westbridge rules including no HMOs, cashflow first, management/acquisition cost inclusion and capital preservation
- Track legal, planning, flood, EPC, insurance, survey, finance, tenancy and environmental due diligence
- Add property summaries to Alfred Memory and Voyage semantic retrieval when enabled

It cannot buy property, make offers, send communications, issue legal instructions, connect to bank accounts, process payments or provide regulated financial advice. All recommendations require Patrick review and professional due diligence.

## Voice Command Centre

Alfred now supports a read-only voice command interface on the Executive Command dashboard.

Architecture:

```text
Voice -> Deepgram -> Alfred -> Claude -> Executive Team Context -> Response -> ElevenLabs -> Voice
```

The same endpoint also accepts typed transcript fallback commands for local testing when microphone, Deepgram or ElevenLabs are not configured.

### Voice Setup

Add these values to `.env` as needed:

```bash
DEEPGRAM_API_KEY="your-deepgram-key"
DEEPGRAM_MODEL="nova-3"
ELEVENLABS_API_KEY="your-elevenlabs-key"
ELEVENLABS_VOICE_ID="your-elevenlabs-voice-id"
ELEVENLABS_MODEL="eleven_multilingual_v2"
VOICE_ENABLED=true
VOICE_TRANSCRIPT_LOGGING_ENABLED=true
VOICE_AI_TIMEOUT_MS=12000
```

`VOICE_ENABLED` controls the local voice interface. `VOICE_TRANSCRIPT_LOGGING_ENABLED=false` prevents transcript content from being persisted in `voice_conversation_turns`.
`VOICE_AI_TIMEOUT_MS` caps how long voice commands wait for Claude before using deterministic local fallback.

### Supported Commands

- `Alfred, brief me`
- `What requires my attention today?`
- `What are my biggest risks?`
- `What meetings do I have today?`
- `What decisions are waiting for approval?`
- `Show Westminster status`
- `Ask Sarah to review Westminster`
- `Ask Olivia for revenue forecast`
- `Ask Westbridge for property pipeline`
- `What property opportunities need attention?`
- `What is projected property cashflow?`

### Voice Security Boundary

Voice is an executive intelligence interface only. It can analyse, brief, route internally to Sarah, Olivia and Westbridge, and recommend next steps.

Voice cannot:

- Send emails
- Update calendars
- Edit OneDrive or SharePoint files
- Modify Monday.com
- Raise invoices or process payments
- Create property offers, purchases or legal instructions
- Approve, reject or execute approval requests
- Bypass approval safeguards

No raw audio is stored by default. Microphone audio is sent to Deepgram only for transcription when the user starts recording and a Deepgram key is configured. ElevenLabs receives only Alfred's final response text for speech synthesis when configured. If ElevenLabs is unavailable, the UI falls back to text and may use local browser speech synthesis.

Voice transcripts are local sensitive business data. Voice audit records log metadata only: timestamp, user action, data categories, provider/model, success/error status and whether execution was attempted. API keys and raw audio are never logged.

### Voice Limitations

- Alfred voice is the only active voice persona in this phase.
- Sarah, Olivia and Westbridge are routed advisory specialists; they do not have separate voices yet.
- Deepgram and ElevenLabs show `Connected` only after a successful provider call.
- Mobile/PWA/native app packaging is not included. The layout is prepared for MacBook, iPhone Safari and future PWA work.
- Voice commands do not create external actions. Any future write action must go through the existing approval framework and a separate executor review.

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

External calls are limited to verified read-only Microsoft 365 reads, explicit Anthropic reasoning requests, Voyage embedding/search requests over compact summaries, Deepgram transcription requests for user-supplied voice audio, and ElevenLabs text-to-speech requests for Alfred's final response. Alfred still cannot modify external systems.

## Tests

```bash
npm test
```

Tests create temporary SQLite databases and cover seeding, CRUD persistence, dashboard aggregation, morning brief generation, approval state transitions, Anthropic reasoning boundaries, Voyage semantic memory retrieval, Olivia CFO financial intelligence, project intelligence, Sarah, Westbridge property intelligence and the Voice Command Centre.

## Architecture

- `server.js` - HTTP server, REST routes and static frontend hosting
- `db.js` - schema, seed data, resource persistence and briefing queries
- `anthropic.js` - Claude Messages API client, CEO system prompt and structured output schemas
- `ai.js` - read-only AI reasoning service and audit wrapper
- `voyage.js` - Voyage embeddings client and vector helpers
- `semantic-memory.js` - SQLite-backed semantic indexing, search and Claude context retrieval
- `financial.js` - Olivia CFO calculations, order book import persistence, board reports and read-only finance audits
- `property.js` - Westbridge portfolio metrics, deal analysis, rules engine, due diligence, property memory and audit logging
- `project-intelligence.js` - Project profiles, Microsoft metadata association, health scoring, search and read-only project audits
- `voice.js` - Deepgram/ElevenLabs adapters, voice command routing, transcript persistence, audit logging and advisory-only voice boundaries
- `excel-orderbook.js` - dependency-free XLSX/CSV order book reader
- `monday-finance.js` - read-only Monday.com financial summary connector
- `app.js` - dashboard rendering, API client and localStorage fallback
- `index.html` / `styles.css` - executive command centre interface
- `test/db.test.js` - database and workflow tests

## Next Integration Steps

1. Add environment-based secrets management.
2. Add a separately reviewed Microsoft write adapter that consumes approved requests.
3. Add idempotency, expiry and re-authentication checks before any approved action can execute.
4. Add Monday.com project and task synchronization.
5. Ingest Krisp transcripts into memories and actions.
6. Add retention controls, encryption and role-based access for financial intelligence tables.
7. Add Xero, QuickBooks and bank feed read-only connectors after another security review.
8. Add retrieval evaluation and retention controls for semantic memory.
9. Add provider health probes and retention controls for voice transcripts.

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

## Human Approval Workflow

Alfred can now create proposed external actions for Patrick to review. Approval requests contain:

- Target system and action type
- Exact proposed outcome
- Risk level
- Requester and timestamps
- Optional structured payload
- Review decision, reviewer and note
- Append-only audit events

Requests move from `pending` to `approved`, `rejected` or `cancelled`. A decided request cannot be reviewed again.

Approval does **not** execute an action. There is deliberately no execution endpoint, Microsoft write method or write permission in this phase. Approved requests remain held until a separately reviewed executor, permission model and identity re-authentication control are implemented.

### Execution Safeguards

Approval requests now have:

- A caller-supplied or server-generated idempotency key so network retries do not create duplicate requests
- A SHA-256 fingerprint covering the target, action, description and structured payload
- A validity window of up to seven days, defaulting to 24 hours
- Automatic transition to `expired` when the validity window closes
- Integrity verification before approval
- A persisted execution preflight report

The preflight checks explicit approval, expiry, payload integrity and idempotency. It also reports two deliberate blockers:

- Identity re-authentication is not implemented
- No external action executor is installed

Therefore every preflight currently returns `ready: false` and `executionAvailable: false`. This is intentional: the safeguards are observable and testable before any Microsoft write permission is requested.

## Anthropic Claude Reasoning Setup

Alfred can use Anthropic Claude as a read-only reasoning layer for:

- Executive briefing analysis
- Risk review
- Decision support
- Approval request review
- Prioritisation

Create a local `.env` from [.env.example](.env.example):

```bash
cp .env.example .env
```

Set:

```bash
ANTHROPIC_API_KEY="your-anthropic-api-key"
ANTHROPIC_MODEL="claude-sonnet-4-6"
```

`ANTHROPIC_MODEL` is optional and defaults to `claude-sonnet-4-6`. Do not commit `.env` or API keys.

If you do not use `.env`, pass the key when starting Alfred:

```bash
ANTHROPIC_API_KEY="your-anthropic-api-key" npm start
```

### Claude API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/anthropic/status` | Shows whether Anthropic is configured and which model will be used |
| `POST` | `/api/ai/briefing` | Analyses the current briefing, Outlook signals, calendar signals, risks, decisions, opportunities, approvals and recent briefing history |
| `POST` | `/api/ai/decision-support` | Analyses one decision, risk or approval request |
| `GET` | `/api/ai/audit?limit=50` | Lists metadata-only AI analysis audit records |

Claude outputs are schema-constrained JSON. Alfred displays them as recommendations only.

### Claude Security Boundary

Claude can:

- Analyse supplied Alfred records and Microsoft read-only signals
- Prioritise Patrick's attention
- Identify risks and assumptions
- Recommend next actions
- Flag when Patrick approval is required
- Cite supplied source record references

Claude cannot:

- Send emails
- Edit OneDrive or SharePoint files
- Update calendars
- Update Monday.com
- Publish content
- Execute approvals
- Create autonomous agents
- Claim work is complete unless Alfred's stored system data proves it

Every AI request is logged in `ai_analysis_audit` with metadata only. Alfred does not log raw API keys and does not persist Claude output in this phase.

## Voyage Semantic Memory Setup

Alfred can use Voyage AI to create embeddings for compact business summaries while keeping SQLite as the source of truth.

Create or update your local `.env`:

```bash
VOYAGE_API_KEY="your-voyage-api-key"
VOYAGE_MODEL="voyage-4-lite"
SEMANTIC_INDEXING_ENABLED=true
```

`VOYAGE_MODEL` is optional and defaults to `voyage-4-lite`. `SEMANTIC_INDEXING_ENABLED` seeds the first local database setting only; after that, use the dashboard toggle or `/api/memory/settings`.

### What Gets Embedded

Alfred indexes compact summaries and metadata for:

- Memories
- Actions, risks, opportunities and decisions
- Briefing snapshots
- Approval requests
- Selected Outlook and calendar summaries captured inside saved briefings

Alfred does **not** embed raw full emails by default. Microsoft-derived records are summary-first and are marked as `local_sensitive_business_data`.

### Memory API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/memory/status` | Voyage configuration, indexing state and vector table stats |
| `GET` | `/api/memory/search?q=Westminster` | Search Alfred memory and return source references, relevance, timestamp and sensitivity label |
| `GET` | `/api/memory/settings` | Read the semantic indexing setting |
| `PATCH` | `/api/memory/settings` | Enable or disable semantic indexing with `{ "semanticIndexingEnabled": false }` |

If `VOYAGE_API_KEY` is missing or indexing is disabled, Alfred falls back to local keyword matching and does not call Voyage.

### Claude Context Retrieval

Before Claude analysis, Alfred retrieves a bounded memory context:

- Maximum 6 records
- Approximate 1,200 token budget
- Source references included
- No unbounded database or mailbox dump

Claude receives these records as context only. Voyage memory retrieval does not execute actions, send messages, edit files, update calendars or approve anything.

## Project Intelligence Platform

Alfred's Project Intelligence Platform is the read-only project knowledge layer for Digitize and future Sarah workflows. It combines confirmed Alfred project profiles, Microsoft 365 metadata, compact email/calendar signals, semantic memory and Olivia financial context.

Seeded project profiles include:

- KSPF
- Westminster
- RBKC
- Islington
- Council Construction Assurance Platform

### Microsoft Read-Only Discovery

The project discovery workflow uses the existing Microsoft delegated read scopes only:

- `Mail.Read`
- `Calendars.Read`
- `Files.Read`

Alfred can list OneDrive file metadata, search Outlook message summaries and read calendar metadata. It does not download or index full document contents in this phase, and it does not send email, update calendars, edit files, write to SharePoint/OneDrive or modify Monday.com.

Document metadata stores file name, path, type, modified date, owner, location, web URL, parent folder, size and association reason. Alfred classifies metadata as EIR, AIR, BEP, MIDP, TIDP, COBie, IFC, Drawings, Meeting Minutes, Reports, Risk Registers, Asset Information, Digital Twin Documents, GIS Documents, Building Safety Documents, Proposals, Contracts, Commercial Documents or Unknown.

Email and calendar associations are inferred from client names, project names, known contacts, keywords, subject lines and meeting attendees. Inferred associations are stored with confidence/reason metadata and should be reviewed before acting.

### Digital Construction Knowledge Layer

Alfred now stores Digital Construction domain tags for projects:

- BIM
- GIS
- COBie
- ISO 19650
- Asset Information
- Digital Twin
- Building Safety
- Information Management
- Power Platform

The schema includes placeholder tables for future Sarah workflows only:

- COBie: facilities, floors, spaces, zones, types, components, systems, documents, attributes, issues and validation results
- GIS: assets, locations, coordinates, layers, spatial datasets, issues and opportunities
- Digital Twin: assets, sensors, systems, models, twin records, issues and opportunities

These structures are preparation only. Alfred does not run COBie validation, GIS analysis or Digital Twin analysis yet.

### Project Knowledge Graph

Project relationships are recorded in `project_knowledge_links`. Alfred links projects to clients, documents, meetings, emails, actions, risks, decisions, memories and financial source references where available. Each link stores a relationship, confidence level and explanation so Alfred can distinguish confirmed records from inferred associations.

`project_emails` is exposed as a read-only compatibility view over `project_email_signals`.

### Project Search

`GET /api/projects/search?q=...` searches:

- Projects
- Documents
- Risks
- Decisions
- Actions
- Meetings
- Emails
- Memory links
- Digital construction tags

Results include source references such as `project_profile:1`, `project_document:2`, `project_email:3`, `project_tag:4` and `project_knowledge_link:5`.

### Project Health Score

Project health is calculated from risk level, open and overdue actions, document metadata completeness, recent activity, meeting frequency, client responsiveness signals, information quality, domain tags and Olivia financial context where available.

Health outputs are `green`, `amber` or `red` with a plain-English explanation and source records. Missing information is reported explicitly rather than hidden.

### Claude Project Analysis

`POST /api/ai/project-analysis` sends Claude a bounded project context: project profile, linked risks/actions/decisions, document metadata only, meeting and email signals, relevant Voyage memory and Olivia financial summary.

Claude also receives project tags, knowledge graph links, Digital Construction placeholders and information quality. Claude must return executive summary, current status, key risks, key opportunities, confirmed facts, inferred information, missing information, recommended actions, decisions required, confidence level and source references.

Claude must distinguish confirmed records, inferred associations, assumptions and missing information. It must not claim full documents were read unless a future feature actually retrieves full document content.

### Dashboard Indicators

The Project Intelligence dashboard shows active projects, projects at risk, overdue project actions, recently updated projects, missing information, financial risk indicators and information quality indicators.

## Sarah Digital Construction Director

Sarah is Alfred's first Executive Specialist. She reports to Alfred and acts as Digitize's advisory-only AI Digital Construction Director.

Sarah specialises in:

- BIM strategy, BIM Execution Plans, EIR, AIR, MIDP, TIDP, BIM delivery and BIM governance
- ISO 19650, information requirements, CDE, information delivery and appointing-party workflows
- COBie structure, COBie quality, asset information and information completeness
- GIS strategy, spatial information, asset mapping and geospatial data
- Digital Twin strategy, operational data, asset performance and smart asset management
- Building Safety, golden thread, information assurance and compliance information
- Power Platform for digital construction, including Power Apps, Dataverse, Power Automate, Power BI and SharePoint

Sarah uses the Project Intelligence Platform, Digital Construction Knowledge Layer, Voyage memory, Anthropic reasoning, Microsoft 365 read-only metadata and Olivia CFO context. Sarah can analyse and recommend only. She cannot send emails, update calendars, edit OneDrive/SharePoint files, create Power Platform apps, publish documents, modify Monday.com, update finance records or execute approvals.

### Sarah APIs

- `GET /api/sarah/dashboard`
- `GET /api/sarah/audit`
- `POST /api/ai/sarah/analyse-project`
- `POST /api/ai/sarah/project-health-review`
- `POST /api/ai/sarah/client-review`
- `POST /api/ai/sarah/draft-deliverable`

Sarah project analysis returns an executive summary, BIM observations, information management observations, digital construction opportunities, risks, missing information, recommendations, confidence level, assumptions and source references.

Sarah project health review returns project score, information quality score, BIM maturity assessment, digital readiness assessment and recommendations.

Sarah client review answers what projects exist for a client, what risks and actions remain, what information is missing, what opportunities exist and what Patrick should discuss next.

Sarah deliverable support is draft-outline only for BIM Strategy, EIR, AIR, BEP, Information Management Plan, Digital Twin Strategy and GIS Strategy outlines. No file is created, edited, saved, uploaded or published.

### Future Sarah Team

The database stores placeholders only for future Sarah-managed specialist roles:

- BIM Consultant
- Information Manager
- COBie Specialist
- GIS Consultant
- Digital Twin Consultant
- Building Safety Consultant
- Power Platform Consultant

These are not active agents and have no autonomous behaviour.

## Olivia CFO Financial Intelligence

Olivia is Alfred's planned Group Chief Financial Officer across Alfred-managed businesses, products, divisions and ventures.

The finance model is multi-entity by design. Every revenue, cost, forecast, budget and KPI record belongs to a `financial_business_entities` record so Alfred can produce business-level, division-level and group-level reporting without a future database redesign.

Seeded reporting entities include:

- Patrick King Group
- Digitize Consultants
- Council Assurance Platform
- Media Businesses
- AI Businesses
- Future SaaS Products
- Future Ventures

This is a financial intelligence layer, not an accounting system. Olivia can analyse and recommend, but cannot:

- Raise invoices
- Send invoices
- Process payments
- Chase debtors
- Modify accounting records
- Connect to bank accounts
- Execute financial actions

All finance workflows are read-only. The existing approval framework can record future human review requests, but no finance executor is installed.

### Order Book Import

Olivia can import order book `.xlsx` or `.csv` files into local SQLite tables against a selected business entity. Digitize Consultants is the default current source, but the same importer supports future products, media businesses, AI businesses and ventures. The importer:

- Detects financial year worksheets such as `FY2026-27`
- Preserves source file, sheet and row references
- Validates missing client/project/amount data
- Flags duplicate rows
- Maintains import history
- Records delta/change audit events
- Requires explicit overwrite approval before changed source rows replace existing rows

### Monday.com Finance Connector

Set these optional environment variables:

```bash
MONDAY_API_TOKEN="your-monday-api-token"
MONDAY_FINANCE_BOARD_IDS="123456789,987654321"
MONDAY_API_VERSION="2025-04"
```

The connector uses Monday.com's GraphQL endpoint for read-only board item queries. It reads invoice/client/project summaries into local SQLite and never sends mutations, creates items, updates boards or writes back to Monday.

The connector is designed for:

- Invoices issued
- Invoices paid
- Overdue invoices
- Client references
- Project references

### CFO Dashboard and Reports

The Finance view includes a reporting scope selector for group, division, business, product and venture views. The dashboard shows:

- Secured revenue
- Pipeline revenue
- Weighted forecast revenue
- Revenue by business entity
- Revenue by financial year, quarter, client, project and service line
- Invoice status
- Outstanding and overdue debtors
- Forecast variance/gap analysis
- Financial risks and opportunities

Board reports are generated as scoped dashboard markdown snapshots with placeholders for future Word, PDF and PowerPoint export.

## Executive Briefing V2

The morning brief now applies a deterministic, explainable prioritisation layer to operating records and read-only Microsoft data.

It produces:

- Ranked executive priorities
- Prioritised Outlook email with scoring reasons
- Recorded risks plus clearly labelled email risk signals
- Meeting preparation prompts with matched client or project context
- Revenue opportunities
- Recorded decisions plus clearly labelled email decision signals
- Agent status

The current analysis is rule-based rather than model-generated. It scores signals such as unread status, high importance, recency, client mentions and operational language. This keeps the first intelligence layer testable and prevents unverified model conclusions from being presented as fact.

Inferred email items are labelled as signals and instruct Patrick to review the source before acting.

### Briefing History and Feedback

Every backend-generated briefing is stored in SQLite. Patrick can mark a briefing:

- `useful`
- `not_useful`

An optional feedback note can be stored with the rating.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/briefings?limit=20` | List briefing history and feedback totals |
| `GET` | `/api/briefings/{id}` | Read one saved briefing snapshot |
| `POST` | `/api/briefings/{id}/feedback` | Store a useful/not-useful rating and optional note |

Briefing snapshots can contain email previews, meeting context and other business information. The SQLite database must therefore be treated as sensitive local data and should use encrypted storage and formal retention controls before production deployment.

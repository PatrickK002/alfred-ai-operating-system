const STORAGE_KEY = "alfred-core-v1";

const seedData = {
  companies: [
    {
      id: "digitize",
      name: "Digitize Consultants",
      shortName: "Digitize",
      symbol: "DC",
      color: "#62ead5",
      purpose: "Digital construction and information consultancy",
      status: "Operating",
      services: ["BIM", "ISO 19650", "Information Management", "GIS", "Digital Twin", "Power Platform", "AI Solutions"],
      clients: ["KSPF", "Westminster City Council", "RBKC", "Islington Council"],
    },
    {
      id: "product",
      name: "Product Studio",
      shortName: "Product",
      symbol: "PS",
      color: "#7fa9e2",
      purpose: "Create scalable SaaS businesses",
      status: "Building",
      services: ["Council Construction Assurance Platform"],
      clients: [],
    },
    {
      id: "venture",
      name: "AI Venture Studio",
      shortName: "Venture",
      symbol: "AV",
      color: "#b18ae2",
      purpose: "Build recurring-income online businesses",
      status: "Discovery",
      services: ["Target: £5,000+ monthly profit"],
      clients: [],
    },
    {
      id: "media",
      name: "Media Studio",
      shortName: "Media",
      symbol: "MS",
      color: "#e2b46b",
      purpose: "Build automated YouTube and content businesses",
      status: "Discovery",
      services: ["Target: £5,000+ monthly income"],
      clients: [],
    },
  ],
  operatingItems: [
    {
      id: 1,
      companyId: "digitize",
      type: "risk",
      title: "Westminster delivery review",
      detail: "Confirm current deliverables and identify any actions requiring chairman input.",
      priority: "high",
      due: "Today",
      status: "open",
    },
    {
      id: 2,
      companyId: "digitize",
      type: "action",
      title: "Review KSPF project position",
      detail: "Prepare an updated commercial and delivery summary.",
      priority: "medium",
      due: "This week",
      status: "open",
    },
    {
      id: 3,
      companyId: "product",
      type: "decision",
      title: "Define assurance platform MVP",
      detail: "Approve the first user journey and validation scope.",
      priority: "high",
      due: "This week",
      status: "open",
    },
    {
      id: 4,
      companyId: "venture",
      type: "opportunity",
      title: "Select first venture thesis",
      detail: "Choose one recurring-revenue concept for structured validation.",
      priority: "medium",
      due: "Next",
      status: "open",
    },
    {
      id: 5,
      companyId: "media",
      type: "opportunity",
      title: "Define first channel niche",
      detail: "Score channel concepts by demand, production effort and monetisation.",
      priority: "low",
      due: "Next",
      status: "open",
    },
  ],
  memories: [
    {
      id: 1,
      type: "decision",
      title: "Alfred operating principle",
      detail: "Build the operating system before specialist agents. Patrick remains the final decision maker.",
      companyId: "group",
      date: "2026-06-05",
    },
    {
      id: 2,
      type: "client",
      title: "Westminster City Council",
      detail: "Registered as an active Digitize Consultants client. Delivery context requires connection to live project systems.",
      companyId: "digitize",
      date: "2026-06-05",
    },
    {
      id: 3,
      type: "idea",
      title: "Council Construction Assurance Platform",
      detail: "Initial Product Studio SaaS concept focused on council construction assurance.",
      companyId: "product",
      date: "2026-06-05",
    },
  ],
  agents: [
    {
      id: "sarah",
      name: "Sarah",
      role: "Digital Construction Director",
      companyId: "digitize",
      department: "Delivery",
      mission: "Lead BIM, GIS, Digital Twin and ISO 19650 delivery for Digitize.",
      tools: [],
      status: "Framework only",
    },
    {
      id: "alex",
      name: "Alex",
      role: "Growth Director",
      companyId: "group",
      department: "Growth",
      mission: "Find and qualify revenue opportunities across the group.",
      tools: [],
      status: "Framework only",
    },
    {
      id: "maya",
      name: "Maya",
      role: "Media Director",
      companyId: "media",
      department: "Media",
      mission: "Build content businesses with repeatable production and monetisation systems.",
      tools: [],
      status: "Framework only",
    },
    {
      id: "james",
      name: "James",
      role: "Product CEO",
      companyId: "product",
      department: "Product",
      mission: "Validate, build and operate scalable SaaS products.",
      tools: [],
      status: "Framework only",
    },
  ],
  integrations: [
    { id: "outlook", name: "Microsoft Outlook", symbol: "O", description: "Read and search Outlook email for briefings. Sending and drafting are disabled.", status: "Not connected" },
    { id: "calendar", name: "Outlook Calendar", symbol: "C", description: "Read upcoming meetings for preparation and briefings. Calendar changes are disabled.", status: "Not connected" },
    { id: "sharepoint", name: "OneDrive (SharePoint planned)", symbol: "S", description: "List and search the signed-in user's OneDrive files. File changes are disabled; SharePoint-wide search is planned.", status: "Planned" },
    { id: "monday", name: "Monday.com", symbol: "M", description: "Boards, projects, tasks, updates and operating reports.", status: "Planned" },
    { id: "krisp", name: "Krisp", symbol: "K", description: "Meeting summaries, actions, risks and follow-up extraction.", status: "Planned" },
    { id: "voyage", name: "Voyage AI", symbol: "V", description: "Semantic long-term memory and retrieval across operating records.", status: "Planned" },
    { id: "elevenlabs", name: "ElevenLabs", symbol: "E", description: "Natural voice output for executive briefings and alerts.", status: "Planned" },
    { id: "deepgram", name: "Deepgram", symbol: "D", description: "Speech-to-text input for voice commands and conversations.", status: "Planned" },
    { id: "anthropic", name: "Anthropic", symbol: "A", description: "Reasoning and language-model execution for Alfred intelligence workflows.", status: "Planned" },
  ],
  approvals: [],
  approvalSummary: {
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
    expired: 0,
    preflightChecks: 0,
    releaseReady: 0,
    executionEnabled: false,
  },
};

let state = loadState();
let backendAvailable = false;
let microsoftPollTimer;
let currentBriefingId = null;
let memoryFilter = "all";
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createIdempotencyKey() {
  return window.crypto?.randomUUID?.() || `approval-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...clone(seedData), ...JSON.parse(stored) } : clone(seedData);
  } catch {
    return clone(seedData);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `API request failed with status ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

function setBackendStatus(available) {
  backendAvailable = available;
  $("#system-status-title").textContent = available ? "Core online" : "Fallback mode";
  $("#system-status-detail").textContent = available ? "SQLite API connected" : "Using browser storage";
  document.body.dataset.backend = available ? "connected" : "fallback";
}

async function loadDashboard() {
  try {
    state = await apiRequest("/api/dashboard");
    const microsoftStatus = await apiRequest("/api/microsoft/status");
    if (microsoftStatus.connected) state = await apiRequest("/api/dashboard");
    persist();
    setBackendStatus(true);
  } catch (error) {
    console.warn("Alfred API unavailable; using local fallback.", error);
    state = loadState();
    setBackendStatus(false);
    showToast("Backend unavailable. Using browser fallback.");
  }
  renderAll();
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function companyFor(id) {
  return state.companies.find((company) => company.id === id);
}

function openItems() {
  return state.operatingItems.filter((item) => item.status === "open");
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function updateClock() {
  const now = new Date();
  $("#current-date").textContent = now
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    .toUpperCase();
  $("#current-time").textContent = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const hour = now.getHours();
  $("#day-period").textContent = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

function renderCommand() {
  const items = openItems();
  const priorityItems = [...items]
    .sort(
      (a, b) =>
        ({ high: 0, medium: 1, low: 2 }[a.priority] -
          { high: 0, medium: 1, low: 2 }[b.priority]),
    )
    .slice(0, 4);

  $("#attention-count").textContent = priorityItems.length;
  $("#attention-list").innerHTML = priorityItems.length
    ? priorityItems
        .map(
          (item) => `
            <article class="attention-item">
              <span class="priority-marker ${item.priority}"></span>
              <div>
                <strong>${escapeHTML(item.title)}</strong>
                <p>${escapeHTML(item.detail)}</p>
              </div>
              <time>${escapeHTML(item.due)}</time>
            </article>
          `,
        )
        .join("")
    : '<div class="empty-state">No open items require attention.</div>';

  const metrics = [
    ["COMPANIES", state.companies.length, "Group portfolio"],
    ["OPEN ACTIONS", items.filter((item) => item.type === "action").length, "Recorded actions"],
    ["RISKS", items.filter((item) => item.type === "risk").length, "Known risks"],
    ["OPPORTUNITIES", items.filter((item) => item.type === "opportunity").length, "Active pipeline"],
    ["DECISIONS", items.filter((item) => item.type === "decision").length, "Chairman required"],
  ];

  $("#metric-grid").innerHTML = metrics
    .map(
      ([label, value, note]) => `
        <article class="metric-card">
          <span>${label}</span>
          <strong>${value}</strong>
          <small>${note}</small>
        </article>
      `,
    )
    .join("");

  $("#company-strip").innerHTML = state.companies
    .map((company) => {
      const companyItems = items.filter((item) => item.companyId === company.id);
      return `
        <article class="company-mini" style="--company-color:${company.color}">
          <header>
            <span class="company-symbol">${escapeHTML(company.symbol)}</span>
            <h4>${escapeHTML(company.name)}</h4>
          </header>
          <p>${escapeHTML(company.purpose)}</p>
          <div class="mini-stats">
            <div><strong>${companyItems.length}</strong><small>Open</small></div>
            <div><strong>${companyItems.filter((item) => item.type === "risk").length}</strong><small>Risks</small></div>
            <div><strong>${companyItems.filter((item) => item.type === "opportunity").length}</strong><small>Opps</small></div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCompanies() {
  $("#portfolio-grid").innerHTML = state.companies
    .map((company) => {
      const items = openItems().filter((item) => item.companyId === company.id);
      return `
        <article class="portfolio-card" style="--company-color:${company.color}">
          <div class="portfolio-header">
            <div class="portfolio-identity">
              <span class="company-symbol">${escapeHTML(company.symbol)}</span>
              <div>
                <h3>${escapeHTML(company.name)}</h3>
                <p>${escapeHTML(company.purpose)}</p>
              </div>
            </div>
            <span class="tag">${escapeHTML(company.status)}</span>
          </div>
          <div class="portfolio-section">
            <h4>${company.id === "digitize" ? "SERVICES & CLIENTS" : "PRODUCTS & TARGETS"}</h4>
            <div class="chip-row">
              ${[...company.services, ...company.clients].map((item) => `<span class="chip">${escapeHTML(item)}</span>`).join("")}
            </div>
          </div>
          <div class="portfolio-section">
            <h4>OPERATING REGISTER</h4>
            <div class="operating-list">
              ${
                items.length
                  ? items
                      .map(
                        (item) => `
                          <div class="operating-row">
                            <span class="priority-marker ${item.priority}"></span>
                            <span>${escapeHTML(item.title)}</span>
                            <small>${escapeHTML(item.type)}</small>
                          </div>
                        `,
                      )
                      .join("")
                  : '<div class="empty-state">No open records.</div>'
              }
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderMemory() {
  const types = ["all", ...new Set(state.memories.map((memory) => memory.type))];
  $("#memory-filters").innerHTML = types
    .map(
      (type) => `
        <button class="filter-button ${memoryFilter === type ? "active" : ""}" data-memory-filter="${type}">
          ${type}
        </button>
      `,
    )
    .join("");

  const query = $("#memory-search").value.trim().toLowerCase();
  const records = state.memories
    .filter((memory) => memoryFilter === "all" || memory.type === memoryFilter)
    .filter((memory) => !query || `${memory.title} ${memory.detail}`.toLowerCase().includes(query))
    .sort((a, b) => b.date.localeCompare(a.date));

  $("#memory-list").innerHTML = records.length
    ? records
        .map(
          (memory) => `
            <article class="memory-record">
              <span class="record-type">${escapeHTML(memory.type)}</span>
              <div>
                <h3>${escapeHTML(memory.title)}</h3>
                <p>${escapeHTML(memory.detail)}</p>
              </div>
              <time>${new Date(`${memory.date}T12:00:00`).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}</time>
            </article>
          `,
        )
        .join("")
    : '<div class="empty-state">No matching memory records.</div>';
}

function renderAgents() {
  $("#agent-grid").innerHTML = state.agents
    .map((agent) => {
      const company = companyFor(agent.companyId);
      return `
        <article class="agent-card">
          <header>
            <div class="agent-identity">
              <span class="agent-avatar">${escapeHTML(agent.name.slice(0, 1))}</span>
              <div>
                <h3>${escapeHTML(agent.name)}</h3>
                <p>${escapeHTML(agent.role)}</p>
              </div>
            </div>
            <span class="agent-status">${escapeHTML(agent.status)}</span>
          </header>
          <p class="agent-mission">${escapeHTML(agent.mission)}</p>
          <div class="agent-meta">
            <div><small>Company</small><strong>${escapeHTML(company?.shortName || "Group")}</strong></div>
            <div><small>Department</small><strong>${escapeHTML(agent.department)}</strong></div>
            <div><small>Tools</small><strong>${agent.tools.length} connected</strong></div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderIntegrations() {
  $("#integration-grid").innerHTML = state.integrations
    .map(
      (integration) => `
        <article class="integration-card">
          <header>
            <span class="integration-icon">${escapeHTML(integration.symbol)}</span>
            <h3>${escapeHTML(integration.name)}</h3>
          </header>
          <p>${escapeHTML(integration.description)}</p>
          <div class="connection-state">
            <span>${integration.status === "Connected" ? "Available to Alfred" : integration.status === "Planned" ? "Foundation prepared" : "Credential required"}</span>
            <strong class="integration-state integration-state-${integration.status.toLowerCase().replaceAll(" ", "-")}">${escapeHTML(integration.status.toUpperCase())}</strong>
          </div>
          ${
            integration.id === "outlook"
              ? `<button class="secondary-button connect-microsoft">${integration.status === "Connected" ? "Verify Microsoft connection" : "Connect Microsoft 365"}</button>`
              : ""
          }
        </article>
      `,
    )
    .join("");
}

function renderApprovals() {
  const approvals = state.approvals || [];
  const summary = state.approvalSummary || {};
  $("#approval-nav-count").textContent = summary.pending || 0;
  $("#approval-nav-count").classList.toggle("has-items", Boolean(summary.pending));
  $("#approval-metrics").innerHTML = [
    ["PENDING", summary.pending || 0],
    ["APPROVED", summary.approved || 0],
    ["EXPIRED", summary.expired || 0],
    ["EXECUTION", summary.executionEnabled ? "Enabled" : "Disabled"],
  ].map(([label, value]) => `
    <article>
      <small>${label}</small>
      <strong>${value}</strong>
    </article>
  `).join("");

  $("#approval-list").innerHTML = approvals.length
    ? approvals.map((approval) => `
        <article class="approval-card">
          <header>
            <div>
              <span class="approval-system">${escapeHTML(approval.targetSystem)}</span>
              <h3>${escapeHTML(approval.title)}</h3>
            </div>
            <span class="approval-status status-${escapeHTML(approval.status)}">${escapeHTML(approval.status)}</span>
          </header>
          <p>${escapeHTML(approval.description)}</p>
          <dl>
            <div><dt>Action</dt><dd>${escapeHTML(approval.actionType.replaceAll("_", " "))}</dd></div>
            <div><dt>Risk</dt><dd>${escapeHTML(approval.riskLevel)}</dd></div>
            <div><dt>Requested by</dt><dd>${escapeHTML(approval.requestedBy)}</dd></div>
            <div><dt>Expires</dt><dd>${approval.expiresAt ? new Date(approval.expiresAt).toLocaleString("en-GB") : "Not set"}</dd></div>
          </dl>
          <div class="approval-safeguards">
            <span class="${approval.payloadHash ? "passed" : "failed"}">Action fingerprint</span>
            <span class="${approval.idempotencyKey ? "passed" : "failed"}">Idempotency key</span>
            <span class="failed">Re-auth unavailable</span>
            <span class="failed">Executor unavailable</span>
          </div>
          ${approval.reviewedBy ? `<div class="approval-review"><strong>${escapeHTML(approval.reviewedBy)}</strong> ${escapeHTML(approval.status)} this request.${approval.reviewNote ? ` ${escapeHTML(approval.reviewNote)}` : ""}</div>` : ""}
          ${approval.status === "approved" ? '<div class="approval-hold">Authorised, but held. No executor is installed.</div>' : ""}
          ${approval.latestPreflight ? `
            <div class="preflight-result">
              <strong>Latest preflight: ${approval.latestPreflight.result.ready ? "ready" : "blocked"}</strong>
              <span>${escapeHTML(approval.latestPreflight.result.checks.identityReauthentication.message)} ${escapeHTML(approval.latestPreflight.result.checks.executor.message)}</span>
            </div>
          ` : ""}
          ${approval.status === "pending" ? `
            <div class="approval-actions">
              <button class="secondary-button approval-decision" data-approval-id="${approval.id}" data-decision="reject">Reject</button>
              <button class="primary-button approval-decision" data-approval-id="${approval.id}" data-decision="approve">Approve</button>
            </div>
          ` : approval.status === "approved" ? `
            <div class="approval-actions">
              <button class="secondary-button approval-preflight" data-approval-id="${approval.id}">Run execution preflight</button>
            </div>
          ` : ""}
        </article>
      `).join("")
    : '<div class="empty-state approval-empty">No actions are awaiting approval. Alfred has not executed anything.</div>';
}

function renderAll() {
  renderCommand();
  renderCompanies();
  renderMemory();
  renderAgents();
  renderApprovals();
  renderIntegrations();
}

function navigate(view) {
  const titles = {
    command: "Executive Command",
    companies: "Companies",
    memory: "Memory",
    agents: "AI Executive Team",
    approvals: "Approvals",
    integrations: "Integrations",
  };
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $$(".view").forEach((section) => section.classList.toggle("active", section.id === `${view}-view`));
  $("#view-title").textContent = titles[view];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function buildBrief(brief) {
  const section = (title, records, empty, className = "") => `
    <section class="brief-section ${className}">
      <h4>${title}</h4>
      ${
        records.length
          ? `<ol>${records.map((item) => `
              <li>
                <strong>${escapeHTML(item.title)}.</strong> ${escapeHTML(item.detail || "")}
                ${item.preparation?.length ? `<em>Prepare: ${escapeHTML(item.preparation.join("; "))}</em>` : ""}
                ${item.prompt ? `<em>${escapeHTML(item.prompt)}</em>` : ""}
                ${item.sourceType === "email-signal" ? "<em>Detected signal — verify the source before acting.</em>" : ""}
              </li>
            `).join("")}</ol>`
          : `<p class="core-message">${empty}</p>`
      }
    </section>
  `;

  $("#brief-timestamp").textContent = new Date(brief.generatedAt).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  currentBriefingId = brief.briefingId || null;
  $("#brief-feedback").classList.remove("submitted");
  $("#brief-feedback-note").value = "";
  $("#brief-content").innerHTML = `
    <div class="brief-opening">
      Good ${$("#day-period").textContent}, Patrick. I ranked ${brief.executivePriorities?.length || 0} executive priorities from
      ${brief.summary.totalOpen} open operating records, ${brief.emails?.length || 0} reviewed emails and
      ${brief.meetings.items?.length || 0} upcoming meetings.
      Signals inferred from email language are clearly labelled and require your review.
    </div>
    ${section("1. EXECUTIVE PRIORITIES", (brief.executivePriorities || []).map((item) => ({
      ...item,
      title: `${item.rank}. ${item.title}`,
      detail: `${item.category.toUpperCase()} · score ${item.score}${item.detail ? ` — ${item.detail}` : ""}`,
    })), "No priorities could be ranked.", "priority-section")}
    ${section("2. PRIORITY ACTIONS", brief.actions, "No actions are currently recorded.")}
    ${section("3. RISK REGISTER & SIGNALS", brief.riskSignals || brief.risks, "No risk records or signals were found.")}
    ${section("4. PRIORITISED OUTLOOK EMAIL", brief.emails || [], brief.microsoft?.connected ? "No recent email was returned." : "Outlook is not connected. No email data was reviewed.")}
    ${section("5. MEETING PREPARATION", brief.meetings.items, brief.meetings.message)}
    ${section("6. REVENUE OPPORTUNITIES", brief.opportunities, "No opportunities are currently recorded.")}
    ${section("7. DECISION PROMPTS", brief.decisionPrompts || brief.decisions, "No decisions are currently recorded.")}
    ${section("8. AGENT STATUS", brief.agents.map((agent) => ({ title: `${agent.name} — ${agent.role}`, detail: agent.status })), "No agent definitions are currently recorded.")}
  `;
}

async function generateBrief() {
  const core = $("#core-button");
  const coreState = $("#core-state");
  const coreMessage = $("#core-message");
  core.classList.add("working");
  coreState.textContent = "REVIEWING";
  coreMessage.textContent = "Reviewing companies, open operating records and stored memory.";
  try {
    const brief = backendAvailable
      ? await apiRequest("/api/morning-brief")
      : buildFallbackBrief();
    buildBrief(brief);
    core.classList.remove("working");
    coreState.textContent = "BRIEF READY";
    coreMessage.textContent = `Briefing compiled from ${backendAvailable ? "the SQLite operating database" : "browser fallback data"}.`;
    $("#brief-dialog").showModal();
  } catch (error) {
    core.classList.remove("working");
    coreState.textContent = "ALERT";
    coreMessage.textContent = error.message;
    showToast("Briefing could not be generated");
  }
}

function buildFallbackBrief() {
  const items = openItems();
  const byType = (type) => items.filter((item) => item.type === type);
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalOpen: items.length,
      actions: byType("action").length,
      risks: byType("risk").length,
      opportunities: byType("opportunity").length,
      decisions: byType("decision").length,
      agentsPlanned: state.agents.length,
      agentsConnected: 0,
    },
    actions: byType("action"),
    risks: byType("risk"),
    meetings: { items: [], message: "Calendar is not connected. No meeting data was reviewed." },
    opportunities: byType("opportunity"),
    decisions: byType("decision"),
    agents: state.agents,
    emails: [],
    microsoft: { connected: false },
    source: "localStorage",
  };
}

async function connectMicrosoft() {
  if (!backendAvailable) {
    showToast("Start the Alfred backend before connecting Microsoft 365");
    return;
  }
  const dialog = $("#microsoft-dialog");
  $("#microsoft-code").textContent = "—";
  $("#microsoft-message").textContent = "Starting secure device authorization…";
  $("#microsoft-progress").textContent = "Alfred requests read-only delegated permissions.";
  dialog.showModal();

  try {
    const flow = await apiRequest("/api/microsoft/connect", { method: "POST", body: "{}" });
    $("#microsoft-code").textContent = flow.userCode;
    $("#microsoft-link").href = flow.verificationUri;
    $("#microsoft-message").textContent = flow.message;
    $("#microsoft-progress").textContent = "Open Microsoft sign-in, enter the code, review the read-only permissions, and approve.";
    pollMicrosoftConnection((flow.interval || 5) * 1000, Date.now() + flow.expiresIn * 1000);
  } catch (error) {
    $("#microsoft-progress").textContent = error.message;
    showToast(error.message);
  }
}

function pollMicrosoftConnection(interval, expiresAt) {
  clearTimeout(microsoftPollTimer);
  microsoftPollTimer = setTimeout(async () => {
    if (Date.now() >= expiresAt || !$("#microsoft-dialog").open) return;
    try {
      const result = await apiRequest("/api/microsoft/connect/complete", { method: "POST", body: "{}" });
      if (result.pending) {
        $("#microsoft-progress").textContent = "Waiting for Microsoft authorization…";
        pollMicrosoftConnection((result.retryAfter || interval / 1000) * 1000, expiresAt);
        return;
      }
      $("#microsoft-progress").textContent = `Connected as ${result.profile.displayName} (${result.profile.email}).`;
      state = await apiRequest("/api/dashboard");
      persist();
      renderAll();
      showToast("Microsoft 365 read-only connection verified");
    } catch (error) {
      $("#microsoft-progress").textContent = error.message;
    }
  }, interval);
}

function briefAsText() {
  return $("#brief-content").innerText.trim();
}

async function submitBriefFeedback(rating) {
  if (!backendAvailable || !currentBriefingId) {
    showToast("Feedback requires a saved backend briefing");
    return;
  }
  try {
    await apiRequest(`/api/briefings/${currentBriefingId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ rating, note: $("#brief-feedback-note").value.trim() }),
    });
    $("#brief-feedback").classList.add("submitted");
    showToast("Briefing feedback stored");
  } catch (error) {
    showToast(error.message);
  }
}

async function showBriefHistory() {
  if (!backendAvailable) {
    showToast("Briefing history requires the backend");
    return;
  }
  try {
    const history = await apiRequest("/api/briefings?limit=30");
    $("#brief-history-list").innerHTML = history.length
      ? history.map((briefing) => `
          <article class="brief-history-item">
            <strong>${new Date(briefing.generatedAt).toLocaleString("en-GB")}</strong>
            <small>${briefing.feedback.useful} useful · ${briefing.feedback.notUseful} not useful</small>
            <p>
              ${briefing.summary.totalOpen || 0} open records ·
              ${briefing.summary.priorityEmails || 0} high-priority emails ·
              ${briefing.summary.meetingsToday || 0} meetings within 24 hours ·
              ${briefing.summary.decisionPrompts || 0} decision prompts
            </p>
          </article>
        `).join("")
      : '<div class="empty-state">No saved briefings yet.</div>';
    $("#history-dialog").showModal();
  } catch (error) {
    showToast(error.message);
  }
}

async function reviewApproval(id, decision) {
  if (!backendAvailable) {
    showToast("Approvals require the backend audit trail");
    return;
  }
  const verb = decision === "approve" ? "approve" : "reject";
  const warning = decision === "approve"
    ? "Approve this request? This records authorization only; Alfred still cannot execute it."
    : "Reject this request? The decision will be recorded in the audit trail.";
  if (!window.confirm(warning)) return;
  const note = window.prompt(`Optional note for this ${verb} decision:`, "") ?? "";
  try {
    await apiRequest(`/api/approvals/${id}/${decision}`, {
      method: "POST",
      body: JSON.stringify({ actor: "Patrick King", note }),
    });
    state = await apiRequest("/api/dashboard");
    persist();
    renderAll();
    showToast(decision === "approve"
      ? "Approved and held. External execution remains disabled."
      : "Approval request rejected");
  } catch (error) {
    showToast(error.message);
  }
}

async function runApprovalPreflight(id) {
  if (!backendAvailable) {
    showToast("Execution preflight requires the backend");
    return;
  }
  try {
    const preflight = await apiRequest(`/api/approvals/${id}/preflight`, {
      method: "POST",
      body: JSON.stringify({ actor: "Patrick King" }),
    });
    state = await apiRequest("/api/dashboard");
    persist();
    renderAll();
    showToast(preflight.result.ready
      ? "Execution preflight passed"
      : "Preflight blocked. Re-authentication and executor are unavailable.");
  } catch (error) {
    showToast(error.message);
  }
}

function openRecordForm(kind) {
  const form = $("#record-form");
  const companies = state.companies
    .map((company) => `<option value="${company.id}">${escapeHTML(company.name)}</option>`)
    .join("");

  if (kind === "memory") {
    $("#form-eyebrow").textContent = "INTELLIGENCE LAYER";
    $("#form-title").textContent = "Add memory";
    form.innerHTML = `
      <div class="field"><label for="record-type">Type</label><select id="record-type" name="type" required>
        <option value="decision">Decision</option><option value="meeting">Meeting</option>
        <option value="lesson">Lesson</option><option value="idea">Idea</option><option value="client">Client</option>
      </select></div>
      <div class="field"><label for="record-title">Title</label><input id="record-title" name="title" required /></div>
      <div class="field"><label for="record-detail">What should Alfred remember?</label><textarea id="record-detail" name="detail" required></textarea></div>
      <div class="field"><label for="record-company">Company</label><select id="record-company" name="companyId"><option value="group">Group</option>${companies}</select></div>
      <div class="form-actions"><button type="button" class="secondary-button close-form">Cancel</button><button class="primary-button" type="submit">Store memory</button></div>
    `;
  } else if (kind === "agent") {
    $("#form-eyebrow").textContent = "AGENT MANAGEMENT LAYER";
    $("#form-title").textContent = "Define agent";
    form.innerHTML = `
      <div class="field"><label for="record-name">Name</label><input id="record-name" name="name" required /></div>
      <div class="field"><label for="record-role">Role</label><input id="record-role" name="role" required /></div>
      <div class="field"><label for="record-mission">Mission</label><textarea id="record-mission" name="mission" required></textarea></div>
      <div class="field"><label for="record-company">Company</label><select id="record-company" name="companyId"><option value="group">Group</option>${companies}</select></div>
      <div class="field"><label for="record-department">Department</label><input id="record-department" name="department" required /></div>
      <div class="form-actions"><button type="button" class="secondary-button close-form">Cancel</button><button class="primary-button" type="submit">Define agent</button></div>
    `;
  } else if (kind === "approval") {
    $("#form-eyebrow").textContent = "HUMAN APPROVAL LAYER";
    $("#form-title").textContent = "Propose external action";
    form.innerHTML = `
      <div class="form-notice">This creates a review request only. No external action will be executed.</div>
      <div class="field"><label for="record-system">Target system</label><select id="record-system" name="targetSystem" required>
        <option value="Microsoft Outlook">Microsoft Outlook</option>
        <option value="Outlook Calendar">Outlook Calendar</option>
        <option value="OneDrive / SharePoint">OneDrive / SharePoint</option>
        <option value="Monday.com">Monday.com</option>
        <option value="Other external system">Other external system</option>
      </select></div>
      <div class="field"><label for="record-action-type">Proposed action</label><select id="record-action-type" name="actionType" required>
        <option value="draft_email">Draft email</option>
        <option value="send_email">Send email</option>
        <option value="calendar_change">Change calendar</option>
        <option value="file_change">Change file</option>
        <option value="external_task">Create external task</option>
      </select></div>
      <div class="field"><label for="record-title">Title</label><input id="record-title" name="title" required /></div>
      <div class="field"><label for="record-detail">Exact proposed outcome</label><textarea id="record-detail" name="description" required></textarea></div>
      <div class="field"><label for="record-risk">Risk level</label><select id="record-risk" name="riskLevel">
        <option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option>
      </select></div>
      <div class="field"><label for="record-expiry">Approval validity</label><select id="record-expiry" name="expiryHours">
        <option value="1">1 hour</option><option value="8">8 hours</option>
        <option value="24" selected>24 hours</option><option value="72">3 days</option><option value="168">7 days</option>
      </select></div>
      <div class="form-actions"><button type="button" class="secondary-button close-form">Cancel</button><button class="primary-button" type="submit">Request approval</button></div>
    `;
  } else {
    $("#form-eyebrow").textContent = "COMPANY OPERATING LAYER";
    $("#form-title").textContent = "Add operating item";
    form.innerHTML = `
      <div class="field"><label for="record-company">Company</label><select id="record-company" name="companyId" required>${companies}</select></div>
      <div class="field"><label for="record-type">Type</label><select id="record-type" name="type" required>
        <option value="action">Action</option><option value="risk">Risk</option>
        <option value="opportunity">Opportunity</option><option value="decision">Decision</option>
      </select></div>
      <div class="field"><label for="record-title">Title</label><input id="record-title" name="title" required /></div>
      <div class="field"><label for="record-detail">Detail</label><textarea id="record-detail" name="detail" required></textarea></div>
      <div class="field"><label for="record-priority">Priority</label><select id="record-priority" name="priority"><option>high</option><option selected>medium</option><option>low</option></select></div>
      <div class="field"><label for="record-due">Timing</label><input id="record-due" name="due" value="This week" required /></div>
      <div class="form-actions"><button type="button" class="secondary-button close-form">Cancel</button><button class="primary-button" type="submit">Add record</button></div>
    `;
  }

  form.dataset.kind = kind;
  $("#form-dialog").showModal();
}

async function submitRecord(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));

  try {
    if (backendAvailable) {
      if (form.dataset.kind === "memory") {
        await apiRequest("/api/memories", {
          method: "POST",
          body: JSON.stringify({ ...values, companyId: values.companyId === "group" ? null : values.companyId }),
        });
        showToast("Memory saved to database");
      } else if (form.dataset.kind === "agent") {
        await apiRequest("/api/agents", {
          method: "POST",
          body: JSON.stringify({
            id: `agent-${Date.now()}`,
            ...values,
            companyId: values.companyId === "group" ? null : values.companyId,
            tools: [],
            status: "Planned",
          }),
        });
        showToast("Agent definition saved");
      } else if (form.dataset.kind === "approval") {
        const expiresAt = new Date(Date.now() + Number(values.expiryHours || 24) * 60 * 60 * 1000).toISOString();
        delete values.expiryHours;
        await apiRequest("/api/approvals", {
          method: "POST",
          body: JSON.stringify({
            ...values,
            requestedBy: "Alfred",
            expiresAt,
            idempotencyKey: createIdempotencyKey(),
          }),
        });
        showToast("Approval request created. Nothing was executed.");
      } else {
        await apiRequest(`/api/${values.type}s`, {
          method: "POST",
          body: JSON.stringify({ ...values, status: "open" }),
        });
        showToast(`${values.type[0].toUpperCase()}${values.type.slice(1)} saved to database`);
      }
      state = await apiRequest("/api/dashboard");
    } else if (form.dataset.kind === "approval") {
      showToast("Approvals require the backend audit trail");
      return;
    } else if (form.dataset.kind === "memory") {
      state.memories.push({ id: Date.now(), ...values, date: new Date().toISOString().slice(0, 10) });
      showToast("Memory stored in browser fallback");
    } else if (form.dataset.kind === "agent") {
      state.agents.push({ id: `agent-${Date.now()}`, ...values, tools: [], status: "Planned" });
      showToast("Agent definition stored in browser fallback");
    } else {
      state.operatingItems.push({ id: Date.now(), ...values, status: "open" });
      showToast("Operating record stored in browser fallback");
    }
    persist();
    renderAll();
    $("#form-dialog").close();
  } catch (error) {
    showToast(error.message);
  }
}

function runCommand(command) {
  const normalized = command.toLowerCase().trim();
  if (!normalized) return;

  if (normalized.includes("brief")) {
    generateBrief();
  } else if (normalized.includes("risk")) {
    navigate("companies");
    showToast(`${openItems().filter((item) => item.type === "risk").length} known risk(s) in the operating register`);
  } else if (normalized.includes("opportun")) {
    navigate("companies");
    showToast(`${openItems().filter((item) => item.type === "opportunity").length} active opportunity record(s)`);
  } else if (normalized.includes("memory") || normalized.includes("remember") || normalized.includes("westminster")) {
    navigate("memory");
    if (normalized.includes("westminster")) {
      $("#memory-search").value = "Westminster";
      renderMemory();
    }
  } else if (normalized.includes("agent") || normalized.includes("team")) {
    navigate("agents");
  } else if (normalized.includes("approval") || normalized.includes("approve")) {
    navigate("approvals");
  } else if (normalized.includes("compan") || normalized.includes("digitize")) {
    navigate("companies");
  } else {
    showToast("Command not yet supported. Try “brief me”, “show risks” or “search Westminster”.");
  }
}

$$(".nav-item").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.view)));
$$("[data-view-target]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.viewTarget)));
$("#brief-button").addEventListener("click", generateBrief);
$("#core-button").addEventListener("click", generateBrief);
$("#add-memory").addEventListener("click", () => openRecordForm("memory"));
$("#add-agent").addEventListener("click", () => openRecordForm("agent"));
$("#add-approval").addEventListener("click", () => openRecordForm("approval"));
$("#add-operating-item").addEventListener("click", () => openRecordForm("operating"));
$("#record-form").addEventListener("submit", submitRecord);
$("#memory-search").addEventListener("input", renderMemory);
$("#memory-filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-memory-filter]");
  if (!button) return;
  memoryFilter = button.dataset.memoryFilter;
  renderMemory();
});
$("#command-form").addEventListener("submit", (event) => {
  event.preventDefault();
  runCommand($("#command-input").value);
  $("#command-input").value = "";
});
$("#copy-brief").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(briefAsText());
    showToast("Briefing copied");
  } catch {
    showToast("Clipboard access is unavailable");
  }
});
$("#brief-history-button").addEventListener("click", showBriefHistory);
$$(".feedback-button").forEach((button) => button.addEventListener("click", () => submitBriefFeedback(button.dataset.rating)));
$$(".close-dialog").forEach((button) => button.addEventListener("click", () => $("#brief-dialog").close()));
$$(".close-history").forEach((button) => button.addEventListener("click", () => $("#history-dialog").close()));
document.addEventListener("click", (event) => {
  if (event.target.closest(".close-form")) $("#form-dialog").close();
  if (event.target.closest(".connect-microsoft")) connectMicrosoft();
  const approvalButton = event.target.closest(".approval-decision");
  if (approvalButton) reviewApproval(approvalButton.dataset.approvalId, approvalButton.dataset.decision);
  const preflightButton = event.target.closest(".approval-preflight");
  if (preflightButton) runApprovalPreflight(preflightButton.dataset.approvalId);
  if (event.target.closest(".close-microsoft")) {
    clearTimeout(microsoftPollTimer);
    $("#microsoft-dialog").close();
  }
});
$("#reset-data").addEventListener("click", () => {
  if (backendAvailable) {
    loadDashboard();
    showToast("Dashboard refreshed from database");
    return;
  }
  if (!window.confirm("Reset browser fallback data to its initial records?")) return;
  state = clone(seedData);
  persist();
  renderAll();
  showToast("Fallback data reset");
});
document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "b" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    generateBrief();
  }
  if (event.key === "Escape") {
    if ($("#brief-dialog").open) $("#brief-dialog").close();
    if ($("#form-dialog").open) $("#form-dialog").close();
    if ($("#microsoft-dialog").open) {
      clearTimeout(microsoftPollTimer);
      $("#microsoft-dialog").close();
    }
    if ($("#history-dialog").open) $("#history-dialog").close();
  }
});

updateClock();
setInterval(updateClock, 30_000);
loadDashboard();

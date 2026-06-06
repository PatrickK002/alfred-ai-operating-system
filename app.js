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
    {
      id: "olivia",
      name: "Olivia",
      role: "Chief Financial Officer",
      companyId: "group",
      department: "Finance",
      mission: "Act as Group CFO across Alfred-managed businesses with read-only revenue, forecast, debtor, KPI and board reporting intelligence.",
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
  financial: {
    businessEntities: [
      { id: "group", name: "Patrick King Group", entityType: "group", parentEntityId: null, companyId: null, status: "active" },
      { id: "digitize", name: "Digitize Consultants", entityType: "business", parentEntityId: "group", companyId: "digitize", status: "active" },
      { id: "council-assurance-platform", name: "Council Assurance Platform", entityType: "product", parentEntityId: "group", companyId: "product", status: "planned" },
      { id: "media-businesses", name: "Media Businesses", entityType: "division", parentEntityId: "group", companyId: "media", status: "planned" },
      { id: "ai-businesses", name: "AI Businesses", entityType: "division", parentEntityId: "group", companyId: "venture", status: "planned" },
      { id: "future-saas-products", name: "Future SaaS Products", entityType: "division", parentEntityId: "group", companyId: "product", status: "planned" },
      { id: "future-ventures", name: "Future Ventures", entityType: "venture", parentEntityId: "group", companyId: "venture", status: "planned" },
    ],
    scope: { type: "group", id: "group", label: "Patrick King Group", entityIds: ["group", "digitize"] },
    metrics: {
      securedRevenue: 0,
      pipelineRevenue: 0,
      weightedForecastRevenue: 0,
      outstandingDebtors: 0,
      overdueDebtors: 0,
      invoiceCount: 0,
      orderBookEntries: 0,
    },
    revenueByFinancialYear: [],
    revenueByQuarter: [],
    revenueByBusiness: [],
    revenueByClient: [],
    revenueByProject: [],
    revenueByServiceLine: [],
    invoiceStatus: {},
    debtors: [],
    forecast: { monthly: [], quarterly: [], annual: [], gapAnalysis: [], resourceRevenue: [] },
    risks: [],
    opportunities: [],
    monday: { invoices: [], readOnly: true },
    boundary: { readOnly: true },
  },
  projectIntelligence: {
    metrics: {
      activeProjects: 0,
      highRiskProjects: 0,
      overdueActions: 0,
      recentlyUpdatedProjects: 0,
      projectsWithMissingInformation: 0,
    },
    projects: [],
    highRiskProjects: [],
    overdueActions: [],
    recentlyUpdatedProjects: [],
    missingInformation: [],
    boundary: { readOnly: true },
  },
};

let state = loadState();
let backendAvailable = false;
let microsoftPollTimer;
let currentBriefingId = null;
let currentBrief = null;
let memoryFilter = "all";
let semanticMemoryStatus = null;
let currentBoardReportMarkdown = "";
let financeScope = { type: "group", id: "group" };
let currentProjectDetail = null;
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
    semanticMemoryStatus = await apiRequest("/api/memory/status").catch(() => null);
    state.financial = await apiRequest("/api/financial/dashboard").catch(() => seedData.financial);
    state.projectIntelligence = await apiRequest("/api/project-intelligence/dashboard").catch(() => seedData.projectIntelligence);
    persist();
    setBackendStatus(true);
  } catch (error) {
    console.warn("Alfred API unavailable; using local fallback.", error);
    state = loadState();
    semanticMemoryStatus = null;
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

function formatMoney(value = 0) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
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
                            ${["risk", "decision"].includes(item.type) ? `<button class="text-button mini-ai-button ai-operating-analysis" data-ai-item-type="${item.type}" data-ai-item-id="${item.id}">Ask Alfred</button>` : ""}
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
  renderSemanticMemoryStatus();
}

function renderSemanticMemoryStatus() {
  const status = semanticMemoryStatus;
  const statusText = !backendAvailable
    ? "Semantic search requires the backend."
    : !status
      ? "Voyage memory status is unavailable."
      : status.indexingEnabled === false
        ? "Semantic indexing is disabled. Local keyword fallback remains available."
        : status.configured
          ? `${status.status}. Model: ${status.model}. ${status.stats?.count || 0} records indexed.`
          : "Voyage is not configured. Local keyword fallback remains available.";
  $("#semantic-memory-status").textContent = statusText;
  $("#semantic-indexing-toggle").checked = status?.indexingEnabled !== false;
  $("#semantic-indexing-toggle").disabled = !backendAvailable;
}

function renderSemanticMemoryResults(result) {
  const qualifier = result.semantic
    ? `Semantic search via ${escapeHTML(result.model)}`
    : escapeHTML(result.message || "Keyword fallback results");
  $("#semantic-memory-results").innerHTML = `
    <div class="semantic-search-meta">
      <strong>${qualifier}</strong>
      <span>${result.results.length} result(s) · Local sensitive business data</span>
    </div>
    ${
      result.results.length
        ? result.results.map((record) => `
            <article class="semantic-memory-result">
              <header>
                <span class="record-type">${escapeHTML(record.sourceType)}</span>
                <strong>${escapeHTML(record.sourceReference)}</strong>
                <small>${Math.round(record.relevanceScore * 100)}% relevant</small>
              </header>
              <p>${escapeHTML(record.shortSummary)}</p>
              <footer>
                <span>${escapeHTML(record.sensitivityLabel)}</span>
                <time>${new Date(record.timestamp).toLocaleString("en-GB")}</time>
              </footer>
            </article>
          `).join("")
        : '<div class="empty-state">No matching semantic memory records yet.</div>'
    }
  `;
}

function renderRelatedMemory(records = []) {
  if (!records.length) return "";
  return renderList("Related memory context", records, (record) => `
    <strong>${escapeHTML(record.sourceReference)}</strong>
    <span>${escapeHTML(record.summary || record.shortSummary || "")}</span>
    <small>${escapeHTML(record.sensitivityLabel || "local_sensitive_business_data")} · ${Math.round((record.relevanceScore || 0) * 100)}% relevant</small>
  `);
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
              <button class="secondary-button ai-approval-analysis" data-approval-id="${approval.id}">Ask Alfred to analyse</button>
              <button class="secondary-button approval-decision" data-approval-id="${approval.id}" data-decision="reject">Reject</button>
              <button class="primary-button approval-decision" data-approval-id="${approval.id}" data-decision="approve">Approve</button>
            </div>
          ` : approval.status === "approved" ? `
            <div class="approval-actions">
              <button class="secondary-button ai-approval-analysis" data-approval-id="${approval.id}">Ask Alfred to analyse</button>
              <button class="secondary-button approval-preflight" data-approval-id="${approval.id}">Run execution preflight</button>
            </div>
          ` : `
            <div class="approval-actions">
              <button class="secondary-button ai-approval-analysis" data-approval-id="${approval.id}">Ask Alfred to analyse</button>
            </div>
          `}
        </article>
      `).join("")
    : '<div class="empty-state approval-empty">No actions are awaiting approval. Alfred has not executed anything.</div>';
}

function renderFinanceList(records, empty = "No financial data yet.") {
  return records?.length
    ? `<div class="finance-list">${records.slice(0, 8).map((item) => `
        <article>
          <span>${escapeHTML(item.label || item.clientName || item.title || "Unassigned")}</span>
          <strong>${formatMoney(item.amountGbp ?? item.amountOutstandingGbp ?? item.valueGbp ?? 0)}</strong>
          ${item.detail ? `<small>${escapeHTML(item.detail)}</small>` : ""}
        </article>
      `).join("")}</div>`
    : `<div class="empty-state finance-empty">${empty}</div>`;
}

function financeScopeValue(entity) {
  return `${entity.entityType || "business"}:${entity.id}`;
}

function selectedFinanceEntity() {
  const finance = state.financial || seedData.financial;
  const entities = finance.businessEntities?.length ? finance.businessEntities : seedData.financial.businessEntities;
  return entities.find((entity) => entity.id === financeScope.id)
    || entities.find((entity) => entity.id === finance.scope?.id)
    || entities.find((entity) => entity.id === "group")
    || entities[0];
}

function selectedOperationalBusinessEntityId() {
  const entity = selectedFinanceEntity();
  if (!entity || entity.entityType === "group") return "digitize";
  return entity.id;
}

function financeScopeQuery() {
  const entity = selectedFinanceEntity();
  const type = entity?.entityType || financeScope.type || "group";
  const id = entity?.id || financeScope.id || "group";
  return `scopeType=${encodeURIComponent(type)}&scopeId=${encodeURIComponent(id)}`;
}

function renderFinanceScopeSelector() {
  const select = $("#finance-scope");
  if (!select) return;
  const finance = state.financial || seedData.financial;
  const entities = finance.businessEntities?.length ? finance.businessEntities : seedData.financial.businessEntities;
  const selected = selectedFinanceEntity() || entities[0];
  financeScope = { type: selected?.entityType || "group", id: selected?.id || "group" };
  select.innerHTML = entities.map((entity) => `
    <option value="${escapeHTML(financeScopeValue(entity))}" ${entity.id === financeScope.id ? "selected" : ""}>
      ${escapeHTML(entity.name)} (${escapeHTML(entity.entityType)})
    </option>
  `).join("");
}

function renderFinance() {
  const finance = state.financial || seedData.financial;
  renderFinanceScopeSelector();
  const metrics = finance.metrics || {};
  $("#finance-metrics").innerHTML = [
    ["SECURED REVENUE", metrics.securedRevenue],
    ["PIPELINE", metrics.pipelineRevenue],
    ["WEIGHTED FORECAST", metrics.weightedForecastRevenue],
    ["OUTSTANDING DEBTORS", metrics.outstandingDebtors],
    ["OVERDUE", metrics.overdueDebtors],
    ["ORDER BOOK ROWS", metrics.orderBookEntries],
  ].map(([label, value]) => `
    <article>
      <small>${label}</small>
      <strong>${typeof value === "number" && label !== "ORDER BOOK ROWS" ? formatMoney(value) : value || 0}</strong>
    </article>
  `).join("");

  const forecast = finance.forecast || {};
  $("#finance-forecast").innerHTML = `
    <div class="forecast-cases">
      <article><small>Best case</small><strong>${formatMoney(forecast.bestCase)}</strong></article>
      <article><small>Expected</small><strong>${formatMoney(forecast.expectedCase)}</strong></article>
      <article><small>Worst case</small><strong>${formatMoney(forecast.worstCase)}</strong></article>
    </div>
    ${renderFinanceList(finance.revenueByQuarter || [], "Import the order book to see quarterly revenue.")}
  `;
  $("#finance-clients").innerHTML = `
    <h4>Business entities</h4>
    ${renderFinanceList(finance.revenueByBusiness || [], "No business-level revenue imported yet.")}
    ${renderFinanceList(finance.revenueByClient || [], "No client revenue imported yet.")}
    <h4>Service lines</h4>
    ${renderFinanceList(finance.revenueByServiceLine || [], "No service line revenue imported yet.")}
  `;
  const debtors = finance.debtors || [];
  $("#finance-debtors").innerHTML = debtors.length
    ? `<div class="finance-list">${debtors.map((debtor) => `
        <article>
          <span>${escapeHTML(debtor.clientName)}</span>
          <strong>${formatMoney(debtor.amountOutstandingGbp)}</strong>
          <small>${formatMoney(debtor.amountOverdueGbp)} overdue · ${debtor.invoiceCount} invoice(s)</small>
        </article>
      `).join("")}</div>`
    : `<div class="empty-state finance-empty">No Monday invoice summaries have been refreshed yet.</div>`;
  const risks = finance.risks || [];
  const opportunities = finance.opportunities || [];
  $("#finance-insights").innerHTML = `
    ${renderFinanceList(risks.map((risk) => ({ ...risk, amountGbp: risk.amountGbp || 0 })), "No financial risks detected yet.")}
    <h4>Opportunities</h4>
    ${renderFinanceList(opportunities.map((opportunity) => ({ ...opportunity, amountGbp: opportunity.valueGbp || 0 })), "No financial opportunities detected yet.")}
  `;
}

function statusLabel(status = "") {
  return String(status || "unknown").toLowerCase();
}

function renderProjectItems(records, empty, renderItem) {
  return records?.length
    ? `<div class="project-record-list">${records.slice(0, 8).map(renderItem).join("")}</div>`
    : `<div class="empty-state project-empty">${empty}</div>`;
}

function renderProjectDetail(detail) {
  if (!detail) {
    $("#project-detail").innerHTML = '<div class="empty-state project-empty">Select a project to inspect risks, actions, documents, meetings, email signals, memory and financial context.</div>';
    return;
  }
  const profile = detail.profile;
  const health = detail.healthScore || {};
  $("#project-detail").innerHTML = `
    <div class="project-detail-header">
      <div>
        <span class="project-health ${statusLabel(health.status)}">${escapeHTML(health.status || "unknown")}</span>
        <h3>${escapeHTML(profile.projectName)}</h3>
        <p>${escapeHTML(profile.clientName || "Internal / product")} · ${escapeHTML(profile.serviceLine || "Unassigned")} · ${escapeHTML(profile.currentPhase || "Unknown phase")}</p>
      </div>
      <button class="secondary-button ask-project-analysis" data-project-id="${profile.id}">Ask Alfred to analyse</button>
    </div>
    <div class="project-health-card">
      <strong>${health.score ?? 0}/100</strong>
      <span>${escapeHTML(health.explanation || "No health score calculated.")}</span>
    </div>
    <p>${escapeHTML(profile.summary || "No project summary recorded yet.")}</p>
    <div class="project-detail-grid">
      <section>
        <h4>Risks</h4>
        ${renderProjectItems(detail.risks || [], "No project risks recorded.", (risk) => `
          <article><strong>${escapeHTML(risk.title)}</strong><small>${escapeHTML(risk.severity)} · ${escapeHTML(risk.confidence || "confirmed")}</small><span>${escapeHTML(risk.detail)}</span></article>
        `)}
      </section>
      <section>
        <h4>Actions</h4>
        ${renderProjectItems(detail.actions || [], "No project actions recorded.", (action) => `
          <article><strong>${escapeHTML(action.title)}</strong><small>${escapeHTML(action.status)} · ${escapeHTML(action.due || "No due date")}</small><span>${escapeHTML(action.detail)}</span></article>
        `)}
      </section>
      <section>
        <h4>Documents</h4>
        ${renderProjectItems(detail.documents || [], "No Microsoft document metadata linked yet.", (document) => `
          <article><strong>${escapeHTML(document.name)}</strong><small>${escapeHTML(document.classification)} · ${escapeHTML(document.associationReason || "metadata")}</small><span>${escapeHTML(document.path || document.webUrl || "No path captured")}</span></article>
        `)}
      </section>
      <section>
        <h4>Meetings & Emails</h4>
        ${renderProjectItems([...(detail.meetings || []), ...(detail.emailSignals || [])], "No related meetings or email signals linked yet.", (item) => `
          <article><strong>${escapeHTML(item.title || item.subject)}</strong><small>${escapeHTML(item.startDatetime || item.receivedDatetime || "")} · ${escapeHTML(item.associationReason || "inferred association")}</small><span>${escapeHTML(item.bodyPreview || item.webUrl || "")}</span></article>
        `)}
      </section>
    </div>
    <div class="project-finance-summary">
      <h4>Olivia financial link</h4>
      <span>${detail.financialSummary?.linkedOrderBookEntries || 0} order book link(s) · secured ${formatMoney(detail.financialSummary?.securedRevenue || 0)} · weighted ${formatMoney(detail.financialSummary?.weightedForecastRevenue || 0)}</span>
    </div>
    <div id="project-analysis-output"></div>
  `;
}

function renderProjectIntelligence() {
  const projectState = state.projectIntelligence || seedData.projectIntelligence;
  const metrics = projectState.metrics || {};
  $("#project-dashboard-metrics").innerHTML = [
    ["ACTIVE PROJECTS", metrics.activeProjects],
    ["HIGH RISK", metrics.highRiskProjects],
    ["OVERDUE ACTIONS", metrics.overdueActions],
    ["RECENTLY UPDATED", metrics.recentlyUpdatedProjects],
    ["MISSING INFO", metrics.projectsWithMissingInformation],
  ].map(([label, value]) => `
    <article>
      <small>${label}</small>
      <strong>${value || 0}</strong>
    </article>
  `).join("");

  const projects = projectState.projects || [];
  $("#project-list").innerHTML = projects.length
    ? `<div class="project-list">${projects.map((project) => `
        <article class="project-card" data-project-id="${project.profile.id}">
          <div>
            <span class="project-health ${statusLabel(project.healthScore?.status)}">${escapeHTML(project.healthScore?.status || "unknown")}</span>
            <h3>${escapeHTML(project.profile.projectName)}</h3>
            <p>${escapeHTML(project.profile.clientName || "Internal / product")} · ${escapeHTML(project.profile.currentPhase || "Unknown phase")}</p>
          </div>
          <small>${project.documentCount || 0} docs · ${project.riskCount || 0} risks · ${project.actionCount || 0} actions</small>
          <button class="text-button project-select" data-project-id="${project.profile.id}">Open project →</button>
        </article>
      `).join("")}</div>`
    : '<div class="empty-state project-empty">No project profiles found. Start the backend to load project intelligence.</div>';
  renderProjectDetail(currentProjectDetail);
}

function renderAll() {
  renderCommand();
  renderCompanies();
  renderProjectIntelligence();
  renderFinance();
  renderMemory();
  renderAgents();
  renderApprovals();
  renderIntegrations();
}

function navigate(view) {
  const titles = {
    command: "Executive Command",
    companies: "Companies",
    projects: "Project Intelligence",
    finance: "Finance",
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
  currentBrief = brief;
  $("#brief-feedback").classList.remove("submitted");
  $("#brief-feedback-note").value = "";
  $("#brief-content").innerHTML = `
    <div class="brief-opening">
      Good ${$("#day-period").textContent}, Patrick. I ranked ${brief.executivePriorities?.length || 0} executive priorities from
      ${brief.summary.totalOpen} open operating records, ${brief.emails?.length || 0} reviewed emails and
      ${brief.meetings.items?.length || 0} upcoming meetings.
      ${brief.projectIntelligence?.projectsNeedingAttention?.length ? `${brief.projectIntelligence.projectsNeedingAttention.length} project(s) need attention. ` : ""}
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
    ${section("8. PROJECT INTELLIGENCE", brief.projectIntelligence?.projectsNeedingAttention || [], "No projects currently require attention from project intelligence.")}
    ${section("9. AGENT STATUS", brief.agents.map((agent) => ({ title: `${agent.name} — ${agent.role}`, detail: agent.status })), "No agent definitions are currently recorded.")}
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
    projectIntelligence: { projectsNeedingAttention: [] },
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

function renderList(title, values, formatter = (item) => item) {
  return `
    <section class="ai-section">
      <h4>${title}</h4>
      ${
        values?.length
          ? `<ul>${values.map((item) => `<li>${formatter(item)}</li>`).join("")}</ul>`
          : '<p class="core-message">None supplied.</p>'
      }
    </section>
  `;
}

function sourceRefs(refs = []) {
  const values = Array.isArray(refs) ? refs : [refs].filter(Boolean);
  return values.length ? `<em>Sources: ${escapeHTML(values.join(", "))}</em>` : "";
}

function renderAiBriefing(analysis, relatedMemory = []) {
  return `
    <div class="ai-boundary">Claude analysed the supplied data only. No emails, files, calendar events, approvals, or records were changed.</div>
    <section class="ai-summary">
      <h3>Executive summary</h3>
      <p>${escapeHTML(analysis.executiveSummary)}</p>
      <small>Confidence: ${escapeHTML(analysis.confidenceLevel)}</small>
    </section>
    ${renderList("Top priorities", analysis.topPriorities, (item) => `
      <strong>${escapeHTML(item.title)}</strong>
      <span>${escapeHTML(item.rationale)}</span>
      <small>${escapeHTML(item.urgency)} ${sourceRefs(item.sourceReferences || item.sourceReference)}</small>
    `)}
    ${renderList("Risks", analysis.risks, (item) => `
      <strong>${escapeHTML(item.title)}</strong>
      <span>${escapeHTML(item.assessment)} Mitigation: ${escapeHTML(item.mitigation)}</span>
      <small>Confidence: ${escapeHTML(item.confidence)} ${sourceRefs(item.sourceReferences || item.sourceReference)}</small>
    `)}
    ${renderList("Decisions required", analysis.decisionsRequired, (item) => `
      <strong>${escapeHTML(item.title)}</strong>
      <span>${escapeHTML(item.whyNow)}</span>
      <small>${item.approvalRequired ? "Patrick approval required" : "No explicit approval flagged"} ${sourceRefs(item.sourceReferences || item.sourceReference)}</small>
    `)}
    ${renderList("Recommended next actions", analysis.recommendedNextActions, (item) => `
      <strong>${escapeHTML(item.action)}</strong>
      <span>${escapeHTML(item.owner)} · ${escapeHTML(item.timing)}</span>
      <small>${item.requiresApproval ? "Requires approval" : "Recommendation only"} ${sourceRefs(item.sourceReferences || item.sourceReference)}</small>
    `)}
    ${renderRelatedMemory(relatedMemory)}
    ${renderList("Assumptions", analysis.assumptions, escapeHTML)}
  `;
}

function renderAiDecision(analysis, relatedMemory = []) {
  return `
    <div class="ai-boundary">Claude provided recommendation only. No approval was granted and no action was executed.</div>
    <section class="ai-summary">
      <h3>Recommendation</h3>
      <p>${escapeHTML(analysis.recommendation)}</p>
      <small>Confidence: ${escapeHTML(analysis.confidenceLevel)} · ${analysis.patrickApprovalRequired ? "Patrick approval required" : "No approval requirement flagged"}</small>
    </section>
    ${renderList("Pros", analysis.pros, escapeHTML)}
    ${renderList("Cons", analysis.cons, escapeHTML)}
    ${renderList("Risks", analysis.risks, escapeHTML)}
    ${renderList("Next action", [analysis.nextAction], escapeHTML)}
    ${renderRelatedMemory(relatedMemory)}
    ${renderList("Assumptions", analysis.assumptions, escapeHTML)}
  `;
}

function showAiAnalysis({ title, meta, html }) {
  $("#ai-analysis-title").textContent = title;
  $("#ai-analysis-meta").textContent = meta;
  $("#ai-analysis-content").innerHTML = html;
  if (!$("#ai-dialog").open) $("#ai-dialog").showModal();
}

function showAiLoading(title) {
  showAiAnalysis({
    title,
    meta: "Claude reasoning is read-only. Alfred is not executing anything.",
    html: '<div class="ai-loading">Asking Alfred to analyse the supplied records…</div>',
  });
}

async function askAiBriefing() {
  if (!backendAvailable) {
    showToast("AI analysis requires the backend");
    return;
  }
  if (!currentBrief) {
    showToast("Generate a briefing first");
    return;
  }
  showAiLoading("Executive analysis");
  try {
    const result = await apiRequest("/api/ai/briefing", {
      method: "POST",
      body: JSON.stringify({ briefing: currentBrief, userAction: "ui:briefing:ask-alfred" }),
    });
    showAiAnalysis({
      title: "Executive analysis",
      meta: `${result.model} · audit #${result.auditId} · read-only`,
      html: renderAiBriefing(result.analysis, result.relatedMemory || []),
    });
    showToast("Claude analysis returned");
  } catch (error) {
    showAiAnalysis({
      title: "Executive analysis unavailable",
      meta: "No action was executed.",
      html: `<div class="empty-state">${escapeHTML(error.message)}</div>`,
    });
  }
}

async function askAiForOperatingItem(type, id) {
  if (!backendAvailable) {
    showToast("AI analysis requires the backend");
    return;
  }
  const item = state.operatingItems.find((record) => record.type === type && String(record.id) === String(id));
  if (!item) return;
  const companyItems = state.operatingItems.filter((record) => record.companyId === item.companyId && record.id !== item.id);
  showAiLoading(`${type === "risk" ? "Risk" : "Decision"} analysis`);
  try {
    const result = await apiRequest("/api/ai/decision-support", {
      method: "POST",
      body: JSON.stringify({
        decisionTitle: `${type}: ${item.title}`,
        context: item.detail,
        category: type,
        relatedItems: companyItems,
        risks: type === "risk" ? [item] : companyItems.filter((record) => record.type === "risk"),
        sourceRecordReferences: [{ reference: `${type}:${item.id}`, label: item.title, category: type }],
        userAction: `ui:${type}:ask-alfred`,
      }),
    });
    showAiAnalysis({
      title: `${type === "risk" ? "Risk" : "Decision"} analysis`,
      meta: `${result.model} · audit #${result.auditId} · read-only`,
      html: renderAiDecision(result.analysis, result.relatedMemory || []),
    });
  } catch (error) {
    showAiAnalysis({
      title: "Analysis unavailable",
      meta: "No action was executed.",
      html: `<div class="empty-state">${escapeHTML(error.message)}</div>`,
    });
  }
}

async function askAiForApproval(id) {
  if (!backendAvailable) {
    showToast("AI analysis requires the backend");
    return;
  }
  const approval = (state.approvals || []).find((record) => String(record.id) === String(id));
  if (!approval) return;
  showAiLoading("Approval analysis");
  try {
    const result = await apiRequest("/api/ai/decision-support", {
      method: "POST",
      body: JSON.stringify({
        decisionTitle: `Approval request: ${approval.title}`,
        context: approval.description,
        category: "approval",
        options: ["Approve", "Reject", "Request more information"],
        approvals: [approval],
        risks: state.operatingItems.filter((record) => record.type === "risk"),
        sourceRecordReferences: [{ reference: `approval:${approval.id}`, label: approval.title, category: "approval" }],
        userAction: "ui:approval:ask-alfred",
      }),
    });
    showAiAnalysis({
      title: "Approval analysis",
      meta: `${result.model} · audit #${result.auditId} · read-only`,
      html: renderAiDecision(result.analysis, result.relatedMemory || []),
    });
  } catch (error) {
    showAiAnalysis({
      title: "Analysis unavailable",
      meta: "No action was executed.",
      html: `<div class="empty-state">${escapeHTML(error.message)}</div>`,
    });
  }
}

async function searchSemanticMemory(event) {
  event.preventDefault();
  if (!backendAvailable) {
    showToast("Semantic memory search requires the backend");
    return;
  }
  const query = $("#semantic-memory-query").value.trim();
  if (!query) {
    showToast("Enter a memory search topic");
    return;
  }
  $("#semantic-memory-results").innerHTML = '<div class="ai-loading">Searching Alfred memory…</div>';
  try {
    const result = await apiRequest(`/api/memory/search?q=${encodeURIComponent(query)}&limit=8`);
    semanticMemoryStatus = await apiRequest("/api/memory/status").catch(() => semanticMemoryStatus);
    renderSemanticMemoryStatus();
    renderSemanticMemoryResults(result);
  } catch (error) {
    $("#semantic-memory-results").innerHTML = `<div class="empty-state">${escapeHTML(error.message)}</div>`;
  }
}

async function toggleSemanticIndexing(event) {
  if (!backendAvailable) {
    event.preventDefault();
    showToast("Semantic indexing settings require the backend");
    return;
  }
  try {
    semanticMemoryStatus = await apiRequest("/api/memory/settings", {
      method: "PATCH",
      body: JSON.stringify({ semanticIndexingEnabled: event.target.checked }),
    });
    renderSemanticMemoryStatus();
    showToast(event.target.checked ? "Semantic indexing enabled" : "Semantic indexing disabled");
  } catch (error) {
    event.target.checked = semanticMemoryStatus?.indexingEnabled !== false;
    showToast(error.message);
  }
}

async function refreshFinancialDashboard() {
  if (!backendAvailable) {
    showToast("Finance dashboard requires the backend");
    return;
  }
  state.financial = await apiRequest(`/api/financial/dashboard?${financeScopeQuery()}`);
  persist();
  renderFinance();
}

async function changeFinanceScope(event) {
  const [type, id] = String(event.target.value || "group:group").split(":");
  financeScope = { type: type || "group", id: id || "group" };
  await refreshFinancialDashboard();
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read order book file"));
    reader.onload = () => resolve(String(reader.result).split(",").pop());
    reader.readAsDataURL(file);
  });
}

async function importOrderBookFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (!backendAvailable) {
    showToast("Order book import requires the backend");
    return;
  }
  try {
    const dataBase64 = await readFileAsBase64(file);
    const result = await apiRequest("/api/financial/order-book/import", {
      method: "POST",
      body: JSON.stringify({ fileName: file.name, dataBase64, businessEntityId: selectedOperationalBusinessEntityId() }),
    });
    await refreshFinancialDashboard();
    showToast(`Imported ${result.rowsImported} order book row(s)`);
  } catch (error) {
    if (/status 409/.test(error.message) || /overwrite/i.test(error.message)) {
      showToast("Import requires overwrite approval. Re-import through API with overwriteApproved once reviewed.");
    } else {
      showToast(error.message);
    }
  }
}

async function refreshMondayFinance() {
  if (!backendAvailable) {
    showToast("Monday refresh requires the backend");
    return;
  }
  try {
    const result = await apiRequest("/api/financial/monday/refresh", {
      method: "POST",
      body: JSON.stringify({ businessEntityId: selectedOperationalBusinessEntityId() }),
    });
    await refreshFinancialDashboard();
    showToast(`Monday read-only refresh stored ${result.invoicesStored} invoice(s)`);
  } catch (error) {
    showToast(error.message);
  }
}

async function generateBoardReportView() {
  if (!backendAvailable) {
    showToast("Board reports require the backend");
    return;
  }
  try {
    const entity = selectedFinanceEntity();
    const report = await apiRequest("/api/financial/board-reports", {
      method: "POST",
      body: JSON.stringify({ scopeType: entity?.entityType || "group", scopeId: entity?.id || "group" }),
    });
    currentBoardReportMarkdown = report.markdown;
    $("#board-report-output").textContent = report.markdown;
    await refreshFinancialDashboard();
    showToast("Board report generated");
  } catch (error) {
    showToast(error.message);
  }
}

async function askOlivia() {
  if (!backendAvailable) {
    showToast("Olivia analysis requires the backend");
    return;
  }
  try {
    const entity = selectedFinanceEntity();
    const analysis = await apiRequest("/api/financial/olivia-analysis", {
      method: "POST",
      body: JSON.stringify({ scopeType: entity?.entityType || "group", scopeId: entity?.id || "group" }),
    });
    $("#finance-insights").innerHTML = `
      <div class="ai-boundary">Olivia analysed local financial records only. No invoices, payments, Monday boards, bank feeds or accounting records were modified.</div>
      <section class="ai-summary">
        <h3>Executive summary</h3>
        <p>${escapeHTML(analysis.executiveSummary)}</p>
      </section>
      ${renderList("CFO insights", analysis.insights, (item) => `
        <strong>${escapeHTML(item.title)}</strong>
        <span>${escapeHTML(item.detail)}</span>
        <small>${escapeHTML(item.severity)} · ${escapeHTML(item.sourceRef)}</small>
      `)}
      ${renderList("Recommendations", analysis.recommendedActions, (item) => `
        <strong>${escapeHTML(item.action)}</strong>
        <small>${item.requiresApproval ? "Future approval required before action" : "Recommendation only"} · no executor installed</small>
      `)}
    `;
    showToast("Olivia analysis generated");
  } catch (error) {
    showToast(error.message);
  }
}

async function refreshProjectIntelligence() {
  if (!backendAvailable) {
    showToast("Project intelligence requires the backend");
    return;
  }
  state.projectIntelligence = await apiRequest("/api/project-intelligence/dashboard");
  persist();
  renderProjectIntelligence();
}

async function openProjectDetail(projectId) {
  if (!backendAvailable) {
    showToast("Project detail requires the backend");
    return;
  }
  try {
    currentProjectDetail = await apiRequest(`/api/project-intelligence/projects/${projectId}`);
    renderProjectDetail(currentProjectDetail);
  } catch (error) {
    showToast(error.message);
  }
}

async function discoverProjectMetadata() {
  if (!backendAvailable) {
    showToast("Project discovery requires the backend");
    return;
  }
  try {
    showToast("Discovering Microsoft project metadata...");
    const result = await apiRequest("/api/project-intelligence/discover-microsoft", { method: "POST", body: "{}" });
    await refreshProjectIntelligence();
    if (currentProjectDetail) await openProjectDetail(currentProjectDetail.profile.id);
    showToast(`Checked ${result.projectsChecked} project(s) in read-only mode`);
  } catch (error) {
    showToast(error.message);
  }
}

async function searchProjects(event) {
  event.preventDefault();
  if (!backendAvailable) {
    showToast("Project search requires the backend");
    return;
  }
  const query = $("#project-search-query").value.trim();
  if (!query) {
    showToast("Enter a project search topic");
    return;
  }
  $("#project-search-results").innerHTML = '<div class="ai-loading">Searching project intelligence...</div>';
  try {
    const result = await apiRequest(`/api/projects/search?q=${encodeURIComponent(query)}`);
    $("#project-search-results").innerHTML = `
      ${renderList("Matching projects", result.matchingProjects, (project) => `
        <strong>${escapeHTML(project.projectName)}</strong>
        <span>${escapeHTML(project.clientName || "Internal / product")} · ${escapeHTML(project.currentPhase || "")}</span>
        <small>Relevance ${project.relevanceScore}</small>
      `)}
      ${renderList("Relevant documents", result.relevantDocuments, (document) => `
        <strong>${escapeHTML(document.name)}</strong>
        <span>${escapeHTML(document.classification || "Unknown")} · ${escapeHTML(document.projectName || "")}</span>
        <small>${escapeHTML(document.path || document.webUrl || "")}</small>
      `)}
      ${renderList("Memory references", result.semanticMemory || result.memoryReferences || [], (memory) => `
        <strong>${escapeHTML(memory.sourceReference || `${memory.sourceType}:${memory.sourceId}`)}</strong>
        <span>${escapeHTML(memory.shortSummary || memory.summary || "")}</span>
        <small>${escapeHTML(memory.sensitivityLabel || "local_sensitive_business_data")}</small>
      `)}
    `;
  } catch (error) {
    $("#project-search-results").innerHTML = `<div class="empty-state">${escapeHTML(error.message)}</div>`;
  }
}

async function askProjectAnalysis(projectId) {
  if (!backendAvailable) {
    showToast("Project analysis requires the backend");
    return;
  }
  try {
    $("#project-analysis-output").innerHTML = '<div class="ai-loading">Alfred is analysing the project...</div>';
    const result = await apiRequest("/api/ai/project-analysis", {
      method: "POST",
      body: JSON.stringify({ projectProfileId: Number(projectId), userAction: "ui:project:ask-alfred" }),
    });
    const analysis = result.analysis || {};
    $("#project-analysis-output").innerHTML = `
      <div class="ai-boundary">Claude analysed project records, metadata, memory and Olivia context only. No files, emails, calendar events, SharePoint records, Monday boards or financial systems were modified.</div>
      <section class="ai-summary">
        <h3>Project summary</h3>
        <p>${escapeHTML(analysis.executiveProjectSummary || analysis.currentStatus || "No analysis returned.")}</p>
      </section>
      ${renderList("Key risks", analysis.keyRisks || [], (risk) => `
        <strong>${escapeHTML(risk.title)}</strong>
        <span>${escapeHTML(risk.assessment)}</span>
        <small>${escapeHTML(risk.severity)} · ${escapeHTML(risk.sourceReference)}</small>
      `)}
      ${renderList("Missing information", analysis.missingInformation || [], (item) => `
        <strong>${escapeHTML(item.item)}</strong>
        <span>${escapeHTML(item.whyItMatters)}</span>
        <small>${escapeHTML(item.sourceReference)}</small>
      `)}
      ${renderList("Recommended next actions", analysis.recommendedNextActions || [], (item) => `
        <strong>${escapeHTML(item.action)}</strong>
        <span>${escapeHTML(item.owner)} · ${escapeHTML(item.timing)}</span>
        <small>${item.requiresApproval ? "Approval required before external action" : "Recommendation only"} · ${escapeHTML(item.sourceReference)}</small>
      `)}
    `;
    showToast("Project analysis generated");
  } catch (error) {
    $("#project-analysis-output").innerHTML = `<div class="empty-state">${escapeHTML(error.message)}</div>`;
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
  } else if (normalized.includes("project") || normalized.includes("westminster") || normalized.includes("rbkc") || normalized.includes("islington") || normalized.includes("kspf")) {
    navigate("projects");
    if (backendAvailable && (normalized.includes("westminster") || normalized.includes("rbkc") || normalized.includes("islington") || normalized.includes("kspf"))) {
      $("#project-search-query").value = normalized.includes("westminster")
        ? "Westminster"
        : normalized.includes("rbkc")
          ? "RBKC"
          : normalized.includes("islington")
            ? "Islington"
            : "KSPF";
      $("#project-search-form").requestSubmit();
    }
  } else if (normalized.includes("finance") || normalized.includes("olivia") || normalized.includes("revenue") || normalized.includes("forecast")) {
    navigate("finance");
  } else if (normalized.includes("memory") || normalized.includes("remember")) {
    navigate("memory");
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
$("#discover-projects").addEventListener("click", discoverProjectMetadata);
$("#project-search-form").addEventListener("submit", searchProjects);
$("#import-order-book").addEventListener("click", () => $("#order-book-file").click());
$("#order-book-file").addEventListener("change", importOrderBookFile);
$("#finance-scope").addEventListener("change", changeFinanceScope);
$("#refresh-monday-finance").addEventListener("click", refreshMondayFinance);
$("#generate-board-report").addEventListener("click", generateBoardReportView);
$("#ask-olivia").addEventListener("click", askOlivia);
$("#copy-board-report").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentBoardReportMarkdown || $("#board-report-output").textContent);
    showToast("Board report copied");
  } catch {
    showToast("Clipboard access is unavailable");
  }
});
$("#record-form").addEventListener("submit", submitRecord);
$("#memory-search").addEventListener("input", renderMemory);
$("#memory-filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-memory-filter]");
  if (!button) return;
  memoryFilter = button.dataset.memoryFilter;
  renderMemory();
});
$("#semantic-memory-form").addEventListener("submit", searchSemanticMemory);
$("#semantic-indexing-toggle").addEventListener("change", toggleSemanticIndexing);
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
$("#ai-brief-analysis").addEventListener("click", askAiBriefing);
$("#brief-history-button").addEventListener("click", showBriefHistory);
$$(".feedback-button").forEach((button) => button.addEventListener("click", () => submitBriefFeedback(button.dataset.rating)));
$$(".close-dialog").forEach((button) => button.addEventListener("click", () => $("#brief-dialog").close()));
$$(".close-ai").forEach((button) => button.addEventListener("click", () => $("#ai-dialog").close()));
$$(".close-history").forEach((button) => button.addEventListener("click", () => $("#history-dialog").close()));
document.addEventListener("click", (event) => {
  if (event.target.closest(".close-form")) $("#form-dialog").close();
  if (event.target.closest(".connect-microsoft")) connectMicrosoft();
  const projectButton = event.target.closest(".project-select");
  if (projectButton) openProjectDetail(projectButton.dataset.projectId);
  const projectAnalysisButton = event.target.closest(".ask-project-analysis");
  if (projectAnalysisButton) askProjectAnalysis(projectAnalysisButton.dataset.projectId);
  const approvalButton = event.target.closest(".approval-decision");
  if (approvalButton) reviewApproval(approvalButton.dataset.approvalId, approvalButton.dataset.decision);
  const preflightButton = event.target.closest(".approval-preflight");
  if (preflightButton) runApprovalPreflight(preflightButton.dataset.approvalId);
  const operatingAiButton = event.target.closest(".ai-operating-analysis");
  if (operatingAiButton) askAiForOperatingItem(operatingAiButton.dataset.aiItemType, operatingAiButton.dataset.aiItemId);
  const approvalAiButton = event.target.closest(".ai-approval-analysis");
  if (approvalAiButton) askAiForApproval(approvalAiButton.dataset.approvalId);
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
    if ($("#ai-dialog").open) $("#ai-dialog").close();
  }
});

updateClock();
setInterval(updateClock, 30_000);
loadDashboard();

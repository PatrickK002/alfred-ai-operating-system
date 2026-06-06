import {
  AGENT_AVATAR_PROFILES,
  AVATAR_VISUAL_STANDARD,
  buildAgentAvatarRenderModel,
  buildAvatarProviderState,
  buildExecutiveTeamRoster,
  getAgentAvatarProfile,
  isLocalAvatarPath,
} from "./agent-avatars.js";

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
      id: "westbridge",
      name: "Westbridge Property Group",
      shortName: "Westbridge",
      symbol: "WP",
      color: "#d7b56d",
      purpose: "Acquire and manage cashflow-producing property assets",
      status: "Building",
      services: ["Property Investment", "Portfolio Management", "Acquisition Analysis", "Due Diligence"],
      clients: [],
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
  agents: AGENT_AVATAR_PROFILES.map((profile) => ({
    id: profile.id,
    name: profile.name,
    role: profile.title,
    companyId: profile.companyId,
    department: profile.department,
    mission: profile.mission,
    tools: [],
    status: profile.status,
  })),
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
      { id: "westbridge-property-group", name: "Westbridge Property Group", entityType: "business", parentEntityId: "group", companyId: "westbridge", status: "active" },
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
      financialRiskIndicators: 0,
      informationQualityIndicators: 0,
    },
    projects: [],
    highRiskProjects: [],
    overdueActions: [],
    recentlyUpdatedProjects: [],
    missingInformation: [],
    boundary: { readOnly: true },
  },
  meetingIntelligence: {
    metrics: {
      totalMeetings: 0,
      recentMeetings: 0,
      meetingsNeedingFollowUp: 0,
      openActions: 0,
      decisions: 0,
      risks: 0,
      feedbackSignals: 0,
      transcriptUnavailable: 0,
      sentinelConcerns: 0,
    },
    recentMeetings: [],
    meetingsNeedingFollowUp: [],
    followUpQueue: [],
    decisions: [],
    risks: [],
    feedback: [],
    agentReviews: [],
    transcriptUnavailable: [],
    boundary: { readOnly: true, advisoryOnly: true },
  },
  mondayOperating: {
    title: "Monday Operating System",
    summary: "Internal Alfred work management foundation for future Monday.com boards.",
    metrics: {
      agents: 11,
      plannedBoards: 0,
      activeWorkItems: 0,
      blockedItems: 0,
      overdueItems: 0,
      priorityItems: 0,
      deliverablesDue: 0,
      highPriorityRisks: 0,
      decisionsAwaitingApproval: 0,
      meetingFollowups: 0,
      feedbackForReview: 0,
      workloadHealth: { green: 0, amber: 0, red: 0 },
      mondayWritesEnabled: false,
    },
    agentBoards: [],
    agentWorkloads: [],
    workloadMetrics: [],
    workItems: [],
    deliverables: [],
    operationalRisks: [],
    operationalOpportunities: [],
    operationalDecisions: [],
    meetingFollowups: [],
    outputFeedback: [],
    boardMappings: [],
    syncStatus: [],
    boundary: {
      internalOnly: true,
      advisoryOnly: true,
      mondayWriteEnabled: false,
      externalWritesEnabled: false,
      autonomousExecutionEnabled: false,
    },
  },
  sarah: {
    profile: {
      name: "Sarah",
      role: "Digital Construction Director",
      reportsTo: "Alfred",
      status: "Advisory only",
    },
    metrics: {
      projectsRequiringAttention: 0,
      informationRisks: 0,
      highRiskProjects: 0,
      missingInformation: 0,
      opportunities: 0,
    },
    projectsRequiringAttention: [],
    informationRisks: [],
    opportunities: [],
    recentDecisions: [],
    recentMeetings: [],
    recentRisks: [],
    futureTeamPlaceholders: [],
    boundary: { advisoryOnly: true, readOnly: true },
  },
  property: {
    business: {
      id: "westbridge",
      businessEntityId: "westbridge-property-group",
      name: "Westbridge Property Group",
      businessType: "Property Investment",
      owner: "Patrick King",
      mission: "Acquire and manage cashflow-producing property assets.",
      targetMonthlyCashflow: 10000,
      stretchMonthlyCashflow: 15000,
    },
    director: {
      name: "Westbridge Property Director",
      role: "AI Investment Director",
      reportsTo: "Patrick King",
      status: "Advisory only",
    },
    metrics: {
      totalProperties: 0,
      portfolioValue: 0,
      netEquity: 0,
      outstandingDebt: 0,
      monthlyCashflow: 0,
      annualCashflow: 0,
      targetMonthlyCashflow: 10000,
      stretchMonthlyCashflow: 15000,
      cashflowTargetProgress: 0,
      activeOpportunities: 0,
      capitalCommitted: 0,
      monthlyCashflowForecast: 0,
      portfolioGrowth: 0,
      dueDiligenceRed: 0,
      dueDiligenceAmber: 0,
    },
    opportunities: [],
    activeOpportunities: [],
    dueDiligence: [],
    analyses: [],
    propertyMemory: [],
    risks: [],
    decisions: [],
    rules: [],
    pipelineStages: ["Lead", "Reviewing", "Due Diligence", "Offer Made", "Negotiating", "Exchanged", "Completed", "Rejected"],
    boundary: { advisoryOnly: true, readOnly: true },
  },
  voice: {
    status: {
      settings: {
        enabled: true,
        transcriptLoggingEnabled: true,
        voiceSelection: "alfred",
        speechSpeed: 1,
        transcriptRetentionDays: 30,
      },
      personas: [],
      supportedCommands: [
        "Alfred, brief me",
        "Ask Sarah to review Westminster",
        "Ask Olivia for revenue forecast",
        "Ask Westbridge for property pipeline",
      ],
      providers: {
        deepgram: { state: "Not connected", configured: false },
        elevenlabs: { state: "Not connected", configured: false },
        avatarProvider: buildAvatarProviderState(),
      },
      avatarProvider: buildAvatarProviderState(),
      setup: {
        readyForTypedCommands: true,
        readyForMicrophone: false,
        readyForSpokenOutput: false,
        readyForTalkingAvatar: false,
        rawAudioStored: false,
        rawVideoStored: false,
        secretsExposed: false,
        checklist: [],
        summary: "Voice works with typed transcript fallback.",
      },
      retention: {
        transcriptLoggingEnabled: true,
        transcriptRetentionDays: 30,
        rawAudioStored: false,
        localSensitiveBusinessData: true,
      },
      microphone: { rawAudioStored: false },
      boundary: { readOnly: true, voiceExecutionEnabled: false },
    },
    conversations: [],
    lastResult: null,
  },
  deployment: {
    status: "degraded",
    app: {
      name: "Alfred AI Operating System",
      packageVersion: "0.9.0",
      release: { version: "v0.4", title: "Cloud/PWA Preparation" },
    },
    environment: "development",
    environmentProfile: {
      label: "Development",
      description: "Local use on Patrick's machine.",
      branch: "feature/* or local",
      deployment: "Local Node server",
    },
    database: { status: "unknown" },
    integrations: {},
    pwa: {
      manifest: "/manifest.json",
      serviceWorker: "/service-worker.js",
      offlineFallback: "/offline.html",
      favicon: "/icons/alfred-icon.svg",
      appleTouchIcon: "/icons/alfred-icon.svg",
      splashScreen: "/icons/alfred-splash.svg",
      displayMode: "standalone",
      installTargets: ["MacBook Dock", "iPhone Home Screen", "iPad Pro Home Screen"],
      iconStrategy: "Premium Alfred command-centre SVG placeholders",
      installReady: true,
    },
    warnings: [],
    security: {
      httpsRequired: false,
      secretsInFrontend: false,
      apiKeysInLocalStorage: false,
      externalWritesEnabled: false,
      approvalSafeguardsRequired: true,
      authenticationProvider: "Microsoft Entra ID planned",
      authenticationEnabled: false,
    },
    uptimeSeconds: 0,
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
let currentMeetingDetail = null;
let sarahCurrentProjectId = null;
let currentPropertyOpportunityId = null;
let voiceMediaRecorder = null;
let voiceAudioChunks = [];
let voiceCurrentStream = null;
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
    state.property = await apiRequest("/api/property/dashboard").catch(() => seedData.property);
    state.projectIntelligence = await apiRequest("/api/project-intelligence/dashboard").catch(() => seedData.projectIntelligence);
    state.meetingIntelligence = await apiRequest("/api/meeting-intelligence/dashboard").catch(() => seedData.meetingIntelligence);
    state.mondayOperating = await apiRequest("/api/monday-os/dashboard").catch(() => seedData.mondayOperating);
    state.sarah = await apiRequest("/api/sarah/dashboard").catch(() => seedData.sarah);
    state.voice = {
      ...seedData.voice,
      status: await apiRequest("/api/voice/status").catch(() => seedData.voice.status),
      conversations: await apiRequest("/api/voice/conversations?limit=8").catch(() => []),
      lastResult: state.voice?.lastResult || null,
    };
    state.deployment = await apiRequest("/api/health").catch(() => seedData.deployment);
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

function executiveTeamRoster(records = state.agents || []) {
  return buildExecutiveTeamRoster(records);
}

function agentIdentity(agentOrId) {
  if (typeof agentOrId === "string") {
    const profile = getAgentAvatarProfile(agentOrId);
    return buildAgentAvatarRenderModel(profile || { id: agentOrId, name: agentOrId });
  }
  return buildAgentAvatarRenderModel(agentOrId || {});
}

function expertiseChips(tags = [], limit = 4) {
  return tags
    .slice(0, limit)
    .map((tag) => `<span class="chip agent-chip">${escapeHTML(tag)}</span>`)
    .join("");
}

function renderAgentAvatar(identity, className = "") {
  const model = buildAgentAvatarRenderModel(identity);
  const image = model.avatarPath && isLocalAvatarPath(model.avatarPath)
    ? `<img class="agent-avatar-image" src="${escapeHTML(model.avatarPath)}" alt="${escapeHTML(`${model.name} avatar`)}" loading="lazy" />`
    : "";
  return `
    <span
      class="agent-avatar-frame ${className}"
      style="--agent-accent:${escapeHTML(model.accentColor)}"
      data-agent-avatar="${escapeHTML(model.id)}"
      data-fallback-initials="${escapeHTML(model.fallbackInitials)}"
      aria-hidden="true"
    >
      ${image}
      <span class="agent-avatar-initials">${escapeHTML(model.fallbackInitials)}</span>
    </span>
  `;
}

function renderSidebarExecutiveTeam() {
  const roster = executiveTeamRoster();
  const active = roster.filter((agent) => agent.statusCategory === "active");
  $("#sidebar-executive-team").innerHTML = `
    <small>EXECUTIVE TEAM</small>
    <div>
      ${active.map((agent) => `
        <span
          class="sidebar-agent-presence status-${escapeHTML(agent.statusCategory)}"
          style="--agent-accent:${escapeHTML(agent.accentColor)}"
          title="${escapeHTML(`${agent.name} - ${agent.status}`)}"
        >
          ${renderAgentAvatar(agent, "small")}
        </span>
      `).join("")}
    </div>
  `;
}

function renderAgentIdentitySummary(agentOrId, options = {}) {
  const identity = agentIdentity(agentOrId);
  const compact = options.compact ? " compact" : "";
  return `
    <article class="specialist-identity${compact}" style="--agent-accent:${escapeHTML(identity.accentColor)}">
      ${renderAgentAvatar(identity, "large")}
      <div>
        <span class="agent-status status-${escapeHTML(identity.statusCategory)}">${escapeHTML(identity.status)}</span>
        <h3>${escapeHTML(identity.name)}</h3>
        <p>${escapeHTML(identity.title)}</p>
        <small>${escapeHTML(identity.businessArea)} · reports to ${escapeHTML(identity.reportingLine)}</small>
        <div class="agent-chip-row">${expertiseChips(identity.expertiseTags, options.tagLimit || 4)}</div>
      </div>
    </article>
  `;
}

function enhanceAvatarFallbacks(root = document) {
  root.querySelectorAll(".agent-avatar-image").forEach((image) => {
    if (image.dataset.fallbackBound) return;
    image.dataset.fallbackBound = "true";
    image.addEventListener("error", () => {
      image.closest(".agent-avatar-frame")?.classList.add("missing-image");
      image.remove();
    }, { once: true });
  });
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

function topicLabel(item = {}) {
  const company = companyFor(item.companyId);
  return [
    company?.shortName || item.companyId || "Group",
    item.type || "signal",
    item.priority ? `${item.priority} priority` : "",
  ].filter(Boolean).join(" · ");
}

function suggestedActionFor(item = {}) {
  if (item.type === "risk") return "Review risk, confirm owner and decide whether Patrick input is required.";
  if (item.type === "decision") return "Prepare options, assumptions and the approval question before deciding.";
  if (item.type === "opportunity") return "Clarify next evidence needed before committing time or capital.";
  if (item.type === "action") return "Confirm next step, due date and whether the item is blocked.";
  return "Review source context and keep action advisory until approved.";
}

function renderCommandOperatingDeck(priorityItems = []) {
  const topics = priorityItems.length ? priorityItems : openItems().slice(0, 4);
  $("#current-topics-panel").innerHTML = topics.length
    ? topics.map((item) => `
        <article style="--company-color:${escapeHTML(companyFor(item.companyId)?.color || "var(--accent)")}">
          <span class="priority-marker ${escapeHTML(item.priority || "medium")}"></span>
          <div>
            <strong>${escapeHTML(item.title)}</strong>
            <small>${escapeHTML(topicLabel(item))}</small>
          </div>
        </article>
      `).join("")
    : '<div class="empty-state">No current topics are above the line.</div>';

  $("#suggested-actions-panel").innerHTML = topics.length
    ? topics.slice(0, 3).map((item) => `
        <article>
          <strong>${escapeHTML(item.title)}</strong>
          <span>${escapeHTML(suggestedActionFor(item))}</span>
          <small>No external action will be taken without approval.</small>
        </article>
      `).join("")
    : '<div class="empty-state">Generate a briefing or add operating records to populate suggested actions.</div>';

  $("#command-agent-presence").innerHTML = executiveTeamRoster()
    .filter((agent) => agent.statusCategory === "active")
    .map((agent) => `
      <article style="--agent-accent:${escapeHTML(agent.accentColor)}">
        ${renderAgentAvatar(agent, "small")}
        <div>
          <strong>${escapeHTML(agent.name)}</strong>
          <span>${escapeHTML(agent.title)}</span>
          <small>${escapeHTML(agent.status)} · ${escapeHTML(agent.avatarProvider)}</small>
        </div>
      </article>
    `).join("");
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

  renderCommandOperatingDeck(priorityItems);

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
  renderIpadExecutiveMode(items);
}

function renderVoiceCommandCentre() {
  const voice = state.voice || seedData.voice;
  const status = voice.status || seedData.voice.status;
  const settings = status.settings || seedData.voice.status.settings;
  const alfred = agentIdentity("alfred");
  const deepgram = status.providers?.deepgram || {};
  const elevenlabs = status.providers?.elevenlabs || {};
  const avatarProvider = status.avatarProvider || status.providers?.avatarProvider || buildAvatarProviderState();
  const setup = status.setup || seedData.voice.status.setup;
  const conversations = voice.conversations || [];
  const last = voice.lastResult;
  const voiceEnabled = Boolean(settings.enabled);

  $("#voice-command-centre").dataset.voiceState = $("#voice-command-centre").dataset.voiceState || "ready";
  $("#voice-agent-identity").innerHTML = renderAgentIdentitySummary(alfred, { compact: true, tagLimit: 3 });
  $("#voice-button").style.setProperty("--agent-accent", alfred.accentColor);
  $("#voice-status-pill").textContent = voiceEnabled ? "Voice ready" : "Voice disabled";
  $("#voice-status-pill").classList.toggle("disabled", !voiceEnabled);
  $("#deepgram-status").textContent = deepgram.state || (deepgram.configured ? "Planned" : "Not connected");
  $("#elevenlabs-status").textContent = elevenlabs.state || (elevenlabs.configured ? "Planned" : "Not connected");
  $("#avatar-provider-status").textContent = avatarProvider.state || avatarProvider.status || "Planned";
  $("#microphone-status").textContent = navigator.mediaDevices ? "Available on request" : "Unavailable";
  $("#voice-avatar-presence").innerHTML = `
    <article><small>Portrait</small><strong>Static</strong></article>
    <article><small>Talking avatar</small><strong>${escapeHTML(avatarProvider.state || avatarProvider.status || "Planned")}</strong></article>
    <article><small>Provider calls</small><strong>${avatarProvider.liveProviderCallsEnabled ? "Enabled" : "Disabled"}</strong></article>
  `;
  $("#voice-button").disabled = !backendAvailable || !voiceEnabled;
  $("#voice-enabled-toggle").checked = voiceEnabled;
  $("#voice-transcript-logging-toggle").checked = Boolean(settings.transcriptLoggingEnabled);
  $("#voice-selection").value = settings.voiceSelection || "alfred";
  $("#voice-speech-speed").value = settings.speechSpeed || 1;
  $("#voice-speed-label").textContent = `${Number(settings.speechSpeed || 1).toFixed(2)}x`;
  $("#voice-retention-days").value = settings.transcriptRetentionDays || status.retention?.transcriptRetentionDays || 30;
  $("#voice-setup-summary").textContent = setup.summary || "Provider setup status unavailable.";
  $("#voice-setup-checklist").innerHTML = (setup.checklist || []).length
    ? setup.checklist.map((item) => `
        <article class="voice-setup-item ${item.connected ? "connected" : item.configured ? "planned" : "missing"}">
          <span></span>
          <div>
            <strong>${escapeHTML(item.label)}</strong>
            <small>${escapeHTML(item.state)} · ${escapeHTML(item.nextStep || "")}</small>
            ${(item.missingEnv || []).length ? `<em>Missing: ${item.missingEnv.map((env) => escapeHTML(env)).join(", ")}</em>` : ""}
          </div>
        </article>
      `).join("")
    : '<div class="empty-state">Run setup check to review provider readiness.</div>';
  $("#voice-command-examples").innerHTML = (status.supportedCommands || seedData.voice.status.supportedCommands)
    .slice(0, 6)
    .map((command) => `<button type="button" class="voice-example" data-voice-command="${escapeHTML(command)}">${escapeHTML(command)}</button>`)
    .join("");

  if (last) {
    $("#voice-response").innerHTML = `
      <div class="voice-answer">
        <div class="voice-answer-agent">
          ${renderAgentAvatar(alfred, "small")}
          <strong>Alfred</strong>
        </div>
        <p>${escapeHTML(last.response || last.message || "")}</p>
        <small>
          Intent: ${escapeHTML(last.detectedIntent?.intent || last.detectedIntent || "unknown")}
          · Audio: ${escapeHTML(last.audio?.status || "text_only")}
          · No external action executed
        </small>
      </div>
      ${(last.specialistContributions || []).length ? `
        <div class="voice-specialists">
          ${(last.specialistContributions || []).map((item) => {
            const specialist = agentIdentity(item.agent);
            return `
            <article style="--agent-accent:${escapeHTML(specialist.accentColor)}">
              <div class="voice-answer-agent">
                ${renderAgentAvatar(specialist, "small")}
                <strong>${escapeHTML(item.agent)}</strong>
              </div>
              <span>${escapeHTML(item.assessment)}</span>
              <small>${escapeHTML(item.sourceReference || "")}</small>
            </article>
          `;
          }).join("")}
        </div>
      ` : ""}
    `;
  }

  $("#voice-history").innerHTML = conversations.length
    ? conversations.map((turn) => `
        <article class="voice-history-item">
          <strong>${turn.transcriptLogged ? escapeHTML(turn.transcript || "Voice transcript") : "Transcript logging disabled"}</strong>
          <span>${escapeHTML(turn.response || "")}</span>
          <small>${escapeHTML(turn.detectedIntent || "unknown")} · ${escapeHTML(turn.linkedAgent || "alfred")} · ${new Date(turn.createdAt).toLocaleString("en-GB")}</small>
        </article>
      `).join("")
    : '<div class="empty-state">No voice conversations yet.</div>';
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
  const roster = executiveTeamRoster();
  renderSidebarExecutiveTeam();
  $("#executive-team-identity").innerHTML = roster
    .map((identity) => `
      <article class="executive-identity-card status-${escapeHTML(identity.statusCategory)}" style="--agent-accent:${escapeHTML(identity.accentColor)}">
        ${renderAgentAvatar(identity, "large")}
        <div>
          <span>${escapeHTML(identity.status)}</span>
          <h3>${escapeHTML(identity.name)}</h3>
          <p>${escapeHTML(identity.title)}</p>
          <small>${escapeHTML(identity.businessArea)}</small>
        </div>
      </article>
    `)
    .join("");

  $("#agent-grid").innerHTML = roster
    .map((agent) => {
      const company = companyFor(agent.companyId);
      return `
        <article class="agent-card status-${escapeHTML(agent.statusCategory)}" style="--agent-accent:${escapeHTML(agent.accentColor)}">
          <header>
            <div class="agent-identity">
              ${renderAgentAvatar(agent)}
              <div>
                <h3>${escapeHTML(agent.name)}</h3>
                <p>${escapeHTML(agent.title)}</p>
              </div>
            </div>
            <span class="agent-status">${escapeHTML(agent.status)}</span>
          </header>
          <p class="agent-mission">${escapeHTML(agent.mission)}</p>
          <div class="agent-capability-summary">
            <div><small>Current capability</small><span>${escapeHTML(agent.currentCapabilitySummary)}</span></div>
            <div><small>Planned capability</small><span>${escapeHTML(agent.plannedCapabilitySummary)}</span></div>
          </div>
          <div class="agent-chip-row">${expertiseChips(agent.expertiseTags, 5)}</div>
          <div class="agent-meta">
            <div><small>Business area</small><strong>${escapeHTML(agent.businessArea || company?.shortName || "Group")}</strong></div>
            <div><small>Department</small><strong>${escapeHTML(agent.department)}</strong></div>
            <div><small>Reports to</small><strong>${escapeHTML(agent.reportingLine)}</strong></div>
            <div><small>Voice persona</small><strong>${escapeHTML(agent.voicePersonaPlaceholder)}</strong></div>
            <div><small>Avatar provider</small><strong>${escapeHTML(agent.avatarProvider)}</strong></div>
            <div><small>Talking avatar</small><strong>${escapeHTML(agent.talkingAvatarPlaceholder)}</strong></div>
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

function renderIpadExecutiveMode(items = openItems()) {
  const risks = items.filter((item) => item.type === "risk");
  const actions = items.filter((item) => item.type === "action");
  const meetings = currentBrief?.meetings || {};
  const voiceStatus = state.voice?.status || seedData.voice.status;
  $("#ipad-briefing-status").textContent = currentBrief
    ? `${currentBrief.summary?.totalOpen || items.length} signal(s)`
    : "Ready";
  $("#ipad-briefing-detail").textContent = currentBrief
    ? `Latest briefing source: ${currentBrief.source || "backend"}.`
    : "Generate a briefing to populate the live summary.";
  $("#ipad-calendar-status").textContent = meetings.available ? `${meetings.items?.length || 0} meeting(s)` : "Read-only";
  $("#ipad-calendar-detail").textContent = meetings.available
    ? "Calendar signals are available from Microsoft read-only data."
    : "Microsoft Calendar appears here when connected.";
  $("#ipad-risk-status").textContent = `${risks.length} active`;
  $("#ipad-risk-detail").textContent = risks[0]?.title || "High-priority operating and project risks.";
  $("#ipad-action-status").textContent = `${actions.length} open`;
  $("#ipad-action-detail").textContent = actions[0]?.title || "Current actions requiring attention.";
  $("#ipad-voice-status").textContent = voiceStatus.settings?.enabled ? "Advisory ready" : "Disabled";
  $("#ipad-voice-detail").textContent = voiceStatus.boundary?.voiceExecutionEnabled
    ? "Unexpected execution flag detected."
    : "Voice button remains accessible below. No execution.";
}

function deploymentStatusLabel(value) {
  if (value === true || value === "connected" || value === "Connected" || value === "ok") return "Connected";
  if (value === false || value === "Not connected" || value === "error") return "Not connected";
  return value || "Planned";
}

function factRows(rows) {
  return rows.map(([label, value]) => `
    <div>
      <small>${escapeHTML(label)}</small>
      <strong>${escapeHTML(value)}</strong>
    </div>
  `).join("");
}

function renderSettings() {
  const deployment = state.deployment || seedData.deployment;
  const app = deployment.app || seedData.deployment.app;
  const environmentProfile = deployment.environmentProfile || seedData.deployment.environmentProfile;
  const pwa = deployment.pwa || seedData.deployment.pwa;
  const integrations = deployment.integrations || {};
  const warnings = deployment.warnings || [];
  const security = deployment.security || seedData.deployment.security;
  const property = state.property || seedData.property;
  const financial = state.financial || seedData.financial;
  const roster = executiveTeamRoster();

  $("#deployment-warning").innerHTML = warnings.length
    ? warnings.map((warning) => `
        <article>
          <strong>${escapeHTML(warning.code || "CONFIGURATION_WARNING")}</strong>
          <span>${escapeHTML(warning.message || warning)}</span>
        </article>
      `).join("")
    : `<article class="ok"><strong>Deployment checks clear for ${escapeHTML(deployment.environment || "development")}</strong><span>Production authentication is still a documented future requirement before public exposure.</span></article>`;

  $("#app-version-facts").innerHTML = factRows([
    ["App", app.name || "Alfred AI Operating System"],
    ["Package version", app.packageVersion || deployment.version || "unknown"],
    ["Release", `${app.release?.version || deployment.release || "v0.4"} ${app.release?.title || "Cloud/PWA Preparation"}`],
    ["Uptime", `${deployment.uptimeSeconds || 0}s`],
  ]);

  $("#environment-facts").innerHTML = factRows([
    ["Environment", environmentProfile.label || deployment.environment || "Development"],
    ["Branch", environmentProfile.branch || "feature/* or local"],
    ["Deployment", environmentProfile.deployment || "Local Node server"],
    ["Database", deployment.database?.status || "unknown"],
  ]);

  $("#backend-readiness-grid").innerHTML = [
    ["Backend", backendAvailable ? "Connected" : "Fallback"],
    ["Memory", deploymentStatusLabel(integrations.voyage?.status || integrations.voyage?.configured)],
    ["Voice", integrations.voice?.enabled ? "Enabled" : "Disabled"],
    ["Microsoft", integrations.microsoft?.connected ? "Connected" : integrations.microsoft?.configured ? "Configured" : "Not connected"],
    ["Property", property.boundary?.readOnly ? "Read-only" : "Review"],
    ["Finance", financial.boundary?.readOnly ? "Read-only" : "Review"],
  ].map(([label, value]) => `
    <article>
      <small>${escapeHTML(label)}</small>
      <strong>${escapeHTML(value)}</strong>
    </article>
  `).join("");

  $("#pwa-readiness-facts").innerHTML = factRows([
    ["Manifest", pwa.manifest || "/manifest.json"],
    ["Service worker", pwa.serviceWorker || "/service-worker.js"],
    ["Offline fallback", pwa.offlineFallback || "/offline.html"],
    ["Favicon", pwa.favicon || "/icons/alfred-icon.svg"],
    ["Apple icon", pwa.appleTouchIcon || "/icons/alfred-icon.svg"],
    ["Splash screen", pwa.splashScreen || "/icons/alfred-splash.svg"],
    ["Install targets", (pwa.installTargets || []).join(", ")],
    ["Standalone mode", pwa.displayMode || "standalone"],
    ["Icon strategy", pwa.iconStrategy || "Brand-ready local SVG placeholders"],
  ]);

  $("#security-boundary-list").innerHTML = [
    ["HTTPS required in production", security.httpsRequired],
    ["Secure cookies required", security.secureCookiesRequired],
    ["Cookies used", security.cookiesUsed],
    ["Secrets exposed to frontend", security.secretsInFrontend],
    ["API keys in localStorage", security.apiKeysInLocalStorage],
    ["External writes enabled", security.externalWritesEnabled],
    ["Approval safeguards required", security.approvalSafeguardsRequired],
    ["Authentication", security.authenticationEnabled ? "Enabled" : security.authenticationProvider || "Microsoft Entra ID planned"],
  ].map(([label, value]) => `
    <article class="${value === false || value === "Disabled" ? "blocked" : "ok"}">
      <strong>${escapeHTML(label)}</strong>
      <span>${escapeHTML(typeof value === "boolean" ? (value ? "Yes" : "No") : value)}</span>
    </article>
  `).join("");

  $("#settings-avatar-summary").innerHTML = `
    <div class="settings-avatar-strip">
      ${roster.map((agent) => renderAgentAvatar(agent, "small")).join("")}
    </div>
    <div class="settings-facts compact">
      ${factRows([
        ["Visual standard", AVATAR_VISUAL_STANDARD.experience],
        ["Avatar assets", "/assets/avatars/"],
        ["Provider abstraction", "avatarProvider"],
        ["Avatar provider state", buildAvatarProviderState().status],
        ["Current identities", roster.filter((agent) => agent.statusCategory === "active").length],
        ["Planned identities", roster.filter((agent) => agent.statusCategory === "planned").length],
        ["Security identity", roster.some((agent) => agent.id === "sentinel") ? "Sentinel planned" : "Not defined"],
        ["Fallback", "Styled initials badge"],
        ["External images", "Blocked by policy"],
        ["External provider calls", "Disabled"],
        ["Multi-voice", "Metadata placeholders only"],
        ["Consent rules", "No likeness without consent"],
      ])}
    </div>
  `;
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
  $("#finance-agent-identity").innerHTML = renderAgentIdentitySummary("olivia");
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

function propertyOpportunityLabel(opportunity) {
  const address = opportunity.address || opportunity.title || "Property opportunity";
  return `${address}${opportunity.assetType ? ` · ${opportunity.assetType}` : ""}`;
}

function currentPropertyOpportunity() {
  const property = state.property || seedData.property;
  const opportunities = property.opportunities || [];
  return opportunities.find((item) => String(item.id) === String(currentPropertyOpportunityId))
    || opportunities[0]
    || null;
}

function renderPropertyAnalysis(result = null) {
  const property = state.property || seedData.property;
  const latest = result || (property.analyses || [])[0];
  if (!latest) {
    $("#property-analysis-output").innerHTML = '<div class="empty-state">Select an opportunity and run analysis. Recommendations are advisory only.</div>';
    return;
  }
  const analysis = latest.analysis || latest.results || {};
  const rules = latest.rules || [];
  $("#property-analysis-output").innerHTML = `
    <div class="ai-boundary">Westbridge analysed local property records only. No offer, purchase, legal instruction, payment, communication or external property action was executed.</div>
    <section class="ai-summary">
      <h3>${escapeHTML(latest.opportunity?.title || "Deal analysis")}</h3>
      <p>${escapeHTML(latest.recommendation || "Recommendation not recorded.")}</p>
    </section>
    <div class="project-intelligence-signals">
      <article><small>GROSS YIELD</small><strong>${analysis.grossYield || 0}%</strong><span>Rent against purchase price.</span></article>
      <article><small>NET YIELD</small><strong>${analysis.netYield || 0}%</strong><span>After acquisition and operating costs.</span></article>
      <article><small>NET CASHFLOW</small><strong>${formatMoney(analysis.netMonthlyCashflow || 0)}</strong><span>Monthly estimate.</span></article>
      <article><small>CASH LEFT</small><strong>${formatMoney(analysis.cashLeftInDeal || 0)}</strong><span>After refinance assumption.</span></article>
    </div>
    ${renderList("Westbridge rule review", rules, (rule) => `
      <strong>${escapeHTML(rule.rule)}</strong>
      <span>${escapeHTML(rule.detail || "")}</span>
      <small>${escapeHTML(rule.status || "review")}</small>
    `)}
    ${renderList("Visible assumptions", analysis.assumptions || latest.assumptions || [], (assumption) => `
      <span>${escapeHTML(assumption)}</span>
    `)}
  `;
}

function renderProperty() {
  const property = state.property || seedData.property;
  const metrics = property.metrics || {};
  $("#property-agent-identity").innerHTML = renderAgentIdentitySummary("westbridge-property-director");
  $("#property-metrics").innerHTML = [
    ["TOTAL PROPERTIES", metrics.totalProperties],
    ["PORTFOLIO VALUE", metrics.portfolioValue],
    ["NET EQUITY", metrics.netEquity],
    ["OUTSTANDING DEBT", metrics.outstandingDebt],
    ["MONTHLY CASHFLOW", metrics.monthlyCashflow],
    ["ANNUAL CASHFLOW", metrics.annualCashflow],
    ["ACTIVE OPPORTUNITIES", metrics.activeOpportunities],
    ["PIPELINE CASHFLOW", metrics.monthlyCashflowForecast],
  ].map(([label, value]) => `
    <article>
      <small>${label}</small>
      <strong>${typeof value === "number" && !label.includes("PROPERTIES") && !label.includes("OPPORTUNITIES") ? formatMoney(value) : value || 0}</strong>
    </article>
  `).join("");

  const progress = Math.max(0, Math.min(100, Number(metrics.cashflowTargetProgress) || 0));
  $("#property-progress-fill").style.width = `${progress}%`;
  $("#property-target-label").textContent = `${progress}%`;
  $("#property-target-detail").textContent = `${formatMoney(metrics.monthlyCashflow || 0)} current monthly cashflow against ${formatMoney(metrics.targetMonthlyCashflow || 10000)} target. Pipeline forecast: ${formatMoney(metrics.monthlyCashflowForecast || 0)}.`;

  const opportunities = property.opportunities || [];
  if (!currentPropertyOpportunityId && opportunities.length) currentPropertyOpportunityId = opportunities[0].id;
  $("#property-opportunity-list").innerHTML = opportunities.length
    ? `<div class="project-list">${opportunities.map((opportunity) => `
        <article class="project-card property-card ${String(opportunity.id) === String(currentPropertyOpportunityId) ? "selected" : ""}">
          <div>
            <span class="project-health ${statusLabel(opportunity.stage).replaceAll(" ", "-")}">${escapeHTML(opportunity.stage || "Lead")}</span>
            <h3>${escapeHTML(opportunity.title)}</h3>
            <p>${escapeHTML(propertyOpportunityLabel(opportunity))}</p>
          </div>
          <small>${formatMoney(opportunity.purchasePrice || 0)} purchase · ${formatMoney(opportunity.rentMonthly || 0)} rent · ${formatMoney(opportunity.forecastNetMonthlyCashflow || 0)} net/month</small>
          <span class="project-card-domains">${escapeHTML(opportunity.sourceUrl || opportunity.notes || "Metadata only")}</span>
          <button class="text-button property-select" data-property-id="${opportunity.id}">Select opportunity →</button>
        </article>
      `).join("")}</div>`
    : '<div class="empty-state project-empty">No property opportunities yet. Add a manual record or URL reference to begin.</div>';

  const dueDiligence = property.dueDiligence || [];
  $("#property-due-diligence").innerHTML = dueDiligence.length
    ? `<div class="project-record-list">${dueDiligence.slice(0, 14).map((item) => `
        <article>
          <strong>${escapeHTML(item.category)}</strong>
          <small>${escapeHTML(item.status)} · ${escapeHTML(item.opportunityTitle || "")}</small>
          <span>${escapeHTML(item.detail || "Not reviewed yet.")}</span>
        </article>
      `).join("")}</div>`
    : '<div class="empty-state project-empty">No due diligence records yet.</div>';

  $("#property-rules").innerHTML = (property.rules || []).length
    ? `<div class="project-record-list">${property.rules.map((rule) => `
        <article><strong>${escapeHTML(rule)}</strong><span>Required Westbridge investment guardrail.</span></article>
      `).join("")}</div>`
    : '<div class="empty-state">Westbridge rules load from the backend.</div>';
  renderPropertyAnalysis();
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
    <div class="project-domain-strip">
      ${(detail.tags || []).length
        ? detail.tags.map((tag) => `<span>${escapeHTML(tag.domainLabel || tag.tag)} <small>${escapeHTML(tag.confidence || "confirmed")}</small></span>`).join("")
        : "<span>No digital construction tags yet</span>"}
    </div>
    <div class="project-intelligence-signals">
      <article>
        <small>INFORMATION QUALITY</small>
        <strong>${escapeHTML(detail.informationQuality?.status || "unknown")}</strong>
        <span>${escapeHTML(detail.informationQuality?.explanation || "No quality assessment available.")}</span>
      </article>
      <article>
        <small>KNOWLEDGE GRAPH</small>
        <strong>${detail.knowledgeLinks?.length || 0}</strong>
        <span>Project relationships across records, memory and Microsoft metadata.</span>
      </article>
      <article>
        <small>SARAH READINESS</small>
        <strong>${detail.digitalConstruction?.domains?.length || 0} domain(s)</strong>
        <span>${escapeHTML(detail.digitalConstruction?.sarahStatus || "Prepared data structures only.")}</span>
      </article>
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
          <article><strong>${escapeHTML(document.name)}</strong><small>${escapeHTML(document.classification)} · ${escapeHTML(document.ownerName || "owner unknown")}</small><span>${escapeHTML(document.path || document.webUrl || document.location || "No path captured")}</span></article>
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
    <div class="project-finance-summary">
      <h4>Digital construction placeholders</h4>
      <span>COBie: ${detail.digitalConstruction?.placeholders?.cobie?.length || 0} · GIS: ${detail.digitalConstruction?.placeholders?.gis?.length || 0} · Digital Twin: ${detail.digitalConstruction?.placeholders?.digitalTwin?.length || 0}. No specialist Sarah analysis has been run.</span>
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
    ["FINANCIAL RISK", metrics.financialRiskIndicators],
    ["INFO QUALITY", metrics.informationQualityIndicators],
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
          <small>${project.documentCount || 0} docs · ${project.riskCount || 0} risks · ${project.actionCount || 0} actions · ${project.tagCount || 0} tag(s)</small>
          <span class="project-card-domains">${(project.domains || []).slice(0, 4).map((domain) => escapeHTML(domain)).join(" · ") || "No domains tagged"}</span>
          <span class="project-card-quality">Info quality: ${escapeHTML(project.informationQuality?.status || "unknown")}</span>
          <button class="text-button project-select" data-project-id="${project.profile.id}">Open project →</button>
        </article>
      `).join("")}</div>`
    : '<div class="empty-state project-empty">No project profiles found. Start the backend to load project intelligence.</div>';
  renderProjectDetail(currentProjectDetail);
}

function meetingList(records, empty, formatter) {
  return records?.length
    ? `<div class="project-record-list">${records.slice(0, 10).map((record) => `<article>${formatter(record)}</article>`).join("")}</div>`
    : `<div class="empty-state project-empty">${empty}</div>`;
}

function renderMeetingDetail(detail) {
  if (!detail) {
    $("#meeting-detail").innerHTML = '<div class="empty-state project-empty">Select a meeting to inspect summary, attendees, actions, decisions, risks, opportunities, feedback, agent reviews and source references.</div>';
    return;
  }
  const meeting = detail.meeting;
  const summary = detail.summary;
  $("#meeting-detail").innerHTML = `
    <div class="project-detail-header">
      <div>
        <span class="project-health ${meeting.transcriptAvailable ? "green" : "amber"}">${meeting.transcriptAvailable ? "transcript available" : "transcript unavailable"}</span>
        <h3>${escapeHTML(meeting.title)}</h3>
        <p>${escapeHTML(meeting.clientName || "Client not linked")} · ${escapeHTML(meeting.projectName || "Project not linked")} · ${escapeHTML(meeting.startDatetime || "No date")}</p>
      </div>
    </div>
    <div class="project-health-card">
      <strong>${escapeHTML(meeting.confidenceLevel || "inferred")}</strong>
      <span>${escapeHTML(summary?.summary || "Transcript not available. Alfred reviewed calendar metadata only and has not inferred meeting content.")}</span>
    </div>
    <div class="project-intelligence-signals">
      <article><small>ATTENDEES</small><strong>${detail.attendees.length}</strong><span>${detail.attendees.slice(0, 3).map((item) => escapeHTML(item.name || item.email)).join(", ") || "No attendees captured"}</span></article>
      <article><small>ACTIONS</small><strong>${detail.actions.length}</strong><span>Internal Alfred records only; no external actions created.</span></article>
      <article><small>AGENT REVIEWS</small><strong>${detail.agentReviews.length}</strong><span>${detail.agentReviews.map((review) => escapeHTML(review.agentName)).join(", ") || "No reviews yet"}</span></article>
    </div>
    <div class="project-detail-grid">
      <section>
        <h4>Actions</h4>
        ${meetingList(detail.actions, "No actions extracted. Transcript may be unavailable.", (item) => `
          <strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.priority)} · ${escapeHTML(item.status)}</small><span>${escapeHTML(item.detail)}</span>
        `)}
      </section>
      <section>
        <h4>Decisions</h4>
        ${meetingList(detail.decisions, "No decisions extracted.", (item) => `
          <strong>${escapeHTML(item.title)}</strong><small>${item.approvalRequired ? "Patrick approval may be required" : "Review"} · ${escapeHTML(item.confidenceLevel)}</small><span>${escapeHTML(item.detail)}</span>
        `)}
      </section>
      <section>
        <h4>Risks & Opportunities</h4>
        ${meetingList([...(detail.risks || []), ...(detail.opportunities || [])], "No risks or opportunities extracted.", (item) => `
          <strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.severity || item.status || "open")} · ${escapeHTML(item.confidenceLevel)}</small><span>${escapeHTML(item.detail)}</span>
        `)}
      </section>
      <section>
        <h4>Agent reviews</h4>
        ${meetingList(detail.agentReviews, "No agent reviews yet.", (review) => `
          <strong>${escapeHTML(review.agentName)}</strong><small>${escapeHTML(review.status)} · ${escapeHTML(review.relevance)}</small><span>${escapeHTML(review.summary)}</span>
        `)}
      </section>
    </div>
    <div class="project-finance-summary">
      <h4>Source references</h4>
      <span>${escapeHTML(meeting.sourceReference)} · ${escapeHTML(meeting.webUrl || "No web URL captured")} · Raw audio stored: no</span>
    </div>
  `;
}

function renderMeetingIntelligence() {
  const meetingState = state.meetingIntelligence || seedData.meetingIntelligence;
  const metrics = meetingState.metrics || {};
  $("#meeting-dashboard-metrics").innerHTML = [
    ["MEETINGS", metrics.totalMeetings],
    ["FOLLOW-UP", metrics.meetingsNeedingFollowUp],
    ["ACTIONS", metrics.openActions],
    ["DECISIONS", metrics.decisions],
    ["RISKS", metrics.risks],
    ["FEEDBACK", metrics.feedbackSignals],
    ["NO TRANSCRIPT", metrics.transcriptUnavailable],
    ["SENTINEL", metrics.sentinelConcerns],
  ].map(([label, value]) => `
    <article>
      <small>${label}</small>
      <strong>${value || 0}</strong>
    </article>
  `).join("");

  const meetings = meetingState.recentMeetings || [];
  $("#meeting-list").innerHTML = meetings.length
    ? `<div class="project-list">${meetings.map((meeting) => `
        <article class="project-card meeting-card" data-meeting-id="${meeting.id}">
          <div>
            <span class="project-health ${meeting.transcriptAvailable ? "green" : "amber"}">${meeting.transcriptAvailable ? "summary ready" : "transcript unavailable"}</span>
            <h3>${escapeHTML(meeting.title)}</h3>
            <p>${escapeHTML(meeting.clientName || "No client linked")} · ${escapeHTML(meeting.projectName || "No project linked")}</p>
          </div>
          <small>${escapeHTML(meeting.startDatetime || "No date")} · ${escapeHTML(meeting.organizerName || "Unknown organiser")}</small>
          <span class="project-card-domains">${escapeHTML(meeting.relatedAgent || "alfred")} · ${escapeHTML(meeting.confidenceLevel || "inferred")}</span>
          <button class="text-button meeting-select" data-meeting-id="${meeting.id}">Open meeting →</button>
        </article>
      `).join("")}</div>`
    : '<div class="empty-state project-empty">No meeting records yet. Import read-only calendar metadata to begin.</div>';

  $("#meeting-follow-ups").innerHTML = meetingList(meetingState.followUpQueue || [], "No outstanding meeting actions.", (item) => `
    <strong>${escapeHTML(item.title)}</strong>
    <span>${escapeHTML(item.meetingTitle || item.meeting_title || "")} · ${escapeHTML(item.owner || "Owner placeholder")}</span>
    <small>${escapeHTML(item.priority || "medium")} · ${escapeHTML(item.dueDate || "Due date placeholder")}</small>
  `);

  $("#meeting-feedback-meeting").innerHTML = meetings.length
    ? meetings.map((meeting) => `<option value="${meeting.id}">${escapeHTML(meeting.title)}</option>`).join("")
    : '<option value="">No meetings available</option>';
  $("#meeting-feedback-list").innerHTML = meetingList(meetingState.feedback || [], "No feedback captured yet.", (item) => `
    <strong>${escapeHTML(item.userFeedback || item.notes || "Meeting feedback")}</strong>
    <span>${escapeHTML(item.meetingTitle || item.meeting_title || "")} · ${escapeHTML(item.agentId || "alfred")}</span>
    <small>${escapeHTML(item.recommendationStatus || "unreviewed")} · ${escapeHTML(item.memoryUpdateReference || "memory not created")}</small>
  `);
  renderMeetingDetail(currentMeetingDetail);
}

async function refreshMeetingIntelligence() {
  if (!backendAvailable) {
    showToast("Meeting intelligence requires the backend");
    return;
  }
  state.meetingIntelligence = await apiRequest("/api/meeting-intelligence/dashboard");
  persist();
  renderMeetingIntelligence();
}

async function importMeetingMetadata() {
  if (!backendAvailable) {
    showToast("Meeting import requires the backend");
    return;
  }
  try {
    showToast("Importing calendar metadata in read-only mode...");
    const result = await apiRequest("/api/meeting-intelligence/import-calendar", {
      method: "POST",
      body: JSON.stringify({ userAction: "ui:meetings:import-calendar" }),
    });
    await refreshMeetingIntelligence();
    showToast(result.message || `Stored ${result.meetingsStored || 0} meeting metadata record(s)`);
  } catch (error) {
    showToast(error.message);
  }
}

async function openMeetingDetail(meetingId) {
  if (!backendAvailable) {
    showToast("Meeting detail requires the backend");
    return;
  }
  try {
    currentMeetingDetail = await apiRequest(`/api/meeting-intelligence/meetings/${meetingId}`);
    renderMeetingDetail(currentMeetingDetail);
  } catch (error) {
    showToast(error.message);
  }
}

async function submitMeetingFeedback(event) {
  event.preventDefault();
  if (!backendAvailable) {
    showToast("Meeting feedback requires the backend");
    return;
  }
  const meetingId = $("#meeting-feedback-meeting").value;
  const notes = $("#meeting-feedback-notes").value.trim();
  if (!meetingId || !notes) {
    showToast("Select a meeting and add feedback notes");
    return;
  }
  try {
    await apiRequest(`/api/meeting-intelligence/meetings/${meetingId}/feedback`, {
      method: "POST",
      body: JSON.stringify({
        outputType: "meeting_intelligence_output",
        agentId: $("#meeting-feedback-agent").value,
        userFeedback: notes,
        recommendationStatus: $("#meeting-feedback-status").value,
        lessonLearned: notes,
      }),
    });
    $("#meeting-feedback-notes").value = "";
    await refreshMeetingIntelligence();
    if (currentMeetingDetail?.meeting?.id === Number(meetingId)) await openMeetingDetail(meetingId);
    showToast("Meeting feedback stored in Alfred memory");
  } catch (error) {
    showToast(error.message);
  }
}

async function searchMeetings(event) {
  event.preventDefault();
  if (!backendAvailable) {
    showToast("Meeting search requires the backend");
    return;
  }
  const query = $("#meeting-search-query").value.trim();
  if (!query) {
    showToast("Enter a meeting search topic");
    return;
  }
  $("#meeting-search-results").innerHTML = '<div class="ai-loading">Searching meeting intelligence...</div>';
  try {
    const result = await apiRequest(`/api/meeting-intelligence/search?q=${encodeURIComponent(query)}`);
    $("#meeting-search-results").innerHTML = `
      ${renderList("Matching meetings", result.matchingMeetings || [], (meeting) => `
        <strong>${escapeHTML(meeting.title)}</strong>
        <span>${escapeHTML(meeting.clientName || "No client linked")} · ${escapeHTML(meeting.projectName || "No project linked")}</span>
        <small>${escapeHTML(meeting.sourceReference || "")} · relevance ${meeting.relevanceScore}</small>
      `)}
      ${renderList("Actions", result.relatedActions || [], (item) => `
        <strong>${escapeHTML(item.title)}</strong>
        <span>${escapeHTML(item.meetingTitle || item.meeting_title || "")} · ${escapeHTML(item.status || "")}</span>
        <small>${escapeHTML(item.sourceReference || "")}</small>
      `)}
      ${renderList("Decisions", result.relatedDecisions || [], (item) => `
        <strong>${escapeHTML(item.title)}</strong>
        <span>${escapeHTML(item.meetingTitle || item.meeting_title || "")} · ${escapeHTML(item.status || "")}</span>
        <small>${escapeHTML(item.sourceReference || "")}</small>
      `)}
      ${renderList("Risks", result.relatedRisks || [], (item) => `
        <strong>${escapeHTML(item.title)}</strong>
        <span>${escapeHTML(item.meetingTitle || item.meeting_title || "")} · ${escapeHTML(item.severity || "")}</span>
        <small>${escapeHTML(item.sourceReference || "")}</small>
      `)}
      ${renderList("Feedback", result.feedbackSignals || [], (item) => `
        <strong>${escapeHTML(item.userFeedback || item.lessonLearned || "Feedback")}</strong>
        <span>${escapeHTML(item.meetingTitle || item.meeting_title || "")}</span>
        <small>${escapeHTML(item.sourceReference || "")}</small>
      `)}
      ${renderList("Semantic memory", result.semanticMemory || [], (memory) => `
        <strong>${escapeHTML(memory.sourceReference || `${memory.sourceType}:${memory.sourceId}`)}</strong>
        <span>${escapeHTML(memory.shortSummary || "")}</span>
        <small>${escapeHTML(memory.sensitivityLabel || "local_sensitive_business_data")}</small>
      `)}
    `;
  } catch (error) {
    $("#meeting-search-results").innerHTML = `<div class="empty-state">${escapeHTML(error.message)}</div>`;
  }
}

function mondayList(records, empty, formatter, limit = 8) {
  return records?.length
    ? `<div class="monday-card-list">${records.slice(0, limit).map((record) => `<article>${formatter(record)}</article>`).join("")}</div>`
    : `<div class="empty-state project-empty">${empty}</div>`;
}

function mondayStatusClass(value = "") {
  return String(value || "").toLowerCase().replace(/\s+/g, "-");
}

function renderMondayOperating() {
  const monday = state.mondayOperating || seedData.mondayOperating;
  const metrics = monday.metrics || {};
  $("#monday-dashboard-metrics").innerHTML = [
    ["AGENTS", metrics.agents],
    ["ACTIVE WORK", metrics.activeWorkItems],
    ["BLOCKED", metrics.blockedItems],
    ["OVERDUE", metrics.overdueItems],
    ["PRIORITY", metrics.priorityItems],
    ["DELIVERABLES", metrics.deliverablesDue],
    ["DECISIONS", metrics.decisionsAwaitingApproval],
    ["FOLLOW-UPS", metrics.meetingFollowups],
    ["FEEDBACK", metrics.feedbackForReview],
    ["HEALTH", `${metrics.workloadHealth?.red || 0}R/${metrics.workloadHealth?.amber || 0}A`],
  ].map(([label, value]) => `
    <article>
      <small>${label}</small>
      <strong>${value || 0}</strong>
    </article>
  `).join("");

  $("#monday-agent-workloads").innerHTML = mondayList(monday.agentWorkloads || [], "No workload records calculated yet.", (item) => `
    <div class="monday-card-top">
      <strong>${escapeHTML(item.agentName)}</strong>
      <span class="monday-status ${mondayStatusClass(item.healthStatus || item.workloadStatus)}">${escapeHTML(item.healthStatus || item.workloadStatus)}</span>
    </div>
    <span>${escapeHTML(item.businessArea || "Group")} · score ${item.workloadScore || 0}/100 · ${item.activeItems || 0} active · ${item.blockedItems || 0} blocked · ${item.overdueItems || 0} overdue · ${item.deliverablesDue || 0} deliverables due</span>
    <small>${escapeHTML(item.notes || "No external Monday sync is enabled.")}</small>
  `, 12);

  $("#monday-workload-health").innerHTML = mondayList(monday.workloadMetrics || [], "No workload health metrics calculated yet.", (item) => `
    <div class="monday-card-top">
      <strong>${escapeHTML(item.agentName)}</strong>
      <span class="monday-status ${mondayStatusClass(item.healthStatus)}">${escapeHTML(item.healthStatus || "Green")}</span>
    </div>
    <span>Score ${item.workloadScore || 0}/100 · ${item.openItems || 0} open · ${item.highPriorityItems || 0} high priority</span>
    <small>${item.blockedItems || 0} blocked · ${item.overdueItems || 0} overdue · ${item.deliverablesDue || 0} deliverables due</small>
  `, 12);

  $("#monday-work-queue").innerHTML = mondayList(monday.workItems || [], "No internal work items yet.", (item) => `
    <div class="monday-card-top">
      <strong>${escapeHTML(item.title)}</strong>
      <span class="monday-priority ${String(item.priority || "Medium").toLowerCase()}">${escapeHTML(item.priority || "Medium")}</span>
    </div>
    <span>${escapeHTML(item.ownerAgentName || "Alfred")} · ${escapeHTML(item.status || "New")} · ${escapeHTML(item.projectName || item.clientName || item.businessEntityId || "Group")}</span>
    <small>${escapeHTML(item.sourceReference || "Internal Alfred record")} ${item.dueDate ? `· due ${escapeHTML(item.dueDate)}` : ""}</small>
  `, 12);

  $("#monday-deliverables").innerHTML = mondayList(monday.deliverables || [], "No deliverables recorded yet.", (item) => `
    <div class="monday-card-top">
      <strong>${escapeHTML(item.title)}</strong>
      <span class="monday-status ${mondayStatusClass(item.status)}">${escapeHTML(item.status || "Planned")}</span>
    </div>
    <span>${escapeHTML(item.ownerAgentName || "Alfred")} · ${escapeHTML(item.projectName || item.clientName || item.linkedBusinessId || "Group")}</span>
    <small>${escapeHTML(item.linkedMemoryReference || item.linkedFilePlaceholder || item.sourceReference || "No external file write.")}</small>
  `);

  const riskOpportunityRows = [
    ...(monday.operationalRisks || []).map((item) => ({ ...item, signalKind: "Risk" })),
    ...(monday.operationalOpportunities || []).map((item) => ({ ...item, signalKind: "Opportunity" })),
  ];
  $("#monday-risks-opportunities").innerHTML = mondayList(riskOpportunityRows, "No operational risks or opportunities recorded yet.", (item) => `
    <div class="monday-card-top">
      <strong>${escapeHTML(item.title)}</strong>
      <span class="monday-priority ${String(item.priority || "Medium").toLowerCase()}">${escapeHTML(item.signalKind)}</span>
    </div>
    <span>${escapeHTML(item.ownerAgentName || "Alfred")} · ${escapeHTML(item.businessImpact || item.detail || "")}</span>
    <small>${escapeHTML(item.sourceReference || "Internal source")}</small>
  `, 10);

  $("#monday-decisions").innerHTML = mondayList(monday.operationalDecisions || [], "No operational decisions queued yet.", (item) => `
    <div class="monday-card-top">
      <strong>${escapeHTML(item.title)}</strong>
      <span class="monday-status ${mondayStatusClass(item.status)}">${escapeHTML(item.status || "New")}</span>
    </div>
    <span>${item.approvalRequired ? "Patrick review required" : "Review"} · ${escapeHTML(item.ownerAgentName || "Alfred")}</span>
    <small>${escapeHTML(item.sourceReference || item.detail || "")}</small>
  `);

  $("#monday-meeting-followups").innerHTML = mondayList(monday.meetingFollowups || [], "No meeting follow-ups have been converted yet.", (item) => `
    <div class="monday-card-top">
      <strong>${escapeHTML(item.extractedAction)}</strong>
      <span class="monday-priority ${String(item.priority || "Medium").toLowerCase()}">${escapeHTML(item.priority || "Medium")}</span>
    </div>
    <span>${escapeHTML(item.meetingTitle || "Meeting")} · ${escapeHTML(item.ownerAgentName || "Alfred")}</span>
    <small>${escapeHTML(item.sourceReference || "Meeting Intelligence")}</small>
  `);

  $("#monday-feedback").innerHTML = mondayList(monday.outputFeedback || [], "No output feedback has been captured yet.", (item) => `
    <div class="monday-card-top">
      <strong>${escapeHTML(item.outputTitle)}</strong>
      <span class="monday-status ${mondayStatusClass(item.recommendationStatus)}">${escapeHTML(item.recommendationStatus || "unreviewed")}</span>
    </div>
    <span>${escapeHTML(item.agentName || "Alfred")} · ${escapeHTML(item.rating || "unrated")}</span>
    <small>${escapeHTML(item.lessonLearned || item.futureWorkSuggestion || item.sourceReference || "Feedback review pending.")}</small>
  `);

  const mappings = (monday.boardMappings || []).slice(0, 16);
  const syncByKey = new Map((monday.syncStatus || []).map((item) => [`${item.agentId}:${item.boardKind}`, item]));
  $("#monday-board-mappings").innerHTML = mappings.length
    ? `<div class="monday-board-grid">${mappings.map((mapping) => {
        const sync = syncByKey.get(`${mapping.agentId}:${mapping.boardKind}`) || {};
        return `
          <article>
            <strong>${escapeHTML(mapping.boardName)}</strong>
            <span>${escapeHTML(mapping.status || "Planned")} · read ${sync.readEnabled ? "on" : "off"} · write ${sync.writeEnabled ? "on" : "off"}</span>
          </article>
        `;
      }).join("")}</div>`
    : '<div class="empty-state project-empty">Future Monday board mappings will appear here.</div>';
}

async function refreshMondayOperating() {
  if (!backendAvailable) {
    showToast("Monday Operating System requires the backend");
    return;
  }
  try {
    state.mondayOperating = await apiRequest("/api/monday-os/dashboard");
    persist();
    renderMondayOperating();
    showToast("Monday OS board refreshed");
  } catch (error) {
    showToast(error.message);
  }
}

async function syncMondayFollowups() {
  if (!backendAvailable) {
    showToast("Monday Operating System requires the backend");
    return;
  }
  try {
    const result = await apiRequest("/api/monday-os/sync-meeting-followups", {
      method: "POST",
      body: JSON.stringify({ userAction: "ui:monday-os:sync-meeting-followups" }),
    });
    state.mondayOperating = await apiRequest("/api/monday-os/dashboard");
    persist();
    renderMondayOperating();
    showToast(`Synced ${result.recordsCreated || 0} internal record(s)`);
  } catch (error) {
    showToast(error.message);
  }
}

function sarahProjectOptions() {
  const projects = state.projectIntelligence?.projects || [];
  return projects.map((project) => `
    <option value="${project.profile.id}" ${String(project.profile.id) === String(sarahCurrentProjectId || "") ? "selected" : ""}>
      ${escapeHTML(project.profile.projectName)} (${escapeHTML(project.profile.clientName || "Internal")})
    </option>
  `).join("");
}

function sarahList(records, empty, formatter) {
  return records?.length
    ? `<div class="sarah-list">${records.slice(0, 8).map((record) => `<article>${formatter(record)}</article>`).join("")}</div>`
    : `<div class="empty-state project-empty">${empty}</div>`;
}

function renderSarah() {
  const sarah = state.sarah || seedData.sarah;
  const metrics = sarah.metrics || {};
  $("#sarah-agent-identity").innerHTML = renderAgentIdentitySummary("sarah");
  $("#sarah-metrics").innerHTML = [
    ["PROJECTS NEEDING ATTENTION", metrics.projectsRequiringAttention],
    ["INFORMATION RISKS", metrics.informationRisks],
    ["HIGH-RISK PROJECTS", metrics.highRiskProjects],
    ["MISSING INFORMATION", metrics.missingInformation],
    ["OPPORTUNITIES", metrics.opportunities],
  ].map(([label, value]) => `
    <article>
      <small>${label}</small>
      <strong>${value || 0}</strong>
    </article>
  `).join("");

  const select = $("#sarah-project-select");
  if (select) {
    const options = sarahProjectOptions();
    select.innerHTML = options || '<option value="">No projects available</option>';
    if (!sarahCurrentProjectId && select.value) sarahCurrentProjectId = select.value;
  }

  $("#sarah-attention").innerHTML = sarahList(sarah.projectsRequiringAttention || [], "No projects currently require Sarah's attention.", (project) => `
    <strong>${escapeHTML(project.profile?.projectName || project.projectName || "Project")}</strong>
    <span>${escapeHTML(project.healthScore?.status || "unknown")} · ${escapeHTML(project.healthScore?.explanation || "")}</span>
    <small>${escapeHTML(project.profile?.clientName || "")}</small>
  `);
  $("#sarah-information-risks").innerHTML = sarahList(sarah.informationRisks || [], "No information quality risks found.", (risk) => `
    <strong>${escapeHTML(risk.projectName)}</strong>
    <span>${escapeHTML(risk.informationQuality?.explanation || "Information quality requires review.")}</span>
    <small>${escapeHTML(risk.informationQuality?.status || "unknown")}</small>
  `);
  $("#sarah-opportunities").innerHTML = sarahList(sarah.opportunities || [], "No Sarah opportunities detected yet.", (opportunity) => `
    <strong>${escapeHTML(opportunity.opportunity)}</strong>
    <span>${escapeHTML(opportunity.projectName)} · ${escapeHTML(opportunity.businessImpact)}</span>
    <small>${escapeHTML(opportunity.category)} · ${escapeHTML(opportunity.confidence)} · ${escapeHTML(opportunity.sourceReference)}</small>
  `);
  const recent = [
    ...(sarah.recentRisks || []).map((item) => ({ ...item, label: "Risk" })),
    ...(sarah.recentDecisions || []).map((item) => ({ ...item, label: "Decision" })),
    ...(sarah.recentMeetings || []).map((item) => ({ ...item, label: "Meeting" })),
  ].slice(0, 8);
  $("#sarah-recent-signals").innerHTML = sarahList(recent, "No recent Sarah signals found.", (signal) => `
    <strong>${escapeHTML(signal.title || "Signal")}</strong>
    <span>${escapeHTML(signal.projectName || "")} · ${escapeHTML(signal.detail || signal.status || "")}</span>
    <small>${escapeHTML(signal.label)}</small>
  `);
}

function renderAll() {
  renderCommand();
  renderVoiceCommandCentre();
  renderCompanies();
  renderProperty();
  renderProjectIntelligence();
  renderMeetingIntelligence();
  renderMondayOperating();
  renderSarah();
  renderFinance();
  renderMemory();
  renderAgents();
  renderApprovals();
  renderIntegrations();
  renderSettings();
  enhanceAvatarFallbacks();
}

function navigate(view) {
  const titles = {
    command: "Executive Command",
    companies: "Companies",
    property: "Property",
    projects: "Project Intelligence",
    meetings: "Meeting Intelligence",
    monday: "Monday Operating System",
    sarah: "Sarah",
    finance: "Finance",
    memory: "Memory",
    agents: "AI Executive Team",
    approvals: "Approvals",
    integrations: "Integrations",
    settings: "Settings",
  };
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $$(".view").forEach((section) => section.classList.toggle("active", section.id === `${view}-view`));
  $("#view-title").textContent = titles[view];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function refreshAppStatus() {
  if (!backendAvailable) {
    state.deployment = seedData.deployment;
    renderSettings();
    showToast("App status requires the backend API");
    return;
  }
  try {
    state.deployment = await apiRequest("/api/health");
    renderSettings();
    showToast("Deployment status refreshed");
  } catch (error) {
    showToast(error.message);
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      console.warn("Service worker registration skipped.", error);
    });
  });
}

function navigateFromUrl() {
  const view = new URLSearchParams(window.location.search).get("view");
  if (view && $(`#${view}-view`)) navigate(view);
}

function renderBriefAgentStatus(agents = []) {
  const roster = executiveTeamRoster((agents || []).map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    status: agent.status,
  })));
  return `
    <section class="brief-section agent-brief-section">
      <h4>13. AGENT STATUS</h4>
      <div class="brief-agent-grid">
        ${roster.map((agent) => `
          <article style="--agent-accent:${escapeHTML(agent.accentColor)}">
            ${renderAgentAvatar(agent, "small")}
            <div>
              <strong>${escapeHTML(agent.name)}</strong>
              <span>${escapeHTML(agent.title)}</span>
              <small>${escapeHTML(agent.status)} · reports to ${escapeHTML(agent.reportingLine)}</small>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
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
      ${brief.property?.items?.length ? `${brief.property.items.length} Westbridge property signal(s) found. ` : ""}
      ${brief.projectIntelligence?.projectsNeedingAttention?.length ? `${brief.projectIntelligence.projectsNeedingAttention.length} project(s) need attention. ` : ""}
      ${brief.sarah?.items?.length ? `${brief.sarah.items.length} Sarah digital construction signal(s) found. ` : ""}
      ${brief.mondayOperating?.items?.length ? `${brief.mondayOperating.items.length} Monday OS internal work signal(s) found. ` : ""}
      ${brief.meetingIntelligence?.items?.length ? `${brief.meetingIntelligence.items.length} meeting intelligence signal(s) found. ` : ""}
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
    ${section("8. WESTBRIDGE PROPERTY", brief.property?.items || [], "No Westbridge property exceptions detected from current records.")}
    ${section("9. PROJECT INTELLIGENCE", brief.projectIntelligence?.projectsNeedingAttention || [], "No projects currently require attention from project intelligence.")}
    ${section("10. SARAH DIGITAL CONSTRUCTION BRIEF", brief.sarah?.items || [], "No Sarah digital construction exceptions detected from current records.")}
    ${section("11. MONDAY OPERATING SYSTEM", brief.mondayOperating?.items || [], "No internal Monday OS work exceptions detected from current records.")}
    ${section("12. TEAMS MEETING INTELLIGENCE", brief.meetingIntelligence?.items || [], "No meeting intelligence exceptions detected from current records.")}
    ${renderBriefAgentStatus(brief.agents || [])}
  `;
  enhanceAvatarFallbacks($("#brief-dialog"));
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
    enhanceAvatarFallbacks($("#brief-dialog"));
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
    property: { title: "Westbridge Property Brief", items: [], summary: "Backend required for property briefing.", metrics: {} },
    projectIntelligence: { projectsNeedingAttention: [] },
    sarah: { title: "Daily Digital Construction Brief", items: [], summary: "Backend required for Sarah briefing." },
    mondayOperating: { title: "Monday Operating System", items: [], summary: "Backend required for internal work intelligence.", metrics: {} },
    meetingIntelligence: { title: "Teams Meeting Intelligence Brief", items: [], summary: "Backend required for meeting intelligence.", metrics: {} },
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
  enhanceAvatarFallbacks($("#ai-dialog"));
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

async function refreshPropertyDashboard() {
  if (!backendAvailable) {
    showToast("Property dashboard requires the backend");
    return;
  }
  state.property = await apiRequest("/api/property/dashboard");
  persist();
  renderProperty();
}

async function addPropertyOpportunity(event) {
  event.preventDefault();
  if (!backendAvailable) {
    showToast("Property deal intake requires the backend");
    return;
  }
  const address = $("#property-address").value.trim();
  const sourceUrl = $("#property-source-url").value.trim();
  if (!address && !sourceUrl) {
    showToast("Add an address/title or URL reference");
    return;
  }
  try {
    const opportunity = await apiRequest("/api/property/opportunities", {
      method: "POST",
      body: JSON.stringify({
        title: address || sourceUrl,
        address,
        purchasePrice: $("#property-purchase-price").value,
        rentMonthly: $("#property-rent").value,
        assetType: $("#property-asset-type").value,
        tenure: $("#property-tenure").value,
        refurbCost: $("#property-refurb-cost").value,
        managementCostMonthly: $("#property-management-cost").value,
        sourceUrl,
        sourceType: sourceUrl ? "url_reference" : "manual",
        userAction: "ui:property:add-opportunity",
      }),
    });
    currentPropertyOpportunityId = opportunity.id;
    $("#property-deal-form").reset();
    await refreshPropertyDashboard();
    showToast("Property opportunity stored");
  } catch (error) {
    showToast(error.message);
  }
}

async function analyseSelectedPropertyOpportunity() {
  if (!backendAvailable) {
    showToast("Property analysis requires the backend");
    return;
  }
  const opportunity = currentPropertyOpportunity();
  if (!opportunity) {
    showToast("Select or add a property opportunity first");
    return;
  }
  $("#property-analysis-output").innerHTML = '<div class="ai-loading">Westbridge Property Director is analysing the deal...</div>';
  try {
    const result = await apiRequest(`/api/property/opportunities/${opportunity.id}/analyse`, {
      method: "POST",
      body: JSON.stringify({ userAction: "ui:property:analyse-selected" }),
    });
    renderPropertyAnalysis(result);
    await refreshPropertyDashboard();
    renderPropertyAnalysis(result);
    showToast("Property analysis generated");
  } catch (error) {
    $("#property-analysis-output").innerHTML = `<div class="empty-state">${escapeHTML(error.message)}</div>`;
  }
}

async function searchProperty(event) {
  event.preventDefault();
  if (!backendAvailable) {
    showToast("Property search requires the backend");
    return;
  }
  const query = $("#property-search-query").value.trim();
  if (!query) {
    showToast("Enter a property search topic");
    return;
  }
  $("#property-search-results").innerHTML = '<div class="ai-loading">Searching Westbridge property memory...</div>';
  try {
    const result = await apiRequest(`/api/property/search?q=${encodeURIComponent(query)}`);
    $("#property-search-results").innerHTML = `
      ${renderList("Matching opportunities", result.matchingOpportunities || [], (opportunity) => `
        <strong>${escapeHTML(opportunity.title)}</strong>
        <span>${escapeHTML(opportunity.stage)} · ${escapeHTML(opportunity.assetType || "Unknown")} · ${formatMoney(opportunity.forecastNetMonthlyCashflow || 0)} net/month</span>
        <small>${escapeHTML(opportunity.sourceReference || "")}</small>
      `)}
      ${renderList("Property memory", result.propertyMemory || [], (memory) => `
        <strong>${escapeHTML(memory.sourceReference || `${memory.sourceType}:${memory.sourceId}`)}</strong>
        <span>${escapeHTML(memory.summary || "")}</span>
        <small>${escapeHTML(memory.sensitivityCategory || "local_sensitive_business_data")}</small>
      `)}
      ${renderList("Semantic memory", result.semanticMemory || [], (memory) => `
        <strong>${escapeHTML(memory.sourceReference || `${memory.sourceType}:${memory.sourceId}`)}</strong>
        <span>${escapeHTML(memory.shortSummary || "")}</span>
        <small>${escapeHTML(memory.sensitivityLabel || "local_sensitive_business_data")}</small>
      `)}
      ${renderList("Source references", result.sourceReferences || [], (source) => `
        <strong>${escapeHTML(source.reference)}</strong>
        <span>${escapeHTML(source.label || "")}</span>
        <small>${escapeHTML(source.category || "")}</small>
      `)}
    `;
  } catch (error) {
    $("#property-search-results").innerHTML = `<div class="empty-state">${escapeHTML(error.message)}</div>`;
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
        <small>${escapeHTML(document.sourceReference || "")} · ${escapeHTML(document.path || document.webUrl || "")}</small>
      `)}
      ${renderList("Risks", result.relatedRisks || [], (risk) => `
        <strong>${escapeHTML(risk.title)}</strong>
        <span>${escapeHTML(risk.projectName || "")} · ${escapeHTML(risk.severity || risk.priority || "")}</span>
        <small>${escapeHTML(risk.sourceReference || "")}</small>
      `)}
      ${renderList("Actions", result.relatedActions || [], (action) => `
        <strong>${escapeHTML(action.title)}</strong>
        <span>${escapeHTML(action.projectName || "")} · ${escapeHTML(action.status || "")}</span>
        <small>${escapeHTML(action.sourceReference || "")} · ${escapeHTML(action.due || "")}</small>
      `)}
      ${renderList("Decisions", result.relatedDecisions || [], (decision) => `
        <strong>${escapeHTML(decision.title)}</strong>
        <span>${escapeHTML(decision.projectName || "")} · ${escapeHTML(decision.status || "")}</span>
        <small>${escapeHTML(decision.sourceReference || "")}</small>
      `)}
      ${renderList("Meetings", result.relatedMeetings || [], (meeting) => `
        <strong>${escapeHTML(meeting.title)}</strong>
        <span>${escapeHTML(meeting.projectName || "")} · ${escapeHTML(meeting.startDatetime || "")}</span>
        <small>${escapeHTML(meeting.sourceReference || "")}</small>
      `)}
      ${renderList("Emails", result.relatedEmails || [], (email) => `
        <strong>${escapeHTML(email.subject)}</strong>
        <span>${escapeHTML(email.projectName || "")} · ${escapeHTML(email.fromName || email.fromEmail || "")}</span>
        <small>${escapeHTML(email.sourceReference || "")}</small>
      `)}
      ${renderList("Digital construction tags", result.matchingTags || [], (tag) => `
        <strong>${escapeHTML(tag.domainLabel || tag.tag)}</strong>
        <span>${escapeHTML(tag.projectName || "")} · ${escapeHTML(tag.confidence || "")}</span>
        <small>${escapeHTML(tag.sourceReference || "")}</small>
      `)}
      ${renderList("Memory references", result.semanticMemory || result.memoryReferences || [], (memory) => `
        <strong>${escapeHTML(memory.sourceReference || `${memory.sourceType}:${memory.sourceId}`)}</strong>
        <span>${escapeHTML(memory.shortSummary || memory.summary || "")}</span>
        <small>${escapeHTML(memory.sensitivityLabel || "local_sensitive_business_data")}</small>
      `)}
      ${renderList("Source references", result.sourceReferences || [], (source) => `
        <strong>${escapeHTML(source.reference)}</strong>
        <span>${escapeHTML(source.label || "")}</span>
        <small>${escapeHTML(source.category || "")}</small>
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
      ${renderList("Key opportunities", analysis.keyOpportunities || [], (opportunity) => `
        <strong>${escapeHTML(opportunity.title)}</strong>
        <span>${escapeHTML(opportunity.assessment)}</span>
        <small>${escapeHTML(opportunity.sourceReference)}</small>
      `)}
      ${renderList("Confirmed facts", analysis.confirmedFacts || [], (fact) => `
        <strong>${escapeHTML(fact)}</strong>
      `)}
      ${renderList("Inferred information", analysis.inferredInformation || [], (item) => `
        <strong>${escapeHTML(item)}</strong>
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

async function refreshSarahDashboard() {
  if (!backendAvailable) {
    showToast("Sarah requires the backend");
    return;
  }
  state.sarah = await apiRequest("/api/sarah/dashboard");
  persist();
  renderSarah();
}

function renderSarahHealthReview(review) {
  return `
    <div class="ai-boundary">Sarah reviewed Alfred project records only. No Microsoft, SharePoint, OneDrive, calendar, email, file, app or finance system was modified.</div>
    <section class="ai-summary">
      <h3>${escapeHTML(review.projectName)} project health</h3>
      <p>Project score ${review.projectScore}/100 (${escapeHTML(review.projectHealthStatus)}). Information quality ${review.informationQualityScore}/100 (${escapeHTML(review.informationQualityStatus)}).</p>
    </section>
    ${renderList("BIM maturity assessment", [review.bimMaturityAssessment], (item) => `
      <strong>${escapeHTML(item.status)} · ${item.score}/100</strong>
      <span>${escapeHTML(item.explanation)}</span>
    `)}
    ${renderList("Digital readiness assessment", [review.digitalReadinessAssessment], (item) => `
      <strong>${escapeHTML(item.status)} · ${item.score}/100</strong>
      <span>${escapeHTML(item.explanation)}</span>
    `)}
    ${renderList("Recommendations", review.recommendations || [], (item) => `
      <strong>${escapeHTML(item.recommendation)}</strong>
      <small>${escapeHTML(item.confidence)} · ${escapeHTML(item.sourceReference)}</small>
    `)}
  `;
}

function renderSarahProjectAnalysis(analysis = {}, relatedMemory = []) {
  return `
    <div class="ai-boundary">Claude analysed Sarah's project context only. Sarah is advisory: no files, emails, calendars, SharePoint, OneDrive, Power Platform apps or finance records were changed.</div>
    <section class="ai-summary">
      <h3>Sarah executive summary</h3>
      <p>${escapeHTML(analysis.executiveSummary || "No Sarah analysis returned.")}</p>
      <small>Confidence: ${escapeHTML(analysis.confidenceLevel || "unknown")}</small>
    </section>
    ${renderList("BIM observations", analysis.bimObservations || [], (item) => `
      <strong>${escapeHTML(item.observation)}</strong>
      <span>${escapeHTML(item.implication)}</span>
      <small>${escapeHTML(item.confidence)} · ${escapeHTML(item.sourceReference)}</small>
    `)}
    ${renderList("Information management observations", analysis.informationManagementObservations || [], (item) => `
      <strong>${escapeHTML(item.observation)}</strong>
      <span>${escapeHTML(item.implication)}</span>
      <small>${escapeHTML(item.confidence)} · ${escapeHTML(item.sourceReference)}</small>
    `)}
    ${renderList("Digital construction opportunities", analysis.digitalConstructionOpportunities || [], (item) => `
      <strong>${escapeHTML(item.opportunity)}</strong>
      <span>${escapeHTML(item.businessImpact)}</span>
      <small>${escapeHTML(item.estimatedValue)} · ${escapeHTML(item.confidence)} · ${escapeHTML(item.sourceReference)}</small>
    `)}
    ${renderList("Key risks", analysis.keyRisks || [], (item) => `
      <strong>${escapeHTML(item.risk)}</strong>
      <span>${escapeHTML(item.impact)}</span>
      <small>${escapeHTML(item.severity)} · ${escapeHTML(item.sourceReference)}</small>
    `)}
    ${renderList("Missing information", analysis.missingInformation || [], (item) => `
      <strong>${escapeHTML(item.item)}</strong>
      <span>${escapeHTML(item.whyItMatters)}</span>
      <small>${escapeHTML(item.sourceReference)}</small>
    `)}
    ${renderList("Recommendations", analysis.recommendations || [], (item) => `
      <strong>${escapeHTML(item.recommendation)}</strong>
      <span>${escapeHTML(item.rationale)}</span>
      <small>${item.approvalRequiredBeforeAction ? "Approval required before external action" : "Recommendation only"} · ${escapeHTML(item.sourceReference)}</small>
    `)}
    ${renderList("Confirmed facts", analysis.confirmedFacts || [], (item) => `<strong>${escapeHTML(item)}</strong>`)}
    ${renderList("Assumptions", analysis.assumptions || [], (item) => `<strong>${escapeHTML(item)}</strong>`)}
    ${renderRelatedMemory(relatedMemory)}
  `;
}

async function askSarahProjectReview() {
  if (!backendAvailable) {
    showToast("Sarah project review requires the backend");
    return;
  }
  const projectId = Number($("#sarah-project-select").value || sarahCurrentProjectId);
  if (!projectId) {
    showToast("Select a project for Sarah");
    return;
  }
  sarahCurrentProjectId = projectId;
  $("#sarah-analysis-output").innerHTML = '<div class="ai-loading">Sarah is reviewing project intelligence...</div>';
  try {
    const review = await apiRequest("/api/ai/sarah/project-health-review", {
      method: "POST",
      body: JSON.stringify({ projectProfileId: projectId, userAction: "ui:sarah:project-health-review" }),
    });
    $("#sarah-analysis-output").innerHTML = renderSarahHealthReview(review);
    try {
      const result = await apiRequest("/api/ai/sarah/analyse-project", {
        method: "POST",
        body: JSON.stringify({ projectProfileId: projectId, userAction: "ui:sarah:review-project" }),
      });
      $("#sarah-analysis-output").innerHTML = renderSarahProjectAnalysis(result.analysis || {}, result.relatedMemory || []);
      showToast("Sarah project analysis generated");
    } catch (error) {
      $("#sarah-analysis-output").innerHTML += `<div class="empty-state">Claude Sarah analysis unavailable: ${escapeHTML(error.message)}. Deterministic Sarah health review shown above.</div>`;
      showToast("Sarah health review generated");
    }
    await refreshSarahDashboard();
  } catch (error) {
    $("#sarah-analysis-output").innerHTML = `<div class="empty-state">${escapeHTML(error.message)}</div>`;
    showToast(error.message);
  }
}

async function draftSarahOutline() {
  if (!backendAvailable) {
    showToast("Sarah draft support requires the backend");
    return;
  }
  const projectId = Number($("#sarah-project-select").value || sarahCurrentProjectId);
  const deliverableType = $("#sarah-deliverable-type").value;
  if (!projectId) {
    showToast("Select a project for Sarah");
    return;
  }
  try {
    const draft = await apiRequest("/api/ai/sarah/draft-deliverable", {
      method: "POST",
      body: JSON.stringify({ projectProfileId: projectId, deliverableType, userAction: "ui:sarah:draft-deliverable" }),
    });
    $("#sarah-analysis-output").innerHTML = `
      <div class="ai-boundary">Draft outline only. Sarah did not create, edit, publish or save a document.</div>
      <section class="ai-summary">
        <h3>${escapeHTML(draft.title)}</h3>
        <p>${escapeHTML(draft.status.replaceAll("_", " "))}</p>
      </section>
      ${renderList("Outline", draft.outline || [], (section) => `
        <strong>${escapeHTML(section.heading)}</strong>
        <span>${escapeHTML((section.prompts || []).join(" "))}</span>
      `)}
      ${renderList("Assumptions", draft.assumptions || [], (item) => `<strong>${escapeHTML(item)}</strong>`)}
    `;
    showToast("Sarah draft outline generated");
  } catch (error) {
    showToast(error.message);
  }
}

async function reviewSarahClient(event) {
  event.preventDefault();
  if (!backendAvailable) {
    showToast("Sarah client review requires the backend");
    return;
  }
  const client = $("#sarah-client-query").value.trim();
  if (!client) {
    showToast("Enter a client name");
    return;
  }
  $("#sarah-client-output").innerHTML = '<div class="ai-loading">Sarah is reviewing client context...</div>';
  try {
    const result = await apiRequest("/api/ai/sarah/client-review", {
      method: "POST",
      body: JSON.stringify({ client, userAction: "ui:sarah:client-review" }),
    });
    const analysis = result.analysis || {};
    $("#sarah-client-output").innerHTML = `
      <div class="ai-boundary">Sarah reviewed client context only. No sales actions or external updates were performed.</div>
      <section class="ai-summary">
        <h3>Client portfolio summary</h3>
        <p>${escapeHTML(analysis.projectPortfolioSummary || "No client review returned.")}</p>
        <small>Confidence: ${escapeHTML(analysis.confidenceLevel || "unknown")}</small>
      </section>
      ${renderList("Client risks", analysis.clientRisks || [], (risk) => `
        <strong>${escapeHTML(risk.risk)}</strong>
        <small>${escapeHTML(risk.severity)} · ${escapeHTML(risk.sourceReference)}</small>
      `)}
      ${renderList("Opportunities", analysis.opportunities || [], (opportunity) => `
        <strong>${escapeHTML(opportunity.opportunity)}</strong>
        <span>${escapeHTML(opportunity.businessImpact)}</span>
        <small>${escapeHTML(opportunity.estimatedValue)} · ${escapeHTML(opportunity.confidence)} · ${escapeHTML(opportunity.sourceReference)}</small>
      `)}
      ${renderList("Strategic recommendations", analysis.strategicRecommendations || [], (item) => `
        <strong>${escapeHTML(item.recommendation)}</strong>
        <span>${escapeHTML(item.why)}</span>
        <small>${escapeHTML(item.sourceReference)}</small>
      `)}
      ${renderList("Next discussion points", analysis.nextDiscussionPoints || [], (item) => `<strong>${escapeHTML(item)}</strong>`)}
      ${renderList("Assumptions", analysis.assumptions || [], (item) => `<strong>${escapeHTML(item)}</strong>`)}
    `;
    showToast("Sarah client review generated");
  } catch (error) {
    $("#sarah-client-output").innerHTML = `<div class="empty-state">${escapeHTML(error.message)}</div>`;
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

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",").pop() || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function setVoiceUiState(label, detail = "") {
  $("#voice-state-label").textContent = label;
  $("#voice-state-detail").textContent = detail;
  $("#voice-command-centre").dataset.voiceState = label.toLowerCase();
}

function speakWithBrowserFallback(text, rate = 1) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window) || !text) return resolve(false);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = Math.min(Math.max(Number(rate) || 1, 0.5), 1.5);
    utterance.onend = () => resolve(true);
    utterance.onerror = () => resolve(false);
    window.speechSynthesis.speak(utterance);
  });
}

async function playVoiceResult(result) {
  const settings = state.voice?.status?.settings || seedData.voice.status.settings;
  if (result.audio?.audioBase64 && result.audio?.mimeType) {
    setVoiceUiState("Speaking", "Playing Alfred through ElevenLabs.");
    const audio = new Audio(`data:${result.audio.mimeType};base64,${result.audio.audioBase64}`);
    await new Promise((resolve) => {
      audio.onended = resolve;
      audio.onerror = resolve;
      audio.play().catch(resolve);
    });
    setVoiceUiState("Ready", "Voice response complete.");
    return;
  }
  setVoiceUiState("Speaking", result.audio?.errorCode ? "Using local browser speech fallback." : "Speaking locally.");
  const spoke = await speakWithBrowserFallback(result.response, settings.speechSpeed);
  setVoiceUiState("Ready", spoke ? "Voice response complete." : "Text response ready. Browser speech is unavailable.");
}

async function submitVoiceCommand(payload) {
  if (!backendAvailable) {
    showToast("Voice requires the backend API");
    return;
  }
  setVoiceUiState("Thinking", "Routing your command through Alfred.");
  try {
    const result = await apiRequest("/api/voice/command", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.voice = {
      ...state.voice,
      lastResult: result,
      conversations: await apiRequest("/api/voice/conversations?limit=8").catch(() => state.voice?.conversations || []),
      status: await apiRequest("/api/voice/status").catch(() => state.voice?.status || seedData.voice.status),
    };
    renderVoiceCommandCentre();
    if (result.status === "error") {
      setVoiceUiState("Ready", result.message || "Voice command failed gracefully.");
      showToast(result.errorCode || "Voice command unavailable");
      return;
    }
    await playVoiceResult(result);
  } catch (error) {
    setVoiceUiState("Ready", error.message);
    showToast(error.message);
  }
}

async function submitVoiceTranscript(event) {
  event.preventDefault();
  const transcript = $("#voice-transcript-input").value.trim();
  if (!transcript) {
    showToast("Enter a voice command transcript");
    return;
  }
  $("#voice-transcript-input").value = "";
  await submitVoiceCommand({ transcript, userAction: "ui:voice:typed-command" });
}

async function startVoiceListening() {
  const settings = state.voice?.status?.settings || seedData.voice.status.settings;
  if (!backendAvailable) {
    showToast("Voice requires the backend API");
    return;
  }
  if (!settings.enabled) {
    showToast("Enable Voice first");
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    $("#microphone-status").textContent = "Unavailable";
    showToast("Microphone recording is unavailable in this browser");
    return;
  }
  try {
    voiceCurrentStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    $("#microphone-status").textContent = "Listening";
    voiceAudioChunks = [];
    voiceMediaRecorder = new MediaRecorder(voiceCurrentStream);
    voiceMediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) voiceAudioChunks.push(event.data);
    });
    voiceMediaRecorder.addEventListener("stop", async () => {
      const blob = new Blob(voiceAudioChunks, { type: voiceMediaRecorder.mimeType || "audio/webm" });
      voiceCurrentStream?.getTracks().forEach((track) => track.stop());
      voiceCurrentStream = null;
      voiceMediaRecorder = null;
      $("#voice-button").setAttribute("aria-pressed", "false");
      $("#microphone-status").textContent = "Captured";
      const audioBase64 = await blobToBase64(blob);
      await submitVoiceCommand({
        audioBase64,
        mimeType: blob.type || "audio/webm",
        userAction: "ui:voice:microphone-command",
      });
    });
    voiceMediaRecorder.start();
    $("#voice-button").setAttribute("aria-pressed", "true");
    setVoiceUiState("Listening", "Speak naturally. Press the microphone again to stop.");
  } catch (error) {
    $("#microphone-status").textContent = "Permission denied";
    showToast(error.message || "Microphone permission was not granted");
  }
}

function toggleVoiceListening() {
  if (voiceMediaRecorder?.state === "recording") {
    setVoiceUiState("Thinking", "Transcribing your command.");
    voiceMediaRecorder.stop();
    return;
  }
  startVoiceListening();
}

async function updateVoiceSettings() {
  if (!backendAvailable) return;
  const settings = {
    enabled: $("#voice-enabled-toggle").checked,
    transcriptLoggingEnabled: $("#voice-transcript-logging-toggle").checked,
    voiceSelection: $("#voice-selection").value.trim() || "alfred",
    speechSpeed: Number($("#voice-speech-speed").value || 1),
    transcriptRetentionDays: Number($("#voice-retention-days").value || 30),
  };
  $("#voice-speed-label").textContent = `${settings.speechSpeed.toFixed(2)}x`;
  try {
    const nextSettings = await apiRequest("/api/voice/settings", {
      method: "PATCH",
      body: JSON.stringify(settings),
    });
    state.voice.status = await apiRequest("/api/voice/status").catch(() => ({
      ...state.voice.status,
      settings: nextSettings,
    }));
    renderVoiceCommandCentre();
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

async function runVoiceDiagnostics() {
  if (!backendAvailable) {
    showToast("Voice setup check requires the backend");
    return;
  }
  $("#voice-setup-summary").textContent = "Checking local provider configuration...";
  try {
    const result = await apiRequest("/api/voice/diagnostics", {
      method: "POST",
      body: JSON.stringify({ userAction: "ui:voice:setup-diagnostics" }),
    });
    state.voice.status = result;
    renderVoiceCommandCentre();
    showToast(result.setup?.readyForMicrophone && result.setup?.readyForSpokenOutput
      ? "Voice providers configured"
      : "Voice setup check complete");
  } catch (error) {
    showToast(error.message);
  }
}

async function purgeOldVoiceTurns() {
  if (!backendAvailable) {
    showToast("Voice history purge requires the backend");
    return;
  }
  const days = Number($("#voice-retention-days").value || state.voice?.status?.settings?.transcriptRetentionDays || 30);
  try {
    const result = await apiRequest("/api/voice/conversations/purge", {
      method: "POST",
      body: JSON.stringify({ olderThanDays: days, userAction: "ui:voice:purge-old-turns" }),
    });
    state.voice.conversations = await apiRequest("/api/voice/conversations?limit=8").catch(() => state.voice?.conversations || []);
    renderVoiceCommandCentre();
    showToast(`Purged ${result.deletedCount || 0} old voice turn(s)`);
  } catch (error) {
    showToast(error.message);
  }
}

function runCommand(command) {
  const normalized = command.toLowerCase().trim();
  if (!normalized) return;

  if (normalized.includes("sarah")) {
    navigate("sarah");
    if (normalized.includes("review") && backendAvailable) askSarahProjectReview();
  } else if (normalized.includes("brief")) {
    generateBrief();
  } else if (normalized.includes("risk")) {
    navigate("companies");
    showToast(`${openItems().filter((item) => item.type === "risk").length} known risk(s) in the operating register`);
  } else if (normalized.includes("opportun")) {
    navigate("companies");
    showToast(`${openItems().filter((item) => item.type === "opportunity").length} active opportunity record(s)`);
  } else if (normalized.includes("monday") || normalized.includes("workload") || normalized.includes("blocked work") || normalized.includes("work queue") || normalized.includes("deliverable")) {
    navigate("monday");
    if (backendAvailable) refreshMondayOperating();
  } else if (normalized.includes("meeting") || normalized.includes("teams") || normalized.includes("transcript") || normalized.includes("follow up")) {
    navigate("meetings");
    if (backendAvailable && (normalized.includes("westminster") || normalized.includes("rbkc") || normalized.includes("islington") || normalized.includes("financial") || normalized.includes("risk"))) {
      $("#meeting-search-query").value = normalized.includes("westminster")
        ? "Westminster"
        : normalized.includes("rbkc")
          ? "RBKC"
          : normalized.includes("islington")
            ? "Islington"
            : normalized.includes("financial")
              ? "financial concerns"
              : "risk";
      $("#meeting-search-form").requestSubmit();
    }
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
  } else if (normalized.includes("property") || normalized.includes("westbridge") || normalized.includes("garage") || normalized.includes("cashflow")) {
    navigate("property");
    if (backendAvailable && (normalized.includes("westbridge") || normalized.includes("garage") || normalized.includes("cashflow"))) {
      $("#property-search-query").value = normalized.includes("garage") ? "garage block" : normalized.includes("cashflow") ? "cashflow" : "Westbridge";
      $("#property-search-form").requestSubmit();
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
$("#refresh-property").addEventListener("click", refreshPropertyDashboard);
$("#property-deal-form").addEventListener("submit", addPropertyOpportunity);
$("#analyse-property-opportunity").addEventListener("click", analyseSelectedPropertyOpportunity);
$("#property-search-form").addEventListener("submit", searchProperty);
$("#discover-projects").addEventListener("click", discoverProjectMetadata);
$("#project-search-form").addEventListener("submit", searchProjects);
$("#import-meetings").addEventListener("click", importMeetingMetadata);
$("#meeting-feedback-form").addEventListener("submit", submitMeetingFeedback);
$("#meeting-search-form").addEventListener("submit", searchMeetings);
$("#refresh-monday-os").addEventListener("click", refreshMondayOperating);
$("#sync-monday-followups").addEventListener("click", syncMondayFollowups);
$("#sarah-project-select").addEventListener("change", (event) => {
  sarahCurrentProjectId = event.target.value;
});
$("#sarah-review-project").addEventListener("click", askSarahProjectReview);
$("#sarah-draft-deliverable").addEventListener("click", draftSarahOutline);
$("#sarah-client-form").addEventListener("submit", reviewSarahClient);
$("#import-order-book").addEventListener("click", () => $("#order-book-file").click());
$("#order-book-file").addEventListener("change", importOrderBookFile);
$("#finance-scope").addEventListener("change", changeFinanceScope);
$("#refresh-monday-finance").addEventListener("click", refreshMondayFinance);
$("#generate-board-report").addEventListener("click", generateBoardReportView);
$("#ask-olivia").addEventListener("click", askOlivia);
$("#refresh-app-status").addEventListener("click", refreshAppStatus);
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
$("#voice-button").addEventListener("click", toggleVoiceListening);
$("#voice-transcript-form").addEventListener("submit", submitVoiceTranscript);
$("#voice-enabled-toggle").addEventListener("change", updateVoiceSettings);
$("#voice-transcript-logging-toggle").addEventListener("change", updateVoiceSettings);
$("#voice-selection").addEventListener("change", updateVoiceSettings);
$("#voice-retention-days").addEventListener("change", updateVoiceSettings);
$("#voice-run-diagnostics").addEventListener("click", runVoiceDiagnostics);
$("#voice-purge-history").addEventListener("click", purgeOldVoiceTurns);
$("#voice-speech-speed").addEventListener("input", () => {
  $("#voice-speed-label").textContent = `${Number($("#voice-speech-speed").value || 1).toFixed(2)}x`;
});
$("#voice-speech-speed").addEventListener("change", updateVoiceSettings);
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
  const propertyButton = event.target.closest(".property-select");
  if (propertyButton) {
    currentPropertyOpportunityId = propertyButton.dataset.propertyId;
    renderProperty();
  }
  const projectButton = event.target.closest(".project-select");
  if (projectButton) openProjectDetail(projectButton.dataset.projectId);
  const meetingButton = event.target.closest(".meeting-select");
  if (meetingButton) openMeetingDetail(meetingButton.dataset.meetingId);
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
  const voiceExample = event.target.closest(".voice-example");
  if (voiceExample) {
    $("#voice-transcript-input").value = voiceExample.dataset.voiceCommand || "";
    $("#voice-transcript-form").requestSubmit();
  }
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
registerServiceWorker();
loadDashboard().then(navigateFromUrl);

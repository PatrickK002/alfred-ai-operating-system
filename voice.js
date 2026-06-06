import {
  createVoiceSession,
  getDashboardData,
  getVoiceSettings,
  listApprovalRequests,
  listBriefings,
  listVoiceConversationTurns,
  purgeVoiceConversationTurns,
  recordVoiceAudit,
  recordVoiceConversationTurn,
  setVoiceSettings,
  updateVoiceSession,
} from "./db.js";
import { getFinancialDashboardData } from "./financial.js";
import { getProjectDashboard, searchProjectKnowledge } from "./project-intelligence.js";
import { getSarahDashboard, SARAH_READ_ONLY_BOUNDARY } from "./sarah.js";
import { getPropertyDashboardData, PROPERTY_READ_ONLY_BOUNDARY, searchPropertyKnowledge } from "./property.js";
import {
  AGENT_AVATAR_PROFILES,
  buildAvatarProviderState,
} from "./agent-avatars.js";

export const VOICE_READ_ONLY_BOUNDARY = {
  advisoryOnly: true,
  readOnly: true,
  voiceExecutionEnabled: false,
  externalWritesEnabled: false,
  approvalBypassAllowed: false,
  emailSendEnabled: false,
  calendarWriteEnabled: false,
  documentWriteEnabled: false,
  microsoftWriteEnabled: false,
  mondayWriteEnabled: false,
  financeWriteEnabled: false,
  propertyPurchaseEnabled: false,
  propertyOfferEnabled: false,
  legalInstructionEnabled: false,
};

export const VOICE_PERSONAS = AGENT_AVATAR_PROFILES.map((agent) => ({
  id: agent.id,
  name: agent.name,
  role: agent.title,
  status: agent.id === "alfred" ? "Primary voice" : agent.statusCategory === "active" ? "Routable advisory specialist" : "Placeholder",
  voicePersonaPlaceholder: agent.voicePersonaPlaceholder,
  avatarProvider: agent.avatarProvider,
  talkingAvatarPlaceholder: agent.talkingAvatarPlaceholder,
}));

export const SUPPORTED_VOICE_COMMANDS = [
  "Alfred, brief me",
  "What requires my attention today?",
  "What are my biggest risks?",
  "What meetings do I have today?",
  "What decisions are waiting for approval?",
  "Show Westminster status",
  "Ask Sarah to review Westminster",
  "Ask Olivia for revenue forecast",
  "Ask Westbridge for property pipeline",
  "What property opportunities need attention?",
  "What is projected property cashflow?",
];

const PROJECT_ALIASES = [
  ["Westminster", /\bwestminster\b/i],
  ["RBKC", /\brbkc\b|\broyal borough of kensington\b/i],
  ["Islington", /\bislington\b/i],
  ["KSPF", /\bkspf\b/i],
  ["Council Construction Assurance Platform", /\bcouncil construction assurance|assurance platform\b/i],
];

function compactText(value = "", limit = 280) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sourceReference(reference, label, category) {
  return { reference: String(reference), label: String(label || reference), category: String(category) };
}

function formatMoney(value = 0) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function detectProjectName(transcript = "") {
  const match = PROJECT_ALIASES.find(([, pattern]) => pattern.test(transcript));
  return match?.[0] || "";
}

export function detectVoiceIntent(transcript = "") {
  const text = String(transcript || "").toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  const projectName = detectProjectName(transcript);

  if (/sarah/.test(text)) {
    return {
      intent: "sarah_project_review",
      routedAgent: "sarah",
      linkedProject: projectName,
      confidence: projectName ? "high" : "medium",
    };
  }
  if (/olivia|finance|financial|revenue|forecast|order book|cashflow forecast/.test(text)) {
    return {
      intent: "olivia_revenue_forecast",
      routedAgent: "olivia",
      linkedBusiness: "group",
      confidence: "high",
    };
  }
  if (/westbridge|property|garage|cashflow|pipeline/.test(text) && !/project/.test(text)) {
    return {
      intent: /cashflow/.test(text) ? "westbridge_cashflow" : "westbridge_property_pipeline",
      routedAgent: "westbridge-property-director",
      linkedBusiness: "westbridge",
      confidence: "high",
    };
  }
  if (projectName || /project|status|documents|actions outstanding|key risks/.test(text)) {
    return {
      intent: "project_status",
      routedAgent: "alfred",
      linkedProject: projectName,
      confidence: projectName ? "high" : "medium",
    };
  }
  if (/brief me|briefing|executive brief/.test(text)) {
    return { intent: "executive_briefing", routedAgent: "alfred", confidence: "high" };
  }
  if (/attention|today|focus/.test(text)) {
    return { intent: "attention_today", routedAgent: "alfred", confidence: "medium" };
  }
  if (/risk|risks/.test(text)) {
    return { intent: "risk_overview", routedAgent: "alfred", confidence: "medium" };
  }
  if (/meeting|calendar|diary/.test(text)) {
    return { intent: "calendar_today", routedAgent: "alfred", confidence: "medium" };
  }
  if (/decision|approval|approve/.test(text)) {
    return { intent: "approval_decisions", routedAgent: "alfred", confidence: "medium" };
  }
  return { intent: "unknown", routedAgent: "alfred", confidence: "low" };
}

export class DeepgramSpeechClient {
  constructor({
    apiKey = process.env.DEEPGRAM_API_KEY || "",
    model = process.env.DEEPGRAM_MODEL || "nova-3",
    fetchImpl = globalThis.fetch,
    timeoutMs = 45_000,
  } = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  status() {
    return {
      provider: "deepgram",
      configured: Boolean(this.apiKey),
      apiKeyConfigured: Boolean(this.apiKey),
      model: this.model,
      storesRawAudio: false,
    };
  }

  async transcribe({ audioBase64, mimeType = "audio/webm" } = {}) {
    if (!this.apiKey) {
      const error = new Error("Deepgram is not configured. Set DEEPGRAM_API_KEY or type a transcript.");
      error.code = "DEEPGRAM_NOT_CONFIGURED";
      error.statusCode = 503;
      throw error;
    }
    if (!audioBase64) {
      const error = new Error("No audio was supplied for transcription.");
      error.code = "VOICE_AUDIO_REQUIRED";
      error.statusCode = 400;
      throw error;
    }
    const response = await this.fetch(`https://api.deepgram.com/v1/listen?model=${encodeURIComponent(this.model)}&smart_format=true`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${this.apiKey}`,
        "Content-Type": mimeType,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
      body: Buffer.from(audioBase64, "base64"),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.err_msg || `Deepgram request failed with status ${response.status}`);
      error.code = body.err_code || "DEEPGRAM_REQUEST_FAILED";
      error.statusCode = response.status >= 400 && response.status < 500 ? 502 : 503;
      throw error;
    }
    const transcript = body.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
    return {
      transcript,
      confidence: body.results?.channels?.[0]?.alternatives?.[0]?.confidence ?? null,
      model: body.metadata?.model_info?.[this.model]?.name || this.model,
      provider: "deepgram",
    };
  }
}

export class ElevenLabsSpeechClient {
  constructor({
    apiKey = process.env.ELEVENLABS_API_KEY || "",
    voiceId = process.env.ELEVENLABS_VOICE_ID || "",
    model = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
    fetchImpl = globalThis.fetch,
    timeoutMs = 45_000,
  } = {}) {
    this.apiKey = apiKey;
    this.voiceId = voiceId;
    this.model = model;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  status() {
    return {
      provider: "elevenlabs",
      configured: Boolean(this.apiKey && this.voiceId),
      apiKeyConfigured: Boolean(this.apiKey),
      model: this.model,
      voiceIdConfigured: Boolean(this.voiceId),
    };
  }

  async synthesize({ text, voiceId = this.voiceId, speed = 1 } = {}) {
    if (!this.apiKey || !voiceId) {
      const error = new Error("ElevenLabs is not configured. Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID.");
      error.code = "ELEVENLABS_NOT_CONFIGURED";
      error.statusCode = 503;
      throw error;
    }
    const response = await this.fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": this.apiKey,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({
        text: compactText(text, 4800),
        model_id: this.model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          speed,
        },
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const error = new Error(body.detail?.message || `ElevenLabs request failed with status ${response.status}`);
      error.code = body.detail?.status || "ELEVENLABS_REQUEST_FAILED";
      error.statusCode = response.status >= 400 && response.status < 500 ? 502 : 503;
      throw error;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      audioBase64: buffer.toString("base64"),
      mimeType: "audio/mpeg",
      model: this.model,
      provider: "elevenlabs",
    };
  }
}

function providerStatus(provider) {
  return provider?.status ? provider.status() : { configured: false };
}

function providerChecklistItem({ id, label, configured, connected = false, requiredEnv = [], missingEnv = [], nextStep }) {
  return {
    id,
    label,
    configured: Boolean(configured),
    connected: Boolean(connected),
    state: connected ? "Connected" : configured ? "Planned" : "Not connected",
    requiredEnv,
    missingEnv,
    nextStep,
  };
}

function voiceProviderSetupStatus(settings, deepgram = {}, elevenlabs = {}, avatarProvider = buildAvatarProviderState()) {
  const deepgramConfigured = Boolean(deepgram.configured);
  const elevenLabsKeyConfigured = Boolean(elevenlabs.apiKeyConfigured || elevenlabs.configured);
  const elevenLabsConfigured = Boolean(elevenlabs.configured);
  const checklist = [
    providerChecklistItem({
      id: "voice-enabled",
      label: "Voice interface enabled",
      configured: settings.enabled,
      connected: settings.enabled,
      requiredEnv: ["VOICE_ENABLED"],
      missingEnv: settings.enabled ? [] : ["VOICE_ENABLED"],
      nextStep: settings.enabled ? "Voice UI is enabled." : "Set VOICE_ENABLED=true or enable Voice in settings.",
    }),
    providerChecklistItem({
      id: "deepgram",
      label: "Deepgram speech-to-text",
      configured: deepgramConfigured,
      connected: deepgram.state === "Connected",
      requiredEnv: ["DEEPGRAM_API_KEY"],
      missingEnv: deepgramConfigured ? [] : ["DEEPGRAM_API_KEY"],
      nextStep: deepgramConfigured
        ? "Run a microphone command to verify speech-to-text."
        : "Add DEEPGRAM_API_KEY to .env for live microphone transcription.",
    }),
    providerChecklistItem({
      id: "elevenlabs",
      label: "ElevenLabs text-to-speech",
      configured: elevenLabsConfigured,
      connected: elevenlabs.state === "Connected",
      requiredEnv: ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"],
      missingEnv: [
        elevenLabsKeyConfigured ? "" : "ELEVENLABS_API_KEY",
        elevenlabs.voiceIdConfigured ? "" : "ELEVENLABS_VOICE_ID",
      ].filter(Boolean),
      nextStep: elevenLabsConfigured
        ? "Run a voice command to verify audio playback."
        : "Add ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID to .env for spoken output.",
    }),
    providerChecklistItem({
      id: "transcript-retention",
      label: "Transcript retention",
      configured: true,
      connected: true,
      requiredEnv: ["VOICE_TRANSCRIPT_LOGGING_ENABLED", "VOICE_TRANSCRIPT_RETENTION_DAYS"],
      missingEnv: [],
      nextStep: settings.transcriptLoggingEnabled
        ? `Transcripts are stored locally for manual review. Retention purge threshold is ${settings.transcriptRetentionDays} day(s).`
        : "Transcript content is not persisted while logging is disabled.",
    }),
    providerChecklistItem({
      id: "avatar-provider",
      label: "Talking avatar provider",
      configured: avatarProvider.status !== "Not connected" || avatarProvider.configured,
      connected: avatarProvider.connected,
      requiredEnv: ["AVATAR_PROVIDER"],
      missingEnv: [],
      nextStep: avatarProvider.configured
        ? "Avatar provider metadata is configured. Live calls remain disabled until a separate provider review."
        : "Provider-neutral avatar placeholder is active. Add AVATAR_PROVIDER only after a consent and security review.",
    }),
  ];
  return {
    readyForTypedCommands: Boolean(settings.enabled),
    readyForMicrophone: Boolean(settings.enabled && deepgramConfigured),
    readyForSpokenOutput: Boolean(settings.enabled && elevenLabsConfigured),
    readyForTalkingAvatar: Boolean(settings.enabled && avatarProvider.connected),
    rawAudioStored: false,
    rawVideoStored: false,
    secretsExposed: false,
    checklist,
    summary: checklist.every((item) => item.configured)
      ? "Voice providers are configured. Connections verify only after successful provider calls."
      : "Voice works with typed transcript fallback. Add missing provider keys for live speech input/output.",
  };
}

function summarizeBrief(brief = {}) {
  const summary = brief.summary || {};
  const priorities = asArray(brief.executivePriorities).slice(0, 3);
  const risks = asArray(brief.riskSignals || brief.risks).slice(0, 2);
  const decisions = asArray(brief.decisionPrompts || brief.decisions).slice(0, 2);
  const meetings = asArray(brief.meetings?.items).slice(0, 2);
  const parts = [
    `You have ${summary.totalOpen || 0} open operating records.`,
    priorities.length ? `Top priority: ${priorities[0].title}.` : "No ranked priority is currently above the line.",
    risks.length ? `Key risk: ${risks[0].title}.` : "",
    meetings.length ? `Calendar highlight: ${meetings[0].title}.` : brief.meetings?.message || "",
    decisions.length ? `Decision required: ${decisions[0].title}.` : "",
  ].filter(Boolean);
  return {
    spokenResponse: `Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}, Patrick. ${parts.join(" ")} No action has been taken.`,
    sourceReferences: [
      ...priorities.map((item, index) => sourceReference(`briefing:priority:${index + 1}`, item.title, item.category || "briefing")),
      ...risks.map((item) => sourceReference(item.sourceReference || `risk:${item.id || item.title}`, item.title, "risk")),
      ...decisions.map((item) => sourceReference(item.sourceReference || `decision:${item.id || item.title}`, item.title, "decision")),
    ],
  };
}

function summarizeSarah(sarah = {}, projectName = "") {
  const attention = asArray(sarah.projectsRequiringAttention);
  const risks = asArray(sarah.informationRisks);
  const opportunities = asArray(sarah.opportunities);
  const selected = projectName
    ? attention.find((project) => (project.profile?.projectName || project.projectName || "").toLowerCase().includes(projectName.toLowerCase()))
    : attention[0];
  const projectLabel = selected?.profile?.projectName || selected?.projectName || projectName || "the selected project";
  const risk = risks.find((item) => !projectName || String(item.projectName || "").toLowerCase().includes(projectName.toLowerCase())) || risks[0];
  const opportunity = opportunities.find((item) => !projectName || String(item.projectName || "").toLowerCase().includes(projectName.toLowerCase())) || opportunities[0];
  const assessment = selected?.healthScore?.explanation || risk?.detail || "Sarah has no critical exception recorded for this project.";
  return {
    spokenResponse: `Sarah's advisory view on ${projectLabel}: ${compactText(assessment, 180)} ${opportunity ? `Opportunity: ${opportunity.opportunity || opportunity.title}.` : ""} No file, email, calendar or SharePoint action has been taken.`,
    specialistContributions: [{
      agent: "Sarah",
      assessment: compactText(assessment, 240),
      sourceReference: selected?.sourceReference || risk?.sourceReference || "sarah:dashboard",
    }],
    sourceReferences: [sourceReference(selected?.sourceReference || risk?.sourceReference || "sarah:dashboard", projectLabel, "sarah")],
  };
}

function summarizeOlivia(financial = {}) {
  const metrics = financial.metrics || {};
  const risks = asArray(financial.risks);
  const opportunities = asArray(financial.opportunities);
  const spokenResponse = [
    `Olivia's read-only CFO view: secured revenue is ${formatMoney(metrics.securedRevenue)}, pipeline is ${formatMoney(metrics.pipelineRevenue)}, and weighted forecast revenue is ${formatMoney(metrics.weightedForecastRevenue)}.`,
    `Outstanding debtors are ${formatMoney(metrics.outstandingDebtors)} with overdue debtors at ${formatMoney(metrics.overdueDebtors)}.`,
    risks[0] ? `Financial risk: ${risks[0].title}.` : "",
    opportunities[0] ? `Opportunity: ${opportunities[0].title}.` : "",
    "No invoices, payments, Monday boards or accounting records were changed.",
  ].filter(Boolean).join(" ");
  return {
    spokenResponse,
    specialistContributions: [{
      agent: "Olivia",
      assessment: `Secured ${formatMoney(metrics.securedRevenue)}, weighted forecast ${formatMoney(metrics.weightedForecastRevenue)}, overdue debtors ${formatMoney(metrics.overdueDebtors)}.`,
      sourceReference: "financial:dashboard",
    }],
    sourceReferences: [sourceReference("financial:dashboard", "Olivia CFO dashboard", "finance")],
  };
}

function summarizeWestbridge(property = {}) {
  const metrics = property.metrics || {};
  const opportunities = asArray(property.opportunities);
  const dueDiligence = asArray(property.dueDiligence).filter((item) => item.status === "Red" || item.status === "Amber");
  const topOpportunity = opportunities.find((item) => item.stage !== "Rejected") || opportunities[0];
  const spokenResponse = [
    `Westbridge has ${metrics.totalProperties || 0} held properties and ${metrics.activeOpportunities || opportunities.length || 0} active acquisition opportunities.`,
    `Current monthly cashflow is ${formatMoney(metrics.monthlyCashflow)} against the ${formatMoney(metrics.targetMonthlyCashflow || 10000)} monthly target. Pipeline forecast cashflow is ${formatMoney(metrics.monthlyCashflowForecast)}.`,
    topOpportunity ? `Priority opportunity: ${topOpportunity.title} at stage ${topOpportunity.stage}.` : "No active opportunity is above the line yet.",
    dueDiligence[0] ? `Due diligence flag: ${dueDiligence[0].category} is ${dueDiligence[0].status}.` : "",
    "No offer, purchase, legal instruction, payment or external communication has been made.",
  ].filter(Boolean).join(" ");
  return {
    spokenResponse,
    specialistContributions: [{
      agent: "Westbridge Property Director",
      assessment: `Monthly cashflow ${formatMoney(metrics.monthlyCashflow)}, pipeline forecast ${formatMoney(metrics.monthlyCashflowForecast)}, active opportunities ${metrics.activeOpportunities || opportunities.length || 0}.`,
      sourceReference: "property:dashboard",
    }],
    sourceReferences: [sourceReference("property:dashboard", "Westbridge property dashboard", "property")],
  };
}

function summarizeProject(projectDashboard = {}, projectSearch = {}, projectName = "") {
  const projects = asArray(projectDashboard.projects);
  const match = projects.find((project) => {
    const name = project.profile?.projectName || "";
    return projectName && name.toLowerCase().includes(projectName.toLowerCase());
  }) || projects[0];
  const profile = match?.profile || {};
  const health = match?.healthScore || {};
  const risks = asArray(projectSearch.projectRisks || projectSearch.matchingRisks);
  const actions = asArray(projectSearch.projectActions || projectSearch.matchingActions);
  const documents = asArray(projectSearch.documents || projectSearch.matchingDocuments);
  const label = profile.projectName || projectName || "the project portfolio";
  const spokenResponse = [
    `${label} is currently ${health.status || profile.status || "recorded"} in Alfred project intelligence.`,
    health.explanation ? compactText(health.explanation, 180) : "",
    risks[0] ? `Key risk: ${risks[0].title}.` : "",
    actions[0] ? `Outstanding action: ${actions[0].title}.` : "",
    `Document metadata records found: ${documents.length || match?.documentCount || 0}.`,
    "This is based on structured records, Microsoft metadata and memory links only. No files or Microsoft records were changed.",
  ].filter(Boolean).join(" ");
  return {
    spokenResponse,
    sourceReferences: [sourceReference(`project:${profile.id || projectName || "dashboard"}`, label, "project")],
  };
}

function summarizeAttention(brief = {}, approvals = []) {
  const priorities = asArray(brief.executivePriorities).slice(0, 3);
  const approvalCount = approvals.filter((approval) => approval.status === "pending").length;
  const spokenResponse = priorities.length
    ? `Today I would protect time for ${priorities.map((item) => item.title).join(", ")}. You also have ${approvalCount} approval request${approvalCount === 1 ? "" : "s"} pending. No action has been taken.`
    : `No high-confidence priority is currently above the line. You have ${approvalCount} approval request${approvalCount === 1 ? "" : "s"} pending. No action has been taken.`;
  return {
    spokenResponse,
    sourceReferences: priorities.map((item, index) => sourceReference(`briefing:priority:${index + 1}`, item.title, item.category || "briefing")),
  };
}

function summarizeRisks(brief = {}) {
  const risks = asArray(brief.riskSignals || brief.risks).slice(0, 4);
  const spokenResponse = risks.length
    ? `Your biggest current risks are ${risks.map((risk) => risk.title).join(", ")}. I recommend reviewing the first one before opening new work. No mitigation has been executed.`
    : "No open risk records or email risk signals are currently above the line. No action has been taken.";
  return {
    spokenResponse,
    sourceReferences: risks.map((risk) => sourceReference(risk.sourceReference || `risk:${risk.id || risk.title}`, risk.title, "risk")),
  };
}

function summarizeMeetings(brief = {}) {
  const meetings = asArray(brief.meetings?.items).slice(0, 4);
  const spokenResponse = meetings.length
    ? `Calendar highlights: ${meetings.map((meeting) => meeting.title).join(", ")}. I have not changed your calendar.`
    : `${brief.meetings?.message || "No meetings are available from the current calendar context."} I have not changed your calendar.`;
  return {
    spokenResponse,
    sourceReferences: meetings.map((meeting) => sourceReference(`calendar:${meeting.id || meeting.title}`, meeting.title, "calendar")),
  };
}

function summarizeApprovals(approvals = []) {
  const pending = approvals.filter((approval) => approval.status === "pending").slice(0, 4);
  const spokenResponse = pending.length
    ? `You have ${pending.length} approval decision${pending.length === 1 ? "" : "s"} waiting: ${pending.map((approval) => approval.title).join(", ")}. Voice cannot approve, reject or execute them.`
    : "No approval decisions are currently waiting. Voice cannot approve, reject or execute requests.";
  return {
    spokenResponse,
    sourceReferences: pending.map((approval) => sourceReference(`approval:${approval.id}`, approval.title, "approval")),
  };
}

function summarizeExecutiveBrief(context = {}) {
  const base = summarizeBrief(context.brief);
  const olivia = summarizeOlivia(context.financial);
  const sarah = summarizeSarah(context.sarah);
  const westbridge = summarizeWestbridge(context.property);
  return {
    spokenResponse: [
      base.spokenResponse,
      `Olivia: ${compactText(olivia.specialistContributions[0]?.assessment, 160)}`,
      `Sarah: ${compactText(sarah.specialistContributions[0]?.assessment, 160)}`,
      `Westbridge: ${compactText(westbridge.specialistContributions[0]?.assessment, 160)}`,
      "This is advisory intelligence only.",
    ].filter(Boolean).join(" "),
    specialistContributions: [
      ...asArray(olivia.specialistContributions),
      ...asArray(sarah.specialistContributions),
      ...asArray(westbridge.specialistContributions),
    ],
    sourceReferences: [
      ...asArray(base.sourceReferences),
      ...asArray(olivia.sourceReferences),
      ...asArray(sarah.sourceReferences),
      ...asArray(westbridge.sourceReferences),
    ],
  };
}

function deterministicVoiceAnalysis(intent, context) {
  if (intent.intent === "sarah_project_review") return summarizeSarah(context.sarah, intent.linkedProject);
  if (intent.intent === "olivia_revenue_forecast") return summarizeOlivia(context.financial);
  if (intent.intent === "westbridge_property_pipeline" || intent.intent === "westbridge_cashflow") return summarizeWestbridge(context.property);
  if (intent.intent === "project_status") return summarizeProject(context.projectDashboard, context.projectSearch, intent.linkedProject);
  if (intent.intent === "attention_today") return summarizeAttention(context.brief, context.approvals);
  if (intent.intent === "risk_overview") return summarizeRisks(context.brief);
  if (intent.intent === "calendar_today") return summarizeMeetings(context.brief);
  if (intent.intent === "approval_decisions") return summarizeApprovals(context.approvals);
  if (intent.intent === "executive_briefing") return summarizeExecutiveBrief(context);
  return {
    spokenResponse: `I heard: ${compactText(context.transcript, 120)}. I can brief you, review projects, ask Sarah, ask Olivia, or review Westbridge property. No action has been taken.`,
    sourceReferences: [],
  };
}

function voiceAnalysisInput(intent, context, fallback) {
  return {
    transcript: context.transcript,
    detectedIntent: intent,
    executiveBrief: {
      summary: context.brief?.summary || {},
      topPriorities: asArray(context.brief?.executivePriorities).slice(0, 5).map((item) => ({
        title: item.title,
        detail: item.detail,
        category: item.category,
        score: item.score,
      })),
      risks: asArray(context.brief?.riskSignals || context.brief?.risks).slice(0, 5).map((item) => ({ title: item.title, detail: item.detail, priority: item.priority })),
      meetings: asArray(context.brief?.meetings?.items).slice(0, 4).map((item) => ({ title: item.title, detail: item.detail, preparation: item.preparation })),
      decisions: asArray(context.brief?.decisionPrompts || context.brief?.decisions).slice(0, 5).map((item) => ({ title: item.title, detail: item.detail, prompt: item.prompt })),
    },
    olivia: {
      metrics: context.financial?.metrics || {},
      risks: asArray(context.financial?.risks).slice(0, 4),
      opportunities: asArray(context.financial?.opportunities).slice(0, 4),
    },
    sarah: {
      metrics: context.sarah?.metrics || {},
      projectsRequiringAttention: asArray(context.sarah?.projectsRequiringAttention).slice(0, 4),
      informationRisks: asArray(context.sarah?.informationRisks).slice(0, 4),
      opportunities: asArray(context.sarah?.opportunities).slice(0, 4),
      boundary: SARAH_READ_ONLY_BOUNDARY,
    },
    westbridge: {
      metrics: context.property?.metrics || {},
      opportunities: asArray(context.property?.opportunities).slice(0, 5),
      dueDiligence: asArray(context.property?.dueDiligence).slice(0, 6),
      boundary: PROPERTY_READ_ONLY_BOUNDARY,
    },
    projects: {
      metrics: context.projectDashboard?.metrics || {},
      matchingRecords: context.projectSearch || {},
    },
    approvals: asArray(context.approvals).slice(0, 6),
    briefingHistory: asArray(context.briefingHistory).slice(0, 4),
    relevantMemory: asArray(context.memoryContext?.records).slice(0, 5),
    deterministicFallback: fallback,
    boundaries: VOICE_READ_ONLY_BOUNDARY,
  };
}

function normalizeClaudeVoiceResult(result, fallback) {
  const analysis = result?.analysis || {};
  return {
    spokenResponse: compactText(analysis.spokenResponse || fallback.spokenResponse, 1200),
    specialistContributions: asArray(analysis.specialistContributions || fallback.specialistContributions).slice(0, 4),
    sourceReferences: asArray(analysis.sourceRecordReferences || analysis.sourceReferences || fallback.sourceReferences).slice(0, 12),
    confidenceLevel: analysis.confidenceLevel || "medium",
    assumptions: asArray(analysis.assumptions).slice(0, 6),
    model: result?.model || "",
    usedClaude: Boolean(result),
  };
}

async function retrieveMemory(semanticMemory, query) {
  if (!semanticMemory?.retrieveContext) {
    return { records: [], semantic: false, indexingEnabled: false, voyageConfigured: false };
  }
  return semanticMemory.retrieveContext(query, { maxRecords: 5, maxTokens: 800 }).catch((error) => ({
    records: [],
    semantic: false,
    indexingEnabled: false,
    voyageConfigured: false,
    errorCode: error.code || "VOICE_MEMORY_RETRIEVAL_FAILED",
  }));
}

async function textFromAudio({ body, speechToText, onDeepgramConnected }) {
  if (body.transcript) return { transcript: String(body.transcript), transcription: null };
  const transcription = await speechToText.transcribe({
    audioBase64: body.audioBase64,
    mimeType: body.mimeType || "audio/webm",
  });
  onDeepgramConnected();
  return { transcript: transcription.transcript, transcription };
}

export function createVoiceCommandService({
  db,
  getExecutiveBrief,
  aiReasoning = null,
  semanticMemory = null,
  speechToText = new DeepgramSpeechClient(),
  textToSpeech = new ElevenLabsSpeechClient(),
  onDeepgramConnected = () => {},
  onElevenLabsConnected = () => {},
} = {}) {
  if (!db) throw new Error("Voice service requires a database");
  if (!getExecutiveBrief) throw new Error("Voice service requires getExecutiveBrief");

  function status() {
    const settings = getVoiceSettings(db);
    const deepgram = providerStatus(speechToText);
    const elevenlabs = providerStatus(textToSpeech);
    const avatarProvider = buildAvatarProviderState();
    const providers = {
      deepgram: {
        ...deepgram,
        state: deepgram.configured ? "Planned" : "Not connected",
      },
      elevenlabs: {
        ...elevenlabs,
        state: elevenlabs.configured ? "Planned" : "Not connected",
      },
      avatarProvider,
    };
    return {
      settings,
      personas: VOICE_PERSONAS,
      supportedCommands: SUPPORTED_VOICE_COMMANDS,
      providers,
      avatarProvider,
      setup: voiceProviderSetupStatus(settings, providers.deepgram, providers.elevenlabs, avatarProvider),
      retention: {
        transcriptLoggingEnabled: settings.transcriptLoggingEnabled,
        transcriptRetentionDays: settings.transcriptRetentionDays,
        rawAudioStored: false,
        localSensitiveBusinessData: true,
      },
      microphone: {
        required: true,
        rawAudioStored: false,
        browserPermissionRequired: true,
        mobileSafariNote: "Requires microphone permission and MediaRecorder support; typed transcript fallback remains available.",
      },
      boundary: VOICE_READ_ONLY_BOUNDARY,
    };
  }

  function diagnostics({ userAction = "voice:setup-diagnostics" } = {}) {
    const result = status();
    const audit = recordVoiceAudit(db, {
      eventType: "voice_setup_diagnostics",
      userAction,
      dataCategories: ["voice_provider_configuration", "voice_retention_settings"],
      model: "local-voice-diagnostics",
      status: "success",
      outputSaved: false,
      executionAttempted: false,
      metadata: {
        deepgramState: result.providers.deepgram.state,
        elevenlabsState: result.providers.elevenlabs.state,
        readyForMicrophone: result.setup.readyForMicrophone,
        readyForSpokenOutput: result.setup.readyForSpokenOutput,
        secretsExposed: false,
      },
    });
    return {
      ...result,
      audit,
      executionAttempted: false,
      externalCallsMade: false,
    };
  }

  function purgeConversations({ olderThanDays, userAction = "voice:purge-conversations" } = {}) {
    const settings = getVoiceSettings(db);
    const result = purgeVoiceConversationTurns(db, {
      olderThanDays: olderThanDays ?? settings.transcriptRetentionDays,
    });
    const audit = recordVoiceAudit(db, {
      eventType: "voice_retention_purge",
      userAction,
      dataCategories: ["voice_conversation_history"],
      model: "local-retention-policy",
      status: "success",
      outputSaved: false,
      executionAttempted: false,
      metadata: {
        deletedCount: result.deletedCount,
        olderThanDays: result.olderThanDays,
        rawAudioStored: false,
      },
    });
    return {
      ...result,
      audit,
      boundary: VOICE_READ_ONLY_BOUNDARY,
      executionAttempted: false,
    };
  }

  async function buildContext(transcript, intent) {
    const [
      brief,
      financial,
      sarah,
      property,
      projectDashboard,
    ] = await Promise.all([
      getExecutiveBrief(),
      Promise.resolve().then(() => getFinancialDashboardData(db)),
      Promise.resolve().then(() => getSarahDashboard(db)),
      Promise.resolve().then(() => getPropertyDashboardData(db)),
      Promise.resolve().then(() => getProjectDashboard(db)),
    ]);
    const projectSearch = intent.intent === "project_status" || intent.intent === "sarah_project_review"
      ? searchProjectKnowledge(db, intent.linkedProject || transcript)
      : {};
    const propertySearch = /westbridge|property/i.test(intent.intent)
      ? searchPropertyKnowledge(db, transcript)
      : {};
    const memoryContext = await retrieveMemory(semanticMemory, transcript);
    return {
      transcript,
      brief,
      financial,
      sarah,
      property,
      projectDashboard,
      projectSearch,
      propertySearch,
      approvals: listApprovalRequests(db),
      briefingHistory: listBriefings(db, 5),
      memoryContext,
      dashboard: getDashboardData(db),
    };
  }

  async function runClaude(intent, context, fallback, userAction) {
    if (!aiReasoning?.analyzeVoiceCommand) return null;
    const timeoutMs = Math.min(Math.max(Number(process.env.VOICE_AI_TIMEOUT_MS) || 12_000, 1_000), 30_000);
    const analysisPromise = aiReasoning.analyzeVoiceCommand(voiceAnalysisInput(intent, context, fallback), {
        userAction,
        dataCategories: [
          "voice_transcript",
          "executive_briefing",
          "olivia_financial_context",
          "sarah_project_context",
          "westbridge_property_context",
          "project_intelligence",
          "approval_queue",
          context.memoryContext?.records?.length ? "semantic_memory" : "",
        ],
      })
      .catch((error) => ({
        fallbackErrorCode: error.code || "VOICE_AI_ANALYSIS_FAILED",
        fallbackErrorMessage: error.message,
        model: aiReasoning.model || "",
      }));
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({
        fallbackErrorCode: "VOICE_AI_TIMEOUT",
        fallbackErrorMessage: `Voice analysis exceeded ${timeoutMs}ms and used deterministic fallback.`,
        model: aiReasoning.model || "",
      }), timeoutMs);
    });
    return Promise.race([analysisPromise, timeoutPromise]);
  }

  async function synthesize(settings, spokenResponse) {
    if (!settings.enabled) return { audioBase64: "", mimeType: "", status: "disabled", provider: "none" };
    try {
      const audio = await textToSpeech.synthesize({
        text: spokenResponse,
        voiceId: settings.voiceSelection === "alfred" ? undefined : settings.voiceSelection,
        speed: settings.speechSpeed,
      });
      onElevenLabsConnected();
      return { ...audio, status: "ready" };
    } catch (error) {
      return {
        audioBase64: "",
        mimeType: "",
        status: "text_only",
        provider: "browser-fallback",
        errorCode: error.code || "ELEVENLABS_SYNTHESIS_FAILED",
        message: error.message,
      };
    }
  }

  async function handleCommand(body = {}) {
    const settings = getVoiceSettings(db);
    const session = body.sessionId
      ? updateVoiceSession(db, Number(body.sessionId), { status: "thinking" }) || createVoiceSession(db, { status: "thinking" })
      : createVoiceSession(db, { status: "thinking", metadata: { source: body.audioBase64 ? "microphone" : "typed-transcript" } });
    const userAction = body.userAction || "voice:command";

    let transcript = "";
    let transcription = null;
    try {
      ({ transcript, transcription } = await textFromAudio({ body, speechToText, onDeepgramConnected }));
    } catch (error) {
      const audit = recordVoiceAudit(db, {
        eventType: "voice_command",
        userAction,
        sessionId: session.id,
        dataCategories: ["voice_audio"],
        model: providerStatus(speechToText).model || "deepgram",
        status: "error",
        errorCode: error.code || "VOICE_TRANSCRIPTION_FAILED",
        outputSaved: false,
        executionAttempted: false,
        metadata: { provider: "deepgram", rawAudioStored: false },
      });
      updateVoiceSession(db, session.id, { status: "error", completed: true, metadata: { errorCode: audit.errorCode } });
      return {
        session,
        status: "error",
        errorCode: audit.errorCode,
        message: error.message,
        transcript: "",
        boundary: VOICE_READ_ONLY_BOUNDARY,
        executionAttempted: false,
      };
    }

    const intent = detectVoiceIntent(transcript);
    const context = await buildContext(transcript, intent);
    const fallback = deterministicVoiceAnalysis(intent, context);
    const ai = await runClaude(intent, context, fallback, userAction);
    const aiFailed = ai?.fallbackErrorCode;
    const voiceAnalysis = aiFailed ? normalizeClaudeVoiceResult(null, fallback) : normalizeClaudeVoiceResult(ai, fallback);
    const audio = await synthesize(settings, voiceAnalysis.spokenResponse);
    const dataCategories = [
      "voice_transcript",
      intent.intent,
      "executive_briefing",
      intent.routedAgent === "sarah" ? "sarah_project_context" : "",
      intent.routedAgent === "olivia" ? "olivia_financial_context" : "",
      intent.routedAgent === "westbridge-property-director" ? "westbridge_property_context" : "",
      context.memoryContext?.records?.length ? "semantic_memory" : "",
    ].filter(Boolean);
    const audit = recordVoiceAudit(db, {
      eventType: "voice_command",
      userAction,
      sessionId: session.id,
      dataCategories,
      model: voiceAnalysis.model || ai?.model || "deterministic-voice-router",
      status: "success",
      errorCode: aiFailed || "",
      outputSaved: settings.transcriptLoggingEnabled,
      executionAttempted: false,
      metadata: {
        intent: intent.intent,
        routedAgent: intent.routedAgent,
        transcriptLogged: settings.transcriptLoggingEnabled,
        audioProviderStatus: audio.status,
        rawAudioStored: false,
        usedClaude: voiceAnalysis.usedClaude,
      },
    });
    const turn = recordVoiceConversationTurn(db, {
      sessionId: session.id,
      speaker: "Patrick",
      transcript,
      detectedIntent: intent.intent,
      response: voiceAnalysis.spokenResponse,
      linkedProject: intent.linkedProject,
      linkedBusiness: intent.linkedBusiness,
      linkedAgent: intent.routedAgent,
      auditReference: `voice_audit:${audit.id}`,
      transcriptLogged: settings.transcriptLoggingEnabled,
      sourceReferences: voiceAnalysis.sourceReferences,
      specialistContributions: voiceAnalysis.specialistContributions,
    });
    updateVoiceSession(db, session.id, {
      status: audio.audioBase64 ? "speaking" : "completed",
      completed: true,
      metadata: { intent: intent.intent, routedAgent: intent.routedAgent },
    });

    return {
      session: { ...session, status: "completed" },
      turn,
      status: "completed",
      transcript: settings.transcriptLoggingEnabled ? transcript : "",
      transcriptLogged: settings.transcriptLoggingEnabled,
      detectedIntent: intent,
      response: voiceAnalysis.spokenResponse,
      specialistContributions: voiceAnalysis.specialistContributions,
      sourceReferences: voiceAnalysis.sourceReferences,
      assumptions: [
        ...voiceAnalysis.assumptions,
        aiFailed ? `Claude voice analysis fallback used: ${aiFailed}.` : "",
        audio.errorCode ? `Voice audio fallback used: ${audio.errorCode}.` : "",
      ].filter(Boolean),
      confidenceLevel: voiceAnalysis.confidenceLevel,
      audio,
      transcription,
      audit,
      boundary: VOICE_READ_ONLY_BOUNDARY,
      executionAttempted: false,
      executedActions: [],
    };
  }

  return {
    status,
    createSession: (metadata = {}) => createVoiceSession(db, { status: "created", metadata }),
    listConversations: (limit = 20) => listVoiceConversationTurns(db, limit),
    getSettings: () => getVoiceSettings(db),
    setSettings: (settings) => setVoiceSettings(db, settings),
    diagnostics,
    purgeConversations,
    handleCommand,
  };
}

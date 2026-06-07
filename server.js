import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, relative, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import {
  RESOURCE_CONFIG,
  createApprovalRequest,
  createDatabase,
  createResource,
  deleteResource,
  deleteSemanticMemoryRecord,
  getApprovalRequest,
  getApprovalSummary,
  listAiAnalysisAudit,
  listVoiceAudit,
  getDashboardData,
  getBriefing,
  getMorningBrief,
  listApprovalRequests,
  listBriefings,
  listResource,
  reviewApprovalRequest,
  runApprovalPreflight,
  saveBriefing,
  saveBriefingFeedback,
  setSemanticIndexingEnabled,
  setIntegrationStatus,
  updateResource,
} from "./db.js";
import { buildExecutiveAnalysis } from "./briefing.js";
import { MICROSOFT_SCOPES, MicrosoftGraphClient } from "./microsoft.js";
import { AnthropicClient } from "./anthropic.js";
import { createAiReasoningService } from "./ai.js";
import { VoyageClient } from "./voyage.js";
import { createSemanticMemoryService } from "./semantic-memory.js";
import { buildHealthResponse, buildProductionPreflight, currentEnvironment, publicAppStatus } from "./app-metadata.js";
import {
  FINANCIAL_READ_ONLY_BOUNDARY,
  generateBoardReport,
  generateOliviaAnalysis,
  getBoardReport,
  getFinancialDashboardData,
  importOrderBookWorkbook,
  listBoardReports,
  listFinancialAudit,
  listFinancialImports,
  saveMondayFinancialSummaries,
} from "./financial.js";
import { MondayFinanceClient } from "./monday-finance.js";
import {
  PROJECT_READ_ONLY_BOUNDARY,
  buildProjectAnalysisInput,
  createProjectProfile,
  discoverMicrosoftProjectSignals,
  getProjectDashboard,
  getProjectDetail,
  importProjectDocuments,
  importProjectEmailSignals,
  importProjectMeetings,
  listDigitalConstructionDomains,
  listProjectAudit,
  listProjectProfiles,
  projectAttentionForBriefing,
  searchProjectKnowledge,
  updateProjectProfile,
} from "./project-intelligence.js";
import {
  SARAH_READ_ONLY_BOUNDARY,
  buildSarahClientReviewInput,
  buildSarahProjectAnalysisInput,
  draftSarahDeliverable,
  generateSarahProjectHealthReview,
  getSarahDashboard,
  listSarahAudit,
  recordSarahAudit,
  sarahBriefingForDaily,
} from "./sarah.js";
import {
  LIAM_READ_ONLY_BOUNDARY,
  buildLiamAnalysisInput,
  createPowerPlatformDecision,
  createPowerPlatformRisk,
  generateLiamAnalysis,
  getLiamDashboard,
  liamBriefingForDaily,
  listLiamAudit,
  listPowerPlatformDecisions,
  listPowerPlatformOpportunities,
  listPowerPlatformRisks,
  listPowerPlatformSolutions,
  searchLiamKnowledge,
} from "./liam.js";
import {
  PROPERTY_READ_ONLY_BOUNDARY,
  createPropertyOpportunity,
  getPropertyDashboardData,
  getPropertyOpportunity,
  listPropertyAnalyses,
  listPropertyAudit,
  listPropertyDueDiligence,
  listPropertyOpportunities,
  savePropertyAnalysis,
  searchPropertyKnowledge,
  updatePropertyOpportunity,
  upsertDueDiligenceItem,
  westbridgeBriefingForDaily,
} from "./property.js";
import { createVoiceCommandService } from "./voice.js";
import { authenticateHeaders } from "./authentication.js";
import {
  MEETING_READ_ONLY_BOUNDARY,
  createMeetingRecord,
  getMeetingDashboard,
  getMeetingDetail,
  importMeetingMetadata,
  listMeetingAudit,
  listMeetings,
  meetingBriefingForDaily,
  processMeetingTranscript,
  recordMeetingFeedback,
  searchMeetingKnowledge,
} from "./meeting-intelligence.js";
import {
  MONDAY_OPERATING_BOUNDARY,
  getMondayOperatingDashboard,
  listMondayAudit,
  listMondayOperatingCollection,
  mondayOperatingBriefForDaily,
  mondayOperatingCollection,
  searchMondayOperatingSystem,
  syncMeetingFollowupsToWorkItems,
  updateWorkItem,
} from "./monday-operating-system.js";
import {
  JAMES_READ_ONLY_BOUNDARY,
  buildJamesAnalysisInput,
  createProductDecision,
  createProductRisk,
  generateJamesAnalysis,
  getJamesDashboard,
  jamesBriefingForDaily,
  listJamesAudit,
  listProductDecisions,
  listProductOpportunities,
  listProductRisks,
  listProductVentures,
  searchJamesKnowledge,
} from "./james.js";
import { buildLiveBetaStatus, createSqliteBackup } from "./live-beta.js";

const ROOT_DIR = fileURLToPath(new URL(".", import.meta.url));
try {
  loadEnvFile(resolve(ROOT_DIR, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") console.warn(`Could not load .env: ${error.message}`);
}
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || (process.env.WEBSITE_SITE_NAME ? "0.0.0.0" : "127.0.0.1");
const SERVER_STARTED_AT = Date.now();
const db = createDatabase();
const microsoft = new MicrosoftGraphClient();
const anthropic = new AnthropicClient();
const voyage = new VoyageClient();
const mondayFinance = new MondayFinanceClient();
const aiReasoning = createAiReasoningService({
  db,
  client: anthropic,
  onConnected: () => setIntegrationStatus(db, "anthropic", "Connected"),
});
const semanticMemory = createSemanticMemoryService({
  db,
  client: voyage,
  onConnected: () => setIntegrationStatus(db, "voyage", "Connected"),
});
const voiceCommandCentre = createVoiceCommandService({
  db,
  getExecutiveBrief: () => generateExecutiveBrief({ save: false }),
  aiReasoning,
  semanticMemory,
  onDeepgramConnected: () => setIntegrationStatus(db, "deepgram", "Connected"),
  onElevenLabsConnected: () => setIntegrationStatus(db, "elevenlabs", "Connected"),
});

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function securityHeaders() {
  const production = currentEnvironment() === "production";
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "X-Frame-Options": "SAMEORIGIN",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=(self)",
    ...(production ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" } : {}),
  };
}

function sendJson(response, statusCode, body, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
    ...securityHeaders(),
  });
  response.end(JSON.stringify(body));
}

function sendAuthenticationFailure(response, auth) {
  const headers = auth.config?.provider === "basic-auth" && auth.statusCode === 401
    ? { "WWW-Authenticate": 'Basic realm="Alfred AI Operating System", charset="UTF-8"' }
    : {};
  return sendJson(response, auth.statusCode || 401, {
    error: auth.message || "Authentication required",
    authentication: {
      required: Boolean(auth.required),
      allowed: false,
      provider: auth.config?.provider || "not_configured",
      code: auth.code || "AUTHENTICATION_FAILED",
    },
  }, headers);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 15_000_000) {
      const error = new Error("Request body is too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function financialScopeFromSearch(searchParams) {
  return {
    scopeType: searchParams.get("scopeType") || "",
    scopeId: searchParams.get("scopeId") || "",
    businessEntityId: searchParams.get("businessEntityId") || "",
  };
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    return sendJson(response, 200, healthResponse());
  }
  if (request.method === "GET" && url.pathname === "/api/app/status") {
    return sendJson(response, 200, publicAppStatus());
  }
  if (request.method === "GET" && url.pathname === "/api/deployment/preflight") {
    return sendJson(response, 200, buildProductionPreflight());
  }
  if (request.method === "GET" && url.pathname === "/api/live-beta/status") {
    return sendJson(response, 200, await liveBetaStatus());
  }
  if (request.method === "POST" && url.pathname === "/api/live-beta/backups") {
    return sendJson(response, 201, {
      ...createSqliteBackup(db),
      status: await liveBetaStatus(),
    });
  }
  if (request.method === "GET" && url.pathname === "/api/dashboard") {
    syncAnthropicStatus();
    syncVoyageStatus();
    syncMondayFinanceStatus();
    syncVoiceStatus();
    return sendJson(response, 200, getDashboardData(db));
  }
  if (request.method === "GET" && url.pathname === "/api/morning-brief") {
    return sendJson(response, 200, await generateExecutiveBrief({ save: true }));
  }
  if (request.method === "GET" && url.pathname === "/api/briefings") {
    return sendJson(response, 200, listBriefings(db, url.searchParams.get("limit") || 20));
  }
  if (url.pathname === "/api/anthropic/status" && request.method === "GET") {
    return sendJson(response, 200, syncAnthropicStatus());
  }
  if (url.pathname === "/api/ai/audit" && request.method === "GET") {
    return sendJson(response, 200, listAiAnalysisAudit(db, url.searchParams.get("limit") || 50));
  }
  if (url.pathname === "/api/memory/status" && request.method === "GET") {
    return sendJson(response, 200, syncVoyageStatus());
  }
  if (url.pathname === "/api/memory/settings") {
    if (request.method === "GET") return sendJson(response, 200, syncVoyageStatus());
    if (request.method === "PATCH" || request.method === "POST") {
      const body = await readJson(request);
      if (typeof body.semanticIndexingEnabled !== "boolean") {
        return sendJson(response, 400, { error: "semanticIndexingEnabled must be true or false" });
      }
      setSemanticIndexingEnabled(db, body.semanticIndexingEnabled);
      return sendJson(response, 200, syncVoyageStatus());
    }
  }
  if (url.pathname === "/api/memory/search" && request.method === "GET") {
    const result = await semanticMemory.search(url.searchParams.get("q") || "", {
      limit: url.searchParams.get("limit") || 8,
    });
    return sendJson(response, 200, result);
  }
  if (url.pathname === "/api/voice/status" && request.method === "GET") {
    return sendJson(response, 200, syncVoiceStatus());
  }
  if (url.pathname === "/api/voice/settings") {
    if (request.method === "GET") return sendJson(response, 200, voiceCommandCentre.getSettings());
    if (request.method === "PATCH" || request.method === "POST") {
      return sendJson(response, 200, voiceCommandCentre.setSettings(await readJson(request)));
    }
  }
  if (url.pathname === "/api/voice/diagnostics" && request.method === "POST") {
    return sendJson(response, 200, voiceCommandCentre.diagnostics(await readJson(request)));
  }
  if (url.pathname === "/api/voice/sessions" && request.method === "POST") {
    return sendJson(response, 201, voiceCommandCentre.createSession(await readJson(request)));
  }
  if (url.pathname === "/api/voice/conversations/purge" && request.method === "POST") {
    return sendJson(response, 200, voiceCommandCentre.purgeConversations(await readJson(request)));
  }
  if (url.pathname === "/api/voice/conversations" && request.method === "GET") {
    return sendJson(response, 200, voiceCommandCentre.listConversations(url.searchParams.get("limit") || 20));
  }
  if (url.pathname === "/api/voice/audit" && request.method === "GET") {
    return sendJson(response, 200, listVoiceAudit(db, url.searchParams.get("limit") || 50));
  }
  if (url.pathname === "/api/voice/command" && request.method === "POST") {
    return sendJson(response, 200, await voiceCommandCentre.handleCommand(await readJson(request)));
  }
  if (url.pathname === "/api/meeting-intelligence/dashboard" && request.method === "GET") {
    return sendJson(response, 200, getMeetingDashboard(db));
  }
  if (url.pathname === "/api/meeting-intelligence/meetings") {
    if (request.method === "GET") return sendJson(response, 200, listMeetings(db, { limit: url.searchParams.get("limit") || 30 }));
    if (request.method === "POST") {
      const detail = createMeetingRecord(db, await readJson(request));
      await tryIndexSemanticMemory();
      return sendJson(response, 201, detail);
    }
  }
  if (url.pathname === "/api/meeting-intelligence/import-calendar" && request.method === "POST") {
    const body = await readJson(request);
    try {
      const meetings = await microsoft.listCalendar({
        start: body.start || undefined,
        end: body.end || undefined,
        limit: body.limit || 25,
      });
      const result = importMeetingMetadata(db, meetings, {
        sourceSystem: "microsoft_calendar",
        userAction: body.userAction || "api:meeting-intelligence:import-calendar",
      });
      await tryIndexSemanticMemory();
      return sendJson(response, 200, result);
    } catch (error) {
      return sendJson(response, error.statusCode === 401 ? 200 : error.statusCode || 500, {
        readOnly: true,
        meetingsRead: 0,
        meetingsStored: 0,
        transcriptContentRead: false,
        message: error.statusCode === 401
          ? "Microsoft Calendar is not connected. Meeting Intelligence can still use existing Alfred meeting records."
          : error.message,
        boundary: MEETING_READ_ONLY_BOUNDARY,
      });
    }
  }
  if (url.pathname === "/api/meeting-intelligence/search" && request.method === "GET") {
    const result = searchMeetingKnowledge(db, url.searchParams.get("q") || "");
    const memory = await semanticMemory.search(url.searchParams.get("q") || "", {
      limit: url.searchParams.get("limit") || 8,
    }).catch(() => null);
    return sendJson(response, 200, {
      ...result,
      semanticMemory: memory?.results || [],
      boundary: MEETING_READ_ONLY_BOUNDARY,
    });
  }
  if (url.pathname === "/api/meeting-intelligence/audit" && request.method === "GET") {
    return sendJson(response, 200, listMeetingAudit(db, url.searchParams.get("limit") || 50));
  }
  const meetingDetailMatch = url.pathname.match(/^\/api\/meeting-intelligence\/meetings\/(\d+)(?:\/(transcript|feedback))?$/);
  if (meetingDetailMatch) {
    const meetingId = Number(meetingDetailMatch[1]);
    const action = meetingDetailMatch[2];
    if (request.method === "GET" && !action) {
      const detail = getMeetingDetail(db, meetingId);
      return detail ? sendJson(response, 200, detail) : sendJson(response, 404, { error: "Meeting not found" });
    }
    if (request.method === "POST" && action === "transcript") {
      const detail = processMeetingTranscript(db, meetingId, {
        ...(await readJson(request)),
        userAction: "api:meeting-intelligence:process-transcript",
      });
      await tryIndexSemanticMemory();
      return sendJson(response, 200, detail);
    }
    if (request.method === "POST" && action === "feedback") {
      const detail = recordMeetingFeedback(db, {
        ...(await readJson(request)),
        meetingId,
        userAction: "api:meeting-intelligence:feedback",
      });
      await tryIndexSemanticMemory();
      return sendJson(response, 201, detail);
    }
  }
  if (url.pathname === "/api/monday-os/dashboard" && request.method === "GET") {
    return sendJson(response, 200, getMondayOperatingDashboard(db));
  }
  if (url.pathname === "/api/monday-os/search" && request.method === "GET") {
    const result = searchMondayOperatingSystem(db, url.searchParams.get("q") || "");
    const memory = await semanticMemory.search(url.searchParams.get("q") || "", {
      limit: url.searchParams.get("limit") || 8,
    }).catch(() => null);
    return sendJson(response, 200, {
      ...result,
      semanticMemory: memory?.results || [],
      boundary: MONDAY_OPERATING_BOUNDARY,
    });
  }
  if (url.pathname === "/api/monday-os/sync-meeting-followups" && request.method === "POST") {
    const result = syncMeetingFollowupsToWorkItems(db);
    await tryIndexSemanticMemory();
    return sendJson(response, 200, result);
  }
  if (url.pathname === "/api/monday-os/briefing" && request.method === "GET") {
    return sendJson(response, 200, mondayOperatingBriefForDaily(db));
  }
  if (url.pathname === "/api/monday-os/audit" && request.method === "GET") {
    return sendJson(response, 200, listMondayAudit(db, url.searchParams.get("limit") || 50));
  }
  const mondayCollectionMatch = url.pathname.match(/^\/api\/monday-os\/(work-items|deliverables|risks|opportunities|decisions|feedback|board-mappings|sync-status)$/);
  if (mondayCollectionMatch) {
    const collection = mondayCollectionMatch[1];
    if (request.method === "GET") {
      return sendJson(response, 200, listMondayOperatingCollection(db, collection, url.searchParams.get("limit") || 50));
    }
    if (request.method === "POST" && !["board-mappings", "sync-status"].includes(collection)) {
      const record = mondayOperatingCollection(db, collection, await readJson(request));
      await tryIndexSemanticMemory();
      return sendJson(response, 201, { ...record, boundary: MONDAY_OPERATING_BOUNDARY });
    }
  }
  const mondayWorkItemMatch = url.pathname.match(/^\/api\/monday-os\/work-items\/(\d+)$/);
  if (mondayWorkItemMatch) {
    if (request.method === "PATCH" || request.method === "PUT") {
      const record = updateWorkItem(db, Number(mondayWorkItemMatch[1]), await readJson(request));
      await tryIndexSemanticMemory();
      return sendJson(response, 200, { ...record, boundary: MONDAY_OPERATING_BOUNDARY });
    }
  }
  if (url.pathname === "/api/liam/dashboard" && request.method === "GET") {
    return sendJson(response, 200, getLiamDashboard(db));
  }
  if (url.pathname === "/api/liam/search" && request.method === "GET") {
    const query = url.searchParams.get("q") || "";
    const result = searchLiamKnowledge(db, query);
    const memory = await semanticMemory.search(query, {
      limit: url.searchParams.get("limit") || 8,
    }).catch(() => null);
    return sendJson(response, 200, {
      ...result,
      semanticMemory: memory?.results || [],
      boundary: LIAM_READ_ONLY_BOUNDARY,
    });
  }
  if (url.pathname === "/api/liam/audit" && request.method === "GET") {
    return sendJson(response, 200, listLiamAudit(db, url.searchParams.get("limit") || 50));
  }
  if (url.pathname === "/api/liam/solutions" && request.method === "GET") {
    return sendJson(response, 200, listPowerPlatformSolutions(db));
  }
  if (url.pathname === "/api/liam/risks") {
    if (request.method === "GET") return sendJson(response, 200, listPowerPlatformRisks(db));
    if (request.method === "POST") {
      const risk = createPowerPlatformRisk(db, await readJson(request));
      await tryIndexSemanticMemory();
      return sendJson(response, 201, { ...risk, boundary: LIAM_READ_ONLY_BOUNDARY });
    }
  }
  if (url.pathname === "/api/liam/opportunities" && request.method === "GET") {
    return sendJson(response, 200, listPowerPlatformOpportunities(db));
  }
  if (url.pathname === "/api/liam/decisions") {
    if (request.method === "GET") return sendJson(response, 200, listPowerPlatformDecisions(db));
    if (request.method === "POST") {
      const decision = createPowerPlatformDecision(db, await readJson(request));
      await tryIndexSemanticMemory();
      return sendJson(response, 201, { ...decision, boundary: LIAM_READ_ONLY_BOUNDARY });
    }
  }
  if (url.pathname === "/api/ai/liam/analyse-power-platform" && request.method === "POST") {
    const body = await readJson(request);
    const memoryContext = await semanticMemory.retrieveContext([
      "Liam Power Platform review",
      "Power Apps Dataverse Power Automate Power BI SharePoint low-code governance",
      body.context || "",
    ].join(" "), {
      maxRecords: 8,
      maxTokens: 1200,
    }).catch(() => ({ records: [], sourceRecordReferences: [], semantic: false }));
    const input = buildLiamAnalysisInput(db, {
      retrievedMemoryContext: {
        ...memoryContext,
        records: (memoryContext.records || []).map(memoryRecordForClaude),
      },
    });
    const result = generateLiamAnalysis(db, {
      userAction: body.userAction || "liam:analyse-power-platform",
    });
    await tryIndexSemanticMemory();
    return sendJson(response, 200, {
      ...result,
      inputSummary: {
        solutions: input.solutions.length,
        risks: input.risks.length,
        opportunities: input.opportunities.length,
        decisions: input.decisions.length,
        memoryRecords: input.relevantMemory.length,
      },
      relatedMemory: input.relevantMemory,
      memoryContext: memoryContextSummary({ ...memoryContext, records: memoryContext.records || [] }),
      boundary: LIAM_READ_ONLY_BOUNDARY,
    });
  }
  if (url.pathname === "/api/james/dashboard" && request.method === "GET") {
    return sendJson(response, 200, getJamesDashboard(db));
  }
  if (url.pathname === "/api/james/search" && request.method === "GET") {
    const query = url.searchParams.get("q") || "";
    const result = searchJamesKnowledge(db, query);
    const memory = await semanticMemory.search(query, {
      boundary: JAMES_READ_ONLY_BOUNDARY,
    });
  }
  if (url.pathname === "/api/james/audit" && request.method === "GET") {
    return sendJson(response, 200, listJamesAudit(db, url.searchParams.get("limit") || 50));
  }
  if (url.pathname === "/api/james/products" && request.method === "GET") {
    return sendJson(response, 200, listProductVentures(db));
  }
  if (url.pathname === "/api/james/risks") {
    if (request.method === "GET") return sendJson(response, 200, listProductRisks(db));
    if (request.method === "POST") {
      const record = createProductRisk(db, await readJson(request));
      await tryIndexSemanticMemory();
      return sendJson(response, 201, { ...record, boundary: JAMES_READ_ONLY_BOUNDARY });
    }
  }
  if (url.pathname === "/api/james/opportunities" && request.method === "GET") {
    return sendJson(response, 200, listProductOpportunities(db));
  }
  if (url.pathname === "/api/james/decisions") {
    if (request.method === "GET") return sendJson(response, 200, listProductDecisions(db));
    if (request.method === "POST") {
      const record = createProductDecision(db, await readJson(request));
      await tryIndexSemanticMemory();
      return sendJson(response, 201, { ...record, boundary: JAMES_READ_ONLY_BOUNDARY });
    }
  }
  if (url.pathname === "/api/ai/james/analyse-product" && request.method === "POST") {
    const body = await readJson(request);
    const query = [
      "James Product CEO",
      body.query || "",
      body.productName || "",
      body.productVentureId || "",
    ].join(" ");
    const retrievedMemoryContext = await semanticMemory.retrieveContext(query, {
      maxRecords: 6,
      maxTokens: 1200,
    }).catch(() => null);
    const input = buildJamesAnalysisInput(db, {
      productVentureId: body.productVentureId,
      retrievedMemoryContext,
    });
    const analysis = generateJamesAnalysis(db, {
      productVentureId: body.productVentureId,
      userAction: body.userAction || "api:james:analyse-product",
    });
    await tryIndexSemanticMemory();
    return sendJson(response, 200, {
      analysis,
      input,
      relatedMemory: retrievedMemoryContext?.records || [],
      memoryContext: retrievedMemoryContext ? memoryContextSummary(retrievedMemoryContext) : null,
      boundary: JAMES_READ_ONLY_BOUNDARY,
    });
  }
  if (url.pathname === "/api/projects/search" && request.method === "GET") {
    const result = searchProjectKnowledge(db, url.searchParams.get("q") || "");
    const memory = await semanticMemory.search(url.searchParams.get("q") || "", {
      limit: url.searchParams.get("limit") || 8,
    }).catch(() => null);
    return sendJson(response, 200, {
      ...result,
      semanticMemory: memory?.results || [],
    });
  }
  if (url.pathname === "/api/property/dashboard" && request.method === "GET") {
    return sendJson(response, 200, getPropertyDashboardData(db));
  }
  if (url.pathname === "/api/property/briefing" && request.method === "GET") {
    return sendJson(response, 200, westbridgeBriefingForDaily(db));
  }
  if (url.pathname === "/api/property/search" && request.method === "GET") {
    const result = searchPropertyKnowledge(db, url.searchParams.get("q") || "");
    const memory = await semanticMemory.search(url.searchParams.get("q") || "", {
      limit: url.searchParams.get("limit") || 8,
    }).catch(() => null);
    return sendJson(response, 200, {
      ...result,
      semanticMemory: memory?.results || [],
    });
  }
  if (url.pathname === "/api/property/opportunities") {
    if (request.method === "GET") return sendJson(response, 200, listPropertyOpportunities(db));
    if (request.method === "POST") {
      const opportunity = createPropertyOpportunity(db, await readJson(request));
      await tryIndexSemanticMemory();
      return sendJson(response, 201, { ...opportunity, boundary: PROPERTY_READ_ONLY_BOUNDARY });
    }
  }
  const propertyOpportunityMatch = url.pathname.match(/^\/api\/property\/opportunities\/(\d+)$/);
  if (propertyOpportunityMatch) {
    const opportunityId = Number(propertyOpportunityMatch[1]);
    if (request.method === "GET") {
      const opportunity = getPropertyOpportunity(db, opportunityId);
      return opportunity
        ? sendJson(response, 200, {
            opportunity,
            analyses: listPropertyAnalyses(db, opportunityId),
            dueDiligence: listPropertyDueDiligence(db, opportunityId),
            boundary: PROPERTY_READ_ONLY_BOUNDARY,
          })
        : sendJson(response, 404, { error: "Property opportunity not found" });
    }
    if (request.method === "PATCH" || request.method === "PUT") {
      const opportunity = updatePropertyOpportunity(db, opportunityId, await readJson(request));
      await tryIndexSemanticMemory();
      return sendJson(response, 200, { ...opportunity, boundary: PROPERTY_READ_ONLY_BOUNDARY });
    }
  }
  const propertyAnalysisMatch = url.pathname.match(/^\/api\/property\/opportunities\/(\d+)\/analyse$/);
  if (propertyAnalysisMatch && request.method === "POST") {
    const result = savePropertyAnalysis(db, Number(propertyAnalysisMatch[1]), await readJson(request), {
      userAction: "api:property:analyse-deal",
    });
    await tryIndexSemanticMemory();
    return sendJson(response, 200, result);
  }
  const propertyDueDiligenceMatch = url.pathname.match(/^\/api\/property\/opportunities\/(\d+)\/due-diligence$/);
  if (propertyDueDiligenceMatch) {
    const opportunityId = Number(propertyDueDiligenceMatch[1]);
    if (request.method === "GET") return sendJson(response, 200, listPropertyDueDiligence(db, opportunityId));
    if (request.method === "POST" || request.method === "PATCH" || request.method === "PUT") {
      const item = upsertDueDiligenceItem(db, opportunityId, await readJson(request));
      await tryIndexSemanticMemory();
      return sendJson(response, 200, { ...item, boundary: PROPERTY_READ_ONLY_BOUNDARY });
    }
  }
  if (url.pathname === "/api/property/audit" && request.method === "GET") {
    return sendJson(response, 200, listPropertyAudit(db, url.searchParams.get("limit") || 50));
  }
  if (url.pathname === "/api/project-intelligence/dashboard" && request.method === "GET") {
    return sendJson(response, 200, getProjectDashboard(db));
  }
  if (url.pathname === "/api/project-intelligence/domains" && request.method === "GET") {
    return sendJson(response, 200, {
      domains: listDigitalConstructionDomains(db),
      sarahStatus: "Placeholder only. No Sarah runtime, autonomous behaviour or external writes exist.",
      boundary: PROJECT_READ_ONLY_BOUNDARY,
    });
  }
  if (url.pathname === "/api/project-intelligence/projects") {
    if (request.method === "GET") return sendJson(response, 200, listProjectProfiles(db));
    if (request.method === "POST") {
      const profile = createProjectProfile(db, await readJson(request));
      await tryIndexSemanticMemory();
      return sendJson(response, 201, profile);
    }
  }
  const projectDetailMatch = url.pathname.match(/^\/api\/project-intelligence\/projects\/(\d+)$/);
  if (projectDetailMatch) {
    const projectId = Number(projectDetailMatch[1]);
    if (request.method === "GET") {
      const detail = getProjectDetail(db, projectId);
      return detail ? sendJson(response, 200, detail) : sendJson(response, 404, { error: "Project profile not found" });
    }
    if (request.method === "PATCH" || request.method === "PUT") {
      const profile = updateProjectProfile(db, projectId, await readJson(request));
      await tryIndexSemanticMemory();
      return sendJson(response, 200, profile);
    }
  }
  const projectImportMatch = url.pathname.match(/^\/api\/project-intelligence\/projects\/(\d+)\/(documents|emails|meetings)$/);
  if (projectImportMatch && request.method === "POST") {
    const projectId = Number(projectImportMatch[1]);
    const kind = projectImportMatch[2];
    const body = await readJson(request);
    const result = kind === "documents"
      ? importProjectDocuments(db, projectId, body.files || body.documents || [])
      : kind === "emails"
        ? importProjectEmailSignals(db, projectId, body.emails || body.messages || [])
        : importProjectMeetings(db, projectId, body.meetings || []);
    await tryIndexSemanticMemory();
    return sendJson(response, 201, { ...result, boundary: PROJECT_READ_ONLY_BOUNDARY });
  }
  if (url.pathname === "/api/project-intelligence/discover-microsoft" && request.method === "POST") {
    const result = await discoverMicrosoftProjectSignals(db, microsoft, await readJson(request));
    await tryIndexSemanticMemory();
    return sendJson(response, 200, { ...result, boundary: PROJECT_READ_ONLY_BOUNDARY });
  }
  if (url.pathname === "/api/project-intelligence/audit" && request.method === "GET") {
    return sendJson(response, 200, listProjectAudit(db, url.searchParams.get("limit") || 50));
  }
  if (url.pathname === "/api/sarah/dashboard" && request.method === "GET") {
    return sendJson(response, 200, getSarahDashboard(db));
  }
  if (url.pathname === "/api/sarah/audit" && request.method === "GET") {
    return sendJson(response, 200, listSarahAudit(db, url.searchParams.get("limit") || 50));
  }
  if (url.pathname === "/api/ai/sarah/project-health-review" && request.method === "POST") {
    const body = await readJson(request);
    if (!body.projectProfileId) return sendJson(response, 400, { error: "projectProfileId is required" });
    return sendJson(response, 200, generateSarahProjectHealthReview(db, Number(body.projectProfileId), {
      userAction: body.userAction || "sarah:project-health-review",
    }));
  }
  if (url.pathname === "/api/ai/sarah/draft-deliverable" && request.method === "POST") {
    const body = await readJson(request);
    if (!body.projectProfileId) return sendJson(response, 400, { error: "projectProfileId is required" });
    return sendJson(response, 200, draftSarahDeliverable(db, {
      projectProfileId: Number(body.projectProfileId),
      deliverableType: body.deliverableType,
      userAction: body.userAction || "sarah:draft-deliverable",
    }));
  }
  if (url.pathname === "/api/ai/sarah/analyse-project" && request.method === "POST") {
    const body = await readJson(request);
    if (!body.projectProfileId) return sendJson(response, 400, { error: "projectProfileId is required" });
    const detail = getProjectDetail(db, Number(body.projectProfileId), { calculateHealth: false });
    if (!detail) return sendJson(response, 404, { error: "Project profile not found" });
    const memoryContext = await semanticMemory.retrieveContext(memoryQueryForSarahProject(detail), {
      maxRecords: 8,
      maxTokens: 1400,
    });
    const retrievedMemoryContext = {
      ...memoryContext,
      records: memoryContext.records.map(memoryRecordForClaude),
    };
    const input = buildSarahProjectAnalysisInput(db, Number(body.projectProfileId), { retrievedMemoryContext });
    try {
      const result = await aiReasoning.analyzeSarahProject(input, {
        userAction: body.userAction || "sarah:analyse-project",
        dataCategories: compactCategories([
          "project_profile",
          "project_health",
          "information_quality",
          input.linkedRisks.length ? "project_risks" : "",
          input.linkedActions.length ? "project_actions" : "",
          input.linkedDecisions.length ? "project_decisions" : "",
          input.linkedDocumentMetadata.length ? "project_document_metadata" : "",
          input.linkedMeetings.length ? "project_meetings" : "",
          input.linkedEmailSignals.length ? "project_email_signals" : "",
          input.projectTags.length ? "project_tags" : "",
          input.sarahOpportunities.length ? "sarah_opportunities" : "",
          input.relevantMemory.length ? "semantic_memory" : "",
          input.oliviaFinancialContext?.linkedOrderBookEntries ? "olivia_financial_context" : "",
        ]),
      });
      recordSarahAudit(db, {
        eventType: "project_analysis",
        userAction: body.userAction || "sarah:analyse-project",
        projectProfileId: Number(body.projectProfileId),
        dataCategories: ["project_profile", "project_intelligence", "semantic_memory", "olivia_financial_context"],
        model: result.model,
        metadata: { projectName: detail.profile.projectName, aiAuditId: result.auditId },
      });
      return sendJson(response, 200, {
        ...result,
        relatedMemory: input.relevantMemory,
        memoryContext: memoryContextSummary(retrievedMemoryContext),
        boundary: SARAH_READ_ONLY_BOUNDARY,
      });
    } catch (error) {
      recordSarahAudit(db, {
        eventType: "project_analysis",
        userAction: body.userAction || "sarah:analyse-project",
        projectProfileId: Number(body.projectProfileId),
        dataCategories: ["project_profile", "project_intelligence", "semantic_memory", "olivia_financial_context"],
        model: anthropic.model,
        status: "error",
        errorCode: error.code || "SARAH_PROJECT_ANALYSIS_FAILED",
        metadata: { projectName: detail.profile.projectName },
      });
      throw error;
    }
  }
  if (url.pathname === "/api/ai/sarah/client-review" && request.method === "POST") {
    const body = await readJson(request);
    const client = body.client || body.clientName || "";
    const memoryContext = await semanticMemory.retrieveContext(`Sarah client review ${client}`, {
      maxRecords: 8,
      maxTokens: 1400,
    });
    const retrievedMemoryContext = {
      ...memoryContext,
      records: memoryContext.records.map(memoryRecordForClaude),
    };
    const input = buildSarahClientReviewInput(db, client, { retrievedMemoryContext });
    try {
      const result = await aiReasoning.analyzeSarahClient(input, {
        userAction: body.userAction || "sarah:client-review",
        dataCategories: compactCategories([
          "client",
          input.portfolioSummary.length ? "project_portfolio" : "",
          input.clientRisks.length ? "project_risks" : "",
          input.openActions.length ? "project_actions" : "",
          input.opportunities.length ? "sarah_opportunities" : "",
          input.relevantMemory.length ? "semantic_memory" : "",
        ]),
      });
      recordSarahAudit(db, {
        eventType: "client_review",
        userAction: body.userAction || "sarah:client-review",
        clientName: client,
        dataCategories: ["client", "project_portfolio", "semantic_memory"],
        model: result.model,
        metadata: { projectCount: input.portfolioSummary.length, aiAuditId: result.auditId },
      });
      return sendJson(response, 200, {
        ...result,
        relatedMemory: input.relevantMemory,
        memoryContext: memoryContextSummary(retrievedMemoryContext),
        boundary: SARAH_READ_ONLY_BOUNDARY,
      });
    } catch (error) {
      recordSarahAudit(db, {
        eventType: "client_review",
        userAction: body.userAction || "sarah:client-review",
        clientName: client,
        dataCategories: ["client", "project_portfolio", "semantic_memory"],
        model: anthropic.model,
        status: "error",
        errorCode: error.code || "SARAH_CLIENT_REVIEW_FAILED",
      });
      throw error;
    }
  }
  if (url.pathname === "/api/financial/dashboard" && request.method === "GET") {
    return sendJson(response, 200, getFinancialDashboardData(db, financialScopeFromSearch(url.searchParams)));
  }
  if (url.pathname === "/api/financial/forecast" && request.method === "GET") {
    return sendJson(response, 200, getFinancialDashboardData(db, financialScopeFromSearch(url.searchParams)).forecast);
  }
  if (url.pathname === "/api/financial/order-book/import" && request.method === "POST") {
    const result = importOrderBookWorkbook(db, await readJson(request));
    await tryIndexSemanticMemory();
    return sendJson(response, result.approvalRequired ? 409 : 201, result);
  }
  if (url.pathname === "/api/financial/imports" && request.method === "GET") {
    return sendJson(response, 200, listFinancialImports(db, url.searchParams.get("limit") || 20));
  }
  if (url.pathname === "/api/financial/monday/status" && request.method === "GET") {
    return sendJson(response, 200, syncMondayFinanceStatus());
  }
  if (url.pathname === "/api/financial/monday/refresh" && request.method === "POST") {
    const body = await readJson(request);
    const summaries = await mondayFinance.fetchFinancialSummaries();
    const result = saveMondayFinancialSummaries(db, { ...summaries, businessEntityId: body.businessEntityId });
    setIntegrationStatus(db, "monday", "Connected");
    await tryIndexSemanticMemory();
    return sendJson(response, 200, { ...result, boundary: FINANCIAL_READ_ONLY_BOUNDARY });
  }
  if (url.pathname === "/api/financial/board-reports") {
    if (request.method === "GET") return sendJson(response, 200, listBoardReports(db, url.searchParams.get("limit") || 20));
    if (request.method === "POST") return sendJson(response, 201, generateBoardReport(db, await readJson(request)));
  }
  const boardReportMatch = url.pathname.match(/^\/api\/financial\/board-reports\/(\d+)$/);
  if (boardReportMatch && request.method === "GET") {
    const report = getBoardReport(db, Number(boardReportMatch[1]));
    return report ? sendJson(response, 200, report) : sendJson(response, 404, { error: "Board report not found" });
  }
  if (url.pathname === "/api/financial/olivia-analysis" && request.method === "POST") {
    return sendJson(response, 200, generateOliviaAnalysis(db, await readJson(request)));
  }
  if (url.pathname === "/api/financial/audit" && request.method === "GET") {
    return sendJson(response, 200, listFinancialAudit(db, url.searchParams.get("limit") || 50));
  }
  if (url.pathname === "/api/ai/briefing" && request.method === "POST") {
    const body = await readJson(request);
    const briefing = body.briefing || await generateExecutiveBrief({ save: false });
    const baseContext = buildAiBriefingContext(briefing, body);
    const context = await withRetrievedMemoryContext(baseContext, memoryQueryForBriefing(baseContext));
    const result = await aiReasoning.analyzeBriefing(context, {
      userAction: body.userAction || "briefing-screen:ask-alfred",
      dataCategories: compactCategories([
        "executive_briefing",
        "outlook_signals",
        "calendar_signals",
        "risks",
        "decisions",
        "opportunities",
        "approval_queue",
        "briefing_history",
        context.propertyBrief?.items?.length ? "westbridge_property" : "",
        context.meetingIntelligenceBrief?.items?.length ? "meeting_intelligence" : "",
        context.mondayOperatingBrief?.items?.length ? "monday_operating_system" : "",
        context.projectIntelligence?.projectsNeedingAttention?.length ? "project_intelligence" : "",
        context.liamPowerPlatformBrief?.items?.length ? "liam_power_platform" : "",
        context.jamesProductBrief?.items?.length ? "james_product_ceo" : "",
        context.retrievedMemoryContext.records.length ? "semantic_memory" : "",
      ]),
    });
    return sendJson(response, 200, {
      ...result,
      relatedMemory: context.retrievedMemoryContext.records,
      memoryContext: memoryContextSummary(context.retrievedMemoryContext),
    });
  }
  if (url.pathname === "/api/ai/decision-support" && request.method === "POST") {
    const body = await readJson(request);
    if (!body.decisionTitle || !body.context) {
      return sendJson(response, 400, { error: "decisionTitle and context are required" });
    }
    const baseContext = buildDecisionSupportContext(body);
    const context = await withRetrievedMemoryContext(baseContext, memoryQueryForDecision(baseContext));
    const result = await aiReasoning.analyzeDecision(context, {
      userAction: body.userAction || "decision-support:ask-alfred",
      dataCategories: compactCategories([
        body.category || "decision_support",
        body.relatedEmails?.length ? "outlook_signals" : "",
        body.relatedCalendar?.length ? "calendar_signals" : "",
        body.risks?.length ? "risks" : "",
        body.relatedItems?.length ? "operating_records" : "",
        body.approvals?.length ? "approval_queue" : "",
        context.retrievedMemoryContext.records.length ? "semantic_memory" : "",
      ]),
    });
    return sendJson(response, 200, {
      ...result,
      relatedMemory: context.retrievedMemoryContext.records,
      memoryContext: memoryContextSummary(context.retrievedMemoryContext),
    });
  }
  if (url.pathname === "/api/ai/project-analysis" && request.method === "POST") {
    const body = await readJson(request);
    if (!body.projectProfileId) {
      return sendJson(response, 400, { error: "projectProfileId is required" });
    }
    const detail = getProjectDetail(db, Number(body.projectProfileId), { calculateHealth: false });
    if (!detail) return sendJson(response, 404, { error: "Project profile not found" });
    const memoryContext = await semanticMemory.retrieveContext(memoryQueryForProject(detail), {
      maxRecords: 8,
      maxTokens: 1400,
    });
    const retrievedMemoryContext = {
      ...memoryContext,
      records: memoryContext.records.map(memoryRecordForClaude),
    };
    const input = buildProjectAnalysisInput(db, Number(body.projectProfileId), { retrievedMemoryContext });
    const result = await aiReasoning.analyzeProject(input, {
      userAction: body.userAction || "project-intelligence:ask-alfred",
      dataCategories: [
        "project_profile",
        input.linkedRisks.length ? "project_risks" : "",
        input.linkedActions.length ? "project_actions" : "",
        input.linkedDecisions.length ? "project_decisions" : "",
        input.linkedDocumentMetadata.length ? "project_document_metadata" : "",
        input.linkedMeetings.length ? "project_meetings" : "",
        input.linkedEmailSignals.length ? "project_email_signals" : "",
        input.projectTags.length ? "project_tags" : "",
        input.knowledgeGraphLinks.length ? "project_knowledge_graph" : "",
        input.digitalConstructionContext?.domains?.length ? "digital_construction_domains" : "",
        input.informationQuality ? "project_information_quality" : "",
        input.relevantMemory.length ? "semantic_memory" : "",
        input.oliviaFinancialContext?.linkedOrderBookEntries ? "olivia_financial_context" : "",
      ],
    });
    return sendJson(response, 200, {
      ...result,
      relatedMemory: input.relevantMemory,
      memoryContext: memoryContextSummary(retrievedMemoryContext),
    });
  }
  if (url.pathname === "/api/approvals") {
    if (request.method === "GET") {
      return sendJson(response, 200, {
        items: listApprovalRequests(db, url.searchParams.get("status") || ""),
        summary: getApprovalSummary(db),
      });
    }
    if (request.method === "POST") {
      const approval = createApprovalRequest(db, await readJson(request));
      await tryIndexSemanticMemory();
      return sendJson(response, 201, approval);
    }
  }
  const approvalMatch = url.pathname.match(/^\/api\/approvals\/(\d+)(?:\/(approve|reject|cancel|preflight))?$/);
  if (approvalMatch) {
    const approvalId = Number(approvalMatch[1]);
    const action = approvalMatch[2];
    if (request.method === "GET" && !action) {
      const approval = getApprovalRequest(db, approvalId);
      return approval
        ? sendJson(response, 200, approval)
        : sendJson(response, 404, { error: "Approval request not found" });
    }
    if (request.method === "POST" && action) {
      if (action === "preflight") {
        const preflight = runApprovalPreflight(db, approvalId, await readJson(request));
        await tryIndexSemanticMemory();
        return sendJson(response, 201, preflight);
      }
      const decisions = { approve: "approved", reject: "rejected", cancel: "cancelled" };
      const approval = reviewApprovalRequest(db, approvalId, decisions[action], await readJson(request));
      await tryIndexSemanticMemory();
      return sendJson(response, 200, approval);
    }
  }
  const briefingMatch = url.pathname.match(/^\/api\/briefings\/(\d+)(?:\/feedback)?$/);
  if (briefingMatch) {
    const briefingId = Number(briefingMatch[1]);
    if (request.method === "GET" && !url.pathname.endsWith("/feedback")) {
      const briefing = getBriefing(db, briefingId);
      return briefing
        ? sendJson(response, 200, briefing)
        : sendJson(response, 404, { error: "Briefing not found" });
    }
    if (request.method === "POST" && url.pathname.endsWith("/feedback")) {
      return sendJson(response, 201, saveBriefingFeedback(db, briefingId, await readJson(request)));
    }
  }

  if (url.pathname === "/api/microsoft/status" && request.method === "GET") {
    return sendJson(response, 200, {
      ...(await syncMicrosoftStatus()),
      scopes: MICROSOFT_SCOPES,
      readOnly: true,
    });
  }
  if (url.pathname === "/api/microsoft/connect" && request.method === "POST") {
    return sendJson(response, 200, await microsoft.startDeviceFlow());
  }
  if (url.pathname === "/api/microsoft/connect/complete" && request.method === "POST") {
    try {
      await microsoft.completeDeviceFlow();
      return sendJson(response, 200, await syncMicrosoftStatus());
    } catch (error) {
      if (error.statusCode === 202) {
        return sendJson(response, 202, {
          pending: true,
          retryAfter: error.retryAfter,
          message: "Waiting for Microsoft authorization",
        });
      }
      throw error;
    }
  }
  if (url.pathname === "/api/microsoft/messages" && request.method === "GET") {
    return sendJson(response, 200, await microsoft.listMessages({
      search: url.searchParams.get("search") || "",
      limit: url.searchParams.get("limit") || 15,
    }));
  }
  if (url.pathname === "/api/microsoft/calendar" && request.method === "GET") {
    return sendJson(response, 200, await microsoft.listCalendar({
      start: url.searchParams.get("start") || undefined,
      end: url.searchParams.get("end") || undefined,
      limit: url.searchParams.get("limit") || 25,
    }));
  }
  if (url.pathname === "/api/microsoft/files" && request.method === "GET") {
    return sendJson(response, 200, await microsoft.listFiles({
      search: url.searchParams.get("search") || "",
      limit: url.searchParams.get("limit") || 20,
    }));
  }

  const match = url.pathname.match(/^\/api\/([a-z-]+)(?:\/([^/]+))?$/);
  if (!match) return sendJson(response, 404, { error: "API route not found" });

  const [, resource, id] = match;
  if (!RESOURCE_CONFIG[resource]) {
    return sendJson(response, 404, { error: "API resource not found" });
  }

  if (request.method === "GET" && !id) {
    return sendJson(response, 200, listResource(db, resource));
  }
  if (request.method === "GET" && id) {
    const record = db.prepare(`SELECT * FROM ${resource} WHERE id = ?`).get(decodeURIComponent(id));
    if (!record) return sendJson(response, 404, { error: `${resource.slice(0, -1)} not found` });
    const records = listResource(db, resource);
    return sendJson(response, 200, records.find((item) => String(item.id) === String(id)));
  }
  if (request.method === "POST" && !id) {
    const record = createResource(db, resource, await readJson(request));
    await tryIndexSemanticMemory();
    return sendJson(response, 201, record);
  }
  if ((request.method === "PATCH" || request.method === "PUT") && id) {
    const record = updateResource(db, resource, decodeURIComponent(id), await readJson(request));
    await tryIndexSemanticMemory();
    return sendJson(response, 200, record);
  }
  if (request.method === "DELETE" && id) {
    deleteResource(db, resource, decodeURIComponent(id));
    deleteSemanticMemoryRecord(db, semanticSourceTypeForResource(resource), decodeURIComponent(id));
    response.writeHead(204);
    return response.end();
  }

  response.setHeader("Allow", id ? "PATCH, PUT, DELETE" : "GET, POST");
  return sendJson(response, 405, { error: "Method not allowed" });
}

async function generateExecutiveBrief({ save = true } = {}) {
  const brief = getMorningBrief(db);
  const dashboard = getDashboardData(db);
  const microsoftStatus = await microsoft.status();
  brief.microsoft = microsoftStatus;
  let messages = [];
  let meetings = [];

  if (microsoftStatus.connected) {
    [messages, meetings] = await Promise.all([
      microsoft.listMessages({ limit: 30 }),
      microsoft.listCalendar({ limit: 25 }),
    ]);
  }

  const analysis = buildExecutiveAnalysis({
    baseBrief: brief,
    messages,
    meetings,
    clients: dashboard.clients,
    projects: dashboard.projects,
  });

  brief.emails = analysis.priorityEmails.slice(0, 10).map((message) => ({
    id: message.id,
    title: message.subject || "(No subject)",
    detail: message.detail,
    receivedDateTime: message.receivedDateTime,
    isRead: message.isRead,
    importance: message.importance,
    priority: message.priority,
    score: message.score,
    reasons: message.reasons,
    webLink: message.webLink,
  }));
  brief.meetings = {
    available: microsoftStatus.connected,
    items: analysis.meetingPreparation,
    message: microsoftStatus.connected
      ? analysis.meetingPreparation.length
        ? ""
        : "No meetings are scheduled in the next seven days."
      : "Calendar is not connected. No meeting data was reviewed.",
  };
  brief.riskSignals = analysis.riskSignals;
  brief.decisionPrompts = analysis.decisionPrompts;
  brief.executivePriorities = analysis.executivePriorities;
  brief.projectIntelligence = projectAttentionForBriefing(db);
  brief.sarah = sarahBriefingForDaily(db);
  brief.liam = liamBriefingForDaily(db);
  brief.property = westbridgeBriefingForDaily(db);
  brief.james = jamesBriefingForDaily(db);
  brief.meetingIntelligence = meetingBriefingForDaily(db);
  brief.mondayOperating = mondayOperatingBriefForDaily(db);
  brief.executivePriorities = [
    ...brief.mondayOperating.items.map((item, index) => ({
      ...item,
      id: `monday-os-${index + 1}`,
      rank: index + 1,
      category: "monday-os",
      score: item.priority === "Critical" ? 90 : item.priority === "High" ? 86 : 60,
    })),
    ...brief.meetingIntelligence.items.map((item, index) => ({
      ...item,
      id: `meeting-intelligence-${index + 1}`,
      rank: index + 1,
      category: "meeting",
      score: item.priority === "high" ? 86 : 56,
    })),
    ...brief.property.items.map((item, index) => ({
      ...item,
      id: `property-${index + 1}`,
      rank: index + 1,
      category: "property",
      score: item.priority === "high" ? 84 : 57,
    })),
    ...brief.sarah.items.map((item, index) => ({
      ...item,
      id: `sarah-${index + 1}`,
      rank: index + 1,
      category: "sarah",
      score: item.priority === "high" ? 78 : 52,
    })),
    ...brief.liam.items.map((item, index) => ({
      ...item,
      id: `liam-${index + 1}`,
      rank: index + 1,
      category: "liam",
      score: item.priority === "high" ? 77 : 51,
    })),
    ...brief.james.items.map((item, index) => ({
      ...item,
      id: `james-${index + 1}`,
      rank: index + 1,
      category: "james",
      score: item.priority === "high" ? 79 : 53,
    })),
    ...brief.projectIntelligence.projectsNeedingAttention.map((project, index) => ({
      ...project,
      rank: index + 1,
      category: "project",
      score: project.priority === "high" ? 82 : 58,
    })),
    ...brief.executivePriorities,
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((item, index) => ({ ...item, rank: index + 1 }));
  brief.summary.priorityEmails = analysis.priorityEmails.filter((email) => email.priority === "high").length;
  brief.summary.meetingsToday = analysis.meetingPreparation.filter((meeting) => meeting.hoursUntil >= 0 && meeting.hoursUntil <= 24).length;
  brief.summary.riskSignals = analysis.riskSignals.length;
  brief.summary.decisionPrompts = analysis.decisionPrompts.length;
  brief.summary.projectsNeedingAttention = brief.projectIntelligence.projectsNeedingAttention.length;
  brief.summary.projectRisks = brief.projectIntelligence.projectRisks.length;
  brief.summary.overdueProjectActions = brief.projectIntelligence.overdueProjectActions.length;
  brief.summary.projectsWithMissingInformation = brief.projectIntelligence.projectsWithMissingInformation.length;
  brief.summary.projectsWithFinancialRisk = brief.projectIntelligence.projectsWithFinancialRisk.length;
  brief.summary.projectsWithInformationQualityRisk = brief.projectIntelligence.projectsWithInformationQualityRisk.length;
  brief.summary.sarahDigitalConstructionSignals = brief.sarah.items.length;
  brief.summary.liamPowerPlatformSignals = brief.liam.items.length;
  brief.summary.liamPowerPlatformRisks = brief.liam.metrics.openRisks;
  brief.summary.liamPowerPlatformDecisions = brief.liam.metrics.decisionsRequired;
  brief.summary.jamesProductSignals = brief.james.items.length;
  brief.summary.jamesProductRisks = brief.james.metrics.openRisks;
  brief.summary.jamesProductDecisions = brief.james.metrics.decisionsRequired;
  brief.summary.meetingIntelligenceSignals = brief.meetingIntelligence.items.length;
  brief.summary.meetingActions = brief.meetingIntelligence.metrics.openActions;
  brief.summary.meetingRisks = brief.meetingIntelligence.metrics.risks;
  brief.summary.meetingTranscriptUnavailable = brief.meetingIntelligence.metrics.transcriptUnavailable;
  brief.summary.mondayOperatingSignals = brief.mondayOperating.items.length;
  brief.summary.mondayActiveWorkItems = brief.mondayOperating.metrics.activeWorkItems;
  brief.summary.mondayBlockedWork = brief.mondayOperating.metrics.blockedItems;
  brief.summary.mondayOverdueWork = brief.mondayOperating.metrics.overdueItems;
  brief.summary.mondayDecisionsAwaitingApproval = brief.mondayOperating.metrics.decisionsAwaitingApproval;
  brief.summary.mondayMeetingFollowups = brief.mondayOperating.metrics.meetingFollowups;
  brief.summary.propertySignals = brief.property.items.length;
  brief.summary.propertyActiveOpportunities = brief.property.metrics.activeOpportunities;
  brief.summary.propertyMonthlyCashflow = brief.property.metrics.monthlyCashflow;
  brief.summary.propertyMonthlyCashflowForecast = brief.property.metrics.monthlyCashflowForecast;
  brief.summary.propertyCashflowTargetProgress = brief.property.metrics.cashflowTargetProgress;
  brief.analysisMethod = "deterministic-v1";

  if (!save) return brief;
  const saved = saveBriefing(db, brief);
  await tryIndexSemanticMemory();
  return { ...brief, briefingId: saved.id };
}

function compactCategories(categories) {
  return [...new Set(categories.map(String).filter(Boolean))];
}

function semanticSourceTypeForResource(resource) {
  return {
    actions: "action",
    risks: "risk",
    opportunities: "opportunity",
    decisions: "decision",
    memories: "memory",
  }[resource] || resource;
}

function compactRecords(records = [], fields = ["id", "title", "detail", "priority", "status", "due"], limit = 12) {
  return records.slice(0, limit).map((record) => Object.fromEntries(
    fields
      .filter((field) => record[field] !== undefined && record[field] !== null)
      .map((field) => [field, compactValue(record[field])]),
  ));
}

function compactValue(value) {
  if (typeof value === "string") return value.length > 400 ? `${value.slice(0, 397)}...` : value;
  if (Array.isArray(value)) return value.slice(0, 6).map(compactValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 8).map(([key, item]) => [key, compactValue(item)]));
  }
  return value;
}

function sourceReference(category, record) {
  const id = record.id ?? record.sourceId ?? record.title ?? record.subject;
  return {
    reference: `${category}:${id}`,
    label: record.title || record.subject || record.name || String(id),
    category,
  };
}

function sourceReferencesFor(context) {
  return [
    ...compactRecords(context.currentExecutiveBriefing.actions, ["id", "title"]).map((record) => sourceReference("action", record)),
    ...compactRecords(context.risks, ["id", "title", "sourceId"]).map((record) => sourceReference(record.sourceType || "risk", record)),
    ...compactRecords(context.decisions, ["id", "title", "sourceId"]).map((record) => sourceReference(record.sourceType || "decision", record)),
    ...compactRecords(context.opportunities, ["id", "title"]).map((record) => sourceReference("opportunity", record)),
    ...compactRecords(context.propertyBrief?.items || [], ["title", "sourceReference"]).map((record) => ({
      reference: record.sourceReference || `property:${record.title}`,
      label: record.title || "Westbridge property signal",
      category: "property",
    })),
    ...compactRecords(context.meetingIntelligenceBrief?.items || [], ["title", "sourceReference"]).map((record) => ({
      reference: record.sourceReference || `meeting:${record.title}`,
      label: record.title || "Meeting intelligence signal",
      category: "meeting_intelligence",
    })),
    ...compactRecords(context.mondayOperatingBrief?.items || [], ["title", "sourceReference"]).map((record) => ({
      reference: record.sourceReference || `monday-os:${record.title}`,
      label: record.title || "Monday Operating System signal",
      category: "monday_operating_system",
    })),
    ...compactRecords(context.projectIntelligence?.projectsNeedingAttention || [], ["id", "title", "sourceId"]).map((record) => sourceReference("project", record)),
    ...compactRecords(context.sarahDigitalConstructionBrief?.items || [], ["title", "sourceReference"]).map((record) => ({
      reference: record.sourceReference || `sarah:${record.title}`,
      label: record.title || "Sarah digital construction signal",
      category: "sarah",
    })),
    ...compactRecords(context.liamPowerPlatformBrief?.items || [], ["title", "sourceReference"]).map((record) => ({
      reference: record.sourceReference || `liam:${record.title}`,
      label: record.title || "Liam Power Platform signal",
      category: "liam_power_platform",
    })),
    ...compactRecords(context.jamesProductBrief?.items || [], ["title", "sourceReference"]).map((record) => ({
      reference: record.sourceReference || `james:${record.title}`,
      label: record.title || "James product signal",
      category: "james",
    })),
    ...compactRecords(context.outlookSignals, ["id", "title", "subject"]).map((record) => sourceReference("outlook", record)),
    ...compactRecords(context.calendarSignals, ["id", "title", "subject"]).map((record) => sourceReference("calendar", record)),
    ...compactRecords(context.approvalQueue, ["id", "title"]).map((record) => sourceReference("approval", record)),
  ];
}

function memoryContextSummary(memoryContext) {
  return {
    semantic: memoryContext.semantic,
    indexingEnabled: memoryContext.indexingEnabled,
    voyageConfigured: memoryContext.voyageConfigured,
    model: memoryContext.model,
    maxRecords: memoryContext.maxRecords,
    maxTokens: memoryContext.maxTokens,
    tokenEstimate: memoryContext.tokenEstimate,
    resultCount: memoryContext.records.length,
    errorCode: memoryContext.errorCode,
  };
}

function memoryRecordForClaude(record) {
  return {
    sourceReference: record.sourceReference,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    relevanceScore: record.relevanceScore,
    timestamp: record.timestamp,
    sensitivityLabel: record.sensitivityLabel,
    summary: compactValue(record.shortSummary),
  };
}

async function withRetrievedMemoryContext(context, query) {
  const memoryContext = await semanticMemory.retrieveContext(query, {
    maxRecords: 6,
    maxTokens: 1200,
  });
  const retrievedMemoryContext = {
    ...memoryContext,
    records: memoryContext.records.map(memoryRecordForClaude),
  };
  return {
    ...context,
    retrievedMemoryContext,
    sourceRecordReferences: [
      ...(context.sourceRecordReferences || []),
      ...memoryContext.sourceRecordReferences,
    ].slice(0, 50),
  };
}

function memoryQueryForBriefing(context) {
  return [
    "executive briefing",
    ...(context.currentExecutiveBriefing.executivePriorities || []).map((item) => `${item.title} ${item.detail || ""}`),
    ...(context.risks || []).map((item) => `${item.title} ${item.detail || ""}`),
    ...(context.decisions || []).map((item) => `${item.title} ${item.detail || ""}`),
    ...(context.opportunities || []).map((item) => `${item.title} ${item.detail || ""}`),
    ...(context.propertyBrief?.items || []).map((item) => `${item.title || ""} ${item.detail || ""}`),
    ...(context.projectIntelligence?.projectsNeedingAttention || []).map((item) => `${item.title} ${item.detail || ""}`),
    ...(context.sarahDigitalConstructionBrief?.items || []).map((item) => `${item.title || ""} ${item.detail || ""}`),
    ...(context.liamPowerPlatformBrief?.items || []).map((item) => `${item.title || ""} ${item.detail || ""}`),
    ...(context.jamesProductBrief?.items || []).map((item) => `${item.title || ""} ${item.detail || ""}`),
    ...(context.meetingIntelligenceBrief?.items || []).map((item) => `${item.title || ""} ${item.detail || ""}`),
    ...(context.mondayOperatingBrief?.items || []).map((item) => `${item.title || ""} ${item.detail || ""} ${item.ownerAgentName || ""}`),
    ...(context.outlookSignals || []).map((item) => `${item.title || item.subject || ""} ${item.detail || ""}`),
    ...(context.calendarSignals || []).map((item) => `${item.title || item.subject || ""} ${item.detail || ""}`),
  ].join(" ").slice(0, 2000);
}

function memoryQueryForDecision(context) {
  return [
    context.decisionTitle,
    context.context,
    ...(context.relatedItems || []).map((item) => `${item.type || ""} ${item.title || ""} ${item.detail || ""}`),
    ...(context.risks || []).map((item) => `${item.title || ""} ${item.detail || ""}`),
    ...(context.approvals || []).map((item) => `${item.title || ""} ${item.targetSystem || ""}`),
  ].join(" ").slice(0, 2000);
}

function memoryQueryForProject(detail) {
  return [
    detail.profile.projectName,
    detail.profile.clientName,
    detail.profile.serviceLine,
    detail.profile.currentPhase,
    detail.profile.summary,
    ...(detail.risks || []).map((item) => `${item.title || ""} ${item.detail || ""}`),
    ...(detail.actions || []).map((item) => `${item.title || ""} ${item.detail || ""}`),
    ...(detail.decisions || []).map((item) => `${item.title || ""} ${item.detail || ""}`),
    ...(detail.documents || []).map((item) => `${item.name || ""} ${item.classification || ""}`),
    ...(detail.tags || []).map((item) => `${item.domainLabel || ""} ${item.tag || ""}`),
    ...(detail.digitalConstruction?.detectedSignals || []),
  ].join(" ").slice(0, 2000);
}

function memoryQueryForSarahProject(detail) {
  return [
    "Sarah digital construction review",
    detail.profile.projectName,
    detail.profile.clientName,
    detail.profile.serviceLine,
    detail.profile.currentPhase,
    detail.profile.summary,
    ...(detail.tags || []).map((tag) => `${tag.domainLabel || ""} ${tag.tag || ""}`),
    ...(detail.digitalConstruction?.detectedSignals || []),
    ...(detail.healthScore?.inputs?.missingClasses || []),
    ...(detail.risks || []).map((item) => `${item.title || ""} ${item.detail || ""}`),
    ...(detail.documents || []).map((item) => `${item.name || ""} ${item.classification || ""}`),
  ].join(" ").slice(0, 2000);
}

function buildAiBriefingContext(briefing, body = {}) {
  const history = listBriefings(db, 5).map((item) => ({
    id: item.id,
    generatedAt: item.generatedAt,
    summary: item.summary,
    feedback: item.feedback,
  }));
  const context = {
    currentExecutiveBriefing: {
      generatedAt: briefing.generatedAt,
      summary: briefing.summary,
      executivePriorities: compactRecords(briefing.executivePriorities || [], ["rank", "title", "detail", "category", "score"], 6),
      actions: compactRecords(briefing.actions || [], undefined, 8),
      agents: compactRecords(briefing.agents || [], ["id", "name", "role", "status"]),
    },
    outlookSignals: compactRecords(body.outlookSignals || briefing.emails || [], ["id", "title", "detail", "priority", "score", "reasons", "receivedDateTime", "importance", "isRead"], 8),
    calendarSignals: compactRecords(body.calendarSignals || briefing.meetings?.items || [], ["id", "title", "detail", "urgency", "hoursUntil", "preparation"], 6),
    risks: compactRecords(body.risks || briefing.riskSignals || briefing.risks || [], ["id", "title", "detail", "priority", "confidence", "sourceType", "sourceId"], 8),
    decisions: compactRecords(body.decisions || briefing.decisionPrompts || briefing.decisions || [], ["id", "title", "detail", "priority", "prompt", "sourceType", "sourceId"], 8),
    opportunities: compactRecords(body.opportunities || briefing.opportunities || [], ["id", "title", "detail", "priority", "due", "status"], 6),
    projectIntelligence: {
      projectsNeedingAttention: compactRecords(briefing.projectIntelligence?.projectsNeedingAttention || [], ["id", "title", "detail", "priority", "sourceType", "sourceId"], 6),
      overdueProjectActions: compactRecords(briefing.projectIntelligence?.overdueProjectActions || [], ["id", "title", "detail", "status", "due", "projectName"], 6),
      projectsWithMissingInformation: compactRecords(briefing.projectIntelligence?.projectsWithMissingInformation || [], ["projectProfileId", "projectName", "missing"], 6),
      projectsWithFinancialRisk: compactRecords(briefing.projectIntelligence?.projectsWithFinancialRisk || [], ["projectProfileId", "projectName", "financialSummary"], 6),
      projectsWithInformationQualityRisk: compactRecords(briefing.projectIntelligence?.projectsWithInformationQualityRisk || [], ["projectProfileId", "projectName", "informationQuality"], 6),
    },
    propertyBrief: {
      title: briefing.property?.title || "Westbridge Property Brief",
      summary: briefing.property?.summary || "",
      metrics: compactValue(briefing.property?.metrics || {}),
      items: compactRecords(briefing.property?.items || [], ["title", "detail", "priority", "sourceReference"], 6),
      boundary: briefing.property?.boundary || PROPERTY_READ_ONLY_BOUNDARY,
    },
    meetingIntelligenceBrief: {
      title: briefing.meetingIntelligence?.title || "Teams Meeting Intelligence Brief",
      summary: briefing.meetingIntelligence?.summary || "",
      metrics: compactValue(briefing.meetingIntelligence?.metrics || {}),
      items: compactRecords(briefing.meetingIntelligence?.items || [], ["title", "detail", "priority", "sourceReference"], 8),
      boundary: briefing.meetingIntelligence?.boundary || MEETING_READ_ONLY_BOUNDARY,
    },
    mondayOperatingBrief: {
      title: briefing.mondayOperating?.title || "Monday Operating System",
      summary: briefing.mondayOperating?.summary || "",
      metrics: compactValue(briefing.mondayOperating?.metrics || {}),
      topWorkloads: compactRecords(briefing.mondayOperating?.topWorkloads || [], ["agentId", "agentName", "activeItems", "blockedItems", "overdueItems", "deliverablesDue", "workloadScore", "healthStatus", "workloadStatus"], 8),
      items: compactRecords(briefing.mondayOperating?.items || [], ["type", "title", "detail", "ownerAgentName", "priority", "status", "sourceReference"], 10),
      boundary: briefing.mondayOperating?.boundary || MONDAY_OPERATING_BOUNDARY,
    },
    sarahDigitalConstructionBrief: {
      title: briefing.sarah?.title || "Daily Digital Construction Brief",
      summary: briefing.sarah?.summary || "",
      items: compactRecords(briefing.sarah?.items || [], ["title", "detail", "priority", "sourceReference"], 6),
      boundary: briefing.sarah?.boundary || SARAH_READ_ONLY_BOUNDARY,
    },
    liamPowerPlatformBrief: {
      title: briefing.liam?.title || "Liam Power Platform Brief",
      summary: briefing.liam?.summary || "",
      metrics: compactValue(briefing.liam?.metrics || {}),
      items: compactRecords(briefing.liam?.items || [], ["title", "detail", "priority", "sourceReference"], 6),
      boundary: briefing.liam?.boundary || LIAM_READ_ONLY_BOUNDARY,
    },
    jamesProductBrief: {
      title: briefing.james?.title || "James Product CEO Brief",
      summary: briefing.james?.summary || "",
      metrics: compactValue(briefing.james?.metrics || {}),
      items: compactRecords(briefing.james?.items || [], ["title", "detail", "priority", "sourceReference"], 8),
      boundary: briefing.james?.boundary || JAMES_READ_ONLY_BOUNDARY,
    },
    approvalQueue: compactRecords(listApprovalRequests(db), ["id", "actionType", "targetSystem", "title", "description", "riskLevel", "status", "expiresAt"], 8),
    briefingHistory: history,
    boundaries: {
      readOnly: true,
      executionAvailable: false,
      approvalExecutionAvailable: false,
      microsoftWritePermissions: false,
      mondayWritePermissions: false,
    },
  };
  return {
    ...context,
    sourceRecordReferences: sourceReferencesFor(context),
  };
}

function buildDecisionSupportContext(body) {
  return {
    decisionTitle: String(body.decisionTitle).slice(0, 500),
    context: String(body.context).slice(0, 4000),
    category: body.category || "decision",
    options: Array.isArray(body.options) ? body.options.slice(0, 8).map(String) : [],
    relatedEmails: compactRecords(body.relatedEmails || [], ["id", "title", "subject", "detail", "priority", "receivedDateTime"], 8),
    relatedCalendar: compactRecords(body.relatedCalendar || [], ["id", "title", "subject", "detail", "start", "urgency"], 8),
    relatedItems: compactRecords(body.relatedItems || [], ["id", "type", "title", "detail", "priority", "status", "due"], 12),
    risks: compactRecords(body.risks || [], ["id", "title", "detail", "priority", "status"], 8),
    approvals: compactRecords(body.approvals || [], ["id", "actionType", "targetSystem", "title", "status", "riskLevel"], 8),
    boundaries: {
      readOnly: true,
      executionAvailable: false,
      approvalExecutionAvailable: false,
    },
    sourceRecordReferences: (body.sourceRecordReferences || []).slice(0, 20),
  };
}

async function syncMicrosoftStatus() {
  const status = await microsoft.status();
  if (!status.connected) {
    setIntegrationStatus(db, "outlook", "Not connected");
    setIntegrationStatus(db, "calendar", "Not connected");
    if (status.configured) setIntegrationStatus(db, "sharepoint", "Planned");
    return status;
  }

  const services = {
    profile: { connected: true },
    mail: { connected: false },
    calendar: { connected: false },
    files: { connected: false },
  };
  const checks = await Promise.allSettled([
    microsoft.listMessages({ limit: 1 }),
    microsoft.listCalendar({ limit: 1 }),
    microsoft.listFiles({ limit: 1 }),
  ]);
  services.mail = checks[0].status === "fulfilled"
    ? { connected: true }
    : { connected: false, error: checks[0].reason.message };
  services.calendar = checks[1].status === "fulfilled"
    ? { connected: true }
    : { connected: false, error: checks[1].reason.message };
  services.files = checks[2].status === "fulfilled"
    ? { connected: true }
    : { connected: false, error: checks[2].reason.message };

  setIntegrationStatus(db, "outlook", services.mail.connected ? "Connected" : "Not connected");
  setIntegrationStatus(db, "calendar", services.calendar.connected ? "Connected" : "Not connected");
  setIntegrationStatus(db, "sharepoint", services.files.connected ? "Connected" : "Planned");
  return { ...status, services };
}

function syncAnthropicStatus() {
  const status = anthropic.status();
  const current = listResource(db, "integrations").find((integration) => integration.id === "anthropic");
  if (!status.configured) {
    setIntegrationStatus(db, "anthropic", "Not connected");
  } else if (current?.status !== "Connected") {
    setIntegrationStatus(db, "anthropic", "Planned");
  }
  return {
    ...status,
    status: !status.configured ? "Not connected" : current?.status === "Connected" ? "Connected" : "Planned",
  };
}

function syncVoyageStatus() {
  const status = semanticMemory.status();
  const current = listResource(db, "integrations").find((integration) => integration.id === "voyage");
  if (!status.configured) {
    setIntegrationStatus(db, "voyage", "Not connected");
  } else if (current?.status !== "Connected") {
    setIntegrationStatus(db, "voyage", "Planned");
  }
  return {
    ...status,
    status: !status.configured ? "Not connected" : current?.status === "Connected" ? "Connected" : "Planned",
  };
}

function syncMondayFinanceStatus() {
  const status = mondayFinance.status();
  const current = listResource(db, "integrations").find((integration) => integration.id === "monday");
  if (!status.configured) {
    setIntegrationStatus(db, "monday", "Not connected");
  } else if (current?.status !== "Connected") {
    setIntegrationStatus(db, "monday", "Planned");
  }
  return {
    ...status,
    status: !status.configured ? "Not connected" : current?.status === "Connected" ? "Connected" : "Planned",
  };
}

function syncVoiceStatus() {
  const status = voiceCommandCentre.status();
  const integrations = listResource(db, "integrations");
  const deepgramCurrent = integrations.find((integration) => integration.id === "deepgram");
  const elevenlabsCurrent = integrations.find((integration) => integration.id === "elevenlabs");

  if (!status.providers.deepgram.configured) {
    setIntegrationStatus(db, "deepgram", "Not connected");
  } else if (deepgramCurrent?.status !== "Connected") {
    setIntegrationStatus(db, "deepgram", "Planned");
  }

  if (!status.providers.elevenlabs.configured) {
    setIntegrationStatus(db, "elevenlabs", "Not connected");
  } else if (elevenlabsCurrent?.status !== "Connected") {
    setIntegrationStatus(db, "elevenlabs", "Planned");
  }

  return {
    ...status,
    providers: {
      ...status.providers,
      deepgram: {
        ...status.providers.deepgram,
        state: !status.providers.deepgram.configured
          ? "Not connected"
          : deepgramCurrent?.status === "Connected" ? "Connected" : "Planned",
      },
      elevenlabs: {
        ...status.providers.elevenlabs,
        state: !status.providers.elevenlabs.configured
          ? "Not connected"
          : elevenlabsCurrent?.status === "Connected" ? "Connected" : "Planned",
      },
    },
  };
}

function databaseStatus() {
  try {
    db.prepare("SELECT 1 AS ok").get();
    return "connected";
  } catch {
    return "error";
  }
}

function healthResponse() {
  const voice = voiceCommandCentre.status();
  return buildHealthResponse({
    databaseStatus: databaseStatus(),
    uptimeSeconds: Math.round((Date.now() - SERVER_STARTED_AT) / 1000),
    integrationConfiguration: {
      anthropic: syncAnthropicStatus(),
      voyage: syncVoyageStatus(),
      microsoft: {
        configured: microsoft.configured,
        connected: Boolean(microsoft.loadToken()),
        readOnlyScopes: MICROSOFT_SCOPES,
      },
      monday: syncMondayFinanceStatus(),
      deepgram: {
        configured: Boolean(voice.providers.deepgram.configured),
        state: voice.providers.deepgram.state,
        rawAudioStored: false,
      },
      elevenlabs: {
        configured: Boolean(voice.providers.elevenlabs.configured),
        state: voice.providers.elevenlabs.state,
      },
      voice: {
        enabled: Boolean(voice.settings.enabled),
        readOnly: true,
        executionEnabled: false,
      },
    },
  });
}

async function liveBetaStatus() {
  const microsoftStatus = await syncMicrosoftStatus().catch((error) => ({
    configured: microsoft.configured,
    connected: false,
    error: error.message,
  }));
  return buildLiveBetaStatus({
    db,
    microsoft,
    microsoftStatus,
    uptimeSeconds: Math.round((Date.now() - SERVER_STARTED_AT) / 1000),
  });
}

async function tryIndexSemanticMemory() {
  const result = await semanticMemory.indexSourceRecords().catch((error) => ({
    errorCode: error.code || "SEMANTIC_INDEXING_FAILED",
    message: error.message,
  }));
  if (result.errorCode) {
    console.warn(`Semantic indexing skipped: ${result.errorCode}`);
  }
  return result;
}

function serveStatic(response, pathname) {
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = resolve(ROOT_DIR, relativePath);
  const pathFromRoot = relative(ROOT_DIR, filePath);
  if (pathFromRoot.startsWith("..") || !existsSync(filePath) || !statSync(filePath).isFile()) {
    return false;
  }

  response.writeHead(200, {
    "Content-Type": CONTENT_TYPES[extname(filePath)] || "application/octet-stream",
    "Cache-Control": ["service-worker.js", "index.html"].includes(relativePath)
      ? "no-cache"
      : "public, max-age=3600",
    ...securityHeaders(),
  });
  createReadStream(filePath).pipe(response);
  return true;
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (shouldRedirectToHttps(request, url)) {
      response.writeHead(308, {
        Location: `https://${request.headers.host}${request.url}`,
        ...securityHeaders(),
      });
      response.end();
      return;
    }
    if (url.pathname === "/api/healthz") {
      sendJson(response, 200, {
        status: "ok",
        service: "alfred-ai-operating-system",
      });
      return;
    }
    const auth = authenticateHeaders(request.headers, process.env);
    if (!auth.allowed) {
      sendAuthenticationFailure(response, auth);
      return;
    }
    request.alfredUser = auth.user;
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }
    if (!serveStatic(response, decodeURIComponent(url.pathname))) {
      sendJson(response, 404, { error: "Not found" });
    }
  } catch (error) {
    console.error(error);
    sendJson(response, error.statusCode || 500, {
      error: error.statusCode ? error.message : "Internal server error",
    });
  }
});

function shouldRedirectToHttps(request, url) {
  if (currentEnvironment() !== "production") return false;
  if (process.env.ENFORCE_HTTPS === "false") return false;
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return false;
  return request.headers["x-forwarded-proto"] !== "https";
}

server.listen(PORT, HOST, () => {
  console.log(`Alfred Core running at http://${HOST}:${PORT}`);
  console.log(`SQLite database: ${process.env.ALFRED_DB_PATH || resolve(ROOT_DIR, "data", "alfred.db")}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

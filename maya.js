import {
  MONDAY_OPERATING_BOUNDARY,
  getMondayOperatingDashboard,
  mondayOperatingCollection,
} from "./monday-operating-system.js";
import { listMeetings } from "./meeting-intelligence.js";

export const MAYA_READ_ONLY_BOUNDARY = Object.freeze({
  advisoryOnly: true,
  readOnly: true,
  reportsTo: "Alfred",
  autonomousExecutionEnabled: false,
  socialPostingEnabled: false,
  outboundMessagesEnabled: false,
  emailSendEnabled: false,
  calendarWriteEnabled: false,
  microsoftWritePermissions: false,
  mondayWriteEnabled: false,
  externalPublishingEnabled: false,
  paidCampaignLaunchEnabled: false,
  approvalRequiredForFutureWrites: true,
});

export const MAYA_DOMAINS = Object.freeze([
  "LinkedIn strategy",
  "YouTube strategy",
  "TikTok strategy",
  "Content planning",
  "Campaign planning",
  "Thought leadership",
  "Marketing opportunities",
  "Content calendar",
  "Marketing feedback",
]);

const MAYA_AGENT_ID = "maya";
const MARKETING_KEYWORDS = /(maya|marketing|content|linkedin|youtube|tiktok|campaign|thought leadership|media|channel|audience|post|video|short-form)/i;
const COMPLETE_STATUSES = new Set(["Complete", "Rejected"]);

function clean(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function json(value) {
  return JSON.stringify(value ?? {});
}

function parseJson(value, fallback = {}) {
  if (value && typeof value === "object") return value;
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function toCamelCase(value) {
  return value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function mapRow(row, jsonFields = []) {
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    toCamelCase(key),
    jsonFields.includes(key) ? parseJson(value, []) : value,
  ]));
}

function boolInt(value) {
  return value ? 1 : 0;
}

function nowIso() {
  return new Date().toISOString();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function rowId(result) {
  return result?.lastInsertRowid ? Number(result.lastInsertRowid) : undefined;
}

function normalizePriority(value = "Medium") {
  const text = clean(value || "Medium").toLowerCase();
  if (["critical", "urgent", "red"].includes(text)) return "Critical";
  if (["high", "amber"].includes(text)) return "High";
  if (["low", "green"].includes(text)) return "Low";
  return "Medium";
}

function normalizeMarketingStatus(value = "Planned") {
  const text = clean(value || "Planned").toLowerCase().replace(/[_-]+/g, " ");
  if (["new", "idea", "planned"].includes(text)) return "Planned";
  if (["draft", "drafting"].includes(text)) return "Draft";
  if (["review", "needs review", "ready"].includes(text)) return "Review";
  if (["approved", "accepted"].includes(text)) return "Approved";
  if (["scheduled"].includes(text)) return "Scheduled";
  if (["complete", "completed", "done"].includes(text)) return "Complete";
  if (["rejected", "declined"].includes(text)) return "Rejected";
  if (["blocked"].includes(text)) return "Blocked";
  return clean(value || "Planned");
}

function sourceReference(type, id, title = "") {
  return `Maya (${type}:${id})${title ? ` - ${title}` : ""}`;
}

function channelName(channels, channelId = "") {
  return channels.find((channel) => channel.id === channelId)?.name || clean(channelId) || "Channel";
}

function recordExists(db, table, sourceType, sourceId) {
  return db.prepare(`
    SELECT id
    FROM ${table}
    WHERE source_type = ? AND source_id = ?
    LIMIT 1
  `).get(String(sourceType), String(sourceId));
}

export function recordMayaAudit(db, {
  eventType,
  userAction = "",
  recordType = "",
  recordId = "",
  dataCategories = [],
  outputSaved = false,
  model = "maya-deterministic-v1",
  status = "success",
  errorCode = "",
  metadata = {},
} = {}) {
  const result = db.prepare(`
    INSERT INTO maya_audit_events (
      event_type, user_action, record_type, record_id, data_categories,
      output_saved, model, status, error_code, execution_attempted,
      external_write_attempted, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
  `).run(
    clean(eventType || "maya_event"),
    clean(userAction),
    clean(recordType),
    String(recordId || ""),
    json([...new Set((dataCategories || []).map(String).filter(Boolean))]),
    boolInt(outputSaved),
    clean(model),
    status === "error" ? "error" : "success",
    clean(errorCode).slice(0, 200),
    json({ ...metadata, boundary: MAYA_READ_ONLY_BOUNDARY }),
  );
  return rowId(result);
}

export function listMayaAudit(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM maya_audit_events
    ORDER BY requested_at DESC, id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 50, 1), 200)).map((row) => ({
    ...mapRow(row, ["data_categories"]),
    dataCategories: parseJson(row.data_categories, []),
    outputSaved: Boolean(row.output_saved),
    executionAttempted: Boolean(row.execution_attempted),
    externalWriteAttempted: Boolean(row.external_write_attempted),
    metadata: parseJson(row.metadata, {}),
  }));
}

export function getMayaProfile(db) {
  const row = db.prepare("SELECT * FROM agents WHERE id = 'maya'").get();
  return row ? {
    ...mapRow(row, ["tools"]),
    reportsTo: "Alfred",
    boundary: MAYA_READ_ONLY_BOUNDARY,
  } : null;
}

export function listMarketingChannels(db) {
  return db.prepare(`
    SELECT *
    FROM marketing_channels
    ORDER BY
      CASE id WHEN 'linkedin' THEN 1 WHEN 'youtube' THEN 2 WHEN 'tiktok' THEN 3 ELSE 4 END,
      name ASC
  `).all().map((row) => ({
    ...mapRow(row, ["content_pillars"]),
    contentPillars: parseJson(row.content_pillars, []),
    publishingEnabled: Boolean(row.publishing_enabled),
  }));
}

export function listMarketingCampaigns(db, limit = 50) {
  return db.prepare(`
    SELECT *
    FROM marketing_campaigns
    ORDER BY
      CASE status WHEN 'Review' THEN 1 WHEN 'Planned' THEN 2 WHEN 'Draft' THEN 3 ELSE 4 END,
      start_date ASC,
      updated_at DESC,
      id DESC
    LIMIT ?
  `).all(Number(limit) || 50).map((row) => ({
    ...mapRow(row, ["channels", "success_metrics"]),
    channels: parseJson(row.channels, []),
    successMetrics: parseJson(row.success_metrics, []),
    externalPublishingEnabled: Boolean(row.external_publishing_enabled),
    metadata: parseJson(row.metadata, {}),
  }));
}

export function listMarketingContentItems(db, limit = 100) {
  return db.prepare(`
    SELECT i.*, ch.name AS channel_name, ca.name AS campaign_name
    FROM marketing_content_items i
    LEFT JOIN marketing_channels ch ON ch.id = i.channel_id
    LEFT JOIN marketing_campaigns ca ON ca.id = i.campaign_id
    ORDER BY
      CASE i.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
      COALESCE(NULLIF(i.planned_date, ''), i.updated_at) ASC,
      i.id DESC
    LIMIT ?
  `).all(Number(limit) || 100).map((row) => ({
    ...mapRow(row, ["metadata"]),
    metadata: parseJson(row.metadata, {}),
  }));
}

export function listMarketingOpportunities(db, limit = 50) {
  return db.prepare(`
    SELECT o.*, ch.name AS channel_name
    FROM marketing_opportunities o
    LEFT JOIN marketing_channels ch ON ch.id = o.channel_id
    ORDER BY
      CASE o.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
      o.updated_at DESC,
      o.id DESC
    LIMIT ?
  `).all(Number(limit) || 50).map((row) => ({
    ...mapRow(row, ["metadata"]),
    metadata: parseJson(row.metadata, {}),
  }));
}

export function listMarketingFeedback(db, limit = 50) {
  return db.prepare(`
    SELECT f.*, i.title AS content_title, c.name AS campaign_name
    FROM marketing_feedback f
    LEFT JOIN marketing_content_items i ON i.id = f.content_item_id
    LEFT JOIN marketing_campaigns c ON c.id = f.campaign_id
    ORDER BY
      CASE f.recommendation_status WHEN 'unreviewed' THEN 1 WHEN 'accepted' THEN 2 ELSE 3 END,
      f.updated_at DESC,
      f.id DESC
    LIMIT ?
  `).all(Number(limit) || 50).map((row) => ({
    ...mapRow(row, ["metadata"]),
    metadata: parseJson(row.metadata, {}),
  }));
}

function ensureMayaMondayIntegration(db) {
  const content = listMarketingContentItems(db, 100);
  for (const item of content) {
    if (recordExists(db, "work_items", "marketing_content", item.id)) continue;
    mondayOperatingCollection(db, "work-items", {
      title: item.title,
      detail: item.summary || `Prepare ${item.contentType} for ${item.channelName || item.channelId || "marketing channel"}.`,
      itemType: "content_calendar",
      ownerAgentId: MAYA_AGENT_ID,
      businessEntityId: "media-businesses",
      companyId: "media",
      priority: item.priority,
      status: normalizeMarketingStatus(item.status),
      dueDate: item.plannedDate,
      sourceType: "marketing_content",
      sourceId: item.id,
      sourceReference: sourceReference("marketing_content", item.id, item.title),
      metadata: { channelId: item.channelId, campaignId: item.campaignId, externalPublishingEnabled: false },
      userAction: "maya:monday-sync-content",
    });
  }

  const campaigns = listMarketingCampaigns(db, 50);
  for (const campaign of campaigns) {
    if (recordExists(db, "deliverables", "marketing_campaign", campaign.id)) continue;
    mondayOperatingCollection(db, "deliverables", {
      title: `${campaign.name} campaign plan`,
      detail: campaign.objective,
      ownerAgentId: MAYA_AGENT_ID,
      businessEntityId: campaign.businessEntityId || "media-businesses",
      companyId: campaign.companyId || "media",
      status: normalizeMarketingStatus(campaign.status),
      priority: "Medium",
      dueDate: campaign.startDate || campaign.endDate,
      linkedBusinessId: campaign.businessEntityId || "media-businesses",
      linkedMemoryReference: sourceReference("marketing_campaign", campaign.id, campaign.name),
      sourceType: "marketing_campaign",
      sourceId: campaign.id,
      sourceReference: sourceReference("marketing_campaign", campaign.id, campaign.name),
      metadata: { channels: campaign.channels, externalPublishingEnabled: false },
      userAction: "maya:monday-sync-campaign",
    });
  }

  const opportunities = listMarketingOpportunities(db, 50);
  for (const opportunity of opportunities) {
    if (recordExists(db, "operational_opportunities", "marketing_opportunity", opportunity.id)) continue;
    mondayOperatingCollection(db, "opportunities", {
      title: opportunity.title,
      detail: opportunity.detail,
      ownerAgentId: MAYA_AGENT_ID,
      businessEntityId: opportunity.businessEntityId || "media-businesses",
      companyId: opportunity.companyId || "media",
      businessImpact: opportunity.potentialImpact,
      priority: opportunity.priority,
      status: normalizeMarketingStatus(opportunity.status),
      recommendedAction: opportunity.recommendedAction,
      sourceType: "marketing_opportunity",
      sourceId: opportunity.id,
      sourceReference: sourceReference("marketing_opportunity", opportunity.id, opportunity.title),
      metadata: { channelId: opportunity.channelId, externalPublishingEnabled: false },
      userAction: "maya:monday-sync-opportunity",
    });
  }

  const feedback = listMarketingFeedback(db, 50);
  for (const item of feedback) {
    if (recordExists(db, "output_feedback", "marketing_feedback", item.id)) continue;
    mondayOperatingCollection(db, "feedback", {
      agentId: MAYA_AGENT_ID,
      outputType: "marketing_feedback",
      outputTitle: item.contentTitle || item.campaignName || "Marketing feedback",
      rating: item.rating,
      recommendationStatus: item.recommendationStatus,
      lessonLearned: item.lessonLearned || item.feedback,
      futureWorkSuggestion: item.futureWorkSuggestion,
      memoryReference: sourceReference("marketing_feedback", item.id),
      sourceType: "marketing_feedback",
      sourceId: item.id,
      sourceReference: sourceReference("marketing_feedback", item.id),
      metadata: { contentItemId: item.contentItemId, campaignId: item.campaignId },
      userAction: "maya:monday-sync-feedback",
    });
  }
}

function marketingMeetings(db) {
  return listMeetings(db, { limit: 50 })
    .filter((meeting) => meeting.relatedAgent === MAYA_AGENT_ID || MARKETING_KEYWORDS.test(`${meeting.title} ${meeting.clientName} ${meeting.projectName}`))
    .slice(0, 8);
}

function filterMayaRecords(records = []) {
  return records.filter((record) => record.ownerAgentId === MAYA_AGENT_ID || record.agentId === MAYA_AGENT_ID);
}

function mayaWorkload(mondayDashboard) {
  return mondayDashboard.agentWorkloads.find((item) => item.agentId === MAYA_AGENT_ID)
    || mondayDashboard.workloadMetrics.find((item) => item.agentId === MAYA_AGENT_ID)
    || null;
}

export function createMarketingContentItem(db, payload = {}) {
  const timestamp = nowIso();
  const result = db.prepare(`
    INSERT INTO marketing_content_items (
      channel_id, campaign_id, title, content_type, theme, target_audience,
      status, priority, planned_date, summary, call_to_action, source_type,
      source_id, source_reference, metadata, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    clean(payload.channelId || payload.channel_id || "linkedin"),
    payload.campaignId || payload.campaign_id || null,
    clean(payload.title || "Untitled content idea"),
    clean(payload.contentType || payload.content_type || "post"),
    clean(payload.theme || ""),
    clean(payload.targetAudience || payload.target_audience || ""),
    normalizeMarketingStatus(payload.status || "Planned"),
    normalizePriority(payload.priority),
    clean(payload.plannedDate || payload.planned_date || ""),
    clean(payload.summary || payload.detail || ""),
    clean(payload.callToAction || payload.call_to_action || ""),
    clean(payload.sourceType || payload.source_type || "maya"),
    String(payload.sourceId || payload.source_id || ""),
    clean(payload.sourceReference || payload.source_reference || ""),
    json({ ...(payload.metadata || {}), externalPublishingEnabled: false }),
    timestamp,
    timestamp,
  );
  const item = listMarketingContentItems(db, 1).find((record) => record.id === rowId(result))
    || mapRow(db.prepare("SELECT * FROM marketing_content_items WHERE id = ?").get(rowId(result)), ["metadata"]);
  recordMayaAudit(db, {
    eventType: "content_item_created",
    userAction: payload.userAction || "maya:content:create",
    recordType: "marketing_content",
    recordId: item.id,
    dataCategories: ["marketing_content", "content_calendar", "monday_operating_system"],
    outputSaved: true,
    metadata: { title: item.title, channelId: item.channelId, externalPublishingEnabled: false },
  });
  ensureMayaMondayIntegration(db);
  return { ...item, boundary: MAYA_READ_ONLY_BOUNDARY };
}

export function createMarketingCampaign(db, payload = {}) {
  const timestamp = nowIso();
  const result = db.prepare(`
    INSERT INTO marketing_campaigns (
      name, objective, business_entity_id, company_id, status, start_date,
      end_date, channels, target_audience, budget_placeholder, success_metrics,
      external_publishing_enabled, source_reference, metadata, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  `).run(
    clean(payload.name || "Untitled marketing campaign"),
    clean(payload.objective || ""),
    clean(payload.businessEntityId || payload.business_entity_id || "media-businesses"),
    clean(payload.companyId || payload.company_id || "media"),
    normalizeMarketingStatus(payload.status || "Planned"),
    clean(payload.startDate || payload.start_date || ""),
    clean(payload.endDate || payload.end_date || ""),
    json(payload.channels || []),
    clean(payload.targetAudience || payload.target_audience || ""),
    clean(payload.budgetPlaceholder || payload.budget_placeholder || "No paid spend approved."),
    json(payload.successMetrics || payload.success_metrics || []),
    clean(payload.sourceReference || payload.source_reference || ""),
    json({ ...(payload.metadata || {}), externalPublishingEnabled: false }),
    timestamp,
    timestamp,
  );
  const campaign = listMarketingCampaigns(db, 100).find((record) => record.id === rowId(result));
  recordMayaAudit(db, {
    eventType: "campaign_created",
    userAction: payload.userAction || "maya:campaign:create",
    recordType: "marketing_campaign",
    recordId: campaign.id,
    dataCategories: ["marketing_campaign", "deliverable", "monday_operating_system"],
    outputSaved: true,
    metadata: { name: campaign.name, externalPublishingEnabled: false },
  });
  ensureMayaMondayIntegration(db);
  return { ...campaign, boundary: MAYA_READ_ONLY_BOUNDARY };
}

export function recordMarketingFeedback(db, payload = {}) {
  const timestamp = nowIso();
  const result = db.prepare(`
    INSERT INTO marketing_feedback (
      content_item_id, campaign_id, source_type, source_id, feedback, rating,
      recommendation_status, lesson_learned, future_work_suggestion,
      source_reference, metadata, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payload.contentItemId || payload.content_item_id || null,
    payload.campaignId || payload.campaign_id || null,
    clean(payload.sourceType || payload.source_type || "manual"),
    String(payload.sourceId || payload.source_id || ""),
    clean(payload.feedback || ""),
    clean(payload.rating || "unrated"),
    clean(payload.recommendationStatus || payload.recommendation_status || "unreviewed"),
    clean(payload.lessonLearned || payload.lesson_learned || ""),
    clean(payload.futureWorkSuggestion || payload.future_work_suggestion || ""),
    clean(payload.sourceReference || payload.source_reference || ""),
    json(payload.metadata || {}),
    timestamp,
    timestamp,
  );
  const feedback = listMarketingFeedback(db, 100).find((record) => record.id === rowId(result));
  recordMayaAudit(db, {
    eventType: "feedback_recorded",
    userAction: payload.userAction || "maya:feedback:create",
    recordType: "marketing_feedback",
    recordId: feedback.id,
    dataCategories: ["marketing_feedback", "feedback_loop", "monday_operating_system"],
    outputSaved: true,
    metadata: { rating: feedback.rating, recommendationStatus: feedback.recommendationStatus },
  });
  ensureMayaMondayIntegration(db);
  return { ...feedback, boundary: MAYA_READ_ONLY_BOUNDARY };
}

export function getMayaDashboard(db) {
  ensureMayaMondayIntegration(db);
  const channels = listMarketingChannels(db);
  const campaigns = listMarketingCampaigns(db);
  const contentItems = listMarketingContentItems(db);
  const opportunities = listMarketingOpportunities(db);
  const feedback = listMarketingFeedback(db);
  const monday = getMondayOperatingDashboard(db);
  const workItems = filterMayaRecords(monday.workItems);
  const deliverables = filterMayaRecords(monday.deliverables);
  const risks = filterMayaRecords(monday.operationalRisks);
  const operatingOpportunities = filterMayaRecords(monday.operationalOpportunities);
  const decisions = filterMayaRecords(monday.operationalDecisions);
  const outputFeedback = filterMayaRecords(monday.outputFeedback);
  const meetings = marketingMeetings(db);
  const today = todayIsoDate();
  const activeContent = contentItems.filter((item) => !COMPLETE_STATUSES.has(normalizeMarketingStatus(item.status)));
  const overdueContent = activeContent.filter((item) => item.plannedDate && item.plannedDate.slice(0, 10) < today);
  const nextContent = activeContent.filter((item) => !item.plannedDate || item.plannedDate.slice(0, 10) >= today).slice(0, 8);
  return {
    profile: getMayaProfile(db),
    domains: MAYA_DOMAINS,
    channels,
    campaigns,
    contentItems,
    contentCalendar: nextContent,
    overdueContent,
    opportunities,
    feedback,
    meetings,
    monday: {
      workload: mayaWorkload(monday),
      workItems,
      deliverables,
      risks,
      opportunities: operatingOpportunities,
      decisions,
      feedback: outputFeedback,
      boundary: MONDAY_OPERATING_BOUNDARY,
    },
    metrics: {
      channels: channels.length,
      activeChannels: channels.filter((channel) => channel.status !== "Disabled").length,
      activeCampaigns: campaigns.filter((campaign) => !COMPLETE_STATUSES.has(normalizeMarketingStatus(campaign.status))).length,
      plannedContent: activeContent.length,
      overdueContent: overdueContent.length,
      marketingOpportunities: opportunities.filter((item) => !COMPLETE_STATUSES.has(normalizeMarketingStatus(item.status))).length,
      feedbackForReview: feedback.filter((item) => item.recommendationStatus === "unreviewed").length,
      openWorkItems: workItems.filter((item) => !COMPLETE_STATUSES.has(item.status)).length,
      deliverablesDue: deliverables.filter((item) => !COMPLETE_STATUSES.has(item.status)).length,
      risks: risks.filter((item) => !COMPLETE_STATUSES.has(item.status)).length,
      decisions: decisions.filter((item) => !COMPLETE_STATUSES.has(item.status)).length,
      relatedMeetings: meetings.length,
    },
    boundary: MAYA_READ_ONLY_BOUNDARY,
  };
}

export function generateMayaAnalysis(db, payload = {}) {
  const dashboard = getMayaDashboard(db);
  const channels = dashboard.channels;
  const requestedChannel = clean(payload.channelId || payload.channel || "");
  const channel = channels.find((item) => item.id === requestedChannel || item.name.toLowerCase() === requestedChannel.toLowerCase())
    || channels[0]
    || { id: "linkedin", name: "LinkedIn" };
  const topic = clean(payload.topic || payload.context || "Alfred executive operating system");
  const currentContent = dashboard.contentItems.filter((item) => !requestedChannel || item.channelId === channel.id).slice(0, 6);
  const recommendations = [
    {
      title: `${channel.name} narrative arc`,
      detail: `Shape ${topic} into a clear point of view, proof point and practical takeaway. Keep any claims tied to confirmed Alfred capabilities.`,
      sourceReference: `marketing_channel:${channel.id}`,
    },
    {
      title: "Repurpose before scaling",
      detail: "Turn one executive thesis into a LinkedIn post, YouTube outline and short-form hook before increasing cadence.",
      sourceReference: "marketing_strategy:repurposing",
    },
    {
      title: "Protect confidentiality",
      detail: "Avoid client-sensitive project details and describe Digitize/Westbridge examples at a safe summary level unless Patrick approves specifics.",
      sourceReference: "maya_boundary:confidentiality",
    },
  ];
  const risks = [
    "Overclaiming Alfred automation before execution safeguards exist.",
    "Using confidential client/project details in public thought leadership.",
    "Starting too many channels before a repeatable content cadence is proven.",
  ];
  const decisionsRequired = [
    `Approve the first ${channel.name} narrative lane for ${topic}.`,
    "Choose whether the priority is authority, inbound leads, audience testing or monetisation.",
  ];
  const analysis = {
    specialist: {
      name: "Maya",
      title: "Media Director",
      reportsTo: "Alfred",
      domains: MAYA_DOMAINS,
    },
    executiveSummary: `Maya recommends treating ${topic} as a focused ${channel.name} thought-leadership lane first, with no posting until Patrick approves the content direction.`,
    topPriorities: recommendations,
    contentPlan: currentContent.map((item) => ({
      title: item.title,
      channel: item.channelName || channelName(channels, item.channelId),
      status: item.status,
      priority: item.priority,
      sourceReference: `marketing_content:${item.id}`,
    })),
    risks,
    opportunities: dashboard.opportunities.slice(0, 5).map((item) => ({
      title: item.title,
      detail: item.potentialImpact || item.detail,
      sourceReference: `marketing_opportunity:${item.id}`,
    })),
    decisionsRequired,
    recommendedNextActions: [
      "Confirm the target audience and one measurable outcome for this content lane.",
      "Draft content inside Alfred only, then route it for Patrick review.",
      "Capture feedback after review so Maya can improve future recommendations.",
    ],
    confidenceLevel: dashboard.contentItems.length ? "medium" : "low",
    assumptions: [
      "Maya has not posted, scheduled, messaged or launched anything externally.",
      "Current analysis uses Alfred marketing records, Monday OS records, meetings and memory summaries only.",
      "No live social platform analytics are connected in this phase.",
    ],
    sourceRecordReferences: [
      `marketing_channel:${channel.id}`,
      ...currentContent.map((item) => `marketing_content:${item.id}`),
      ...dashboard.opportunities.slice(0, 5).map((item) => `marketing_opportunity:${item.id}`),
      ...dashboard.meetings.slice(0, 3).map((meeting) => `meeting:${meeting.id}`),
    ],
    boundary: MAYA_READ_ONLY_BOUNDARY,
  };
  const auditId = recordMayaAudit(db, {
    eventType: "marketing_analysis",
    userAction: payload.userAction || "maya:analyse-marketing",
    recordType: "marketing_analysis",
    dataCategories: ["marketing_channels", "marketing_content", "marketing_opportunities", "meeting_intelligence", "monday_operating_system", "semantic_memory"],
    model: "maya-deterministic-v1",
    metadata: { topic, channelId: channel.id, contentItemsReviewed: currentContent.length },
  });
  return { ...analysis, auditId, model: "maya-deterministic-v1" };
}

export function mayaBriefingForDaily(db) {
  const dashboard = getMayaDashboard(db);
  const items = [
    ...dashboard.overdueContent.slice(0, 3).map((item) => ({
      title: `${item.channelName || channelName(dashboard.channels, item.channelId)} content overdue: ${item.title}`,
      detail: item.summary || "Content calendar item needs review.",
      priority: item.priority === "High" || item.priority === "Critical" ? "high" : "medium",
      sourceReference: `marketing_content:${item.id}`,
    })),
    ...dashboard.opportunities.slice(0, 3).map((item) => ({
      title: item.title,
      detail: item.potentialImpact || item.detail,
      priority: item.priority === "High" || item.priority === "Critical" ? "high" : "medium",
      sourceReference: `marketing_opportunity:${item.id}`,
    })),
    ...dashboard.feedback.filter((item) => item.recommendationStatus === "unreviewed").slice(0, 2).map((item) => ({
      title: item.contentTitle || item.campaignName || "Marketing feedback needs review",
      detail: item.feedback || item.futureWorkSuggestion || "Review Maya feedback.",
      priority: item.rating === "negative" ? "high" : "medium",
      sourceReference: `marketing_feedback:${item.id}`,
    })),
  ].slice(0, 6);
  return {
    title: "Maya Marketing Brief",
    summary: items.length
      ? `${items.length} Maya marketing signal(s) need review. No posting or outbound marketing action has occurred.`
      : "No Maya marketing exceptions detected from current records.",
    metrics: dashboard.metrics,
    items,
    boundary: MAYA_READ_ONLY_BOUNDARY,
  };
}

export function searchMayaKnowledge(db, query = "") {
  const normalizedQuery = clean(query).toLowerCase();
  if (!normalizedQuery) {
    return {
      query: "",
      contentItems: [],
      campaigns: [],
      opportunities: [],
      feedback: [],
      boundary: MAYA_READ_ONLY_BOUNDARY,
    };
  }
  const terms = [...new Set([normalizedQuery, ...normalizedQuery.split(/\s+/).filter((part) => part.length > 2)])].map((term) => `%${term}%`);
  const search = (sqlPrefix, fields, orderBy, mapper) => {
    const clauses = [];
    const params = [];
    for (const field of fields) {
      for (const term of terms) {
        clauses.push(`LOWER(COALESCE(${field}, '')) LIKE ?`);
        params.push(term);
      }
    }
    return db.prepare(`${sqlPrefix} WHERE ${clauses.join(" OR ")} ${orderBy}`).all(...params).map(mapper);
  };
  return {
    query: clean(query),
    contentItems: search(`
      SELECT i.*, ch.name AS channel_name, ca.name AS campaign_name
      FROM marketing_content_items i
      LEFT JOIN marketing_channels ch ON ch.id = i.channel_id
      LEFT JOIN marketing_campaigns ca ON ca.id = i.campaign_id
    `, ["i.title", "i.summary", "i.theme", "ch.name", "ca.name"], `
      ORDER BY i.updated_at DESC, i.id DESC
      LIMIT 25
    `, (row) => mapRow(row, ["metadata"])),
    campaigns: search(`
      SELECT *
      FROM marketing_campaigns
    `, ["name", "objective", "target_audience", "channels"], `
      ORDER BY updated_at DESC, id DESC
      LIMIT 25
    `, (row) => ({ ...mapRow(row, ["channels", "success_metrics", "metadata"]), channels: parseJson(row.channels, []), successMetrics: parseJson(row.success_metrics, []) })),
    opportunities: search(`
      SELECT o.*, ch.name AS channel_name
      FROM marketing_opportunities o
      LEFT JOIN marketing_channels ch ON ch.id = o.channel_id
    `, ["o.title", "o.detail", "o.potential_impact", "o.recommended_action", "ch.name"], `
      ORDER BY o.updated_at DESC, o.id DESC
      LIMIT 25
    `, (row) => mapRow(row, ["metadata"])),
    feedback: search(`
      SELECT f.*, i.title AS content_title, c.name AS campaign_name
      FROM marketing_feedback f
      LEFT JOIN marketing_content_items i ON i.id = f.content_item_id
      LEFT JOIN marketing_campaigns c ON c.id = f.campaign_id
    `, ["f.feedback", "f.lesson_learned", "f.future_work_suggestion", "i.title", "c.name"], `
      ORDER BY f.updated_at DESC, f.id DESC
      LIMIT 25
    `, (row) => mapRow(row, ["metadata"])),
    sourceReferences: ["marketing_content", "marketing_campaign", "marketing_opportunity", "marketing_feedback", "monday_operating_system", "meeting_intelligence"],
    boundary: MAYA_READ_ONLY_BOUNDARY,
  };
}

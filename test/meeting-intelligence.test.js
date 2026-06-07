import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDatabase, listSemanticSourceRecords } from "../db.js";
import { MICROSOFT_SCOPES } from "../microsoft.js";
import {
  MEETING_READ_ONLY_BOUNDARY,
  createMeetingRecord,
  extractMeetingSignals,
  getMeetingDashboard,
  getMeetingDetail,
  importMeetingMetadata,
  listMeetingAudit,
  meetingBriefingForDaily,
  processMeetingTranscript,
  recordMeetingFeedback,
  searchMeetingKnowledge,
} from "../meeting-intelligence.js";

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-meetings-"));
  const path = join(directory, "test.db");
  const db = createDatabase(path);
  const cleanup = () => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  };
  try {
    const result = run(db);
    if (result && typeof result.then === "function") return result.finally(cleanup);
    cleanup();
    return result;
  } catch (error) {
    cleanup();
    throw error;
  }
}

function westminsterMeeting(overrides = {}) {
  return {
    id: "calendar-westminster-1",
    subject: "Westminster Teams project review",
    start: { dateTime: "2026-06-08T09:30:00Z" },
    end: { dateTime: "2026-06-08T10:00:00Z" },
    organizer: { emailAddress: { name: "Client Lead", address: "lead@westminster.gov.uk" } },
    attendees: [
      { type: "required", emailAddress: { name: "Patrick King", address: "patrick@example.test" } },
      { type: "required", emailAddress: { name: "Westminster PM", address: "pm@westminster.gov.uk" } },
    ],
    bodyPreview: "Westminster BIM, ISO 19650 and access review.",
    webLink: "https://example.test/calendar/westminster",
    ...overrides,
  };
}

function transcriptText() {
  return [
    "Action: Patrick to confirm Westminster COBie owner by Friday.",
    "We agreed that Patrick approval is required before any external follow up.",
    "Risk: confidential access to the BIM folder needs review because missing permissions could expose sensitive data.",
    "Opportunity to automate the weekly ISO 19650 report for the client.",
    "What project information is still missing?",
    "Client confirmed the meeting summary was useful feedback.",
    "Olivia should review revenue and invoice exposure.",
    "James should review the Council Assurance Platform MVP validation plan.",
    "Westbridge property due diligence is unrelated but should remain separate.",
  ].join(" ");
}

test("meeting metadata import stores read-only calendar records and transcript-unavailable fallback", () => {
  withDatabase((db) => {
    const result = importMeetingMetadata(db, [westminsterMeeting()], { userAction: "test:meeting:calendar-import" });
    const detail = getMeetingDetail(db, result.meetings[0].id);
    const audit = listMeetingAudit(db);

    assert.equal(result.readOnly, true);
    assert.equal(result.transcriptContentRead, false);
    assert.equal(result.meetingsStored, 1);
    assert.equal(detail.meeting.projectName, "Westminster");
    assert.equal(detail.attendees.length, 2);
    assert.equal(detail.summary.confidenceLevel, "assumption");
    assert.match(detail.summary.summary, /Transcript not available/);
    assert.ok(detail.summary.assumptions.some((item) => /Do not treat metadata/i.test(item)));
    assert.ok(detail.agentReviews.some((review) => review.agentId === "sentinel" && review.status === "planned_review"));
    assert.equal(audit[0].executionAttempted, false);
    assert.equal(audit[0].metadata.boundary.calendarWriteEnabled, false);
  });
});

test("transcript processing extracts follow-ups without storing raw transcript by default", () => {
  withDatabase((db) => {
    const created = createMeetingRecord(db, westminsterMeeting({ sourceSystem: "alfred_manual" }));
    const processed = processMeetingTranscript(db, created.meeting.id, {
      transcriptText: transcriptText(),
      transcriptReference: "teams-transcript:westminster-1",
      userAction: "test:meeting:transcript-process",
    });
    const storedTranscript = db.prepare("SELECT * FROM meeting_transcripts WHERE meeting_id = ?").get(created.meeting.id);

    assert.equal(processed.meeting.transcriptAvailable, true);
    assert.equal(processed.meeting.transcriptStatus, "summary_extracted");
    assert.equal(storedTranscript.raw_content_stored, 0);
    assert.equal(storedTranscript.transcript_text, "");
    assert.ok(processed.actions.some((item) => /Patrick to confirm Westminster COBie owner/i.test(item.title)));
    assert.ok(processed.decisions.some((item) => item.approvalRequired === 1));
    assert.ok(processed.risks.some((item) => /confidential access/i.test(item.title)));
    assert.ok(processed.opportunities.some((item) => /automate/i.test(item.title)));
    assert.ok(processed.questions.some((item) => /missing/i.test(item.question)));
    assert.ok(processed.feedback.some((item) => item.recommendationStatus === "accepted"));
    assert.doesNotMatch(processed.memoryLinks.find((link) => link.sourceType === "meeting_record").summary, /Metadata only/);

    const reprocessed = processMeetingTranscript(db, created.meeting.id, {
      transcriptText: transcriptText(),
      transcriptReference: "teams-transcript:westminster-1",
      userAction: "test:meeting:transcript-reprocess",
    });
    assert.equal(reprocessed.transcripts.length, 1);
    assert.equal(reprocessed.feedback.filter((item) => item.outputType === "meeting_discussion").length, 1);
  });
});

test("agent reviews route meeting context to Alfred, Sarah, Olivia, James, Westbridge and Sentinel", () => {
  withDatabase((db) => {
    const detail = createMeetingRecord(db, {
      ...westminsterMeeting({
        id: "calendar-agent-routing-1",
        bodyPreview: "BIM, invoice, product MVP validation, property due diligence and confidential access review.",
      }),
      transcriptText: transcriptText(),
      transcriptPermitted: true,
    });
    const reviewers = new Set(getMeetingDetail(db, detail.meeting.id).agentReviews.map((review) => review.agentId));

    assert.ok(reviewers.has("alfred"));
    assert.ok(reviewers.has("sarah"));
    assert.ok(reviewers.has("olivia"));
    assert.ok(reviewers.has("james"));
    assert.ok(reviewers.has("westbridge-property-director"));
    assert.ok(reviewers.has("sentinel"));
  });
});

test("meeting feedback creates audit records and links lessons into memory", () => {
  withDatabase((db) => {
    const created = createMeetingRecord(db, westminsterMeeting({ id: "calendar-feedback-1" }));
    const detail = recordMeetingFeedback(db, {
      meetingId: created.meeting.id,
      outputType: "meeting_summary",
      agentId: "alfred",
      userFeedback: "The follow-up list was useful.",
      recommendationStatus: "accepted",
      followUpResult: "Patrick reviewed the notes.",
      lessonLearned: "Keep meeting actions grouped by client and project.",
      userAction: "test:meeting:feedback",
    });
    const memory = db.prepare("SELECT * FROM memories WHERE type = 'meeting_feedback' ORDER BY id DESC LIMIT 1").get();
    const audit = listMeetingAudit(db);

    assert.equal(detail.feedback[0].memoryUpdateReference, `memory:${memory.id}`);
    assert.equal(detail.memoryLinks.some((link) => link.sourceType === "meeting_feedback"), true);
    assert.equal(memory.company_id, "digitize");
    assert.equal(audit.some((event) => event.eventType === "feedback_captured" && event.executionAttempted === false), true);
  });
});

test("meeting search, dashboard and daily briefing use structured meeting intelligence", () => {
  withDatabase((db) => {
    const created = createMeetingRecord(db, westminsterMeeting({ id: "calendar-search-1" }));
    processMeetingTranscript(db, created.meeting.id, { transcriptText: transcriptText() });
    const search = searchMeetingKnowledge(db, "Westminster confidential access");
    const dashboard = getMeetingDashboard(db);
    const briefing = meetingBriefingForDaily(db);

    assert.ok(search.matchingMeetings.some((meeting) => meeting.title.includes("Westminster")));
    assert.ok(search.relatedRisks.some((risk) => /confidential access/i.test(risk.title)));
    assert.equal(dashboard.metrics.totalMeetings, 1);
    assert.equal(dashboard.metrics.openActions > 0, true);
    assert.equal(briefing.boundary.externalActionsEnabled, false);
    assert.ok(briefing.items.some((item) => item.sourceReference.startsWith("meeting_")));
  });
});

test("meeting summaries and feedback are available to semantic memory without raw transcript indexing", () => {
  withDatabase((db) => {
    const created = createMeetingRecord(db, westminsterMeeting({ id: "calendar-memory-1" }));
    processMeetingTranscript(db, created.meeting.id, { transcriptText: transcriptText(), storeTranscriptText: false });
    recordMeetingFeedback(db, {
      meetingId: created.meeting.id,
      userFeedback: "Useful meeting analysis.",
      lessonLearned: "Westminster meeting reviews need source references.",
    });
    const records = listSemanticSourceRecords(db);
    const storedTranscript = db.prepare("SELECT * FROM meeting_transcripts WHERE meeting_id = ?").get(created.meeting.id);
    const meetingSummary = records.find((record) => record.sourceType === "meeting_summary");
    const meetingFeedback = records.find((record) => record.sourceType === "meeting_feedback");

    assert.equal(storedTranscript.raw_content_stored, 0);
    assert.equal(storedTranscript.transcript_text, "");
    assert.ok(meetingSummary);
    assert.match(meetingSummary.summary, /raw audio is not stored/i);
    assert.ok(meetingFeedback);
    assert.equal(meetingFeedback.sensitivityCategory, "local_sensitive_business_data");
  });
});

test("meeting intelligence is wired into the server executive briefing pipeline", () => {
  withDatabase((db) => {
    const created = createMeetingRecord(db, westminsterMeeting({ id: "calendar-briefing-1" }));
    processMeetingTranscript(db, created.meeting.id, { transcriptText: transcriptText() });
    const meetingBrief = meetingBriefingForDaily(db);
    const server = readFileSync(new URL("../server.js", import.meta.url), "utf8");

    assert.equal(meetingBrief.metrics.openActions > 0, true);
    assert.match(server, /brief\.meetingIntelligence = meetingBriefingForDaily/);
    assert.match(server, /meetingIntelligenceSignals/);
    assert.match(server, /meeting_intelligence/);
  });
});

test("meeting intelligence keeps Microsoft and execution boundaries read-only", () => {
  const forbiddenScopes = ["Mail.Send", "Calendars.ReadWrite", "Files.ReadWrite", "Sites.ReadWrite.All", "Group.ReadWrite.All", "ChannelMessage.Send"];
  for (const scope of forbiddenScopes) {
    assert.equal(MICROSOFT_SCOPES.includes(scope), false);
  }
  assert.equal(MEETING_READ_ONLY_BOUNDARY.readOnly, true);
  assert.equal(MEETING_READ_ONLY_BOUNDARY.teamsWritePermissions, false);
  assert.equal(MEETING_READ_ONLY_BOUNDARY.calendarWriteEnabled, false);
  assert.equal(MEETING_READ_ONLY_BOUNDARY.externalActionsEnabled, false);
});

test("frontend and API expose the meeting intelligence dashboard safely", () => {
  const server = readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

  assert.match(server, /\/api\/meeting-intelligence\/dashboard/);
  assert.match(server, /\/api\/meeting-intelligence\/import-calendar/);
  assert.match(app, /renderMeetingIntelligence/);
  assert.match(app, /meetingIntelligence/);
  assert.match(html, /id="meetings-view"/);
  assert.match(html, /Import calendar metadata/);
});

test("standalone signal extraction returns structured action, decision, risk and feedback records", () => {
  const extracted = extractMeetingSignals(transcriptText(), { meetingId: 42 });

  assert.equal(extracted.actions.length > 0, true);
  assert.equal(extracted.decisions.length > 0, true);
  assert.equal(extracted.risks.length > 0, true);
  assert.equal(extracted.opportunities.length > 0, true);
  assert.equal(extracted.questions.length > 0, true);
  assert.equal(extracted.feedback.length > 0, true);
  assert.equal(extracted.risks[0].sourceReference, "meeting_transcript:42");
});

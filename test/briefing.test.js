import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDecisionPrompts,
  buildExecutiveAnalysis,
  extractRiskSignals,
  prepareMeetings,
  prioritiseEmails,
} from "../briefing.js";

const NOW = new Date("2026-06-05T09:00:00.000Z");

test("prioritises unread, important, recent and client-related email", () => {
  const emails = prioritiseEmails([
    {
      id: "1",
      subject: "Urgent Westminster approval required",
      bodyPreview: "Please confirm the decision today.",
      from: { emailAddress: { name: "Client Lead" } },
      receivedDateTime: "2026-06-05T08:30:00.000Z",
      isRead: false,
      importance: "high",
    },
    {
      id: "2",
      subject: "Newsletter",
      bodyPreview: "Monthly update",
      receivedDateTime: "2026-06-01T08:30:00.000Z",
      isRead: true,
      importance: "normal",
    },
  ], {
    clients: [{ name: "Westminster" }],
    now: NOW,
  });

  assert.equal(emails[0].id, "1");
  assert.equal(emails[0].priority, "high");
  assert.ok(emails[0].reasons.includes("unread"));
  assert.ok(emails[0].score > emails[1].score);
});

test("creates meeting preparation with matched operating context", () => {
  const meetings = prepareMeetings([
    {
      id: "event-1",
      subject: "KSPF delivery decision",
      start: { dateTime: "2026-06-05T11:00:00.000Z" },
      end: { dateTime: "2026-06-05T12:00:00.000Z" },
      attendees: [{ emailAddress: { address: "one@example.com" } }],
      location: { displayName: "Teams" },
    },
  ], {
    clients: [{ name: "KSPF" }],
    projects: [],
    now: NOW,
  });

  assert.equal(meetings[0].urgency, "high");
  assert.match(meetings[0].preparation.join(" "), /KSPF/);
  assert.match(meetings[0].preparation.join(" "), /decision/i);
});

test("labels inferred risks and decisions as email signals", () => {
  const emails = [{
    id: "mail-1",
    subject: "Project delay - approval needed",
    bodyPreview: "The delivery is blocked. Please confirm.",
    priority: "high",
  }];

  const risks = extractRiskSignals({ emails, risks: [] });
  const decisions = buildDecisionPrompts({ emails, decisions: [] });

  assert.equal(risks[0].sourceType, "email-signal");
  assert.equal(risks[0].confidence, "signal");
  assert.equal(decisions[0].sourceType, "email-signal");
  assert.match(decisions[0].prompt, /review the source email/i);
});

test("builds a ranked executive analysis", () => {
  const analysis = buildExecutiveAnalysis({
    baseBrief: {
      actions: [{ id: 1, title: "Submit report", detail: "Due today", priority: "high" }],
      risks: [{ id: 1, title: "Delivery risk", detail: "Client deadline", priority: "high" }],
      opportunities: [],
      decisions: [],
    },
    messages: [],
    meetings: [],
    clients: [],
    projects: [],
    now: NOW,
  });

  assert.equal(analysis.executivePriorities[0].category, "risk");
  assert.equal(analysis.executivePriorities[0].rank, 1);
});

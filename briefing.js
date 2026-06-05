const HIGH_SIGNAL_WORDS = [
  "urgent",
  "critical",
  "risk",
  "issue",
  "delay",
  "overdue",
  "approval",
  "decision",
  "action required",
  "deadline",
  "escalation",
  "commercial",
  "invoice",
  "contract",
];

const DECISION_WORDS = [
  "approve",
  "approval",
  "decide",
  "decision",
  "confirm",
  "sign off",
  "which option",
  "your view",
  "can we",
];

const RISK_WORDS = [
  "risk",
  "issue",
  "delay",
  "blocked",
  "overdue",
  "complaint",
  "escalation",
  "breach",
  "failed",
  "missing",
];

function textFor(item) {
  return `${item.title || item.subject || ""} ${item.detail || item.bodyPreview || ""}`.toLowerCase();
}

function containsAny(text, words) {
  return words.filter((word) => text.includes(word));
}

function hoursUntil(value, now) {
  if (!value) return Number.POSITIVE_INFINITY;
  return (new Date(value).getTime() - now.getTime()) / 3_600_000;
}

function priorityWeight(priority) {
  return { high: 40, medium: 24, low: 10 }[priority] || 15;
}

export function prioritiseEmails(messages, { clients = [], now = new Date() } = {}) {
  const clientNames = clients.map((client) => client.name.toLowerCase());
  return messages
    .map((message) => {
      const text = textFor(message);
      const reasons = [];
      let score = 0;

      if (!message.isRead) {
        score += 18;
        reasons.push("unread");
      }
      if (message.importance === "high") {
        score += 30;
        reasons.push("marked high importance");
      }
      const signals = containsAny(text, HIGH_SIGNAL_WORDS);
      if (signals.length) {
        score += Math.min(signals.length * 9, 27);
        reasons.push(`contains ${signals.slice(0, 3).join(", ")}`);
      }
      const client = clientNames.find((name) => text.includes(name));
      if (client) {
        score += 18;
        reasons.push(`mentions client ${client}`);
      }
      const ageHours = message.receivedDateTime
        ? (now.getTime() - new Date(message.receivedDateTime).getTime()) / 3_600_000
        : Number.POSITIVE_INFINITY;
      if (ageHours <= 24) {
        score += 12;
        reasons.push("received in the last 24 hours");
      } else if (ageHours <= 72) {
        score += 5;
        reasons.push("received in the last 3 days");
      }

      return {
        ...message,
        score,
        priority: score >= 55 ? "high" : score >= 30 ? "medium" : "low",
        reasons,
        detail: `${message.from?.emailAddress?.name || message.from?.emailAddress?.address || "Unknown sender"}${reasons.length ? ` — ${reasons.join("; ")}` : ""}`,
      };
    })
    .sort((a, b) => b.score - a.score || new Date(b.receivedDateTime) - new Date(a.receivedDateTime));
}

export function prepareMeetings(meetings, { clients = [], projects = [], now = new Date() } = {}) {
  const knownTerms = [
    ...clients.map((client) => ({ type: "client", name: client.name })),
    ...projects.map((project) => ({ type: "project", name: project.name })),
  ];

  return meetings
    .map((meeting) => {
      const startValue = meeting.start?.dateTime || meeting.start;
      const hours = hoursUntil(startValue, now);
      const text = textFor(meeting);
      const matches = knownTerms.filter((term) => text.includes(term.name.toLowerCase()));
      const preparation = [];
      if (matches.length) preparation.push(`Review ${matches.map((match) => match.name).join(", ")} context`);
      if (meeting.attendees?.length) preparation.push(`Confirm desired outcome for ${meeting.attendees.length} attendee${meeting.attendees.length === 1 ? "" : "s"}`);
      if (containsAny(text, DECISION_WORDS).length) preparation.push("Prepare the decision and options required");
      if (!preparation.length) preparation.push("Confirm agenda, desired outcome and any pre-read");

      return {
        id: meeting.id,
        title: meeting.subject || "(No subject)",
        detail: `${startValue || "Time unavailable"}${meeting.location?.displayName ? ` — ${meeting.location.displayName}` : ""}`,
        start: meeting.start,
        end: meeting.end,
        webLink: meeting.webLink,
        hoursUntil: Number.isFinite(hours) ? Math.round(hours * 10) / 10 : null,
        urgency: hours <= 4 ? "high" : hours <= 24 ? "medium" : "low",
        preparation,
        matchedContext: matches,
      };
    })
    .sort((a, b) => (a.hoursUntil ?? Number.POSITIVE_INFINITY) - (b.hoursUntil ?? Number.POSITIVE_INFINITY));
}

export function extractRiskSignals({ emails = [], risks = [] }) {
  const recorded = risks.map((risk) => ({
    id: `risk-${risk.id}`,
    title: risk.title,
    detail: risk.detail,
    priority: risk.priority,
    sourceType: "recorded-risk",
    sourceId: risk.id,
    confidence: "confirmed",
  }));

  const inferred = emails
    .map((email) => {
      const signals = containsAny(textFor(email), RISK_WORDS);
      if (!signals.length) return null;
      return {
        id: `email-risk-${email.id}`,
        title: `Email signal: ${email.subject || "(No subject)"}`,
        detail: `Potential risk language detected: ${signals.slice(0, 4).join(", ")}. Review the source email before acting.`,
        priority: email.priority === "high" ? "high" : "medium",
        sourceType: "email-signal",
        sourceId: email.id,
        confidence: "signal",
      };
    })
    .filter(Boolean);

  return [...recorded, ...inferred];
}

export function buildDecisionPrompts({ decisions = [], emails = [] }) {
  const recorded = decisions.map((decision) => ({
    id: `decision-${decision.id}`,
    title: decision.title,
    detail: decision.detail,
    priority: decision.priority,
    sourceType: "recorded-decision",
    sourceId: decision.id,
    prompt: `Decision required: ${decision.title}. Confirm the preferred option, owner and deadline.`,
  }));

  const inferred = emails
    .map((email) => {
      const signals = containsAny(textFor(email), DECISION_WORDS);
      if (!signals.length) return null;
      return {
        id: `email-decision-${email.id}`,
        title: `Review decision signal: ${email.subject || "(No subject)"}`,
        detail: `The email contains decision language (${signals.slice(0, 3).join(", ")}).`,
        priority: email.priority === "high" ? "high" : "medium",
        sourceType: "email-signal",
        sourceId: email.id,
        prompt: "Review the source email and decide whether an explicit response or approval is required.",
      };
    })
    .filter(Boolean);

  return [...recorded, ...inferred];
}

export function rankExecutivePriorities({ actions = [], risks = [], opportunities = [], decisions = [], emails = [], meetings = [] }) {
  const records = [
    ...actions.map((item) => ({ ...item, category: "action", score: priorityWeight(item.priority) + 15 })),
    ...risks.map((item) => ({ ...item, category: "risk", score: priorityWeight(item.priority) + 30 })),
    ...decisions.map((item) => ({ ...item, category: "decision", score: priorityWeight(item.priority) + 25 })),
    ...opportunities.map((item) => ({ ...item, category: "opportunity", score: priorityWeight(item.priority) + 10 })),
    ...emails.slice(0, 5).map((item) => ({ ...item, title: item.subject || item.title, category: "email", score: item.score })),
    ...meetings.filter((item) => item.urgency !== "low").map((item) => ({
      ...item,
      category: "meeting",
      score: item.urgency === "high" ? 70 : 45,
    })),
  ];

  return records
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

export function buildExecutiveAnalysis({ baseBrief, messages = [], meetings = [], clients = [], projects = [], now = new Date() }) {
  const priorityEmails = prioritiseEmails(messages, { clients, now });
  const meetingPreparation = prepareMeetings(meetings, { clients, projects, now });
  const riskSignals = extractRiskSignals({ emails: priorityEmails, risks: baseBrief.risks });
  const decisionPrompts = buildDecisionPrompts({ decisions: baseBrief.decisions, emails: priorityEmails });
  const executivePriorities = rankExecutivePriorities({
    actions: baseBrief.actions,
    risks: riskSignals,
    opportunities: baseBrief.opportunities,
    decisions: decisionPrompts,
    emails: priorityEmails,
    meetings: meetingPreparation,
  });

  return {
    priorityEmails,
    meetingPreparation,
    riskSignals,
    decisionPrompts,
    executivePriorities,
  };
}

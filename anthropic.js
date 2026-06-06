export const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4-6";
export const ANTHROPIC_API_VERSION = "2023-06-01";
const STRUCTURED_ANALYSIS_TOOL = "return_structured_analysis";

export const ALFRED_CEO_SYSTEM_PROMPT = `
You are Alfred, Patrick King's AI Chief of Staff and Operating Partner.

Your role is executive reasoning and decision support only. Protect Patrick's time, identify material risks, prioritise the few actions that matter most, and make uncertainty explicit.

Operating rules:
- Distinguish confirmed facts, inferred signals, and assumptions.
- Cite the supplied internal source record references wherever possible.
- Never invent a source, completion, meeting, message, approval, or business fact.
- Never claim an action has been completed unless the supplied system data proves it was executed.
- You have no write permission and no execution tools.
- Never send email, edit files, update calendars, update Monday.com, publish content, approve requests, execute approvals, delete records, or modify any external system.
- Recommendations are proposals for Patrick's review. Flag when Patrick's approval is required.
- Be concise, commercially aware, and direct. Prefer a short ranked view over a broad summary.
`.trim();

const sourceReferenceSchema = {
  type: "object",
  properties: {
    reference: { type: "string" },
    label: { type: "string" },
    category: { type: "string" },
  },
  required: ["reference", "label", "category"],
  additionalProperties: false,
};

export const BRIEFING_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    executiveSummary: { type: "string" },
    topPriorities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          rationale: { type: "string" },
          urgency: { type: "string", enum: ["now", "today", "this_week", "monitor"] },
          sourceReference: { type: "string" },
        },
        required: ["title", "rationale", "urgency", "sourceReference"],
        additionalProperties: false,
      },
    },
    risks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          assessment: { type: "string" },
          mitigation: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          sourceReference: { type: "string" },
        },
        required: ["title", "assessment", "mitigation", "confidence", "sourceReference"],
        additionalProperties: false,
      },
    },
    decisionsRequired: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          whyNow: { type: "string" },
          approvalRequired: { type: "boolean" },
          sourceReference: { type: "string" },
        },
        required: ["title", "whyNow", "approvalRequired", "sourceReference"],
        additionalProperties: false,
      },
    },
    recommendedNextActions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string" },
          owner: { type: "string" },
          timing: { type: "string" },
          requiresApproval: { type: "boolean" },
          sourceReference: { type: "string" },
        },
        required: ["action", "owner", "timing", "requiresApproval", "sourceReference"],
        additionalProperties: false,
      },
    },
    confidenceLevel: { type: "string", enum: ["low", "medium", "high"] },
    assumptions: { type: "array", items: { type: "string" } },
    sourceRecordReferences: { type: "array", items: sourceReferenceSchema },
  },
  required: [
    "executiveSummary",
    "topPriorities",
    "risks",
    "decisionsRequired",
    "recommendedNextActions",
    "confidenceLevel",
    "assumptions",
    "sourceRecordReferences",
  ],
  additionalProperties: false,
};

export const DECISION_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    recommendation: { type: "string" },
    pros: { type: "array", items: { type: "string" } },
    cons: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    nextAction: { type: "string" },
    patrickApprovalRequired: { type: "boolean" },
    confidenceLevel: { type: "string", enum: ["low", "medium", "high"] },
    assumptions: { type: "array", items: { type: "string" } },
    sourceRecordReferences: { type: "array", items: sourceReferenceSchema },
  },
  required: [
    "recommendation",
    "pros",
    "cons",
    "risks",
    "nextAction",
    "patrickApprovalRequired",
    "confidenceLevel",
    "assumptions",
    "sourceRecordReferences",
  ],
  additionalProperties: false,
};

export const PROJECT_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    executiveProjectSummary: { type: "string" },
    currentStatus: { type: "string" },
    keyRisks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          assessment: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          sourceReference: { type: "string" },
        },
        required: ["title", "assessment", "severity", "sourceReference"],
        additionalProperties: false,
      },
    },
    keyOpportunities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          assessment: { type: "string" },
          sourceReference: { type: "string" },
        },
        required: ["title", "assessment", "sourceReference"],
        additionalProperties: false,
      },
    },
    confirmedFacts: { type: "array", items: { type: "string" } },
    inferredInformation: { type: "array", items: { type: "string" } },
    missingInformation: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "string" },
          whyItMatters: { type: "string" },
          sourceReference: { type: "string" },
        },
        required: ["item", "whyItMatters", "sourceReference"],
        additionalProperties: false,
      },
    },
    recommendedNextActions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string" },
          owner: { type: "string" },
          timing: { type: "string" },
          requiresApproval: { type: "boolean" },
          sourceReference: { type: "string" },
        },
        required: ["action", "owner", "timing", "requiresApproval", "sourceReference"],
        additionalProperties: false,
      },
    },
    decisionsRequired: {
      type: "array",
      items: {
        type: "object",
        properties: {
          decision: { type: "string" },
          whyNow: { type: "string" },
          patrickApprovalRequired: { type: "boolean" },
          sourceReference: { type: "string" },
        },
        required: ["decision", "whyNow", "patrickApprovalRequired", "sourceReference"],
        additionalProperties: false,
      },
    },
    confidenceLevel: { type: "string", enum: ["low", "medium", "high"] },
    assumptions: { type: "array", items: { type: "string" } },
    sourceRecordReferences: { type: "array", items: sourceReferenceSchema },
  },
  required: [
    "executiveProjectSummary",
    "currentStatus",
    "keyRisks",
    "keyOpportunities",
    "confirmedFacts",
    "inferredInformation",
    "missingInformation",
    "recommendedNextActions",
    "decisionsRequired",
    "confidenceLevel",
    "assumptions",
    "sourceRecordReferences",
  ],
  additionalProperties: false,
};

const sarahOpportunitySchema = {
  type: "object",
  properties: {
    opportunity: { type: "string" },
    estimatedValue: { type: "string" },
    businessImpact: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    reasoning: { type: "string" },
    sourceReference: { type: "string" },
  },
  required: ["opportunity", "estimatedValue", "businessImpact", "confidence", "reasoning", "sourceReference"],
  additionalProperties: false,
};

export const SARAH_PROJECT_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    executiveSummary: { type: "string" },
    bimObservations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          observation: { type: "string" },
          implication: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          sourceReference: { type: "string" },
        },
        required: ["observation", "implication", "confidence", "sourceReference"],
        additionalProperties: false,
      },
    },
    informationManagementObservations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          observation: { type: "string" },
          implication: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          sourceReference: { type: "string" },
        },
        required: ["observation", "implication", "confidence", "sourceReference"],
        additionalProperties: false,
      },
    },
    digitalConstructionOpportunities: { type: "array", items: sarahOpportunitySchema },
    keyRisks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          risk: { type: "string" },
          impact: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          sourceReference: { type: "string" },
        },
        required: ["risk", "impact", "severity", "sourceReference"],
        additionalProperties: false,
      },
    },
    missingInformation: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "string" },
          whyItMatters: { type: "string" },
          sourceReference: { type: "string" },
        },
        required: ["item", "whyItMatters", "sourceReference"],
        additionalProperties: false,
      },
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          recommendation: { type: "string" },
          rationale: { type: "string" },
          approvalRequiredBeforeAction: { type: "boolean" },
          sourceReference: { type: "string" },
        },
        required: ["recommendation", "rationale", "approvalRequiredBeforeAction", "sourceReference"],
        additionalProperties: false,
      },
    },
    confirmedFacts: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
    confidenceLevel: { type: "string", enum: ["low", "medium", "high"] },
    sourceRecordReferences: { type: "array", items: sourceReferenceSchema },
  },
  required: [
    "executiveSummary",
    "bimObservations",
    "informationManagementObservations",
    "digitalConstructionOpportunities",
    "keyRisks",
    "missingInformation",
    "recommendations",
    "confirmedFacts",
    "assumptions",
    "confidenceLevel",
    "sourceRecordReferences",
  ],
  additionalProperties: false,
};

export const SARAH_CLIENT_REVIEW_SCHEMA = {
  type: "object",
  properties: {
    projectPortfolioSummary: { type: "string" },
    clientRisks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          risk: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          sourceReference: { type: "string" },
        },
        required: ["risk", "severity", "sourceReference"],
        additionalProperties: false,
      },
    },
    opportunities: { type: "array", items: sarahOpportunitySchema },
    strategicRecommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          recommendation: { type: "string" },
          why: { type: "string" },
          sourceReference: { type: "string" },
        },
        required: ["recommendation", "why", "sourceReference"],
        additionalProperties: false,
      },
    },
    nextDiscussionPoints: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
    confidenceLevel: { type: "string", enum: ["low", "medium", "high"] },
    sourceRecordReferences: { type: "array", items: sourceReferenceSchema },
  },
  required: [
    "projectPortfolioSummary",
    "clientRisks",
    "opportunities",
    "strategicRecommendations",
    "nextDiscussionPoints",
    "assumptions",
    "confidenceLevel",
    "sourceRecordReferences",
  ],
  additionalProperties: false,
};

function createConfigurationError() {
  const error = new Error("Anthropic is not configured. Set ANTHROPIC_API_KEY and restart Alfred.");
  error.statusCode = 503;
  error.code = "ANTHROPIC_NOT_CONFIGURED";
  return error;
}

export class AnthropicClient {
  constructor({
    apiKey = process.env.ANTHROPIC_API_KEY || "",
    model = process.env.ANTHROPIC_MODEL || ANTHROPIC_DEFAULT_MODEL,
    fetchImpl = globalThis.fetch,
    timeoutMs = 60_000,
  } = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  status() {
    return {
      configured: Boolean(this.apiKey),
      model: this.model,
      readOnly: true,
      toolsEnabled: false,
    };
  }

  async analyzeBriefing(input) {
    return this.requestStructured({
      analysisType: "executive_briefing",
      instruction: "Produce a concise CEO-level analysis of the supplied operating context. Keep each array to the three most important entries.",
      input,
      schema: BRIEFING_OUTPUT_SCHEMA,
      maxTokens: 2000,
    });
  }

  async analyzeDecision(input) {
    return this.requestStructured({
      analysisType: "decision_support",
      instruction: "Assess the supplied decision or review item and recommend the clearest next step. Keep each array to the three most important entries.",
      input,
      schema: DECISION_OUTPUT_SCHEMA,
      maxTokens: 1600,
    });
  }

  async analyzeProject(input) {
    return this.requestStructured({
      analysisType: "project_analysis",
      instruction: "Analyse the supplied project intelligence and digital construction context for Patrick. Distinguish confirmed facts, inferred associations, assumptions and missing information. Identify practical project risks and opportunities. Do not claim full documents were read unless fullDocumentContentsRetrieved is true. Do not recommend or imply any external write action has been executed.",
      input,
      schema: PROJECT_OUTPUT_SCHEMA,
      maxTokens: 2200,
    });
  }

  async analyzeSarahProject(input) {
    return this.requestStructured({
      analysisType: "sarah_project_analysis",
      instruction: "Act as Sarah, Digitize's advisory-only AI Digital Construction Director reporting to Alfred. Analyse the supplied project intelligence, memory, Microsoft metadata and Olivia context. Provide BIM and information management observations, opportunities, risks, missing information and recommendations. Clearly distinguish facts, assumptions and recommendations. Never claim to execute or modify anything.",
      input,
      schema: SARAH_PROJECT_ANALYSIS_SCHEMA,
      maxTokens: 2400,
    });
  }

  async analyzeSarahClient(input) {
    return this.requestStructured({
      analysisType: "sarah_client_review",
      instruction: "Act as Sarah, Digitize's advisory-only AI Digital Construction Director reporting to Alfred. Review the supplied client portfolio context and recommend what Patrick should discuss next. Include source references and do not propose any autonomous sales, Microsoft, file, calendar or financial write action.",
      input,
      schema: SARAH_CLIENT_REVIEW_SCHEMA,
      maxTokens: 2200,
    });
  }

  async requestStructured({ analysisType, instruction, input, schema, maxTokens }) {
    if (!this.apiKey) throw createConfigurationError();

    const response = await this.fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
      },
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        system: ALFRED_CEO_SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: `${instruction}\n\nAnalysis type: ${analysisType}\n\nSupplied internal context:\n${JSON.stringify(input)}`,
        }],
        tools: [{
          name: STRUCTURED_ANALYSIS_TOOL,
          description: "Return the requested Alfred analysis as structured JSON only. Do not execute actions.",
          input_schema: schema,
        }],
        tool_choice: { type: "tool", name: STRUCTURED_ANALYSIS_TOOL },
      }),
    }).catch((error) => {
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        const timeout = new Error("Anthropic analysis timed out before completion");
        timeout.statusCode = 504;
        timeout.code = "ANTHROPIC_TIMEOUT";
        throw timeout;
      }
      throw error;
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error?.message || `Anthropic request failed with status ${response.status}`);
      error.statusCode = response.status >= 400 && response.status < 500 ? 502 : 503;
      error.code = body.error?.type || "ANTHROPIC_REQUEST_FAILED";
      throw error;
    }

    const analysis = extractStructuredAnalysis(body);
    if (!analysis) {
      const error = new Error("Anthropic returned no structured analysis");
      error.statusCode = 502;
      error.code = body.stop_reason === "max_tokens" ? "ANTHROPIC_MAX_TOKENS" : "ANTHROPIC_EMPTY_RESPONSE";
      throw error;
    }

    return {
      analysis,
      model: body.model || this.model,
      usage: body.usage || {},
      readOnly: true,
      executedActions: [],
    };
  }
}

export function extractStructuredAnalysis(body) {
  const toolUse = body?.content?.find((block) => (
    block.type === "tool_use"
    && block.name === STRUCTURED_ANALYSIS_TOOL
    && block.input
    && typeof block.input === "object"
  ));
  if (toolUse) return toolUse.input;

  const text = body?.content?.find((block) => block.type === "text")?.text;
  if (!text) return null;
  return parseStructuredJson(text);
}

export function parseStructuredJson(text) {
  const trimmed = String(text || "").trim();
  const candidates = [
    trimmed,
    trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim(),
  ];
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(trimmed.slice(firstBrace, lastBrace + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

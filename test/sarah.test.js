import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAiReasoningService } from "../ai.js";
import { createDatabase, listAiAnalysisAudit } from "../db.js";
import {
  SARAH_DELIVERABLE_TYPES,
  SARAH_READ_ONLY_BOUNDARY,
  buildSarahClientReviewInput,
  buildSarahProjectAnalysisInput,
  draftSarahDeliverable,
  generateSarahOpportunities,
  generateSarahProjectHealthReview,
  getSarahDashboard,
  getSarahProfile,
  listSarahAudit,
  listSarahTeamPlaceholders,
  recordSarahAudit,
  sarahBriefingForDaily,
} from "../sarah.js";

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-sarah-"));
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

function seededProject(db, name = "Westminster") {
  return db.prepare("SELECT * FROM project_profiles WHERE project_name = ?").get(name);
}

test("Sarah profile and future consultant team are advisory-only", () => {
  withDatabase((db) => {
    const sarah = getSarahProfile(db);
    const team = listSarahTeamPlaceholders(db);

    assert.equal(sarah.name, "Sarah");
    assert.equal(sarah.role, "Digital Construction Director");
    assert.equal(sarah.reportsTo, "Alfred");
    assert.equal(sarah.status, "Active");
    assert.equal(sarah.boundary.autonomousExecutionEnabled, false);
    assert.ok(team.some((member) => member.id === "cobie-specialist"));
    assert.ok(team.every((member) => member.status === "Placeholder"));
  });
});

test("Sarah dashboard exposes information risks and opportunities", () => {
  withDatabase((db) => {
    const dashboard = getSarahDashboard(db);

    assert.equal(dashboard.boundary.advisoryOnly, true);
    assert.ok(dashboard.metrics.projectsRequiringAttention >= 1);
    assert.ok(dashboard.informationRisks.some((risk) => risk.projectName === "Westminster"));
    assert.ok(dashboard.opportunities.some((opportunity) => opportunity.recommendationOnly));
    assert.ok(dashboard.futureTeamPlaceholders.length >= 7);
  });
});

test("Sarah project health review records audit and no execution", () => {
  withDatabase((db) => {
    const project = seededProject(db, "Westminster");
    const review = generateSarahProjectHealthReview(db, project.id, { userAction: "test:sarah-health" });
    const audit = listSarahAudit(db);

    assert.equal(review.boundary.fileEditingEnabled, false);
    assert.equal(review.projectName, "Westminster");
    assert.equal(typeof review.informationQualityScore, "number");
    assert.ok(review.recommendations.length > 0);
    assert.ok(audit.some((event) => event.eventType === "project_health_review" && event.executionAttempted === false));
  });
});

test("Sarah opportunity engine identifies domain opportunities with source references", () => {
  withDatabase((db) => {
    const detail = buildSarahProjectAnalysisInput(db, seededProject(db, "RBKC").id);
    const opportunities = generateSarahOpportunities({
      profile: detail.projectProfile,
      documents: detail.linkedDocumentMetadata,
      actions: detail.linkedActions,
      tags: detail.projectTags,
      healthScore: detail.healthScore,
      informationQuality: detail.informationQuality,
      meetings: detail.linkedMeetings,
    });

    assert.ok(opportunities.some((opportunity) => opportunity.category === "Asset Information"));
    assert.ok(opportunities.every((opportunity) => opportunity.sourceReference.startsWith("project_profile:")));
    assert.ok(opportunities.every((opportunity) => opportunity.estimatedValue));
  });
});

test("Sarah project analysis input includes memory, Olivia context and read-only boundary", () => {
  withDatabase((db) => {
    const project = seededProject(db, "Islington");
    const input = buildSarahProjectAnalysisInput(db, project.id, {
      retrievedMemoryContext: {
        records: [{ sourceReference: "memory:1", summary: "Islington memory", sensitivityLabel: "local_sensitive_business_data" }],
        sourceRecordReferences: [{ reference: "memory:1", label: "Islington memory", category: "memory" }],
      },
    });

    assert.equal(input.specialist.name, "Sarah");
    assert.equal(input.boundary.emailSendEnabled, false);
    assert.equal(input.boundary.applicationGenerationEnabled, false);
    assert.ok(input.sarahDomainObservations.length > 0);
    assert.ok(input.sarahOpportunities.length > 0);
    assert.ok(input.relevantMemory.some((record) => record.sourceReference === "memory:1"));
    assert.ok(input.oliviaFinancialContext);
  });
});

test("Sarah client review input aggregates client portfolio context", () => {
  withDatabase((db) => {
    const input = buildSarahClientReviewInput(db, "RBKC");

    assert.equal(input.client, "RBKC");
    assert.ok(input.portfolioSummary.some((project) => project.projectName === "RBKC"));
    assert.ok(Array.isArray(input.clientRisks));
    assert.ok(input.opportunities.some((opportunity) => opportunity.category === "Asset Information"));
    assert.equal(input.boundary.financialWriteEnabled, false);
  });
});

test("Sarah deliverable drafting is outline-only and audited", () => {
  withDatabase((db) => {
    const project = seededProject(db, "Westminster");
    const draft = draftSarahDeliverable(db, {
      projectProfileId: project.id,
      deliverableType: "bep_outline",
      userAction: "test:sarah-draft",
    });
    const audit = listSarahAudit(db);

    assert.ok(SARAH_DELIVERABLE_TYPES.includes(draft.deliverableType));
    assert.equal(draft.status, "draft_outline_only");
    assert.equal(draft.boundary.documentPublishingEnabled, false);
    assert.ok(draft.outline.some((section) => /Roles|MIDP|TIDP/.test(section.heading)));
    assert.ok(audit.some((event) => event.eventType === "deliverable_draft"));
  });
});

test("Sarah AI project and client review remain recommendation-only and audited", async () => {
  await withDatabase(async (db) => {
    const project = seededProject(db, "Westminster");
    const client = {
      model: "test-sarah-claude",
      analyzeSarahProject: async (input) => {
        assert.equal(input.boundary.readOnly, true);
        assert.equal(input.boundary.fileEditingEnabled, false);
        return {
          analysis: {
            executiveSummary: "Westminster needs an information management baseline review.",
            bimObservations: [{ observation: "BIM domain is tagged.", implication: "BEP should be confirmed.", confidence: "medium", sourceReference: `project_profile:${project.id}` }],
            informationManagementObservations: [{ observation: "Missing EIR/BEP/MIDP/TIDP metadata.", implication: "Information quality confidence is low.", confidence: "high", sourceReference: `project_profile:${project.id}` }],
            digitalConstructionOpportunities: [{ opportunity: "Baseline information review", estimatedValue: "To be qualified", businessImpact: "Reduces delivery risk.", confidence: "high", reasoning: "Missing metadata.", sourceReference: `project_profile:${project.id}` }],
            keyRisks: [{ risk: "Information delivery gap", impact: "Unclear compliance baseline.", severity: "high", sourceReference: `project_profile:${project.id}` }],
            missingInformation: [{ item: "BEP metadata", whyItMatters: "Needed for BIM governance.", sourceReference: `project_profile:${project.id}` }],
            recommendations: [{ recommendation: "Confirm BEP/MIDP/TIDP record set.", rationale: "Improves review confidence.", approvalRequiredBeforeAction: false, sourceReference: `project_profile:${project.id}` }],
            confirmedFacts: ["Project profile exists."],
            assumptions: ["No full documents were read."],
            confidenceLevel: "medium",
            sourceRecordReferences: input.sourceRecordReferences.slice(0, 3),
          },
          model: "test-sarah-claude",
          usage: {},
          readOnly: true,
          executedActions: [],
        };
      },
      analyzeSarahClient: async (input) => ({
        analysis: {
          projectPortfolioSummary: `${input.client} has ${input.portfolioSummary.length} project(s).`,
          clientRisks: [],
          opportunities: input.opportunities.slice(0, 1).map((opportunity) => ({
            opportunity: opportunity.opportunity,
            estimatedValue: opportunity.estimatedValue,
            businessImpact: opportunity.businessImpact,
            confidence: opportunity.confidence,
            reasoning: opportunity.reasoning,
            sourceReference: opportunity.sourceReference,
          })),
          strategicRecommendations: [{ recommendation: "Discuss information quality baseline.", why: "Sarah found missing information.", sourceReference: input.sourceRecordReferences[0].reference }],
          nextDiscussionPoints: ["What information is missing?"],
          assumptions: ["No sales action was taken."],
          confidenceLevel: "medium",
          sourceRecordReferences: input.sourceRecordReferences.slice(0, 3),
        },
        model: "test-sarah-claude",
        usage: {},
        readOnly: true,
        executedActions: [],
      }),
    };
    const ai = createAiReasoningService({ db, client });
    const projectResult = await ai.analyzeSarahProject(buildSarahProjectAnalysisInput(db, project.id), { userAction: "test:sarah-ai-project", dataCategories: ["project_profile"] });
    const clientResult = await ai.analyzeSarahClient(buildSarahClientReviewInput(db, "Westminster"), { userAction: "test:sarah-ai-client", dataCategories: ["client"] });
    const audit = listAiAnalysisAudit(db);

    assert.equal(projectResult.executionAttempted, false);
    assert.equal(clientResult.executionAttempted, false);
    assert.ok(audit.some((event) => event.analysisType === "sarah_project_analysis"));
    assert.ok(audit.some((event) => event.analysisType === "sarah_client_review"));
  });
});

test("Sarah daily briefing produces advisory digital construction signals", () => {
  withDatabase((db) => {
    const brief = sarahBriefingForDaily(db);

    assert.equal(brief.title, "Daily Digital Construction Brief");
    assert.equal(brief.boundary.autonomousExecutionEnabled, false);
    assert.ok(Array.isArray(brief.items));
    assert.ok(brief.items.every((item) => item.sourceReference));
  });
});

test("Sarah audit can record error outcomes without execution", () => {
  withDatabase((db) => {
    recordSarahAudit(db, {
      eventType: "project_analysis",
      userAction: "test:error",
      status: "error",
      errorCode: "ANTHROPIC_NOT_CONFIGURED",
      model: "test-model",
      dataCategories: ["project_profile"],
    });
    const audit = listSarahAudit(db);

    assert.equal(audit[0].status, "error");
    assert.equal(audit[0].executionAttempted, false);
    assert.equal(audit[0].metadata.boundary.emailSendEnabled, false);
  });
});

test("Sarah security boundary exposes no write permissions", () => {
  assert.equal(SARAH_READ_ONLY_BOUNDARY.advisoryOnly, true);
  assert.equal(SARAH_READ_ONLY_BOUNDARY.microsoftWritePermissions, false);
  assert.equal(SARAH_READ_ONLY_BOUNDARY.sharePointWriteEnabled, false);
  assert.equal(SARAH_READ_ONLY_BOUNDARY.oneDriveWriteEnabled, false);
  assert.equal(SARAH_READ_ONLY_BOUNDARY.emailSendEnabled, false);
  assert.equal(SARAH_READ_ONLY_BOUNDARY.calendarWriteEnabled, false);
  assert.equal(SARAH_READ_ONLY_BOUNDARY.fileEditingEnabled, false);
  assert.equal(SARAH_READ_ONLY_BOUNDARY.financialWriteEnabled, false);
  assert.equal(SARAH_READ_ONLY_BOUNDARY.applicationGenerationEnabled, false);
});

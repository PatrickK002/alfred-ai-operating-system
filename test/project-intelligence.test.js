import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAiReasoningService } from "../ai.js";
import { createDatabase } from "../db.js";
import { MICROSOFT_SCOPES } from "../microsoft.js";
import {
  associateEmailToProject,
  associateMeetingToProject,
  buildProjectAnalysisInput,
  calculateProjectHealthScore,
  classifyProjectDocument,
  createProjectProfile,
  getProjectDashboard,
  getProjectDetail,
  importProjectDocuments,
  listProjectAudit,
  searchProjectKnowledge,
  updateProjectProfile,
} from "../project-intelligence.js";

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-project-"));
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

test("project profile CRUD records audit and memory links", () => {
  withDatabase((db) => {
    const profile = createProjectProfile(db, {
      companyId: "digitize",
      clientName: "Test Council",
      projectName: "Test Assurance Project",
      serviceLine: "BIM",
      currentPhase: "Mobilisation",
    });
    const updated = updateProjectProfile(db, profile.id, { currentPhase: "Delivery", leadName: "Patrick" });
    const links = db.prepare("SELECT * FROM project_memory_links WHERE project_profile_id = ?").all(profile.id);
    const audit = listProjectAudit(db);

    assert.equal(updated.currentPhase, "Delivery");
    assert.equal(updated.leadName, "Patrick");
    assert.equal(links[0].source_type, "project_profile");
    assert.ok(audit.some((event) => event.eventType === "project_profile_created"));
    assert.ok(audit.some((event) => event.eventType === "project_profile_updated"));
  });
});

test("project document metadata import classifies and preserves Microsoft references", () => {
  withDatabase((db) => {
    const project = seededProject(db);
    const result = importProjectDocuments(db, project.id, [{
      id: "file-1",
      name: "Westminster COBie Register.xlsx",
      webUrl: "https://example.test/file",
      size: 1024,
      createdDateTime: "2026-06-01T09:00:00Z",
      lastModifiedDateTime: "2026-06-02T09:00:00Z",
      parentReference: { path: "/drive/root:/Clients/Westminster", name: "Westminster" },
      file: { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    }]);
    const detail = getProjectDetail(db, project.id);

    assert.equal(result.documentsStored, 1);
    assert.equal(detail.documents[0].classification, "COBie");
    assert.equal(detail.documents[0].webUrl, "https://example.test/file");
    assert.equal(detail.documents[0].metadata.fullContentIndexed, false);
    assert.equal(classifyProjectDocument({ name: "MIDP draft.docx" }), "MIDP");
  });
});

test("project search returns projects, documents and related records", () => {
  withDatabase((db) => {
    const project = seededProject(db);
    importProjectDocuments(db, project.id, [{ id: "file-2", name: "Westminster BEP.pdf", parentFolder: "Westminster" }]);
    const result = searchProjectKnowledge(db, "Westminster BEP");

    assert.equal(result.matchingProjects[0].projectName, "Westminster");
    assert.equal(result.relevantDocuments[0].classification, "BEP");
    assert.ok(Array.isArray(result.relatedRisks));
    assert.ok(Array.isArray(result.memoryReferences));
  });
});

test("email and calendar association use client/project/contact signals", () => {
  withDatabase((db) => {
    const project = getProjectDetail(db, seededProject(db, "RBKC").id).profile;
    const emailAssociation = associateEmailToProject({
      id: "email-1",
      subject: "RBKC COBie risk and approval",
      bodyPreview: "Please confirm the missing asset data before the deadline.",
      from: { emailAddress: { name: "Client Lead", address: "lead@rbkc.gov.uk" } },
    }, project);
    const meetingAssociation = associateMeetingToProject({
      id: "meeting-1",
      subject: "RBKC project review",
      attendees: [{ emailAddress: { name: "RBKC Lead", address: "lead@rbkc.gov.uk" } }],
    }, project);

    assert.equal(emailAssociation.associated, true);
    assert.ok(emailAssociation.signalWords.includes("risk"));
    assert.equal(meetingAssociation.associated, true);
  });
});

test("project health score explains risk, actions and missing information", () => {
  const health = calculateProjectHealthScore({
    profile: { projectName: "Westminster" },
    documents: [{ classification: "BEP" }],
    actions: [{ title: "Submit plan", status: "open", due: "2026-01-01" }],
    risks: [{ title: "Client escalation", status: "open", severity: "high" }],
    decisions: [],
    meetings: [],
    updates: [],
    contacts: [],
    emailSignals: [],
    financialSummary: { riskLevel: "unknown" },
  }, { now: new Date("2026-06-06T12:00:00Z") });

  assert.equal(health.status, "red");
  assert.equal(health.riskLevel, "high");
  assert.equal(health.actionStatus, "overdue");
  assert.match(health.explanation, /Missing/);
});

test("Claude project analysis input is structured and recommendation-only", async () => {
  await withDatabase(async (db) => {
    const project = seededProject(db, "Islington");
    const input = buildProjectAnalysisInput(db, project.id, {
      retrievedMemoryContext: {
        records: [{ sourceReference: "memory:1", summary: "Islington context", sensitivityLabel: "local_sensitive_business_data" }],
        sourceRecordReferences: [{ reference: "memory:1", label: "Islington context", category: "memory" }],
      },
    });
    const client = {
      model: "test-claude",
      analyzeProject: async (projectInput) => {
        assert.equal(projectInput.boundaries.readOnly, true);
        assert.equal(projectInput.boundaries.fileEditsEnabled, false);
        assert.equal(projectInput.fullDocumentContentsRetrieved, false);
        assert.ok(projectInput.sourceRecordReferences.some((reference) => reference.reference.startsWith("project_profile:")));
        return {
          analysis: {
            executiveProjectSummary: "Islington needs baseline document metadata before deeper review.",
            currentStatus: "Confirmed project profile exists; Microsoft metadata is not yet linked.",
            keyRisks: [],
            missingInformation: [{ item: "Document metadata", whyItMatters: "Health scoring is incomplete.", sourceReference: `project_profile:${project.id}` }],
            recommendedNextActions: [{ action: "Run read-only Microsoft discovery.", owner: "Patrick", timing: "This week", requiresApproval: false, sourceReference: `project_profile:${project.id}` }],
            decisionsRequired: [],
            confidenceLevel: "medium",
            assumptions: ["No full documents were read."],
            sourceRecordReferences: projectInput.sourceRecordReferences.slice(0, 3),
          },
          model: "test-claude",
          usage: {},
          readOnly: true,
          executedActions: [],
        };
      },
    };
    const ai = createAiReasoningService({ db, client });
    const result = await ai.analyzeProject(input, { userAction: "test:project-analysis", dataCategories: ["project_profile"] });

    assert.equal(result.executionAttempted, false);
    assert.equal(result.analysis.confidenceLevel, "medium");
  });
});

test("project dashboard seeds active Digitize profiles and read-only boundary", () => {
  withDatabase((db) => {
    const dashboard = getProjectDashboard(db);

    assert.equal(dashboard.boundary.readOnly, true);
    assert.ok(dashboard.metrics.activeProjects >= 4);
    assert.ok(dashboard.projects.some((project) => project.profile.projectName === "KSPF"));
    assert.ok(dashboard.missingInformation.length > 0);
  });
});

test("Microsoft project discovery scopes remain read-only", () => {
  assert.equal(MICROSOFT_SCOPES.some((scope) => /write/i.test(scope)), false);
  assert.ok(MICROSOFT_SCOPES.includes("Files.Read"));
  assert.ok(MICROSOFT_SCOPES.includes("Mail.Read"));
  assert.ok(MICROSOFT_SCOPES.includes("Calendars.Read"));
});

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAiReasoningService } from "../ai.js";
import { createDatabase } from "../db.js";
import { MICROSOFT_SCOPES } from "../microsoft.js";
import {
  DIGITAL_CONSTRUCTION_DOMAINS,
  associateEmailToProject,
  associateMeetingToProject,
  buildProjectAnalysisInput,
  calculateProjectHealthScore,
  classifyProjectDocument,
  createProjectProfile,
  getProjectDashboard,
  getProjectDetail,
  importProjectDocuments,
  importProjectEmailSignals,
  importProjectMeetings,
  listDigitalConstructionDomains,
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
      createdBy: { user: { displayName: "Client Owner" } },
      parentReference: { path: "/drive/root:/Clients/Westminster", name: "Westminster", driveId: "drive-1" },
      file: { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    }]);
    const detail = getProjectDetail(db, project.id);

    assert.equal(result.documentsStored, 1);
    assert.equal(detail.documents[0].classification, "COBie");
    assert.equal(detail.documents[0].webUrl, "https://example.test/file");
    assert.equal(detail.documents[0].ownerName, "Client Owner");
    assert.equal(detail.documents[0].location, "drive-1");
    assert.equal(detail.documents[0].metadata.fullContentIndexed, false);
    assert.ok(detail.knowledgeLinks.some((link) => link.toType === "project_document"));
    assert.equal(classifyProjectDocument({ name: "MIDP draft.docx" }), "MIDP");
  });
});

test("construction document classification recognises digital construction categories", () => {
  assert.equal(classifyProjectDocument({ name: "Westminster Risk Register.xlsx" }), "Risk Registers");
  assert.equal(classifyProjectDocument({ name: "RBKC Asset Information Requirements.docx" }), "AIR");
  assert.equal(classifyProjectDocument({ name: "KSPF Digital Twin Strategy.pdf" }), "Digital Twin Documents");
  assert.equal(classifyProjectDocument({ name: "Islington GIS spatial dataset.geojson" }), "GIS Documents");
  assert.equal(classifyProjectDocument({ name: "Building Safety golden thread report.pdf" }), "Building Safety Documents");
  assert.equal(classifyProjectDocument({ name: "Commercial fee proposal.xlsx" }), "Proposals");
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

test("project search spans emails, meetings, tags and source references", () => {
  withDatabase((db) => {
    const project = seededProject(db, "RBKC");
    importProjectEmailSignals(db, project.id, [{
      id: "mail-rbkc-1",
      subject: "RBKC COBie issue",
      bodyPreview: "COBie validation issue for asset information.",
      from: { emailAddress: { name: "RBKC Lead", address: "lead@rbkc.gov.uk" } },
      receivedDateTime: "2026-06-03T09:00:00Z",
    }]);
    importProjectMeetings(db, project.id, [{
      id: "meeting-rbkc-1",
      subject: "RBKC COBie review",
      start: { dateTime: "2026-06-04T10:00:00Z" },
      attendees: [{ emailAddress: { name: "RBKC Lead", address: "lead@rbkc.gov.uk" } }],
    }]);
    const result = searchProjectKnowledge(db, "COBie");

    assert.ok(result.relatedEmails.some((email) => email.sourceReference.startsWith("project_email:")));
    assert.ok(result.relatedMeetings.some((meeting) => meeting.sourceReference.startsWith("project_meeting:")));
    assert.ok(result.matchingTags.some((tag) => tag.domainId === "COBie"));
    assert.ok(result.sourceReferences.some((reference) => reference.category === "project_tag"));
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
        assert.ok(projectInput.projectTags.length > 0);
        assert.ok(projectInput.digitalConstructionContext.domains.includes("InformationManagement"));
        assert.equal(projectInput.digitalConstructionContext.noSpecialistAnalysisYet, true);
        assert.equal(projectInput.informationQuality.status !== undefined, true);
        assert.ok(projectInput.sourceRecordReferences.some((reference) => reference.reference.startsWith("project_profile:")));
        return {
          analysis: {
            executiveProjectSummary: "Islington needs baseline document metadata before deeper review.",
            currentStatus: "Confirmed project profile exists; Microsoft metadata is not yet linked.",
            keyRisks: [],
            keyOpportunities: [{ title: "Baseline information review", assessment: "A read-only metadata refresh would improve confidence.", sourceReference: `project_profile:${project.id}` }],
            confirmedFacts: ["A project profile exists for Islington."],
            inferredInformation: ["Islington is tagged for information management and BIM readiness."],
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
    assert.equal(typeof dashboard.metrics.informationQualityIndicators, "number");
    assert.ok(dashboard.projects.some((project) => project.profile.projectName === "KSPF"));
    assert.ok(dashboard.projects.some((project) => project.domains.includes("InformationManagement")));
    assert.ok(dashboard.missingInformation.length > 0);
  });
});

test("digital construction domain catalog and future placeholders are present", () => {
  withDatabase((db) => {
    const domains = listDigitalConstructionDomains(db);
    const tableNames = db.prepare("SELECT name, type FROM sqlite_master WHERE name IN (?, ?, ?, ?, ?, ?)").all(
      "project_tags",
      "project_emails",
      "cobie_facilities",
      "gis_spatial_datasets",
      "digital_twin_records",
      "project_knowledge_links",
    );
    const sarah = db.prepare("SELECT * FROM agents WHERE id = 'sarah'").get();

    assert.deepEqual([...DIGITAL_CONSTRUCTION_DOMAINS].sort(), domains.map((domain) => domain.id).sort());
    assert.equal(tableNames.length, 6);
    assert.equal(JSON.parse(sarah.tools).includes("COBie"), true);
    assert.match(sarah.mission, /Placeholder only/);
  });
});

test("Microsoft project discovery scopes remain read-only", () => {
  assert.equal(MICROSOFT_SCOPES.some((scope) => /write/i.test(scope)), false);
  assert.ok(MICROSOFT_SCOPES.includes("Files.Read"));
  assert.ok(MICROSOFT_SCOPES.includes("Mail.Read"));
  assert.ok(MICROSOFT_SCOPES.includes("Calendars.Read"));
});

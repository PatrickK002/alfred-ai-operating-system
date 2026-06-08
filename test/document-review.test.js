import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createDatabase, listSemanticSourceRecords } from "../db.js";
import {
  DOCUMENT_REVIEW_BOUNDARY,
  buildDocumentReviewInput,
  createDocumentReviewSource,
  deterministicDocumentReview,
  formatClientResponseMarkdown,
  listDocumentReviewAudit,
  listDocumentReviewDashboard,
  saveClientResponseDraft,
  saveDocumentReview,
} from "../document-review.js";
import { listProjectProfiles } from "../project-intelligence.js";

function withDatabase(run) {
  const directory = mkdtempSync(join(tmpdir(), "alfred-document-review-"));
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

function firstProject(db) {
  const project = listProjectProfiles(db)[0];
  assert.ok(project, "seed project should exist");
  return project;
}

test("document review source stores exact file links and extracted text safely", () => {
  withDatabase((db) => {
    const project = firstProject(db);
    const source = createDocumentReviewSource(db, {
      projectProfileId: project.id,
      sourceType: "link",
      title: "GIS Implementation Plan",
      sourceUrl: "https://contoso.sharepoint.com/sites/kspf/GIS-Implementation-Plan.docx",
      textContent: "The GIS implementation plan confirms asset layers, coordinate strategy and Digital Twin reporting requirements.",
      userAction: "test:document-review-source",
    });
    const dashboard = listDocumentReviewDashboard(db, { projectProfileId: project.id });
    const audit = listDocumentReviewAudit(db);

    assert.equal(source.sourceUrl.includes("sharepoint.com"), true);
    assert.equal(source.contentExtracted, true);
    assert.equal(source.metadata.exactFileLinkProvided, true);
    assert.equal(dashboard.sources[0].sourceReference, `document_review_source:${source.id}`);
    assert.equal(audit[0].externalWriteAttempted, false);
    assert.equal(DOCUMENT_REVIEW_BOUNDARY.emailSendEnabled, false);
    assert.equal(DOCUMENT_REVIEW_BOUNDARY.sharePointWriteEnabled, false);
  });
});

test("Sarah consultant review checks client requirements and drafts formatted response", () => {
  withDatabase((db) => {
    const project = firstProject(db);
    const source = createDocumentReviewSource(db, {
      projectProfileId: project.id,
      sourceType: "pasted_text",
      title: "COBie and GIS extract",
      textContent: [
        "COBie attributes will be validated before future reporting dashboards.",
        "GIS asset layers will align with the spatial information strategy.",
        "Digital Twin reporting will connect Viewpoint, Speckle and Power BI outputs.",
      ].join("\n"),
    });
    const input = buildDocumentReviewInput(db, {
      projectProfileId: project.id,
      sourceIds: [source.id],
      disciplines: ["BIM", "GIS", "Digital Twin", "COBie"],
      clientRequirements: [
        "Confirm how COBie data will be validated.",
        "Confirm GIS asset layer alignment.",
        "Explain how Digital Twin reporting will be supported.",
      ].join("\n"),
      incomingEmail: "Subject: GIS and COBie review\nCan you confirm the current position before we update the client?",
    });
    const analysis = deterministicDocumentReview(input);
    const review = saveDocumentReview(db, {
      projectProfileId: project.id,
      disciplines: input.disciplines,
      clientRequirements: input.clientRequirements,
      incomingEmail: input.incomingEmail,
      sourceIds: [source.id],
      reviewOutput: analysis,
    });
    const markdown = formatClientResponseMarkdown({
      analysis,
      projectName: project.projectName,
      clientName: project.clientName,
      incomingEmail: input.incomingEmail,
    });
    const draft = saveClientResponseDraft(db, {
      projectProfileId: project.id,
      documentReviewId: review.id,
      incomingEmail: input.incomingEmail,
      draftBodyMarkdown: markdown,
      sourceReferences: analysis.sourceRecordReferences,
      assumptions: analysis.assumptions,
    });

    assert.ok(analysis.consultantReviews.some((item) => item.discipline === "GIS"));
    assert.ok(analysis.requirementChecks.some((item) => item.requirement.includes("COBie")));
    assert.match(markdown, /Objective/);
    assert.match(markdown, /Activities/);
    assert.match(markdown, /Outcome/);
    assert.match(markdown, /Risk & Issue Log/);
    assert.match(markdown, /Next Steps/);
    assert.equal(draft.status, "draft_only");
    assert.equal(draft.sendEnabled, false);
    assert.equal(draft.executionAttempted, false);
    const semanticRecords = listSemanticSourceRecords(db);
    assert.ok(semanticRecords.some((record) => record.sourceType === "document_review"));
    assert.ok(semanticRecords.some((record) => record.sourceType === "client_response_draft"));
  });
});

test("document review UI and API routes are exposed as draft-only workflow", () => {
  const app = readFileSync(join(process.cwd(), "app.js"), "utf8");
  const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
  const server = readFileSync(join(process.cwd(), "server.js"), "utf8");

  assert.match(html, /sarah-document-review-form/);
  assert.match(html, /document-review-link/);
  assert.match(html, /document-review-file/);
  assert.match(html, /document-review-requirements/);
  assert.match(app, /submitSarahDocumentReview/);
  assert.match(app, /Copy draft response/);
  assert.match(server, /\/api\/ai\/document-review-client-response/);
  assert.match(server, /\/api\/document-review\/sources/);
  assert.match(server, /sendEnabled: false/);
});

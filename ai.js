import { recordAiAnalysisAudit } from "./db.js";

function compactCategories(categories) {
  return [...new Set((categories || []).map(String).filter(Boolean))].slice(0, 30);
}

export function createAiReasoningService({ db, client, onConnected = () => {} }) {
  async function run({ analysisType, userAction, dataCategories, outputSaved = false, analyze }) {
    const categories = compactCategories(dataCategories);
    try {
      const result = await analyze();
      onConnected();
      const audit = recordAiAnalysisAudit(db, {
        analysisType,
        userAction,
        dataCategories: categories,
        outputSaved,
        model: result.model,
        status: "success",
        executionAttempted: false,
      });
      return {
        ...result,
        auditId: audit.id,
        outputSaved,
        executionAttempted: false,
      };
    } catch (error) {
      recordAiAnalysisAudit(db, {
        analysisType,
        userAction,
        dataCategories: categories,
        outputSaved: false,
        model: client.model,
        status: "error",
        errorCode: error.code || "AI_ANALYSIS_FAILED",
        executionAttempted: false,
      });
      throw error;
    }
  }

  return {
    analyzeBriefing(input, metadata = {}) {
      return run({
        analysisType: "executive_briefing",
        userAction: metadata.userAction || "api:ai-briefing",
        dataCategories: metadata.dataCategories,
        analyze: () => client.analyzeBriefing(input),
      });
    },
    analyzeDecision(input, metadata = {}) {
      return run({
        analysisType: "decision_support",
        userAction: metadata.userAction || "api:ai-decision-support",
        dataCategories: metadata.dataCategories,
        analyze: () => client.analyzeDecision(input),
      });
    },
    analyzeProject(input, metadata = {}) {
      return run({
        analysisType: "project_analysis",
        userAction: metadata.userAction || "api:ai-project-analysis",
        dataCategories: metadata.dataCategories,
        analyze: () => client.analyzeProject(input),
      });
    },
    analyzeSarahProject(input, metadata = {}) {
      return run({
        analysisType: "sarah_project_analysis",
        userAction: metadata.userAction || "api:ai-sarah-project-analysis",
        dataCategories: metadata.dataCategories,
        analyze: () => client.analyzeSarahProject(input),
      });
    },
    analyzeSarahClient(input, metadata = {}) {
      return run({
        analysisType: "sarah_client_review",
        userAction: metadata.userAction || "api:ai-sarah-client-review",
        dataCategories: metadata.dataCategories,
        analyze: () => client.analyzeSarahClient(input),
      });
    },
    analyzeDocumentReview(input, metadata = {}) {
      return run({
        analysisType: "document_review_client_response",
        userAction: metadata.userAction || "api:ai-document-review-client-response",
        dataCategories: metadata.dataCategories,
        outputSaved: true,
        analyze: () => client.analyzeDocumentReview(input),
      });
    },
    analyzeVoiceCommand(input, metadata = {}) {
      return run({
        analysisType: "voice_command",
        userAction: metadata.userAction || "api:voice-command",
        dataCategories: metadata.dataCategories,
        analyze: () => client.analyzeVoiceCommand(input),
      });
    },
  };
}

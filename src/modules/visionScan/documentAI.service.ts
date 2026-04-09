/**
 * Google Document AI — Custom Extractor Integration
 *
 * Sends diary page images to a trained custom Document AI processor
 * and returns structured field data in the same AIExtractionResult format
 * used by the existing visionScan pipeline.
 *
 * Setup:
 *  1. Create a Custom Extractor in Google Cloud Console → Document AI
 *  2. Upload & label 50-100 diary page samples
 *  3. Train the processor
 *  4. Set DOCUMENT_AI_PROCESSOR_ID in .env
 */

import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { AIExtractionResult, DiaryQuestion } from "./visionScan.types";

// ─── Configuration ──────────────────────────────────────────────────────────

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || "cureplan-mvp-472407";
const LOCATION = process.env.DOCUMENT_AI_LOCATION || "us"; // "us" or "eu"
const PROCESSOR_ID = process.env.DOCUMENT_AI_PROCESSOR_ID || "";
const CREDENTIALS_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "./cureplan-mvp-472407-950b5ca8e9a8.json";

// ─── Client (lazy init) ─────────────────────────────────────────────────────

let client: DocumentProcessorServiceClient | null = null;

function getClient(): DocumentProcessorServiceClient {
    if (!client) {
        client = new DocumentProcessorServiceClient({
            keyFilename: CREDENTIALS_PATH,
        });
    }
    return client;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DocumentAIResult {
    extraction: AIExtractionResult;
    usage: {
        pageCount: number;
        entityCount: number;
        processingTimeMs: number;
    };
}

// ─── Main Extraction Function ───────────────────────────────────────────────

/**
 * Send a diary page image to Google Document AI for extraction.
 *
 * @param imageBuffer  Raw image bytes (JPEG or PNG)
 * @param mimeType     e.g. "image/jpeg" or "image/png"
 * @param questions    Diary page questions — used to map entity types to question IDs
 * @returns AIExtractionResult in the same format as the LLM-based extraction
 */
export async function extractWithDocumentAI(
    imageBuffer: Buffer,
    mimeType: string,
    questions: DiaryQuestion[]
): Promise<DocumentAIResult> {
    if (!PROCESSOR_ID) {
        throw new Error(
            "DOCUMENT_AI_PROCESSOR_ID is not set. Create a custom extractor in Google Cloud Console and set the processor ID in .env"
        );
    }

    const startTime = Date.now();
    const docClient = getClient();

    // Build the full processor resource name
    const processorName = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;

    // Call Document AI
    const [result] = await docClient.processDocument({
        name: processorName,
        rawDocument: {
            content: imageBuffer.toString("base64"),
            mimeType,
        },
    });

    const processingTimeMs = Date.now() - startTime;
    const document = result.document;

    if (!document) {
        throw new Error("Document AI returned no document in response");
    }

    // ─── Map entities to AIExtractionResult format ──────────────────────────

    const extraction: AIExtractionResult = {};
    const entities = document.entities || [];

    // Build a lookup: entity type/name → question ID
    // Document AI entity types are set during labeling.
    // Convention: label each field with the question ID (e.g., "q1", "q2", "appointment_date")
    const questionMap = new Map<string, DiaryQuestion>();
    for (const q of questions) {
        if (q.type === "info") continue;
        // Match by question ID directly (primary convention)
        questionMap.set(q.id, q);
        // Also match by lowercase normalized version
        questionMap.set(q.id.toLowerCase().replace(/[^a-z0-9]/g, "_"), q);
    }

    for (const entity of entities) {
        const entityType = entity.type || "";
        const normalizedType = entityType.toLowerCase().replace(/[^a-z0-9]/g, "_");

        // Try to match entity type to a question ID
        const question = questionMap.get(entityType) || questionMap.get(normalizedType);

        if (question) {
            const rawValue = (entity.mentionText || "").trim();
            const confidence = entity.confidence || 0;

            // Normalize values for yes/no fields
            let value: string | null = rawValue || null;
            if (question.type === "yes_no" && rawValue) {
                const lower = rawValue.toLowerCase();
                if (["yes", "हाँ", "haan", "y", "true", "1"].includes(lower)) {
                    value = "yes";
                } else if (["no", "नहीं", "nahi", "n", "false", "0"].includes(lower)) {
                    value = "no";
                }
            }

            extraction[question.id] = { value, confidence };
        }
    }

    // Fill in any questions that Document AI didn't return an entity for
    for (const q of questions) {
        if (q.type === "info") continue;
        if (!extraction[q.id]) {
            extraction[q.id] = { value: null, confidence: 0 };
        }
    }

    return {
        extraction,
        usage: {
            pageCount: document.pages?.length || 1,
            entityCount: entities.length,
            processingTimeMs,
        },
    };
}

/**
 * Check if Document AI is configured and ready to use.
 */
export function isDocumentAIConfigured(): boolean {
    return !!PROCESSOR_ID;
}

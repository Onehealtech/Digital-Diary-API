import sharp from 'sharp';
import { decodeQRFromBuffer } from './qrDecoder.service';
import { FORM_EXTRACTION_SYSTEM_PROMPT } from '../prompts/formExtractionPrompt';

const QUBRID_TIMEOUT_MS = 30_000;

export type PageTypeHint = 'summary' | 'schedule' | 'done_report' | 'patient_info';

export interface FormExtractionResult {
    formData: Record<string, any>;
    confidence: 'high' | 'medium' | 'low';
    flags: string[];
    processingTimeMs: number;
    imageDimensions: { width: number; height: number };
    modelUsed: string;
    qrCodeId: string | null;
}

class FormExtractionService {
    private modelName: string;
    private apiKey: string;
    private baseUrl: string;

    constructor() {
        this.apiKey = process.env.QUBRID_API_KEY || '';
        this.modelName = process.env.QUBRID_MODEL || 'moonshotai/Kimi-K2.5';
        this.baseUrl = process.env.QUBRID_BASE_URL || 'https://platform.qubrid.com/v1/chat/completions';

        if (!this.apiKey) {
            console.warn('[FormExtraction] QUBRID_API_KEY is not set — API calls will fail');
        }
    }

    /**
     * Main entry point: preprocess image → decode QR → call Qubrid AI → return result.
     * Images are NEVER written to disk (healthcare privacy compliance).
     */
    async extractForm(
        rawImageBuffer: Buffer,
        pageTypeHint?: PageTypeHint
    ): Promise<FormExtractionResult> {
        const startTime = Date.now();

        // 1. Pre-process image (resize, EXIF rotate, enhance contrast)
        const { processedBuffer, dimensions } = await this.preprocessImage(rawImageBuffer);

        // 2. Decode QR code from the ORIGINAL buffer (before compression artifacts)
        const flags: string[] = [];
        let qrCodeId: string | null = null;
        try {
            qrCodeId = await decodeQRFromBuffer(rawImageBuffer);
            if (!qrCodeId) {
                flags.push('qr_decode_failed');
            }
        } catch {
            flags.push('qr_decode_failed');
        }

        // 3. Convert processed image to base64 data URI for Qubrid API
        const base64Image = processedBuffer.toString('base64');

        // 4. Call Qubrid API (with one retry on JSON parse failure)
        let extractedJson: Record<string, any>;
        let jsonRetryNeeded = false;
        try {
            extractedJson = await this.callQubridWithTimeout(base64Image, pageTypeHint);
        } catch (firstError: any) {
            console.warn(
                '[FormExtraction] First Qubrid attempt failed, retrying with strict prompt:',
                firstError.message
            );
            jsonRetryNeeded = true;
            try {
                extractedJson = await this.callQubridWithTimeout(base64Image, pageTypeHint, true);
            } catch (retryError: any) {
                throw new Error(`Qubrid extraction failed after retry: ${retryError.message}`);
            }
        }

        if (jsonRetryNeeded) {
            flags.push('json_retry_needed');
        }

        // 5. Extract meta fields before returning as form data
        const confidence = (extractedJson.confidence as 'high' | 'medium' | 'low') || 'medium';
        const modelFlags: string[] = Array.isArray(extractedJson.flags) ? extractedJson.flags : [];

        // Check for ambiguous bubbles
        const hasAmbiguous = JSON.stringify(extractedJson).includes('"Ambiguous"');
        if (hasAmbiguous) {
            flags.push('ambiguous_bubble_detected');
        }

        // Remove meta fields so formData is clean
        delete extractedJson.confidence;
        delete extractedJson.flags;

        // 6. Inject the authoritative QR value (overrides model's null placeholder)
        extractedJson.qr_code_id = qrCodeId;

        const processingTimeMs = Date.now() - startTime;

        // 7. Log every extraction for debugging
        console.log(
            `[FormExtraction] page=${extractedJson.page_number ?? 'unknown'} ` +
            `type=${extractedJson.form_type ?? 'unknown'} ` +
            `confidence=${confidence} ` +
            `flags=${[...flags, ...modelFlags].length} ` +
            `time=${processingTimeMs}ms`
        );

        return {
            formData: extractedJson,
            confidence,
            flags: [...flags, ...modelFlags],
            processingTimeMs,
            imageDimensions: dimensions,
            modelUsed: this.modelName,
            qrCodeId,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Resize to ≤1600px, EXIF-rotate, normalize contrast, encode as JPEG 85.
     */
    private async preprocessImage(buffer: Buffer): Promise<{
        processedBuffer: Buffer;
        dimensions: { width: number; height: number };
    }> {
        const { data: processedBuffer, info } = await sharp(buffer)
            .rotate()
            .resize(1600, 1600, {
                fit: 'inside',
                withoutEnlargement: true,
            })
            .normalize()
            .jpeg({ quality: 85 })
            .toBuffer({ resolveWithObject: true });

        return {
            processedBuffer,
            dimensions: { width: info.width, height: info.height },
        };
    }

    /**
     * Call Qubrid AI (OpenAI-compatible) with a 30-second timeout.
     * Sends image as base64 data URI in the content array.
     * Strips markdown fences from response if present.
     */
    private async callQubridWithTimeout(
        base64Image: string,
        pageTypeHint?: PageTypeHint,
        strictMode = false
    ): Promise<Record<string, any>> {

        // Build system prompt with optional hint
        let systemPrompt = FORM_EXTRACTION_SYSTEM_PROMPT;
        if (pageTypeHint) {
            systemPrompt +=
                `\n\nHINT: The mobile app reports this page is likely of type "${pageTypeHint}". ` +
                `Verify from the visible page number and layout before accepting this hint.`;
        }
        if (strictMode) {
            systemPrompt +=
                '\n\nCRITICAL: Your previous response was not valid JSON. ' +
                'Return ONLY a raw JSON object. No markdown, no backticks, no code fences, no explanation. ' +
                'Start with { and end with }.';
        }

        const requestBody = {
            model: this.modelName,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt,
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Extract all form data from this CANTrac diary page image and return the JSON.',
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 2048,
            temperature: 0,
            top_p: 0.1,
            stream: false,
        };

        // AbortController for 30-second timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), QUBRID_TIMEOUT_MS);

        let response: Response;
        try {
            response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });
        } catch (err: any) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                throw new Error('Qubrid API timed out after 30 seconds');
            }
            throw new Error(`Qubrid API request failed: ${err.message}`);
        } finally {
            clearTimeout(timeoutId);
        }

        if (response.status === 429) {
            throw new Error('RATE_LIMITED: Qubrid API rate limit reached');
        }

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'unknown error');
            throw new Error(`Qubrid API error ${response.status}: ${errorText}`);
        }

        const data = await response.json() as any;
        const rawText: string = data?.choices?.[0]?.message?.content?.trim() ?? '';

        if (!rawText) {
            throw new Error('Qubrid returned an empty response');
        }

        // Strip markdown code fences if model ignores instructions
        const jsonText = rawText
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```\s*$/i, '')
            .trim();

        try {
            return JSON.parse(jsonText);
        } catch {
            throw new Error(
                `Qubrid returned invalid JSON. Preview: ${jsonText.substring(0, 300)}`
            );
        }
    }
}

export const formExtractionService = new FormExtractionService();

import { spawn } from "child_process";
import path from "path";

export interface OcrResult {
    rawText: string;
    confidence: number;
    structured: {
        sections: Array<{
            heading: string | null;
            content: string;
            fields: Array<{ label: string; value: string }>;
        }>;
    };
    metadata: {
        processingTimeMs: number;
        imageWidth: number;
        imageHeight: number;
    };
}

class OcrService {
    private scriptPath: string;
    private pythonCmd: string;
    private timeoutMs: number;

    constructor() {
        this.scriptPath = path.join(__dirname, "../../scripts/ocr_processor.py");
        this.pythonCmd = process.env.PYTHON_PATH || "python3";
        this.timeoutMs = parseInt(process.env.OCR_TIMEOUT_MS || "30000");
    }

    async processImage(imagePath: string, pageType?: string): Promise<OcrResult> {
        return new Promise((resolve, reject) => {
            const args = [this.scriptPath, imagePath];
            if (pageType) {
                args.push("--page-type", pageType);
            }

            const child = spawn(this.pythonCmd, args, {
                timeout: this.timeoutMs,
            });

            let stdout = "";
            let stderr = "";

            child.stdout.on("data", (data) => {
                stdout += data.toString();
            });

            child.stderr.on("data", (data) => {
                stderr += data.toString();
            });

            child.on("close", (code) => {
                if (code !== 0) {
                    reject(
                        new Error(
                            `OCR processing failed (exit code ${code}): ${stderr}`
                        )
                    );
                    return;
                }
                try {
                    const result: OcrResult = JSON.parse(stdout);
                    resolve(result);
                } catch {
                    reject(new Error(`Failed to parse OCR output: ${stdout}`));
                }
            });

            child.on("error", (err) => {
                reject(
                    new Error(`Failed to spawn OCR process: ${err.message}`)
                );
            });
        });
    }
}

export const ocrService = new OcrService();

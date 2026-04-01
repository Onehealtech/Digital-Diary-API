import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import path from "path";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
});

const S3_BUCKET = process.env.AWS_S3_BUCKET || "onheal-bucket";
const S3_REGION = process.env.AWS_REGION || "ap-south-1";

/**
 * Uploads a file buffer to S3 and returns the public HTTPS URL.
 *
 * @param buffer      File data
 * @param mimeType    e.g. "application/pdf" or "image/jpeg"
 * @param s3Key       Full S3 object key (path inside the bucket)
 */
export async function uploadBufferToS3(
  buffer: Buffer,
  mimeType: string,
  s3Key: string
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: mimeType,
    })
  );
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${s3Key}`;
}

/**
 * Builds an S3 key for a patient report file.
 * Pattern: patient-reports/{patientId}/{scanId}/{timestamp}-{random}.{ext}
 */
export function buildReportS3Key(
  patientId: string,
  scanId: string,
  originalname: string,
  mimeType: string
): string {
  const ext =
    path.extname(originalname).toLowerCase() ||
    `.${mimeType.split("/")[1] ?? "bin"}`;
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `patient-reports/${patientId}/${scanId}/${unique}${ext}`;
}

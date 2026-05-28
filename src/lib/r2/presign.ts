import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client } from "./client";
import { R2_BUCKET } from "./config";

const DEFAULT_EXPIRES_IN = 60 * 5; // 5 minutes

export function createUploadUrl(
  key: string,
  contentType: string,
  expiresIn = DEFAULT_EXPIRES_IN,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getR2Client(), command, { expiresIn });
}

export function createDownloadUrl(
  key: string,
  expiresIn = DEFAULT_EXPIRES_IN,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
  return getSignedUrl(getR2Client(), command, { expiresIn });
}

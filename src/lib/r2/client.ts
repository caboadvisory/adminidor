import "server-only";
import { S3Client } from "@aws-sdk/client-s3";
import { R2_ACCESS_KEY_ID, R2_ENDPOINT, R2_SECRET_ACCESS_KEY } from "./config";

let client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

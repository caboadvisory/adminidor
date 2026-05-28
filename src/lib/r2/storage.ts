import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "./client";
import { R2_BUCKET } from "./config";

export async function deleteObject(key: string): Promise<void> {
  await getR2Client().send(
    new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }),
  );
}

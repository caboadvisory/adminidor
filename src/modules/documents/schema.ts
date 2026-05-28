import { z } from "zod";

export const documentMetaSchema = z.object({
  ownerType: z.enum(["client", "project"]),
  ownerId: z.uuid(),
  fileName: z.string().trim().min(1).max(255),
  r2Key: z.string().trim().min(1).max(500),
  contentType: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().max(150).nullable(),
  ),
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
});

export type DocumentMeta = z.infer<typeof documentMetaSchema>;

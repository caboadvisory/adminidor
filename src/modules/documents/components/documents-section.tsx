"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { requestUploadUrl } from "@/lib/r2/actions";
import {
  attachDocument,
  deleteDocument,
  getDocumentDownloadUrl,
} from "@/modules/documents/actions";
import type { DocumentOwnerType, StoredDocument } from "@/modules/documents/types";

function formatSize(bytes: number | null) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsSection({
  ownerType,
  ownerId,
  documents,
  r2Configured,
}: {
  ownerType: DocumentOwnerType;
  ownerId: string;
  documents: StoredDocument[];
  r2Configured: boolean;
}) {
  const t = useTranslations("documents");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  if (!r2Configured) {
    return <p className="text-sm text-foreground/60">{t("notConfigured")}</p>;
  }

  async function onUpload() {
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const contentType = file.type || "application/octet-stream";

    setUploading(true);
    try {
      const { url, key } = await requestUploadUrl({
        fileName: file.name,
        contentType,
        ownerType,
        ownerId,
      });
      const put = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!put.ok) throw new Error("upload failed");

      const res = await attachDocument({
        ownerType,
        ownerId,
        fileName: file.name,
        r2Key: key,
        contentType,
        sizeBytes: file.size,
      });
      if (!res.ok) throw new Error(res.error);

      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch {
      setError(t("error"));
    } finally {
      setUploading(false);
    }
  }

  async function onDownload(id: string) {
    const res = await getDocumentDownloadUrl(id);
    if (res.ok) window.open(res.url, "_blank");
  }

  async function onDelete(id: string) {
    const res = await deleteDocument({ id, ownerType, ownerId });
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      {documents.length === 0 ? (
        <p className="text-sm text-foreground/60">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-black/[.06] dark:divide-white/[.08]">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{d.fileName}</span>
                  {d.kind === "report" ? (
                    <Badge tone="blue">{t("report")}</Badge>
                  ) : null}
                </div>
                <div className="text-foreground/60">
                  {dateFmt.format(new Date(d.createdAt))}
                  {d.sizeBytes != null ? ` · ${formatSize(d.sizeBytes)}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => onDownload(d.id)}
                  className="text-xs hover:underline"
                >
                  {t("download")}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(d.id)}
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  {tc("delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-black/[.06] pt-4 dark:border-white/[.08]">
        <input
          ref={fileRef}
          type="file"
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-background"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={onUpload}
          disabled={uploading}
        >
          {uploading ? t("uploading") : t("upload")}
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}

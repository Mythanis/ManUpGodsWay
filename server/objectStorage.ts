import { objectStorageClient } from "./replit_integrations/object_storage/objectStorage";
import type { Response } from "express";

function getBucketName(): string {
  const paths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "").split(",").map((p) => p.trim()).filter(Boolean);
  if (!paths.length) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not set — run setup_object_storage first");
  const bucketName = paths[0].split("/").filter(Boolean)[0];
  if (!bucketName) throw new Error("Cannot parse bucket name from PUBLIC_OBJECT_SEARCH_PATHS");
  return bucketName;
}

/**
 * Upload a buffer to the PUBLIC part of Object Storage.
 * Returns a backend proxy URL (/api/media/public/uploads/{key}) — GCS direct URLs
 * are NOT publicly accessible (uniform bucket ACL), so all public files are
 * served through the /api/media/* proxy route.
 * Used for thumbnails, images, community media, store products, blog images.
 */
export async function uploadPublicFile(buffer: Buffer, key: string, mimeType: string): Promise<string> {
  const bucketName = getBucketName();
  const bucket = objectStorageClient.bucket(bucketName);
  const objectName = `public/uploads/${key}`;
  const file = bucket.file(objectName);

  await file.save(buffer, {
    contentType: mimeType,
    resumable: false,
    metadata: { cacheControl: "public, max-age=31536000" },
  });

  // Return a backend proxy URL — GCS direct URLs require auth (uniform bucket-level ACL).
  return `/api/media/public/uploads/${key}`;
}

/**
 * Upload a buffer to the PRIVATE part of Object Storage.
 * Returns the GCS object key (NOT a public URL) — prefixed with "gcs:" to distinguish from disk filenames.
 * Used for subscription-gated video files; served through the /api/videos/:id/stream proxy.
 */
export async function uploadPrivateFile(buffer: Buffer, key: string, mimeType: string): Promise<string> {
  const bucketName = getBucketName();
  const bucket = objectStorageClient.bucket(bucketName);
  const objectName = `.private/uploads/${key}`;
  const file = bucket.file(objectName);

  await file.save(buffer, {
    contentType: mimeType,
    resumable: false,
  });

  return `gcs:${objectName}`;
}

/**
 * Delete a file from Object Storage given its public URL or gcs: key.
 * Silently succeeds if the file does not exist.
 */
export async function deleteStorageFile(urlOrKey: string): Promise<void> {
  try {
    const bucketName = getBucketName();
    const bucket = objectStorageClient.bucket(bucketName);
    let objectName: string;

    if (urlOrKey.startsWith("gcs:")) {
      objectName = urlOrKey.slice(4);
    } else if (urlOrKey.startsWith("https://storage.googleapis.com/")) {
      const url = new URL(urlOrKey);
      objectName = url.pathname.slice(1 + bucketName.length + 1);
    } else if (urlOrKey.startsWith("/api/media/")) {
      // Backend proxy URL: /api/media/public/uploads/{key} → public/uploads/{key}
      objectName = urlOrKey.slice("/api/media/".length);
    } else {
      return;
    }

    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    if (exists) await file.delete();
  } catch (e) {
    console.warn("[ObjectStorage] deleteStorageFile failed:", (e as Error).message);
  }
}

/**
 * Stream a private video file from Object Storage to the Express response.
 * Handles HTTP Range requests so seeking works correctly in the browser.
 * Used by GET /api/videos/:id/stream when videoUrl starts with "gcs:".
 */
export async function streamVideoFromStorage(
  gcsKey: string,
  rangeHeader: string | undefined,
  res: Response,
  mimeType: string
): Promise<void> {
  const bucketName = getBucketName();
  const objectName = gcsKey.startsWith("gcs:") ? gcsKey.slice(4) : gcsKey;
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);

  const [exists] = await file.exists();
  if (!exists) {
    res.status(404).json({ message: "Video file not found in storage" });
    return;
  }

  const [metadata] = await file.getMetadata();
  const fileSize = parseInt(metadata.size as string, 10);

  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": mimeType || "video/mp4",
    });
    file.createReadStream({ start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": mimeType || "video/mp4",
      "Accept-Ranges": "bytes",
    });
    file.createReadStream().pipe(res);
  }
}

/**
 * Returns true if the given string is a GCS-backed URL or key (not a local path, YouTube, Vimeo, etc.)
 */
export function isStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith("gcs:") || url.startsWith("https://storage.googleapis.com/") || url.startsWith("/api/media/");
}

/**
 * Stream a public file from Object Storage to the Express response.
 * Used by GET /api/media/* proxy route for serving thumbnails and public media.
 */
export async function streamPublicFileFromStorage(
  objectName: string,
  res: Response
): Promise<void> {
  const bucketName = getBucketName();
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);

  const [exists] = await file.exists();
  if (!exists) {
    res.status(404).json({ message: "File not found" });
    return;
  }

  const [metadata] = await file.getMetadata();
  const contentType = (metadata.contentType as string) || "application/octet-stream";
  const fileSize = metadata.size as string;

  res.set({
    "Content-Type": contentType,
    "Content-Length": fileSize,
    "Cache-Control": "public, max-age=31536000, immutable",
  });

  file.createReadStream().pipe(res);
}

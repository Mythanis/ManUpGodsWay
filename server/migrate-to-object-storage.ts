/**
 * One-time migration: Upload existing local disk files to Object Storage.
 * Run with: tsx server/migrate-to-object-storage.ts
 */
import * as fs from "fs";
import * as path from "path";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, sql, isNotNull } from "drizzle-orm";
import { objectStorageClient } from "./replit_integrations/object_storage/objectStorage";

function getBucketName(): string {
  const paths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "").split(",").map((p) => p.trim()).filter(Boolean);
  if (!paths.length) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not set");
  return paths[0].split("/").filter(Boolean)[0];
}

async function uploadToGCSPublic(buffer: Buffer, key: string, mimeType: string): Promise<string> {
  const bucketName = getBucketName();
  const bucket = objectStorageClient.bucket(bucketName);
  const objectName = `public/uploads/${key}`;
  const file = bucket.file(objectName);
  await file.save(buffer, { contentType: mimeType, resumable: false, metadata: { cacheControl: "public, max-age=31536000" } });
  try { await file.makePublic(); } catch {}
  return `https://storage.googleapis.com/${bucketName}/${objectName}`;
}

async function uploadToGCSPrivate(buffer: Buffer, key: string, mimeType: string): Promise<string> {
  const bucketName = getBucketName();
  const bucket = objectStorageClient.bucket(bucketName);
  const objectName = `.private/uploads/${key}`;
  const file = bucket.file(objectName);
  await file.save(buffer, { contentType: mimeType, resumable: false });
  return `gcs:${objectName}`;
}

function guessMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.mp4': 'video/mp4',
    '.webm': 'video/webm', '.mov': 'video/quicktime', '.pdf': 'application/pdf',
  };
  return map[ext] || 'application/octet-stream';
}

let migrated = 0, skipped = 0, errors = 0;

function logResult(table: string, id: string, oldUrl: string, newUrl: string) {
  console.log(`[MIGRATED] ${table} id=${id}: ${oldUrl.substring(0, 50)} → ${newUrl.substring(0, 50)}`);
  migrated++;
}

async function migrateFile(
  localSubPath: string,
  gcsKey: string,
  isPrivate: boolean,
): Promise<string | null> {
  const localPath = path.join(process.cwd(), localSubPath);
  if (!fs.existsSync(localPath)) {
    console.warn(`[SKIP] File not found on disk: ${localPath}`);
    skipped++;
    return null;
  }
  try {
    const buffer = fs.readFileSync(localPath);
    const mimeType = guessMimeType(localPath);
    if (isPrivate) {
      return await uploadToGCSPrivate(buffer, gcsKey, mimeType);
    } else {
      return await uploadToGCSPublic(buffer, gcsKey, mimeType);
    }
  } catch (e) {
    console.error(`[ERROR] Failed to upload ${localPath}:`, (e as Error).message);
    errors++;
    return null;
  }
}

// ─── Studies thumbnails ───────────────────────────────────────────────────────
async function migrateStudyThumbnails() {
  console.log("\n=== Migrating study thumbnails ===");
  const studies = await db.select({ id: schema.studies.id, thumbnailUrl: schema.studies.thumbnailUrl, thumbnailFilename: schema.studies.thumbnailFilename })
    .from(schema.studies)
    .where(sql`${schema.studies.thumbnailUrl} LIKE '/uploads/thumbnails/%'`);

  for (const study of studies) {
    if (!study.thumbnailUrl) continue;
    const filename = study.thumbnailUrl.replace('/uploads/thumbnails/', '');
    const gcsKey = `thumbnails/${filename}`;
    const newUrl = await migrateFile(`uploads/thumbnails/${filename}`, gcsKey, false);
    if (newUrl) {
      await db.update(schema.studies).set({ thumbnailUrl: newUrl, thumbnailFilename: gcsKey }).where(eq(schema.studies.id, study.id));
      logResult('studies', study.id, study.thumbnailUrl, newUrl);
    }
  }
}

// ─── Study series thumbnails ──────────────────────────────────────────────────
async function migrateSeriesThumbnails() {
  console.log("\n=== Migrating study series thumbnails ===");
  const series = await db.select({ id: schema.studySeries.id, thumbnailUrl: schema.studySeries.thumbnailUrl })
    .from(schema.studySeries)
    .where(sql`${schema.studySeries.thumbnailUrl} LIKE '/uploads/thumbnails/%'`);

  for (const s of series) {
    if (!s.thumbnailUrl) continue;
    const filename = s.thumbnailUrl.replace('/uploads/thumbnails/', '');
    const newUrl = await migrateFile(`uploads/thumbnails/${filename}`, `thumbnails/${filename}`, false);
    if (newUrl) {
      await db.update(schema.studySeries).set({ thumbnailUrl: newUrl }).where(eq(schema.studySeries.id, s.id));
      logResult('studySeries', s.id, s.thumbnailUrl, newUrl);
    }
  }
}

// ─── Devotional thumbnails ────────────────────────────────────────────────────
async function migrateDevotionalThumbnails() {
  console.log("\n=== Migrating devotional thumbnails ===");
  const devotionals = await db.select({ id: schema.devotionals.id, imageUrl: schema.devotionals.imageUrl })
    .from(schema.devotionals)
    .where(sql`${schema.devotionals.imageUrl} LIKE '/uploads/thumbnails/%'`);

  for (const d of devotionals) {
    if (!d.imageUrl) continue;
    const filename = d.imageUrl.replace('/uploads/thumbnails/', '');
    const newUrl = await migrateFile(`uploads/thumbnails/${filename}`, `thumbnails/${filename}`, false);
    if (newUrl) {
      await db.update(schema.devotionals).set({ imageUrl: newUrl }).where(eq(schema.devotionals.id, d.id));
      logResult('devotionals', d.id, d.imageUrl, newUrl);
    }
  }
}

// ─── Blog thumbnails ──────────────────────────────────────────────────────────
async function migrateBlogThumbnails() {
  console.log("\n=== Migrating blog thumbnails ===");
  const blogs = await db.select({ id: schema.blogPosts.id, coverImageUrl: schema.blogPosts.coverImageUrl })
    .from(schema.blogPosts)
    .where(sql`${schema.blogPosts.coverImageUrl} LIKE '/uploads/blog-thumbnails/%'`);

  for (const b of blogs) {
    if (!b.coverImageUrl) continue;
    const filename = b.coverImageUrl.replace('/uploads/blog-thumbnails/', '');
    const newUrl = await migrateFile(`uploads/blog-thumbnails/${filename}`, `blog-thumbnails/${filename}`, false);
    if (newUrl) {
      await db.update(schema.blogPosts).set({ coverImageUrl: newUrl }).where(eq(schema.blogPosts.id, b.id));
      logResult('blogPosts', b.id, b.coverImageUrl, newUrl);
    }
  }
}

// ─── Store product images ─────────────────────────────────────────────────────
async function migrateStoreProductImages() {
  console.log("\n=== Migrating store product images ===");
  const products = await db.select({ id: schema.storeProducts.id, imageUrl: schema.storeProducts.imageUrl })
    .from(schema.storeProducts)
    .where(sql`${schema.storeProducts.imageUrl} LIKE '/uploads/store-products/%'`);

  for (const p of products) {
    if (!p.imageUrl) continue;
    const filename = p.imageUrl.replace('/uploads/store-products/', '');
    const newUrl = await migrateFile(`uploads/store-products/${filename}`, `store-products/${filename}`, false);
    if (newUrl) {
      await db.update(schema.storeProducts).set({ imageUrl: newUrl }).where(eq(schema.storeProducts.id, p.id));
      logResult('storeProducts', p.id, p.imageUrl, newUrl);
    }
  }
}

// ─── Community media (discussions, war group posts, fitness posts) ────────────
async function migrateCommunityMedia() {
  console.log("\n=== Migrating community media ===");

  // Discussions
  const discussions = await db.select({ id: schema.discussions.id, mediaUrls: schema.discussions.mediaUrls })
    .from(schema.discussions)
    .where(sql`${schema.discussions.mediaUrls}::text LIKE '%/uploads/community/%'`);

  for (const d of discussions) {
    if (!d.mediaUrls?.length) continue;
    const newUrls: string[] = [];
    let changed = false;
    for (const url of d.mediaUrls) {
      if (url.startsWith('/uploads/community/')) {
        const filename = url.replace('/uploads/community/', '');
        const newUrl = await migrateFile(`uploads/community/${filename}`, `community/${filename}`, false);
        newUrls.push(newUrl || url);
        if (newUrl) changed = true;
      } else {
        newUrls.push(url);
      }
    }
    if (changed) {
      await db.update(schema.discussions).set({ mediaUrls: newUrls }).where(eq(schema.discussions.id, d.id));
      logResult('discussions', String(d.id), 'mediaUrls updated', 'GCS URLs');
    }
  }

  // Fitness posts
  const fitnessPosts = await db.select({ id: schema.fitnessPosts.id, mediaUrls: schema.fitnessPosts.mediaUrls })
    .from(schema.fitnessPosts)
    .where(sql`${schema.fitnessPosts.mediaUrls}::text LIKE '%/uploads/community/%'`);

  for (const p of fitnessPosts) {
    if (!p.mediaUrls?.length) continue;
    const newUrls: string[] = [];
    let changed = false;
    for (const url of p.mediaUrls) {
      if (url.startsWith('/uploads/community/')) {
        const filename = url.replace('/uploads/community/', '');
        const newUrl = await migrateFile(`uploads/community/${filename}`, `community/${filename}`, false);
        newUrls.push(newUrl || url);
        if (newUrl) changed = true;
      } else {
        newUrls.push(url);
      }
    }
    if (changed) {
      await db.update(schema.fitnessPosts).set({ mediaUrls: newUrls }).where(eq(schema.fitnessPosts.id, p.id));
      logResult('fitnessPosts', String(p.id), 'mediaUrls updated', 'GCS URLs');
    }
  }
}

// ─── Videos ───────────────────────────────────────────────────────────────────
async function migrateVideos() {
  console.log("\n=== Migrating video thumbnails ===");
  const videos = await db.select({ id: schema.videos.id, filename: schema.videos.filename, videoUrl: schema.videos.videoUrl, thumbnailUrl: schema.videos.thumbnailUrl, mimeType: schema.videos.mimeType })
    .from(schema.videos);

  for (const v of videos) {
    const updates: Record<string, any> = {};

    // Migrate thumbnail
    if (v.thumbnailUrl && v.thumbnailUrl.startsWith('/uploads/video-thumbnails/')) {
      const filename = v.thumbnailUrl.replace('/uploads/video-thumbnails/', '');
      const newUrl = await migrateFile(`uploads/video-thumbnails/${filename}`, `video-thumbnails/${filename}`, false);
      if (newUrl) {
        updates.thumbnailUrl = newUrl;
        logResult('videos(thumb)', v.id, v.thumbnailUrl, newUrl);
      }
    }

    // Migrate video file (if disk-stored and not yet in GCS)
    if (v.filename && !v.videoUrl?.startsWith('gcs:') && !v.videoUrl?.startsWith('http')) {
      console.log(`\n[Video file] Migrating video: ${v.filename}`);
      const newKey = await migrateFile(`uploads/videos/${v.filename}`, `videos/${v.filename}`, true);
      if (newKey) {
        updates.videoUrl = newKey;
        logResult('videos(file)', v.id, v.filename || '', newKey);
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.update(schema.videos).set(updates).where(eq(schema.videos.id, v.id));
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Starting Object Storage migration...");
  console.log(`Bucket: ${getBucketName()}`);

  await migrateStudyThumbnails();
  await migrateSeriesThumbnails();
  await migrateDevotionalThumbnails();
  await migrateBlogThumbnails();
  await migrateStoreProductImages();
  await migrateCommunityMedia();
  await migrateVideos();

  console.log(`\n===== Migration complete =====`);
  console.log(`Migrated: ${migrated}, Skipped: ${skipped}, Errors: ${errors}`);
  process.exit(0);
}

main().catch(e => { console.error("Migration failed:", e); process.exit(1); });

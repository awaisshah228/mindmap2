import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Bucket, getAwsRegion } from "@/lib/env";
import { db } from "@/db";
import { userFiles } from "@/db/schema";

const MAX_SIZE_ICONS = 5 * 1024 * 1024; // 5MB for icons
const MAX_SIZE_ATTACHMENTS = 20 * 1024 * 1024; // 20MB for attachments
const ALLOWED_ICON_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
const ALLOWED_ATTACHMENT_TYPES = [
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "text/csv", "application/json",
];
/** S3 presigned URLs max 7 days; we use 7 days for icon URLs. Use GET /api/upload/presign to refresh. */
const PRESIGN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

function getS3() {
  const region = getAwsRegion();
  const key = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;
  if (!key || !secret) throw new Error("AWS credentials not set");
  return new S3Client({ region, credentials: { accessKeyId: key, secretAccessKey: secret } });
}

async function createPresignedGetUrl(key: string): Promise<string> {
  const bucket = getS3Bucket();
  if (!bucket) throw new Error("S3 not configured");
  const s3 = getS3();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });
}

/** POST /api/upload – upload file to S3, store key in DB, return presigned URL (7 days) and key. */
export async function POST(request: Request) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const bucket = getS3Bucket();
  if (!bucket) {
    return NextResponse.json({ error: "Upload not configured" }, { status: 503 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string) || "icons";

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  const isAttachment = folder === "attachments";
  const maxSize = isAttachment ? MAX_SIZE_ATTACHMENTS : MAX_SIZE_ICONS;
  const allowedTypes = isAttachment ? ALLOWED_ATTACHMENT_TYPES : ALLOWED_ICON_TYPES;
  if (file.size > maxSize) {
    return NextResponse.json({ error: `File too large (max ${maxSize / 1024 / 1024}MB)` }, { status: 400 });
  }
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "bin";
  const key = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  try {
    const s3 = getS3();
    const buffer = Buffer.from(await file.arrayBuffer());
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    );

    const url = await createPresignedGetUrl(key);

    await db.insert(userFiles).values({
      userId,
      key,
      url,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });

    return NextResponse.json({ url, key });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

/** GET /api/upload/presign?key=... – return a fresh 7-day presigned URL for an uploaded file (own files only). */
export async function GET(req: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const key = req.nextUrl.searchParams.get("key");
  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "key required" }, { status: 400 });
  }
  if (!key.startsWith(userId + "/")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bucket = getS3Bucket();
  if (!bucket) {
    return NextResponse.json({ error: "Upload not configured" }, { status: 503 });
  }

  try {
    const url = await createPresignedGetUrl(key);
    return NextResponse.json({ url, key, expiresIn: PRESIGN_EXPIRY_SECONDS });
  } catch (err) {
    console.error("Presign error:", err);
    return NextResponse.json({ error: "Failed to create URL" }, { status: 500 });
  }
}

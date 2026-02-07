import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Bucket, getAwsRegion } from "@/lib/env";
import { db } from "@/db";
import { cloudIcons } from "@/db/schema";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
const PRESIGN_EXPIRY = 7 * 24 * 60 * 60; // 7 days

function getS3() {
  const region = getAwsRegion();
  const key = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;
  if (!key || !secret) throw new Error("AWS credentials not set");
  return new S3Client({ region, credentials: { accessKeyId: key, secretAccessKey: secret } });
}

async function createPresignedGetUrl(bucket: string, s3Key: string): Promise<string> {
  const s3 = getS3();
  const command = new GetObjectCommand({ Bucket: bucket, Key: s3Key });
  return getSignedUrl(s3, command, { expiresIn: PRESIGN_EXPIRY });
}

/** GET /api/admin/icons – list cloud icons (admin only). */
export async function GET() {
  const ok = await requireAdmin();
  if (ok instanceof NextResponse) return ok;

  try {
    const bucket = getS3Bucket();
    const rows = await db
      .select()
      .from(cloudIcons)
      .orderBy(desc(cloudIcons.createdAt));

    const withUrls = bucket
      ? await Promise.all(
          rows.map(async (r) => ({
            ...r,
            url: await createPresignedGetUrl(bucket, r.key),
          }))
        )
      : rows;

    return NextResponse.json({ icons: withUrls });
  } catch (err) {
    console.error("Admin list icons error:", err);
    return NextResponse.json({ error: "Failed to list icons" }, { status: 500 });
  }
}

/** POST /api/admin/icons – upload cloud icon (admin only). Body: FormData with file, name, keywords. */
export async function POST(req: Request) {
  const ok = await requireAdmin();
  if (ok instanceof NextResponse) return ok;

  const bucket = getS3Bucket();
  if (!bucket) {
    return NextResponse.json({ error: "Upload not configured (S3)" }, { status: 503 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string)?.trim() || "";
  const keywords = (formData.get("keywords") as string)?.trim() || "";

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: `File too large (max ${MAX_SIZE / 1024 / 1024}MB)` }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type (png, jpeg, gif, webp, svg)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "bin";
  const s3Key = `cloud-icons/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  try {
    const s3 = getS3();
    const buffer = Buffer.from(await file.arrayBuffer());
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type,
      })
    );

    const url = await createPresignedGetUrl(bucket, s3Key);
    const [row] = await db
      .insert(cloudIcons)
      .values({
        key: s3Key,
        url,
        filename: file.name,
        name,
        keywords: keywords || null,
        sortOrder: 0,
      })
      .returning();

    return NextResponse.json({ icon: row, url });
  } catch (err) {
    console.error("Admin icon upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

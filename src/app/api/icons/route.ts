import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Bucket, getAwsRegion } from "@/lib/env";
import { db } from "@/db";
import { cloudIcons } from "@/db/schema";

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

/** GET /api/icons – list cloud icons (public). Used for icon matching during node generation. */
export async function GET() {
  try {
    const bucket = getS3Bucket();
    const rows = await db
      .select({ id: cloudIcons.id, key: cloudIcons.key, name: cloudIcons.name, keywords: cloudIcons.keywords, url: cloudIcons.url })
      .from(cloudIcons)
      .orderBy(desc(cloudIcons.sortOrder), desc(cloudIcons.createdAt));

    const withUrls = bucket
      ? await Promise.all(
          rows.map(async (r) => ({
            id: r.id,
            name: r.name,
            keywords: r.keywords ?? "",
            url: await createPresignedGetUrl(bucket, r.key),
          }))
        )
      : rows.map((r) => ({
          id: r.id,
          name: r.name,
          keywords: r.keywords ?? "",
          url: r.url,
        }));

    return NextResponse.json({ icons: withUrls });
  } catch (err) {
    console.error("List icons error:", err);
    return NextResponse.json({ icons: [] });
  }
}

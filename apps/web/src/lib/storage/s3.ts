import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";

export function getS3Bucket(): string {
  return process.env.S3_BUCKET?.trim() || "goyalco-prod-assets";
}

/** All objects live under this folder, never at the bucket root. */
export function getS3Prefix(): string {
  const raw = (process.env.S3_PREFIX || "eoi").trim().replace(/^\/+|\/+$/g, "");
  const safe = raw.replace(/[^a-zA-Z0-9._-]/g, "-") || "eoi";
  return safe;
}

export function withS3Prefix(relativeKey: string): string {
  const prefix = getS3Prefix();
  const key = relativeKey.replace(/^\/+/, "");
  if (key === prefix || key.startsWith(`${prefix}/`)) return key;
  return `${prefix}/${key}`;
}

function s3Endpoint(): string | undefined {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  return endpoint || undefined;
}

let cached: S3Client | null = null;
let cachedSig = "";

export function getS3Client(): S3Client {
  const sig = [
    s3Endpoint() || "",
    process.env.S3_REGION || "",
    process.env.S3_ACCESS_KEY || "",
    process.env.S3_FORCE_PATH_STYLE || "",
  ].join("|");
  if (cached && cachedSig === sig) return cached;
  cachedSig = sig;
  cached = new S3Client({
    endpoint: s3Endpoint(),
    region: process.env.S3_REGION || "ap-south-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || "",
      secretAccessKey: process.env.S3_SECRET_KEY || "",
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  });
  return cached;
}

export async function s3PutObject(params: {
  key: string;
  body: Buffer | Uint8Array;
  mimeType: string;
  size: number;
}): Promise<string> {
  const key = withS3Prefix(params.key);
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getS3Bucket(),
      Key: key,
      Body: params.body,
      ContentType: params.mimeType,
      ContentLength: params.size,
    }),
  );
  return key;
}

export async function s3DeleteObject(key: string): Promise<void> {
  await getS3Client().send(new DeleteObjectCommand({ Bucket: getS3Bucket(), Key: key.replace(/^\/+/, "") }));
}

export async function s3HeadObject(key: string): Promise<boolean> {
  try {
    await getS3Client().send(new HeadObjectCommand({ Bucket: getS3Bucket(), Key: key.replace(/^\/+/, "") }));
    return true;
  } catch {
    return false;
  }
}

export async function s3GetObject(key: string) {
  return getS3Client().send(new GetObjectCommand({ Bucket: getS3Bucket(), Key: key.replace(/^\/+/, "") }));
}

export async function s3HealthCheck(): Promise<boolean> {
  if (!process.env.S3_ACCESS_KEY?.trim()) return false;
  try {
    await getS3Client().send(new HeadBucketCommand({ Bucket: getS3Bucket() }));
    return true;
  } catch (err) {
    console.warn(
      `[warn] scope=s3.health msg=HeadBucket failed bucket=${getS3Bucket()}`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

export function appFileUrl(key: string): string {
  return `/api/files/${withS3Prefix(key).split("/").map(encodeURIComponent).join("/")}`;
}

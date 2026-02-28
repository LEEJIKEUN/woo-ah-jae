import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

function isR2Enabled() {
  return process.env.STORAGE_BACKEND === "r2";
}

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function createClient() {
  const accountId = required("R2_ACCOUNT_ID");
  const accessKeyId = required("R2_ACCESS_KEY_ID");
  const secretAccessKey = required("R2_SECRET_ACCESS_KEY");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

let _client: S3Client | null = null;

function getClient() {
  if (!isR2Enabled()) {
    throw new Error("R2 backend is not enabled");
  }
  if (!_client) _client = createClient();
  return _client;
}

export function getStorageBackend() {
  return process.env.STORAGE_BACKEND === "r2" ? "r2" : "local";
}

export async function putPublicObject(key: string, body: Buffer, contentType: string) {
  const client = getClient();
  const bucket = required("R2_BUCKET_PUBLIC");
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
    })
  );

  const publicBase = process.env.R2_PUBLIC_BASE_URL;
  if (!publicBase) {
    throw new Error("Missing env: R2_PUBLIC_BASE_URL");
  }
  return `${publicBase.replace(/\/$/, "")}/${key}`;
}

export async function putPrivateObject(key: string, body: Buffer, contentType: string) {
  const client = getClient();
  const bucket = required("R2_BUCKET_PRIVATE");
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
    })
  );
  return `r2://${key}`;
}

export async function getPrivateObject(fileKey: string) {
  if (!fileKey.startsWith("r2://")) {
    throw new Error("Invalid R2 private key");
  }
  const key = fileKey.replace("r2://", "");
  const client = getClient();
  const bucket = required("R2_BUCKET_PRIVATE");
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
  if (!response.Body) {
    throw new Error("R2 object body is empty");
  }
  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes);
}

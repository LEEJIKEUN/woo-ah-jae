import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

/** 브라우저가 R2(비공개 버킷)로 파일을 직접 PUT 하도록 서명된 업로드 URL 발급. (대용량 영상용) */
export async function presignPutUrl(key: string, contentType: string, expiresSec = 3600) {
  const client = getClient();
  const bucket = required("R2_BUCKET_PRIVATE");
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType || "application/octet-stream" }), { expiresIn: expiresSec });
}

/**
 * 재생/보기/다운로드용 서명 URL(Range 지원).
 * opts.disposition="inline" → 브라우저에서 바로 보기(PDF 뷰어·동영상 재생), "attachment" → 다운로드.
 * opts.mime 로 응답 Content-Type 을 명시해 브라우저가 올바르게 렌더링하도록 강제한다.
 */
export async function presignGetUrl(
  key: string,
  expiresSec = 6 * 3600,
  opts?: { fileName?: string; mime?: string; disposition?: "inline" | "attachment" }
) {
  const client = getClient();
  const bucket = required("R2_BUCKET_PRIVATE");
  const extra: { ResponseContentType?: string; ResponseContentDisposition?: string } = {};
  if (opts?.mime) extra.ResponseContentType = opts.mime;
  if (opts?.disposition) {
    const fn = opts.fileName ? `; filename*=UTF-8''${encodeURIComponent(opts.fileName)}` : "";
    extra.ResponseContentDisposition = `${opts.disposition}${fn}`;
  }
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key, ...extra }), { expiresIn: expiresSec });
}

/** 비공개 버킷의 오브젝트 삭제(과제 삭제 시 R2 파일도 함께 제거). */
export async function deletePrivateObject(key: string) {
  const client = getClient();
  const bucket = required("R2_BUCKET_PRIVATE");
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
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

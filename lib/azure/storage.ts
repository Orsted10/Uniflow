import crypto from "crypto";

export interface AzureBlobConfig {
  configured: boolean;
  accountName: string | null;
  containerName: string;
  endpointSuffix: string;
}

export interface BlobUploadResult {
  blobName: string;
  blobUrl: string;
  sizeBytes: number;
  contentHash: string;
  uploadedAt: string;
  provider: "azure_blob" | "local_memory";
}

// In-memory simulation store for local testing and offline fallback
const localBlobStorage = new Map<string, { content: string; contentType: string; uploadedAt: string }>();

/**
 * Returns safe health/config state for Azure Blob Storage.
 * Never exposes the storage account key or raw connection string.
 */
export function getAzureBlobConfig(): AzureBlobConfig {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME?.trim() || "uniflow-specs";

  if (!connStr || connStr.includes("placeholder") || connStr.length < 20) {
    return {
      configured: false,
      accountName: null,
      containerName,
      endpointSuffix: "core.windows.net",
    };
  }

  // Parse AccountName without exposing key
  const match = connStr.match(/AccountName=([^;]+)/i);
  const accountName = match ? match[1] : "unknown";

  return {
    configured: true,
    accountName,
    containerName,
    endpointSuffix: "core.windows.net",
  };
}

/**
 * Uploads specification content to Azure Blob Storage (or local fallback).
 * Uses SHA-256 content hashing to ensure idempotent and tamper-proof naming.
 */
export async function uploadSpecToBlob(
  projectId: string,
  side: "source" | "target",
  filename: string,
  content: string
): Promise<BlobUploadResult> {
  const config = getAzureBlobConfig();
  const contentHash = crypto.createHash("sha256").update(content, "utf8").digest("hex");
  const blobName = `specs/${projectId}/${side}-${contentHash.slice(0, 12)}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const now = new Date().toISOString();
  const sizeBytes = Buffer.byteLength(content, "utf8");

  if (!config.configured) {
    // Graceful offline fallback
    localBlobStorage.set(blobName, {
      content,
      contentType: "application/json",
      uploadedAt: now,
    });

    return {
      blobName,
      blobUrl: `local://storage/${blobName}`,
      sizeBytes,
      contentHash,
      uploadedAt: now,
      provider: "local_memory",
    };
  }

  // When live Azure Storage credentials are configured, execute upload via Azure Blob REST API
  try {
    const uploadRes = await uploadBlockBlobViaRest(config, blobName, content, "application/json");
    return {
      blobName,
      blobUrl: uploadRes.url,
      sizeBytes,
      contentHash,
      uploadedAt: now,
      provider: "azure_blob",
    };
  } catch (err: unknown) {
    // If live upload fails (e.g. invalid credentials or network unreachable), fallback safely
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[Azure Blob] Live upload failed, using local fallback: ${errMsg}`);
    localBlobStorage.set(blobName, {
      content,
      contentType: "application/json",
      uploadedAt: now,
    });

    return {
      blobName,
      blobUrl: `local://storage/${blobName}`,
      sizeBytes,
      contentHash,
      uploadedAt: now,
      provider: "local_memory",
    };
  }
}

/**
 * Uploads generated compatibility report artifacts (.md and .json) to Azure Blob Storage.
 */
export async function uploadReportToBlob(
  projectId: string,
  reportId: string,
  markdown: string,
  jsonData: unknown
): Promise<{
  markdownArtifact: BlobUploadResult;
  jsonArtifact: BlobUploadResult;
}> {
  const jsonContent = typeof jsonData === "string" ? jsonData : JSON.stringify(jsonData, null, 2);

  const mdUpload = await uploadSpecToBlob(
    projectId,
    "source",
    `compatibility-report-${reportId}.md`,
    markdown
  );

  const jsonUpload = await uploadSpecToBlob(
    projectId,
    "target",
    `compatibility-report-${reportId}.json`,
    jsonContent
  );

  return {
    markdownArtifact: mdUpload,
    jsonArtifact: jsonUpload,
  };
}

/**
 * Retrieves blob content from live Azure Blob or fallback store.
 */
export async function getBlobContent(blobName: string): Promise<string | null> {
  // Check local fallback first
  if (localBlobStorage.has(blobName)) {
    return localBlobStorage.get(blobName)!.content;
  }

  const config = getAzureBlobConfig();
  if (!config.configured || !config.accountName) return null;

  try {
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING!;
    const keyMatch = connStr.match(/AccountKey=([^;]+)/i);
    if (!keyMatch) return null;

    const accountKey = keyMatch[1];
    const host = `${config.accountName}.blob.${config.endpointSuffix}`;
    const dateStr = new Date().toUTCString();
    const canonicalResource = `/${config.accountName}/${config.containerName}/${blobName}`;
    const stringToSign = `GET\n\n\n\n\n\n\n\n\n\n\n\nx-ms-date:${dateStr}\nx-ms-version:2020-10-02\n${canonicalResource}`;
    const signature = crypto
      .createHmac("sha256", Buffer.from(accountKey, "base64"))
      .update(stringToSign, "utf8")
      .digest("base64");

    const url = `https://${host}/${config.containerName}/${blobName}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "x-ms-date": dateStr,
        "x-ms-version": "2020-10-02",
        Authorization: `SharedKey ${config.accountName}:${signature}`,
      },
    });

    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Direct REST API upload to Azure BlockBlob using SharedKey authentication.
 */
async function uploadBlockBlobViaRest(
  config: AzureBlobConfig,
  blobName: string,
  content: string,
  contentType: string
): Promise<{ url: string }> {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING!;
  const keyMatch = connStr.match(/AccountKey=([^;]+)/i);
  if (!keyMatch || !config.accountName) {
    throw new Error("Missing Azure Storage AccountKey in connection string.");
  }

  const accountKey = keyMatch[1];
  const host = `${config.accountName}.blob.${config.endpointSuffix}`;
  const dateStr = new Date().toUTCString();
  const contentLength = Buffer.byteLength(content, "utf8");

  const canonicalResource = `/${config.accountName}/${config.containerName}/${blobName}`;
  const stringToSign = `PUT\n\n\n${contentLength}\n\n${contentType}\n\n\n\n\n\n\nx-ms-blob-type:BlockBlob\nx-ms-date:${dateStr}\nx-ms-version:2020-10-02\n${canonicalResource}`;

  const signature = crypto
    .createHmac("sha256", Buffer.from(accountKey, "base64"))
    .update(stringToSign, "utf8")
    .digest("base64");

  const url = `https://${host}/${config.containerName}/${blobName}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(contentLength),
      "x-ms-blob-type": "BlockBlob",
      "x-ms-date": dateStr,
      "x-ms-version": "2020-10-02",
      Authorization: `SharedKey ${config.accountName}:${signature}`,
    },
    body: content,
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Azure Blob REST error (${res.status}): ${errorBody.slice(0, 200)}`);
  }

  return { url };
}


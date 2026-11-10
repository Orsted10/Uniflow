import { NextResponse } from "next/server";
import { getAzureBlobConfig } from "@/lib/azure/storage";
import { getAzureSqlConfig } from "@/lib/azure/sql";

export const dynamic = "force-dynamic";

export async function GET() {
  // 1. Supabase health
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const supabaseConfigured = !!(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes("placeholder") &&
    !supabaseAnonKey.includes("placeholder")
  );

  // 2. Groq AI health
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const groqModel = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
  const groqConfigured = !!(groqKey && !groqKey.includes("placeholder") && groqKey.startsWith("gsk_"));

  // 3. Azure Blob Storage health
  const azureBlob = getAzureBlobConfig();

  // 4. Azure SQL Database health
  const azureSql = getAzureSqlConfig();

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    services: {
      supabase: {
        configured: supabaseConfigured,
        status: supabaseConfigured ? "ready" : "offline_mock",
        endpoint: supabaseUrl ? supabaseUrl.replace(/https?:\/\//, "").split(".")[0] : null,
      },
      groq: {
        configured: groqConfigured,
        status: groqConfigured ? "ready" : "mock_proposals",
        model: groqModel,
      },
      azureBlob: {
        configured: azureBlob.configured,
        status: azureBlob.configured ? "ready" : "in_memory_simulation",
        accountName: azureBlob.accountName,
        containerName: azureBlob.containerName,
      },
      azureSql: {
        configured: azureSql.configured,
        status: azureSql.configured ? "ready" : "in_memory_simulation",
        server: azureSql.server,
        database: azureSql.database,
      },
    },
  });
}


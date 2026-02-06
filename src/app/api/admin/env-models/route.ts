/**
 * GET /api/admin/env-models — which providers have API keys in env + default model in use.
 * Admin-only. Does not expose actual keys.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getEnvProviderStatus, getDefaultEnvModel, getDefaultCloudModel } from "@/lib/ai-models";

export async function GET() {
  const userId = await requireAdmin();
  if (userId instanceof NextResponse) return userId;

  const envStatus = getEnvProviderStatus();
  const defaultEnv = getDefaultEnvModel();
  const defaultCloud = await getDefaultCloudModel();

  return NextResponse.json({
    envProviders: envStatus,
    defaultModelInUse: defaultCloud
      ? { source: "admin", label: defaultCloud.label, provider: defaultCloud.provider, model: defaultCloud.model }
      : defaultEnv
        ? { source: "env", label: defaultEnv.label ?? `${defaultEnv.provider}/${defaultEnv.model}`, provider: defaultEnv.provider, model: defaultEnv.model }
        : null,
  });
}

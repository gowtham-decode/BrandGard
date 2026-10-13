const API_BASE = (
  import.meta.env.VITE_BRANDGUARD_API_URL || "http://127.0.0.1:8000/api/v1"
).replace(/\/+$/, "");

export type User = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  organization_id: string | null;
};

export type Asset = {
  id: string;
  brand_id: string;
  platform: string;
  raw_identifier: string;
  normalized_identifier: string;
  url: string | null;
  display_name: string | null;
  verification_status: string;
  is_verified: boolean;
  created_at: string;
};

export type Brand = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  logo_url: string | null;
  alternate_names: string[];
  authorized_contact: Record<string, unknown>;
  is_active: boolean;
  official_assets: Asset[];
  created_at: string;
};

export type Evidence = {
  id: string | null;
  signal_name: string;
  signal_type: string;
  severity: string;
  score_contribution: number;
  title: string;
  description: string;
  supporting_data: Record<string, unknown>;
};

export type Assessment = {
  risk_score: number;
  risk_category: string;
  rule_score: number;
  ml_score: number | null;
  is_insufficient_evidence: boolean;
  uncertainty_level: string;
  summary_reason: string;
  triggered_rules: Array<Record<string, unknown>>;
  recommended_actions: string[];
  missing_evidence_notes: string[];
  model_version: string;
  assessed_at: string | null;
};

export type Scan = {
  id: string;
  organization_id: string;
  brand_id: string | null;
  brand_name: string | null;
  platform: string;
  target_url: string | null;
  account_handle: string | null;
  display_name: string | null;
  profile_description: string | null;
  submission_source: string;
  status: string;
  created_at: string;
  risk_assessment: Assessment | null;
  evidence_items: Evidence[];
  extracted_features: Record<string, unknown> | null;
  source_provenance: {
    origin: string;
    source_name: string;
    collection_method: string;
    source_url: string | null;
    source_record_id: string | null;
    source_observed_at: string | null;
    attribution_status: string;
    received_at: string | null;
  } | null;
};

export type AppStoreListing = {
  listing_id: string;
  name: string;
  publisher: string;
  listing_url: string;
  artwork_url: string | null;
  description: string | null;
  observed_at: string;
  country: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(
  path: string,
  options: { token?: string; method?: string; body?: unknown } = {},
): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(
      `Cannot reach the BrandGuard API at ${API_BASE}. Start the backend and try again.`,
      0,
    );
  }

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const payload = (await response.json()) as { detail?: unknown };
      if (typeof payload.detail === "string") message = payload.detail;
      else if (Array.isArray(payload.detail)) {
        message = payload.detail
          .map((item: { msg?: unknown }) => item.msg)
          .filter((item): item is string => typeof item === "string")
          .join(" ");
      }
    } catch {
      // Use the status message when an error response is not JSON.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const platformLabels: Record<string, string> = {
  website: "Website",
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X",
  twitter: "X",
  telegram: "Telegram",
  app_store: "App Store",
  apple_app_store: "Apple App Store",
  google_play: "Google Play",
};

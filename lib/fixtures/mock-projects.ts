import { Project } from "@/lib/supabase/models";
import {
  CANONICAL_SOURCE_SPEC,
  CANONICAL_TARGET_SPEC,
  CANONICAL_TEST_FIXTURES,
} from "@/lib/specs/fixtures";

/**
 * Explicitly named story/demo fixtures for Phase 1 UI foundation.
 * These are marked as demo fixtures and not persisted production data.
 */
export const DEMO_PROJECTS: Project[] = [
  {
    id: "proj-ecommerce-canonical",
    owner_id: "00000000-0000-0000-0000-000000000001",
    name: "Billing API to Invoice Fulfillment",
    description: "Legacy integer-based billing order contract adapted to the string-based invoice fulfillment microservice.",
    created_at: "2026-10-28T09:30:00Z",
    updated_at: "2026-10-30T04:15:00Z",
  },
  {
    id: "proj-stripe-to-netsuite",
    owner_id: "00000000-0000-0000-0000-000000000001",
    name: "Payment Gateway to ERP Sync",
    description: "Reconciling webhook payloads with ERP transaction records and nested item breakdowns.",
    created_at: "2026-10-25T11:00:00Z",
    updated_at: "2026-10-29T16:20:00Z",
  },
];

export const DEMO_SPECS = {
  source: CANONICAL_SOURCE_SPEC,
  target: CANONICAL_TARGET_SPEC,
  fixtures: CANONICAL_TEST_FIXTURES,
};

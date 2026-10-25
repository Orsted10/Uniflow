export const CANONICAL_SOURCE_SPEC = JSON.stringify(
  {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "BillingOrderSourceAPI",
    version: "1.2.0",
    type: "object",
    required: ["id", "amount", "currency", "created_at"],
    properties: {
      id: {
        type: "integer",
        description: "Primary numeric order ID from legacy billing system",
      },
      amount: {
        type: "number",
        description: "Monetary amount in source currency",
      },
      currency: {
        type: "string",
        enum: ["USD", "EUR", "GBP"],
        description: "ISO currency code uppercase",
      },
      created_at: {
        type: "string",
        format: "date-time",
        description: "ISO-8601 creation timestamp",
      },
      note: {
        type: "string",
        description: "Optional customer comment or note",
      },
    },
  },
  null,
  2
);

export const CANONICAL_TARGET_SPEC = JSON.stringify(
  {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "InvoiceFulfillmentTargetAPI",
    version: "2.0.0",
    type: "object",
    required: ["order_id", "total", "currency_code", "timestamp", "region"],
    properties: {
      order_id: {
        type: "string",
        description: "String identifier for the destination invoice system",
      },
      total: {
        type: "string",
        description: "Formatted string total amount",
      },
      currency_code: {
        type: "string",
        enum: ["usd", "eur", "gbp"],
        description: "Lowercase ISO currency code",
      },
      timestamp: {
        type: "string",
        format: "date-time",
        description: "Standard timestamp for record fulfillment",
      },
      memo: {
        type: "string",
        description: "Fulfillment note or customer remarks",
      },
      region: {
        type: "string",
        description: "Geographic processing region (required)",
      },
    },
  },
  null,
  2
);

export const CANONICAL_TEST_FIXTURES = [
  {
    description: "Valid order payload requiring type conversion, enum mapping, rename, and default",
    payload: {
      id: 101,
      amount: 42.5,
      currency: "USD",
      created_at: "2026-03-14T10:00:00Z",
      note: "sample order note",
    },
    expectValid: true,
  },
  {
    description: "Valid European currency order with omitted optional note",
    payload: {
      id: 202,
      amount: 199.99,
      currency: "EUR",
      created_at: "2026-03-14T12:30:00Z",
    },
    expectValid: true,
  },
  {
    description: "Negative case: Missing required 'amount' in source payload",
    payload: {
      id: 303,
      currency: "USD",
      created_at: "2026-03-14T14:00:00Z",
    },
    expectValid: false,
  },
];

import { describe, expect, it } from "vitest";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  auditLogQuerySchema,
  documentIdSchema,
  queryRequestSchema,
  questionSchema,
} from "@/lib/validation";

describe("questionSchema", () => {
  it("accepts a normal question", () => {
    const result = questionSchema.safeParse("What was revenue in Q3?");
    expect(result.success).toBe(true);
  });

  it("trims whitespace", () => {
    const result = questionSchema.safeParse("  What was revenue?  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("What was revenue?");
  });

  it("rejects an empty question", () => {
    expect(questionSchema.safeParse("").success).toBe(false);
    expect(questionSchema.safeParse("   ").success).toBe(false);
  });

  it("rejects a question over 500 characters", () => {
    const long = "a".repeat(501);
    expect(questionSchema.safeParse(long).success).toBe(false);
  });

  it("accepts exactly 500 characters", () => {
    const exact = "a".repeat(500);
    expect(questionSchema.safeParse(exact).success).toBe(true);
  });
});

describe("queryRequestSchema", () => {
  it("accepts a valid request body", () => {
    const result = queryRequestSchema.safeParse({ question: "Is this document good?" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing question field", () => {
    expect(queryRequestSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-string question", () => {
    expect(queryRequestSchema.safeParse({ question: 42 }).success).toBe(false);
  });
});

describe("documentIdSchema", () => {
  it("accepts a valid uuid", () => {
    const result = documentIdSchema.safeParse("123e4567-e89b-12d3-a456-426614174000");
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid string", () => {
    expect(documentIdSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(documentIdSchema.safeParse("").success).toBe(false);
  });
});

describe("auditLogQuerySchema", () => {
  it("applies defaults for page and pageSize", () => {
    const result = auditLogQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
      expect(result.data.status).toBeUndefined();
    }
  });

  it("coerces string page/pageSize query params to numbers", () => {
    const result = auditLogQuerySchema.safeParse({ page: "3", pageSize: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(50);
    }
  });

  it("rejects pageSize over 100", () => {
    expect(auditLogQuerySchema.safeParse({ pageSize: "101" }).success).toBe(false);
  });

  it("rejects page below 1", () => {
    expect(auditLogQuerySchema.safeParse({ page: "0" }).success).toBe(false);
  });

  it("accepts each valid status enum value", () => {
    for (const status of [
      "answered",
      "refused_out_of_scope",
      "refused_advice_request",
      "insufficient_context",
      "error",
    ]) {
      expect(auditLogQuerySchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("rejects an invalid status value", () => {
    expect(auditLogQuerySchema.safeParse({ status: "bogus" }).success).toBe(false);
  });
});

describe("upload constants", () => {
  it("caps uploads at 20 MB", () => {
    expect(MAX_UPLOAD_BYTES).toBe(20 * 1024 * 1024);
  });

  it("only allows PDF mime type", () => {
    expect(ALLOWED_UPLOAD_MIME_TYPES).toEqual(["application/pdf"]);
  });
});

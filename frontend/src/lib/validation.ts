import { z } from "zod";

export const questionSchema = z
  .string()
  .trim()
  .min(1, "Question cannot be empty.")
  .max(500, "Question must be 500 characters or fewer.");

export const queryRequestSchema = z.object({
  question: questionSchema,
});

export const documentIdSchema = z.string().uuid("Invalid document id.");

export const auditLogQuerySchema = z.object({
  status: z
    .enum([
      "answered",
      "refused_out_of_scope",
      "refused_advice_request",
      "insufficient_context",
      "error",
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
export const ALLOWED_UPLOAD_MIME_TYPES = ["application/pdf"];

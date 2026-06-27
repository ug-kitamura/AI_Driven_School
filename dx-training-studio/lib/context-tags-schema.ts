import { z } from "zod";

export const contextTagsSchema = z
  .array(z.string().trim().min(1))
  .min(1, "tags は 1 個以上必要です")
  .max(3, "tags は 3 個以内です");

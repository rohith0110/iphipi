import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  resumes: defineTable({
    anonId: v.string(),
    analysis: v.any(),
    createdAt: v.number(),
  }).index("by_anon", ["anonId"]),

  jobs: defineTable({
    resumeId: v.id("resumes"),
    jobs: v.any(),
    createdAt: v.number(),
  }).index("by_resume", ["resumeId"]),

  sessions: defineTable({
    anonId: v.string(),
    resumeId: v.id("resumes"),
    targetRole: v.string(),
    status: v.union(v.literal("active"), v.literal("completed")),
    sessionBlob: v.any(),
    reportBlob: v.optional(v.any()),
    aggregate: v.optional(
      v.object({
        technical: v.number(),
        communication: v.number(),
        confidence: v.number(),
      }),
    ),
    overall: v.optional(v.number()),
    hire: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_anon", ["anonId"])
    .index("by_anon_status", ["anonId", "status"]),
});

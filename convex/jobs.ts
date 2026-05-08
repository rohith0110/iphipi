import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const forResume = query({
  args: { resumeId: v.id("resumes"), anonId: v.string() },
  handler: async (ctx, { resumeId, anonId }) => {
    const resume = await ctx.db.get(resumeId);
    if (!resume || resume.anonId !== anonId) return null;
    const docs = await ctx.db
      .query("jobs")
      .withIndex("by_resume", (q) => q.eq("resumeId", resumeId))
      .order("desc")
      .take(1);
    return docs[0] ?? null;
  },
});

export const set = mutation({
  args: { resumeId: v.id("resumes"), anonId: v.string(), jobs: v.any() },
  handler: async (ctx, { resumeId, anonId, jobs }) => {
    const resume = await ctx.db.get(resumeId);
    if (!resume || resume.anonId !== anonId) {
      throw new Error("Not your resume");
    }
    const existing = await ctx.db
      .query("jobs")
      .withIndex("by_resume", (q) => q.eq("resumeId", resumeId))
      .collect();
    for (const e of existing) await ctx.db.delete(e._id);
    await ctx.db.insert("jobs", { resumeId, jobs, createdAt: Date.now() });
  },
});

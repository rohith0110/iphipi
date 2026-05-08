import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const current = query({
  args: { anonId: v.string() },
  handler: async (ctx, { anonId }) => {
    const docs = await ctx.db
      .query("resumes")
      .withIndex("by_anon", (q) => q.eq("anonId", anonId))
      .order("desc")
      .take(1);
    return docs[0] ?? null;
  },
});

export const set = mutation({
  args: { anonId: v.string(), analysis: v.any() },
  handler: async (ctx, { anonId, analysis }) => {
    const id = await ctx.db.insert("resumes", {
      anonId,
      analysis,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const clear = mutation({
  args: { anonId: v.string() },
  handler: async (ctx, { anonId }) => {
    const resumes = await ctx.db
      .query("resumes")
      .withIndex("by_anon", (q) => q.eq("anonId", anonId))
      .collect();
    for (const r of resumes) {
      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_resume", (q) => q.eq("resumeId", r._id))
        .collect();
      for (const j of jobs) await ctx.db.delete(j._id);
      await ctx.db.delete(r._id);
    }
    // Also drop any active session so the user lands cleanly on upload screen.
    const active = await ctx.db
      .query("sessions")
      .withIndex("by_anon_status", (q) =>
        q.eq("anonId", anonId).eq("status", "active"),
      )
      .collect();
    for (const s of active) await ctx.db.delete(s._id);
  },
});

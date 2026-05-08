import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const active = query({
  args: { anonId: v.string() },
  handler: async (ctx, { anonId }) => {
    const docs = await ctx.db
      .query("sessions")
      .withIndex("by_anon_status", (q) =>
        q.eq("anonId", anonId).eq("status", "active"),
      )
      .order("desc")
      .take(1);
    return docs[0] ?? null;
  },
});

export const byId = query({
  args: { id: v.id("sessions"), anonId: v.string() },
  handler: async (ctx, { id, anonId }) => {
    const doc = await ctx.db.get(id);
    if (!doc || doc.anonId !== anonId) return null;
    return doc;
  },
});

export const start = mutation({
  args: {
    anonId: v.string(),
    resumeId: v.id("resumes"),
    targetRole: v.string(),
    sessionBlob: v.any(),
  },
  handler: async (ctx, { anonId, resumeId, targetRole, sessionBlob }) => {
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_anon_status", (q) =>
        q.eq("anonId", anonId).eq("status", "active"),
      )
      .collect();
    for (const e of existing) await ctx.db.delete(e._id);

    const id = await ctx.db.insert("sessions", {
      anonId,
      resumeId,
      targetRole,
      status: "active",
      sessionBlob,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("sessions"),
    anonId: v.string(),
    sessionBlob: v.any(),
  },
  handler: async (ctx, { id, anonId, sessionBlob }) => {
    const doc = await ctx.db.get(id);
    if (!doc || doc.anonId !== anonId) throw new Error("Not your session");
    await ctx.db.patch(id, { sessionBlob });
  },
});

export const complete = mutation({
  args: {
    id: v.id("sessions"),
    anonId: v.string(),
    sessionBlob: v.any(),
    reportBlob: v.any(),
    aggregate: v.object({
      technical: v.number(),
      communication: v.number(),
      confidence: v.number(),
    }),
    overall: v.number(),
    hire: v.string(),
  },
  handler: async (
    ctx,
    { id, anonId, sessionBlob, reportBlob, aggregate, overall, hire },
  ) => {
    const doc = await ctx.db.get(id);
    if (!doc || doc.anonId !== anonId) throw new Error("Not your session");
    await ctx.db.patch(id, {
      status: "completed",
      sessionBlob,
      reportBlob,
      aggregate,
      overall,
      hire,
      completedAt: Date.now(),
    });
  },
});

export const history = query({
  args: { anonId: v.string() },
  handler: async (ctx, { anonId }) => {
    const docs = await ctx.db
      .query("sessions")
      .withIndex("by_anon_status", (q) =>
        q.eq("anonId", anonId).eq("status", "completed"),
      )
      .order("desc")
      .take(20);
    return docs;
  },
});

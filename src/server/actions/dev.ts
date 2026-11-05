"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { fail, handle } from "@/lib/action";
import { dayFromString } from "@/lib/dates";
import { bookmarkSchema, devGoalSchema, devProjectSchema, devTaskSchema, DEV_TASK_STATUSES, learningSchema, snippetSchema } from "@/lib/validation/productivity";
import { opt, tagList } from "../guards";

const refresh = () => revalidatePath("/", "layout");
const optDay = (v?: string) => (v ? dayFromString(v) : null);

export async function saveProject(id: string | null, input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = devProjectSchema.parse(input);
    const data = {
      name: v.name,
      description: opt(v.description),
      status: v.status,
      startDate: optDay(v.startDate),
      deadline: optDay(v.deadline),
      techStack: (v.techStack ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 30),
      repoUrl: opt(v.repoUrl),
      liveUrl: opt(v.liveUrl),
      notes: opt(v.notes),
    };
    if (id) {
      const p = await prisma.devProject.findFirst({ where: { id, userId: user.id } });
      if (!p) fail("Project not found.");
      await prisma.devProject.update({ where: { id }, data });
    } else await prisma.devProject.create({ data: { userId: user.id, ...data } });
    refresh();
  }, id ? "Project updated" : "Project created");
}

export async function deleteProject(id: string) {
  return handle(async () => {
    const user = await requireUser();
    const r = await prisma.devProject.deleteMany({ where: { id, userId: user.id } });
    if (!r.count) fail("Project not found.");
    refresh();
  }, "Project deleted. Its tasks were kept without a project.");
}

export async function saveDevTask(id: string | null, input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = devTaskSchema.parse(input);
    const projectId = opt(v.projectId);
    if (projectId && !(await prisma.devProject.findFirst({ where: { id: projectId, userId: user.id } }))) fail("Project not found.");
    const data = { title: v.title, description: opt(v.description), type: v.type, status: v.status, priority: v.priority, projectId, dueDate: optDay(v.dueDate) };
    if (id) {
      const t = await prisma.devTask.findFirst({ where: { id, userId: user.id } });
      if (!t) fail("Task not found.");
      await prisma.devTask.update({ where: { id }, data });
    } else {
      const max = await prisma.devTask.aggregate({ where: { userId: user.id, status: v.status }, _max: { position: true } });
      await prisma.devTask.create({ data: { userId: user.id, ...data, position: (max._max.position ?? -1) + 1 } });
    }
    refresh();
  }, id ? "Task updated" : "Task added");
}

export async function deleteDevTask(id: string) {
  return handle(async () => {
    const user = await requireUser();
    const r = await prisma.devTask.deleteMany({ where: { id, userId: user.id } });
    if (!r.count) fail("Task not found.");
    refresh();
  }, "Task deleted");
}

const moveSchema = z.object({ id: z.string().min(1).max(40), status: z.enum(DEV_TASK_STATUSES), orderedIds: z.array(z.string().max(40)).max(1000) });

/** Kanban drop: sets the card's column and rewrites positions for that column. */
export async function moveDevTask(input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = moveSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const owned = await tx.devTask.findMany({ where: { userId: user.id, id: { in: [...v.orderedIds, v.id] } }, select: { id: true } });
      const ownedIds = new Set(owned.map((o) => o.id));
      if (!ownedIds.has(v.id)) fail("Task not found.");
      await tx.devTask.update({ where: { id: v.id }, data: { status: v.status } });
      let pos = 0;
      for (const tid of v.orderedIds) if (ownedIds.has(tid)) await tx.devTask.update({ where: { id: tid }, data: { position: pos++ } });
    });
    revalidatePath("/dev", "layout");
  }, "Board updated");
}

export async function saveBookmark(id: string | null, input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = bookmarkSchema.parse(input);
    const data = { title: v.title, url: v.url, description: opt(v.description), category: v.category, tags: tagList(v.tags), isFavourite: v.isFavourite };
    if (id) {
      const b = await prisma.bookmark.findFirst({ where: { id, userId: user.id } });
      if (!b) fail("Bookmark not found.");
      await prisma.bookmark.update({ where: { id }, data });
    } else await prisma.bookmark.create({ data: { userId: user.id, ...data } });
    refresh();
  }, "Bookmark saved");
}

export async function toggleFavourite(id: string) {
  return handle(async () => {
    const user = await requireUser();
    const b = await prisma.bookmark.findFirst({ where: { id, userId: user.id } });
    if (!b) fail("Bookmark not found.");
    await prisma.bookmark.update({ where: { id }, data: { isFavourite: !b.isFavourite } });
    refresh();
  }, "Updated");
}

export async function deleteBookmark(id: string) {
  return handle(async () => {
    const user = await requireUser();
    const r = await prisma.bookmark.deleteMany({ where: { id, userId: user.id } });
    if (!r.count) fail("Bookmark not found.");
    refresh();
  }, "Bookmark deleted");
}

export async function saveLearning(id: string | null, input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = learningSchema.parse(input);
    const progress = v.status === "COMPLETED" ? 100 : v.progress;
    const data = { name: v.name, kind: v.kind, status: v.status, progress, resourceUrl: opt(v.resourceUrl), targetDate: optDay(v.targetDate), notes: opt(v.notes) };
    if (id) {
      const l = await prisma.learningGoal.findFirst({ where: { id, userId: user.id } });
      if (!l) fail("Item not found.");
      await prisma.learningGoal.update({ where: { id }, data });
    } else await prisma.learningGoal.create({ data: { userId: user.id, ...data } });
    refresh();
  }, "Learning item saved");
}

export async function deleteLearning(id: string) {
  return handle(async () => {
    const user = await requireUser();
    const r = await prisma.learningGoal.deleteMany({ where: { id, userId: user.id } });
    if (!r.count) fail("Item not found.");
    refresh();
  }, "Learning item deleted");
}

export async function saveSnippet(id: string | null, input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = snippetSchema.parse(input);
    const data = { title: v.title, language: v.language.toLowerCase(), code: v.code, description: opt(v.description), tags: tagList(v.tags) };
    if (id) {
      const s = await prisma.codeSnippet.findFirst({ where: { id, userId: user.id } });
      if (!s) fail("Snippet not found.");
      await prisma.codeSnippet.update({ where: { id }, data });
    } else await prisma.codeSnippet.create({ data: { userId: user.id, ...data } });
    refresh();
  }, "Snippet saved");
}

export async function deleteSnippet(id: string) {
  return handle(async () => {
    const user = await requireUser();
    const r = await prisma.codeSnippet.deleteMany({ where: { id, userId: user.id } });
    if (!r.count) fail("Snippet not found.");
    refresh();
  }, "Snippet deleted");
}

export async function saveDevGoal(id: string | null, input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = devGoalSchema.parse(input);
    const data = { title: v.title, description: opt(v.description), type: v.type, status: v.status, progress: v.status === "COMPLETED" ? 100 : v.progress, targetDate: optDay(v.targetDate) };
    if (id) {
      const g = await prisma.devGoal.findFirst({ where: { id, userId: user.id } });
      if (!g) fail("Goal not found.");
      await prisma.devGoal.update({ where: { id }, data });
    } else await prisma.devGoal.create({ data: { userId: user.id, ...data } });
    refresh();
  }, "Goal saved");
}

export async function deleteDevGoal(id: string) {
  return handle(async () => {
    const user = await requireUser();
    const r = await prisma.devGoal.deleteMany({ where: { id, userId: user.id } });
    if (!r.count) fail("Goal not found.");
    refresh();
  }, "Goal deleted");
}

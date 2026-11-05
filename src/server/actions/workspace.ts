"use server";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { fail, handle } from "@/lib/action";
import { audit } from "@/lib/audit";
import { documentMetaSchema, noteSchema, passwordSchema, preferenceSchema, profileSchema } from "@/lib/validation/productivity";
import { getStorage } from "@/lib/storage";
import { opt, assertId } from "../guards";

const refresh = () => revalidatePath("/", "layout");

export async function saveNote(id: string | null, input: unknown) {
  return handle(async () => {
    if (id !== null) assertId(id);
    const user = await requireUser();
    const v = noteSchema.parse(input);
    const data = { title: v.title, content: v.content, category: opt(v.category), isPinned: v.isPinned };
    if (id) {
      const n = await prisma.note.findFirst({ where: { id, userId: user.id } });
      if (!n) fail("Note not found.");
      await prisma.note.update({ where: { id }, data });
      refresh();
      return id;
    }
    const n = await prisma.note.create({ data: { userId: user.id, ...data } });
    refresh();
    return n.id;
  }, "Note saved");
}

export async function togglePin(id: string) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    const n = await prisma.note.findFirst({ where: { id, userId: user.id } });
    if (!n) fail("Note not found.");
    await prisma.note.update({ where: { id }, data: { isPinned: !n.isPinned } });
    refresh();
  }); // the client words the toast, since it knows which way the toggle went
}

export async function deleteNote(id: string) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    const r = await prisma.note.deleteMany({ where: { id, userId: user.id } });
    if (!r.count) fail("Note not found.");
    refresh();
  }, "Note deleted");
}

export async function updateDocument(id: string, input: unknown) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    const v = documentMetaSchema.parse(input);
    const r = await prisma.document.updateMany({ where: { id, userId: user.id }, data: { name: v.name, category: v.category, description: opt(v.description) } });
    if (!r.count) fail("Document not found.");
    refresh();
  }, "Document updated");
}

export async function deleteDocument(id: string) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    const d = await prisma.document.findFirst({ where: { id, userId: user.id } });
    if (!d) fail("Document not found.");
    await getStorage().remove(d.storageKey);
    await prisma.$transaction(async (tx) => {
      await tx.document.delete({ where: { id } });
      await audit(tx, user.id, "delete", "Document", id, { name: d.name });
    });
    refresh();
  }, "Document deleted");
}

export async function updateProfile(input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = profileSchema.parse(input);
    await prisma.user.update({ where: { id: user.id }, data: { name: v.name } });
    refresh();
  }, "Profile updated");
}

export async function changePassword(input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    if (user.isDemo) fail("The shared demo account's password can't be changed. Register your own account to set one.");
    const v = passwordSchema.parse(input);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await bcrypt.compare(v.currentPassword, u.passwordHash))) fail("Your current password is incorrect.");
    await prisma.$transaction(async (tx) => {
      // Bumping the session version signs out every device, including this one.
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(v.newPassword, 12), sessionVersion: { increment: 1 } } });
      await audit(tx, user.id, "update", "User", user.id, { field: "password" });
    });
  }, "Password changed. Sign in again with your new password.");
}

export async function updatePreferences(input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = preferenceSchema.parse(input);
    try {
      new Intl.DateTimeFormat("en", { timeZone: v.timezone });
      new Intl.NumberFormat(v.locale, { style: "currency", currency: v.currency });
    } catch {
      fail("That timezone, locale or currency isn't recognised.");
    }
    await prisma.userPreference.upsert({ where: { userId: user.id }, update: v, create: { userId: user.id, ...v } });
    refresh();
  }, "Preferences saved");
}

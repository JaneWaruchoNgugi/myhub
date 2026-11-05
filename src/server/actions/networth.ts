"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { fail, handle } from "@/lib/action";
import { audit } from "@/lib/audit";
import { dayFromString, todayIn } from "@/lib/dates";
import { assetSchema, liabilitySchema } from "@/lib/validation/finance";
import { snapshotNetWorth } from "@/lib/services/networth";
import { opt, assertId } from "../guards";

const refresh = () => revalidatePath("/", "layout");

export async function saveAsset(id: string | null, input: unknown) {
  return handle(async () => {
    if (id !== null) assertId(id);
    const user = await requireUser();
    const v = assetSchema.parse(input);
    const data = { name: v.name, type: v.type, value: v.value, valuedAt: dayFromString(v.valuedAt), notes: opt(v.notes) };
    await prisma.$transaction(async (tx) => {
      if (id) {
        const a = await tx.asset.findFirst({ where: { id, userId: user.id } });
        if (!a) fail("Asset not found.");
        await tx.asset.update({ where: { id }, data });
        await audit(tx, user.id, "update", "Asset", id, { from: a.value.toString(), to: v.value });
      } else {
        const a = await tx.asset.create({ data: { userId: user.id, ...data } });
        await audit(tx, user.id, "create", "Asset", a.id, { value: v.value });
      }
    });
    await snapshotNetWorth(user.id, todayIn(user.prefs.timezone));
    refresh();
  }, "Asset saved");
}

export async function deleteAsset(id: string) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    const r = await prisma.asset.deleteMany({ where: { id, userId: user.id } });
    if (!r.count) fail("Asset not found.");
    await snapshotNetWorth(user.id, todayIn(user.prefs.timezone));
    refresh();
  }, "Asset deleted");
}

export async function saveLiability(id: string | null, input: unknown) {
  return handle(async () => {
    if (id !== null) assertId(id);
    const user = await requireUser();
    const v = liabilitySchema.parse(input);
    const data = { name: v.name, type: v.type, balance: v.balance, asOf: dayFromString(v.asOf), notes: opt(v.notes) };
    await prisma.$transaction(async (tx) => {
      if (id) {
        const l = await tx.liability.findFirst({ where: { id, userId: user.id } });
        if (!l) fail("Liability not found.");
        await tx.liability.update({ where: { id }, data });
        await audit(tx, user.id, "update", "Liability", id, { from: l.balance.toString(), to: v.balance });
      } else {
        const l = await tx.liability.create({ data: { userId: user.id, ...data } });
        await audit(tx, user.id, "create", "Liability", l.id, { balance: v.balance });
      }
    });
    await snapshotNetWorth(user.id, todayIn(user.prefs.timezone));
    refresh();
  }, "Liability saved");
}

export async function deleteLiability(id: string) {
  return handle(async () => {
    assertId(id);
    const user = await requireUser();
    const r = await prisma.liability.deleteMany({ where: { id, userId: user.id } });
    if (!r.count) fail("Liability not found.");
    await snapshotNetWorth(user.id, todayIn(user.prefs.timezone));
    refresh();
  }, "Liability deleted");
}

export async function takeSnapshot() {
  return handle(async () => {
    const user = await requireUser();
    await snapshotNetWorth(user.id, todayIn(user.prefs.timezone));
    refresh();
  }, "This month's snapshot was updated");
}

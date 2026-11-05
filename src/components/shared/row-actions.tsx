"use client";
import * as React from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "./confirm";

type Result = { ok: true; message?: string } | { ok: false; error: string };

export type RowAction = { label: string; icon?: React.ReactNode; onSelect: () => void; disabled?: boolean };

/** Kebab menu with Edit, extra actions and a confirmed Delete. */
export function RowActions({
  onEdit,
  onDelete,
  deleteTitle,
  deleteDescription,
  extra,
  label = "Actions",
}: {
  onEdit?: () => void;
  onDelete?: () => Promise<Result>;
  deleteTitle?: string;
  deleteDescription?: React.ReactNode;
  extra?: RowAction[];
  label?: string;
}) {
  const [confirm, setConfirm] = React.useState(false);
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={label}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {extra?.map((a) => (
            <DropdownMenuItem key={a.label} onSelect={a.onSelect} disabled={a.disabled}>
              {a.icon}
              {a.label}
            </DropdownMenuItem>
          ))}
          {onEdit ? (
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> Edit
            </DropdownMenuItem>
          ) : null}
          {onDelete ? (
            <>
              {onEdit || extra?.length ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {onDelete ? <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={deleteTitle} description={deleteDescription} action={onDelete} /> : null}
    </>
  );
}

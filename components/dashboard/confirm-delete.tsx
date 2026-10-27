"use client";

import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** Delete with a confirmation that names the object; nothing is removed before "Hapus". */
export function ConfirmDelete({
  objectName,
  description,
  onConfirm,
  disabled,
  disabledReason,
}: {
  objectName: string;
  description: string;
  onConfirm: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            title={disabled ? disabledReason : undefined}
            aria-label={`Hapus ${objectName}`}
          />
        }
      >
        <Trash2 aria-hidden="true" />
        Hapus
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus {objectName}?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogCancel variant="destructive" onClick={onConfirm}>
            Hapus permanen
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

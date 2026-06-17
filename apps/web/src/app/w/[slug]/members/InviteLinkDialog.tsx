"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface InviteLinkDialogProps {
  inviteUrl: string | undefined;
}

export function InviteLinkDialog({ inviteUrl }: InviteLinkDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(!!inviteUrl);
  const [copied, setCopied] = useState(false);

  if (!inviteUrl) return null;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      router.replace(window.location.pathname);
      setOpen(false);
    }
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite link generated</DialogTitle>
          <DialogDescription>
            Share the link below. It expires after one use.
          </DialogDescription>
        </DialogHeader>
        <code className="block rounded bg-muted px-2 py-1.5 font-mono text-xs break-all select-all mt-2">
          {inviteUrl}
        </code>
        <DialogFooter showCloseButton={false}>
          <Button size="sm" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

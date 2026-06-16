"use client";

import { Modal } from "./modal";
import { Button } from "./button";

export interface LogoutConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function LogoutConfirmModal({ open, onOpenChange, onConfirm }: LogoutConfirmModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Confirm Logout"
      description="Are you sure you want to sign out of your account?"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Logout</Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        You will need to sign in again to access your portal.
      </p>
    </Modal>
  );
}

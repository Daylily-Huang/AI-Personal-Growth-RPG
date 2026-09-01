"use client";

import React, { useId } from "react";
import { BaseModal } from "./BaseModal";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";
import { DangerButton } from "./DangerButton";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: React.ReactNode;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  className?: string;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  destructive = false,
  loading = false,
  className = "",
}: ConfirmDialogProps) {
  const descId = useId();
  const ConfirmButtonComponent = destructive ? DangerButton : PrimaryButton;

  const footer = (
    <>
      <SecondaryButton
        onClick={onClose}
        disabled={loading}
        data-testid="confirm-dialog-cancel"
      >
        {cancelLabel}
      </SecondaryButton>
      <ConfirmButtonComponent
        onClick={onConfirm}
        loading={loading}
        data-testid="confirm-dialog-confirm"
      >
        {confirmLabel}
      </ConfirmButtonComponent>
    </>
  );

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={title}
      descriptionId={`confirm-desc-${descId}`}
      footer={footer}
      className={className}
    >
      <div
        id={`confirm-desc-${descId}`}
        data-testid="confirm-dialog-description"
        className="text-sm text-[var(--text-secondary)] leading-relaxed"
      >
        {description}
      </div>
    </BaseModal>
  );
}

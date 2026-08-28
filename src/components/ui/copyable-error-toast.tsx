"use client";

import { toast } from "sonner";
import { ActionFailure } from "@/lib/action-error-handler";

/**
 * Formats error payload for clipboard copy.
 */
export function formatErrorForClipboard(
  message: string,
  options?: {
    errorRef?: string;
    timestamp?: string;
    operation?: string;
    technicalDetails?: string;
  }
): string {
  const lines: string[] = ["OnPro error", "", message];

  if (options?.errorRef) {
    lines.push(`Reference: ${options.errorRef}`);
  }

  if (options?.timestamp) {
    // Format timestamp nicely or fall back to raw ISO string
    try {
      const date = new Date(options.timestamp);
      lines.push(`Time: ${date.toUTCString()}`);
    } catch {
      lines.push(`Time: ${options.timestamp}`);
    }
  }

  if (options?.operation) {
    lines.push(`Operation: ${options.operation}`);
  }

  if (options?.technicalDetails) {
    lines.push("", "Technical Details:", options.technicalDetails);
  }

  return lines.join("\n");
}

/**
 * Copies formatted error text to clipboard and notifies user.
 */
export function copyActionErrorToClipboard(
  message: string,
  options?: {
    errorRef?: string;
    timestamp?: string;
    operation?: string;
    technicalDetails?: string;
  }
) {
  const text = formatErrorForClipboard(message, options);
  navigator.clipboard.writeText(text).then(
    () => {
      toast.success("Error details copied to clipboard", { duration: 2500 });
    },
    () => {
      toast.error("Failed to copy to clipboard", { duration: 2500 });
    }
  );
}

/**
 * Renders a Sonner toast for server action failures.
 * Supports both legacy string error messages and ActionFailure envelopes.
 */
export function showActionErrorToast(
  failure: ActionFailure | { success?: boolean; message?: string; errorRef?: string; timestamp?: string; operation?: string; technicalDetails?: string } | string | null | undefined,
  fallbackMessage: string = "We couldn't save this field."
) {
  if (!failure) {
    toast.error(fallbackMessage);
    return;
  }
  if (typeof failure === "string") {
    toast.error(failure || fallbackMessage);
    return;
  }

  const message = failure.message || fallbackMessage;
  const isUnexpected = "kind" in failure ? failure.kind === "unexpected" : Boolean((failure as any).errorRef);
  const errorRef = "errorRef" in failure ? failure.errorRef : undefined;
  const timestamp = "timestamp" in failure ? failure.timestamp : undefined;
  const operation = "operation" in failure ? failure.operation : undefined;
  const technicalDetails = "technicalDetails" in failure ? failure.technicalDetails : undefined;

  if (!isUnexpected || !errorRef) {
    // Domain error or simple validation message: show standard clean toast
    toast.error(message);
    return;
  }

  // Unexpected technical failure with correlation errorRef
  toast.error(
    <div className="flex flex-col gap-1 text-sm select-text">
      <div className="font-semibold text-foreground">{message}</div>
      <div className="text-xs text-muted-foreground font-mono">
        Error reference: <span className="select-all font-semibold">{errorRef}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            copyActionErrorToClipboard(message, {
              errorRef,
              timestamp,
              operation,
              technicalDetails,
            });
          }}
          className="text-xs font-medium text-primary underline underline-offset-2 hover:opacity-80 transition-opacity cursor-pointer select-none"
        >
          Copy error
        </button>
      </div>
    </div>,
    {
      duration: 8000,
    }
  );
}

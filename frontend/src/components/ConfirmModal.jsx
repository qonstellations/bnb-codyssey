import { modals } from "@mantine/modals";

/** Opens a confirmation modal (delete by default). Used by dashboard / builder / settings. */
export function openConfirmModal({ title = "Are you sure?", message, confirmLabel = "Delete", confirmColor = "red", onConfirm }) {
  modals.openConfirmModal({
    title,
    children: message,
    labels: { confirm: confirmLabel, cancel: "Cancel" },
    confirmProps: { color: confirmColor },
    onConfirm,
  });
}

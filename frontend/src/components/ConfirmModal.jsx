import { modals } from "@mantine/modals";

/** Opens a delete-confirmation modal. Used by dashboard / builder / settings. */
export function openConfirmModal({ title = "Are you sure?", message, confirmLabel = "Delete", onConfirm }) {
  modals.openConfirmModal({
    title,
    children: message,
    labels: { confirm: confirmLabel, cancel: "Cancel" },
    confirmProps: { color: "red" },
    onConfirm,
  });
}

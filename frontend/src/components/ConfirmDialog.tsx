// components/ConfirmDialog.tsx
import { FC } from "react";
import { Dialog } from "@headlessui/react";
import { X } from "lucide-react";

type ConfirmDialogProps = {
  isOpen: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const ConfirmDialog: FC<ConfirmDialogProps> = ({
  isOpen,
  title = "Confirm Deletion",
  description = "Are you sure you want to delete this chat?",
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog open={isOpen} onClose={onCancel} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-sm rounded-lg bg-white dark:bg-[#1c1c1c] p-6 shadow-lg border dark:border-gray-700">
          <div className="flex justify-between items-center mb-3">
            <Dialog.Title className="text-lg font-semibold text-gray-800 dark:text-white">
              {title}
            </Dialog.Title>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={18} />
            </button>
          </div>
          <Dialog.Description className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            {description}
          </Dialog.Description>

          <div className="flex justify-end space-x-2">
            <button
              onClick={onCancel}
              className="px-4 py-1.5 text-sm rounded-md border dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700"
            >
              {confirmText}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default ConfirmDialog;

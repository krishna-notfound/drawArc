'use client';

import { LayoutTemplate } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { ConfirmDialog } from '@/components/editor/app-dialog';
import { TemplatePreview } from '@/components/editor/template-preview';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogHeader, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useImportTemplate } from '@/hooks/useImportTemplate';
import { e2eHooksEnabled } from '@/lib/env.public';
import { CANVAS_TEMPLATES, type CanvasTemplate, findTemplate } from '@/lib/canvas/templates';

declare global {
  interface Window {
    /** E2E-only (F14 test plan): imports a template by id through the same hook as the dialog. */
    __importTemplate?: (id: string) => void;
  }
}

export const IMPORT_COPY = {
  button: 'Import',
  buttonLabel: 'Import a starter template',
  title: 'Starter templates',
  description: 'Pick a diagram to start from. Importing replaces the current canvas.',
  confirmTitle: 'Replace the current diagram?',
  confirmDescription: 'This replaces the current diagram for everyone in this project. You can undo it.',
  confirm: 'Replace diagram',
} as const;

// The Import slot sits in the navbar, outside the Liveblocks room and React Flow (which live in the canvas
// island), so the button cannot use the import hook there. The slot renders an empty target and
// `ImportTemplateControl`, mounted inside the canvas, portals the button and dialog into it — the F11 presence
// pattern. A one-value store hands the target element across the two trees.
let target: HTMLElement | null = null;
const listeners = new Set<() => void>();

function setTarget(element: HTMLElement | null) {
  target = element;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getTarget = () => target;
const getServerTarget = () => null;

/** F04's `importSlot` (D-028). The page passes it to owners and editors only. */
export function ImportTemplateSlot() {
  return <div ref={setTarget} data-slot="import-template" className="flex items-center empty:hidden" />;
}

/**
 * The navbar Import button and the Starter templates dialog (F14 FR-004–FR-007, FR-011). Must render inside
 * React Flow in the project room; renders nothing for members who cannot write (viewers, archived projects).
 */
export function ImportTemplateControl() {
  const element = useSyncExternalStore(subscribe, getTarget, getServerTarget);
  const { importTemplate, canImport, isEmptyCanvas } = useImportTemplate();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<CanvasTemplate | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!e2eHooksEnabled) return;
    window.__importTemplate = (id) => {
      const template = findTemplate(id);
      if (template) importTemplate(template);
    };
    return () => {
      delete window.__importTemplate;
    };
  }, [importTemplate]);

  // A role downgrade while the dialog is open closes it (EC-008); the button is gone with it.
  if (!canImport && (open || pending)) {
    setOpen(false);
    setPending(null);
  }
  if (!canImport || !element) return null;

  const run = (template: CanvasTemplate) => {
    importTemplate(template);
    setPending(null);
    setOpen(false);
  };
  const choose = (template: CanvasTemplate) => {
    if (isEmptyCanvas()) run(template);
    else setPending(template);
  };

  return createPortal(
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="sm"
        aria-label={IMPORT_COPY.buttonLabel}
        aria-haspopup="dialog"
        className="focus-visible:ring-2 focus-visible:ring-brand [&_svg:not([class*='size-'])]:size-5"
        onClick={() => setOpen(true)}
      >
        <LayoutTemplate aria-hidden="true" className="h-5 w-5" />
        {IMPORT_COPY.button}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPortal>
          <DialogOverlay className="bg-base/60 backdrop-blur-sm motion-reduce:animate-none" />
          <DialogPrimitive.Content
            data-slot="dialog-content"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              buttonRef.current?.focus();
            }}
            className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-3xl border border-surface-border bg-elevated p-6 text-copy-primary shadow-xl outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-3xl motion-reduce:animate-none"
          >
            <DialogHeader>
              <DialogTitle>{IMPORT_COPY.title}</DialogTitle>
              <DialogDescription>{IMPORT_COPY.description}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="min-h-0 flex-1 overflow-hidden">
              <ul data-slot="template-grid" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {CANVAS_TEMPLATES.map((template) => (
                  <li
                    key={template.id}
                    data-template-id={template.id}
                    className="flex flex-col gap-3 rounded-2xl border border-surface-border bg-elevated p-3 transition-colors hover:border-surface-subtle"
                  >
                    <div className="flex aspect-[12/7] items-center justify-center overflow-hidden rounded-xl bg-base">
                      <TemplatePreview template={template} className="h-full w-full" />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <h3 className="font-medium text-copy-primary">{template.name}</h3>
                      <p className="text-sm text-copy-muted">{template.description}</p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      aria-label={`Import ${template.name}`}
                      className="self-end focus-visible:ring-2 focus-visible:ring-brand"
                      onClick={() => choose(template)}
                    >
                      Import
                    </Button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(next) => {
          if (!next) setPending(null);
        }}
        title={IMPORT_COPY.confirmTitle}
        description={IMPORT_COPY.confirmDescription}
        confirmLabel={IMPORT_COPY.confirm}
        destructive
        onConfirm={() => {
          if (pending) run(pending);
        }}
      />
    </>,
    element,
  );
}

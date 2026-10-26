import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { AlertTriangle, Info } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { btnGhost } from './card';

// Confirmação e aviso no tema do app, no lugar do window.confirm/alert nativos do sistema
interface DialogRequest {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string; // ausente: é só um aviso, com um botão "OK"
  tone?: 'danger' | 'neutral';
}

export function useAppDialog(): {
  dialog: React.ReactNode;
  confirm: (req: DialogRequest) => Promise<boolean>;
  notify: (req: Omit<DialogRequest, 'cancelLabel'>) => Promise<void>;
} {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const open = (req: DialogRequest) =>
    new Promise<boolean>((resolve) => {
      resolver.current?.(false);
      resolver.current = resolve;
      setRequest(req);
    });
  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setRequest(null);
  };

  const confirm = (req: DialogRequest) => open({ cancelLabel: 'Cancelar', ...req });
  const notify = async (req: Omit<DialogRequest, 'cancelLabel'>) => {
    await open({ confirmLabel: 'OK', ...req, cancelLabel: undefined });
  };

  // Esc cancela enquanto houver um diálogo aberto, esteja o foco onde estiver
  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const danger = request?.tone === 'danger';
  const dialog = (
    <AnimatePresence>
      {request && (
        <ModalShell
          key="app-dialog"
          ariaLabel={request.title}
          panelClassName="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl p-6 text-slate-800 dark:text-slate-100"
        >
          <div>
            <div className="flex items-start gap-3">
              <span
                className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${
                  danger
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                    : 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
                }`}
              >
                {danger ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">{request.title}</h2>
                <div className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line">{request.message}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              {request.cancelLabel && (
                <button
                  type="button"
                  autoFocus
                  onClick={() => close(false)}
                  className={btnGhost}
                >
                  {request.cancelLabel}
                </button>
              )}
              <button
                type="button"
                autoFocus={!request.cancelLabel}
                onClick={() => close(true)}
                className={`px-4 py-2 rounded-full text-sm font-semibold text-white cursor-pointer ${
                  danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-anil-600 hover:bg-anil-500'
                }`}
              >
                {request.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </AnimatePresence>
  );

  return { dialog, confirm, notify };
}

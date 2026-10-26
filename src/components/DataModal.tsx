import React, { useEffect, useRef, useState } from 'react';
import { Download, FolderOpen, HardDrive, RotateCcw, Upload, X } from 'lucide-react';
import { ModalShell } from './ui/ModalShell';
import { btnGhost, tile } from './ui/card';
import { exportBackup, normalizeData, type AppData } from '../lib/store';
import { playSound } from '../hooks/useSound';

type ConfirmFn = (req: { title: string; message: React.ReactNode; confirmLabel?: string; tone?: 'danger' | 'neutral' }) => Promise<boolean>;
type NotifyFn = (req: { title: string; message: React.ReactNode }) => Promise<void>;

export const DataModal: React.FC<{
  data: AppData;
  update: (fn: (prev: AppData) => AppData) => void;
  confirm: ConfirmFn;
  notify: NotifyFn;
  onClose: () => void;
  onReset: () => void;
}> = ({ data, update, confirm, notify, onClose, onReset }) => {
  const [info, setInfo] = useState<{ path: string; mode: 'portable' | 'system' } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    window.electronAPI?.dataInfo?.().then(setInfo);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const importFile = async (file: File) => {
    try {
      const parsed = normalizeData(JSON.parse(await file.text()));
      if (!parsed.contract) throw new Error('O arquivo não tem um financiamento cadastrado.');
      const ok = await confirm({
        title: 'Restaurar backup',
        message: `Trocar os dados atuais pelos do arquivo (${parsed.contract.nickname}, ${parsed.checkins.length} check-ins)?`,
        confirmLabel: 'Restaurar',
      });
      if (!ok) return;
      update(() => parsed);
      playSound('success');
      onClose();
    } catch (e) {
      void notify({ title: 'Não deu para restaurar', message: e instanceof Error ? e.message : 'Arquivo inválido.' });
    }
  };

  const reset = async () => {
    const ok = await confirm({
      title: 'Apagar tudo e recomeçar',
      message: 'O contrato, os check-ins e as amortizações registradas serão apagados deste computador. Faça um backup antes, se quiser guardar.',
      confirmLabel: 'Apagar tudo',
      tone: 'danger',
    });
    if (!ok) return;
    update((prev) => ({ ...prev, contract: null, extras: [], checkpoints: [], checkins: [], celebrated: [], isDemo: false }));
    playSound('delete');
    onReset();
  };

  return (
    <ModalShell
      ariaLabel="Dados e backup"
      panelClassName="bg-white dark:bg-slate-900 rounded-[28px] w-full max-w-lg shadow-2xl ring-1 ring-slate-900/[0.06] dark:ring-white/[0.08] p-6 sm:p-7"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Dados e backup</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Tudo fica só neste computador. Nada é enviado para a internet.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className={`${tile} p-4 mt-5 flex gap-3`}>
        <HardDrive className="w-5 h-5 text-anil-600 dark:text-anil-300 shrink-0 mt-0.5" />
        <div className="min-w-0 text-sm">
          <div className="font-semibold text-slate-900 dark:text-white">
            {info ? (info.mode === 'portable' ? 'Arquivo ao lado do app' : 'Pasta de dados do sistema') : 'Guardado no navegador'}
          </div>
          <div className="text-slate-500 dark:text-slate-400 break-all font-num text-xs mt-0.5">{info?.path ?? 'localStorage'}</div>
          {info && (
            <button type="button" onClick={() => window.electronAPI?.openDataFolder()} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-anil-700 dark:text-anil-300 cursor-pointer">
              <FolderOpen className="w-3.5 h-3.5" /> Abrir a pasta
            </button>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2 mt-4">
        <button type="button" onClick={() => exportBackup(data)} className={btnGhost} disabled={!data.contract}>
          <Download className="w-4 h-4" /> Salvar backup
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className={btnGhost}>
          <Upload className="w-4 h-4" /> Restaurar backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = '';
          }}
        />
      </div>

      <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
        <button type="button" onClick={reset} className="inline-flex items-center gap-2 text-sm font-semibold text-rose-600 hover:text-rose-500 dark:text-rose-400 cursor-pointer">
          <RotateCcw className="w-4 h-4" /> Apagar tudo e recomeçar
        </button>
      </div>
    </ModalShell>
  );
};

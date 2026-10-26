import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Database, Download, FolderOpen, RotateCcw, Upload, X } from 'lucide-react';
import { ModalShell } from './ui/ModalShell';
import { btnGhost, tile } from './ui/card';
import { exportJson, normalizeData, type AppData, type DataInfo } from '../lib/store';
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
  const [info, setInfo] = useState<DataInfo | null>(null);
  const api = window.electronAPI;
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    window.electronAPI?.dataInfo?.().then(setInfo);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Confere o conteúdo importado e, com o "sim" da pessoa, troca os dados atuais
  const applyImport = async (raw: unknown) => {
    try {
      const parsed = normalizeData(raw);
      if (!parsed.contract) throw new Error('O arquivo não tem um financiamento cadastrado.');
      const ok = await confirm({
        title: 'Importar dados',
        message: `Trocar os dados atuais pelos do arquivo (${parsed.contract.nickname}, ${parsed.checkins.length} check-ins, ${parsed.extras.length} amortizações)?`,
        confirmLabel: 'Importar',
      });
      if (!ok) return;
      // As taxas do mercado continuam as que o app já tem
      update((prev) => ({ ...parsed, rates: prev.rates }));
      playSound('success');
      onClose();
    } catch (e) {
      void notify({ title: 'Não deu para importar', message: e instanceof Error ? e.message : 'Arquivo inválido.' });
    }
  };

  const importFile = async (file: File) => {
    try {
      await applyImport(JSON.parse(await file.text()));
    } catch {
      void notify({ title: 'Não deu para importar', message: 'O arquivo não é um JSON válido.' });
    }
  };

  const exportData = async () => {
    if (!api?.exportData) {
      exportJson(data);
      return;
    }
    const r = await api.exportData();
    if (r.ok) {
      playSound('success');
      void notify({ title: 'Dados exportados', message: r.path ?? '' });
    }
  };

  const importData = async () => {
    if (!api?.importData) {
      fileRef.current?.click();
      return;
    }
    const r = await api.importData();
    if (r.ok) await applyImport(r.doc);
    else if (r.error) void notify({ title: 'Não deu para importar', message: r.error });
  };

  const reset = async () => {
    const ok = await confirm({
      title: 'Apagar tudo e recomeçar',
      message: 'O contrato, os check-ins e as amortizações registradas serão apagados deste computador. Exporte os dados antes, se quiser guardar.',
      confirmLabel: 'Apagar tudo',
      tone: 'danger',
    });
    if (!ok) return;
    // Dados novos (nova data de criação): os tutoriais voltam a aparecer
    update((prev) => ({ ...prev, contract: null, extras: [], checkpoints: [], checkins: [], celebrated: [], isDemo: false, createdAt: new Date().toISOString() }));
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
        <Database className="w-5 h-5 text-anil-600 dark:text-anil-300 shrink-0 mt-0.5" />
        <div className="min-w-0 text-sm">
          <div className="font-semibold text-slate-900 dark:text-white">
            {info
              ? `${info.engine === 'sqlite' ? 'Banco SQLite' : 'Arquivo de dados'} ${info.mode === 'portable' ? 'ao lado do app' : 'na pasta de dados do sistema'}`
              : 'Guardado no navegador'}
          </div>
          {info?.engine === 'json' && (
            <div className="mt-1.5 flex items-start gap-1.5 text-xs text-sol-800 dark:text-sol-200">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              O banco SQLite não pôde ser aberto neste computador. Os dados estão sendo guardados num arquivo de reserva.
            </div>
          )}
          <div className="text-slate-500 dark:text-slate-400 break-all font-num text-xs mt-0.5">{info?.path ?? 'localStorage'}</div>
          {info && (
            <button type="button" onClick={() => window.electronAPI?.openDataFolder()} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-anil-700 dark:text-anil-300 cursor-pointer">
              <FolderOpen className="w-3.5 h-3.5" /> Abrir a pasta
            </button>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2 mt-4">
        <button type="button" onClick={exportData} className={btnGhost} disabled={!data.contract}>
          <Download className="w-4 h-4" /> Exportar (JSON)
        </button>
        <button type="button" onClick={importData} className={btnGhost}>
          <Upload className="w-4 h-4" /> Importar (JSON)
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

import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  CircleCheck,
  ClipboardCheck,
  ExternalLink,
  FileText,
  FileUp,
  Landmark,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { ModalShell } from './ui/ModalShell';
import { StepTrack } from './ui/StepTrack';
import { Field, HelpTip } from './ui/HelpTip';
import { MoneyField, NumberField } from './ui/Inputs';
import { TermPresets } from './ui/TermPresets';
import { btnGhost, btnPrimary, inputBase, tile } from './ui/card';
import { celebrate } from './ui/Confetti';
import { HELP } from './help';
import type { AppData } from '../lib/store';
import { parseBankDocument } from '../lib/bankDocument';
import { applyImport, checkImport, planImport, type ImportOptions, type ImportPlan } from '../lib/importDocument';
import { formatBRL } from '../lib/format';
import { EASE_OUT } from '../lib/motion';
import { playSound } from '../hooks/useSound';

const brDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const brMonth = (ym: string) => `${ym.slice(5, 7)}/${ym.slice(0, 4)}`;

// Linha de "rótulo ... valor" dos quadros de conferência
const Row: React.FC<{ label: React.ReactNode; value: React.ReactNode; note?: React.ReactNode }> = ({ label, value, note }) => (
  <div className="py-2 first:pt-0 last:pb-0">
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      <span className="font-num text-sm font-semibold text-slate-900 dark:text-white text-right">{value}</span>
    </div>
    {note && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-snug">{note}</div>}
  </div>
);

const Section: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode; tone?: 'ok' | 'warn' }> = ({
  icon: Icon,
  title,
  children,
  tone,
}) => (
  <section
    className={`p-4 rounded-2xl ${
      tone === 'ok'
        ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-600/15 dark:bg-emerald-500/10 dark:ring-emerald-400/20'
        : tone === 'warn'
          ? 'bg-sol-50 ring-1 ring-inset ring-sol-600/20 dark:bg-sol-400/10 dark:ring-sol-300/20'
          : tile
    }`}
  >
    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white mb-2.5">
      <Icon className={`w-4 h-4 ${tone === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'warn' ? 'text-sol-600 dark:text-sol-300' : 'text-anil-500'}`} />
      {title}
    </h3>
    <div className="divide-y divide-slate-900/[0.06] dark:divide-white/[0.06]">{children}</div>
  </section>
);

// Importa o Documento Descritivo do Crédito: escolher o PDF, conferir o que muda e importar
export const ImportDocumentModal: React.FC<{
  data: AppData;
  update: (fn: (prev: AppData) => AppData) => void;
  onClose: () => void;
}> = ({ data, update, onClose }) => {
  const reduce = Boolean(useReducedMotion());
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [opts, setOpts] = useState<ImportOptions>({ removeConflicting: true });
  const [done, setDone] = useState(false);

  const read = async (file: File) => {
    setError(null);
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      setError('Escolha o arquivo em PDF que o banco gerou.');
      playSound('warning');
      return;
    }
    setReading(true);
    try {
      const { pdfLines } = await import('../lib/pdfText');
      const result = parseBankDocument(await pdfLines(await file.arrayBuffer()));
      if (!result.ok) {
        setError(
          result.reason === 'sem-parcelas'
            ? 'O documento foi reconhecido, mas não tem nenhuma parcela paga ainda. Importe de novo depois da primeira parcela.'
            : 'Não reconheci este arquivo como um Documento Descritivo do Crédito. Por enquanto o app lê o modelo da Caixa.'
        );
        playSound('warning');
        return;
      }
      const next = planImport(data, result.doc);
      setPlan(next);
      setOpts({ removeConflicting: true, termMonths: next.contract.termMonths });
      setStep(1);
      playSound('success');
    } catch {
      setError('Não consegui abrir este PDF. Baixe o documento de novo no banco e tente outra vez.');
      playSound('warning');
    } finally {
      setReading(false);
    }
  };

  const after = useMemo(() => (plan ? applyImport(data, plan, opts) : null), [data, plan, opts]);
  const check = useMemo(() => (after && plan ? checkImport(after, plan) : null), [after, plan]);
  const balanceOk = check ? check.appBalance !== null && Math.abs(check.appBalance - check.docBalance) < 0.01 : false;
  const remainingOk = check ? check.remainingDoc === undefined || check.remainingDoc === check.remainingApp : false;

  const confirmImport = () => {
    if (!plan || !after) return;
    update((prev) => applyImport(prev, plan, opts));
    playSound('celebrate');
    if (plan.isNew) {
      // Primeiro cadastro: a casa aparece direto, com as boas-vindas de sempre
      celebrate();
      onClose();
      return;
    }
    setDone(true);
  };

  const doc = plan?.doc;
  const extrasTotal = doc ? doc.extras.reduce((a, e) => a + e.amount, 0) : 0;
  const replacedSomething = plan && (plan.replacedCheckins > 0 || plan.replacedExtras.length > 0 || plan.removedCheckpoints.length > 0);

  return (
    <ModalShell
      ariaLabel="Importar documento do banco"
      panelClassName="bg-white dark:bg-slate-900 rounded-[28px] w-full max-w-2xl shadow-2xl ring-1 ring-slate-900/[0.06] dark:ring-white/[0.08] overflow-hidden"
    >
      <div className="relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 z-10 w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {done && doc ? (
          <div className="p-8 text-center">
            <motion.div
              className="mx-auto w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_16px_40px_-12px_rgba(16,185,129,0.8)]"
              initial={reduce ? false : { scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 16 }}
            >
              <ClipboardCheck className="w-9 h-9" />
            </motion.div>
            <h2 className="mt-5 text-2xl font-bold text-slate-900 dark:text-white">Pronto, o app está igual ao banco</h2>
            <p className="mt-1 text-slate-600 dark:text-slate-300 text-balance">
              {doc.paid.length} parcelas e {doc.extras.length} {doc.extras.length === 1 ? 'amortização' : 'amortizações'} do documento de{' '}
              {brDate(doc.referenceDate)}. Quando o banco gerar um documento novo, é só importar de novo: nada se repete.
            </p>
            <button type="button" onClick={onClose} className={`${btnPrimary} mt-7`}>
              Ver minha casa
            </button>
          </div>
        ) : (
          <div className="p-6 sm:p-7">
            <div className="text-sm font-semibold text-anil-700 dark:text-anil-300">Importar documento do banco</div>
            <StepTrack
              ariaLabel="Etapas da importação"
              className="mt-3 mb-6 pr-10"
              steps={['Documento', 'Conferir']}
              icons={[FileUp, ClipboardCheck]}
              size="sm"
              current={step}
              done={(k) => k < step}
              reachable={(k) => k === 0 || Boolean(plan)}
              onSelect={(k) => setStep(k)}
            />

            <div className="relative min-h-[330px] max-h-[calc(100vh-15rem)] overflow-y-auto overflow-x-clip -mx-1 px-1">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={step}
                  initial={reduce ? false : { x: step === 1 ? 40 : -40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { x: step === 1 ? -40 : 40, opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                  className="space-y-5"
                >
                  {step === 0 && (
                    <>
                      <div>
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white text-balance">
                          Traga o extrato oficial do banco
                          <HelpTip help={HELP.bankDocument} />
                        </h2>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                          O <b className="text-slate-900 dark:text-white">Documento Descritivo do Crédito</b> traz cada parcela paga, as
                          amortizações extras e o saldo. Com ele o app preenche o cadastro e fica igual ao banco desde a primeira parcela.
                        </p>
                      </div>

                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragging(false);
                          const f = e.dataTransfer.files?.[0];
                          if (f) void read(f);
                        }}
                        className={`rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
                          dragging
                            ? 'border-anil-500 bg-anil-50 dark:bg-anil-500/10'
                            : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/40'
                        }`}
                      >
                        <div className="mx-auto w-12 h-12 rounded-2xl bg-anil-100 text-anil-700 dark:bg-anil-500/15 dark:text-anil-300 flex items-center justify-center">
                          {reading ? <Loader2 className="w-6 h-6 animate-spin" /> : <FileText className="w-6 h-6" />}
                        </div>
                        <div className="mt-3 font-semibold text-slate-900 dark:text-white">
                          {reading ? 'Lendo o documento…' : 'Arraste o PDF para cá'}
                        </div>
                        {!reading && (
                          <>
                            <div className="text-sm text-slate-500 dark:text-slate-400">ou</div>
                            <button type="button" onClick={() => fileRef.current?.click()} className={`${btnPrimary} mt-2`}>
                              <FileUp className="w-4 h-4" /> Escolher o arquivo
                            </button>
                          </>
                        )}
                        <input
                          ref={fileRef}
                          type="file"
                          accept="application/pdf,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (f) void read(f);
                          }}
                        />
                      </div>

                      {error && (
                        <div role="alert" className="flex gap-2.5 p-3.5 rounded-2xl bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200 text-sm">
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}

                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className={`${tile} p-4`}>
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                            <Landmark className="w-4 h-4 text-anil-500" /> Na Caixa
                          </div>
                          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            Em{' '}
                            <a
                              href="https://habitacaodigital.caixa.gov.br/"
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-bold text-anil-700 dark:text-anil-300 underline underline-offset-2"
                            >
                              habitacaodigital.caixa.gov.br <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            , escolha o contrato e abra{' '}
                            <b className="text-slate-800 dark:text-slate-200">Documentos → Descritivo do crédito → Baixar documento</b>.
                          </p>
                          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            A Caixa não gera na hora: se o arquivo não vier, tente de novo em até 24 horas.
                          </p>
                        </div>
                        <div className={`${tile} p-4`}>
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                            <FileText className="w-4 h-4 text-anil-500" /> Nos outros bancos
                          </div>
                          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            Peça o Documento Descritivo do Crédito: pela Resolução CMN nº 5.057/2022, todo banco tem de entregá-lo. Por enquanto o
                            app lê o modelo da Caixa.
                          </p>
                        </div>
                      </div>

                      <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        O arquivo é lido só neste computador. O app guarda os números do financiamento, nunca o seu nome ou CPF.
                      </p>
                    </>
                  )}

                  {step === 1 && plan && doc && (
                    <>
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-balance">Confira antes de importar</h2>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                          Documento {doc.bank === 'Caixa' ? 'da Caixa' : `do ${doc.bank}`} de {brDate(doc.referenceDate)}.{' '}
                          {plan.isNew
                            ? 'Ele preenche o cadastro e o histórico de uma vez.'
                            : 'Nos meses que ele mostra, o documento vale no lugar do que estava no app.'}
                        </p>
                      </div>

                      <Section icon={Landmark} title="Contrato">
                        <Row label="Valor financiado" value={formatBRL(plan.contract.financedAmount)} />
                        <Row
                          label="Taxa de juros"
                          value={`${doc.effectiveRate?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) ?? '—'}% efetiva`}
                          note={doc.nominalRate ? `${doc.nominalRate.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}% nominal ao ano` : undefined}
                        />
                        <Row
                          label="Sistema e correção"
                          value={`${plan.contract.system === 'SAC' ? 'SAC' : 'Price'}${plan.contract.trIndexed ? ', corrigido pela TR' : ''}`}
                        />
                        <Row label="Vencimento" value={`dia ${plan.contract.dueDay}, desde ${brMonth(plan.contract.firstDueMonth)}`} />
                        {!plan.isNew &&
                          (plan.contractChanges.length > 0 ? (
                            <Row
                              label="Muda no seu cadastro"
                              value={`${plan.contractChanges.length} ${plan.contractChanges.length === 1 ? 'item' : 'itens'}`}
                              note={plan.contractChanges.map((c) => `${c.label}: ${c.from} → ${c.to}`).join(' · ')}
                            />
                          ) : (
                            <Row label="Seu cadastro" value="igual ao documento" />
                          ))}
                      </Section>

                      <div className="grid sm:grid-cols-2 gap-4">
                        {plan.isNew && (
                          <Field label="Apelido do imóvel" htmlFor="imp-nick" help={HELP.nickname}>
                            <input
                              id="imp-nick"
                              className={inputBase}
                              placeholder="Minha casa"
                              value={opts.nickname ?? ''}
                              onChange={(e) => setOpts((o) => ({ ...o, nickname: e.target.value }))}
                            />
                          </Field>
                        )}
                        {plan.isNew && (
                          <Field label="Valor do imóvel" optional help={HELP.propertyValue} hint="O documento não traz. Serve para mostrar quanto da casa já é seu.">
                            <MoneyField value={opts.propertyValue ?? 0} onChange={(v) => setOpts((o) => ({ ...o, propertyValue: v }))} ariaLabel="Valor do imóvel" />
                          </Field>
                        )}
                        <Field
                          label="Prazo total do contrato"
                          help={HELP.termMonths}
                          className="sm:col-span-2"
                          hint={
                            (opts.termMonths ?? 0) < plan.minTerm
                              ? `Não pode ser menos que ${plan.minTerm} meses: as ${doc.paid.length} pagas mais as ${doc.remaining} que faltam.`
                              : `O documento só mostra as ${doc.paid.length} pagas e as ${doc.remaining} que faltam (${plan.minTerm}). Se o contrato era maior, como 420 meses, use o prazo original: a diferença aparece como parcelas eliminadas ao amortizar.`
                          }
                        >
                          <NumberField
                            value={opts.termMonths ?? plan.contract.termMonths}
                            onChange={(v) => setOpts((o) => ({ ...o, termMonths: v }))}
                            digits={0}
                            suffix="meses"
                            ariaLabel="Prazo total do contrato em meses"
                          />
                          <TermPresets
                            value={opts.termMonths ?? plan.contract.termMonths}
                            onPick={(m) => setOpts((o) => ({ ...o, termMonths: m }))}
                            min={plan.minTerm}
                            unit="meses"
                          />
                        </Field>
                      </div>

                      <Section icon={FileText} title="Histórico">
                        <Row
                          label="Parcelas pagas"
                          value={doc.paid.length}
                          note={`De ${brMonth(doc.paid[0].dueDate.slice(0, 7))} a ${brMonth(doc.paid[doc.paid.length - 1].dueDate.slice(0, 7))}, com amortização, juros, seguros e o saldo de cada uma.`}
                        />
                        <Row
                          label="Amortizações extras"
                          value={doc.extras.length > 0 ? formatBRL(extrasTotal) : 'nenhuma'}
                          note={doc.extras.length > 0 ? doc.extras.map((e) => `${brDate(e.date)}: ${formatBRL(e.amount)}`).join(' · ') : undefined}
                        />
                        {doc.others.length > 0 && (
                          <Row
                            label="Outros eventos"
                            value={`${doc.others.length} fora`}
                            note={`${doc.others.map((e) => `${brDate(e.date)}: ${e.description.toLowerCase()}`).join(' · ')}. O app não usa estes: se algum mudou o saldo, a parcela seguinte do documento já traz o saldo certo.`}
                          />
                        )}
                        {plan.updatesDocument && (
                          <Row
                            label="Documento anterior"
                            value="atualizado"
                            note="O que veio do documento importado antes é trocado por este, sem repetir nada."
                          />
                        )}
                        {replacedSomething && (
                          <Row
                            label="Troca no app"
                            value={[
                              plan.replacedCheckins > 0 && `${plan.replacedCheckins} check-in${plan.replacedCheckins === 1 ? '' : 's'}`,
                              plan.replacedExtras.length > 0 && `${plan.replacedExtras.length} amortização${plan.replacedExtras.length === 1 ? '' : 'ões'}`,
                              plan.removedCheckpoints.length > 0 && `${plan.removedCheckpoints.length} saldo${plan.removedCheckpoints.length === 1 ? '' : 's'}`,
                            ]
                              .filter(Boolean)
                              .join(', ')}
                            note="Registros seus dos mesmos meses: o documento traz os valores do banco no lugar deles."
                          />
                        )}
                      </Section>

                      {plan.conflictingExtras.length > 0 && (
                        <Section icon={AlertTriangle} title="Amortizações que o documento não mostra" tone="warn">
                          <div className="pb-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                            {plan.conflictingExtras.map((e) => `${e.date ? brDate(e.date) : brMonth(e.yearMonth)}: ${formatBRL(e.amount)}`).join(' · ')}.
                            Se o banco não as registrou, elas contariam duas vezes no saldo.
                          </div>
                          <label className="pt-2 flex items-center gap-2.5 text-sm font-semibold text-slate-900 dark:text-white cursor-pointer">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-anil-600"
                              checked={Boolean(opts.removeConflicting)}
                              onChange={(e) => setOpts((o) => ({ ...o, removeConflicting: e.target.checked }))}
                            />
                            Apagar estas amortizações e ficar com o documento
                          </label>
                        </Section>
                      )}

                      {check && (
                        <Section icon={balanceOk && remainingOk ? CircleCheck : AlertTriangle} title="Conferência do saldo" tone={balanceOk && remainingOk ? 'ok' : 'warn'}>
                          <Row
                            label={`Saldo em ${brDate(check.docDue)}, logo depois da parcela`}
                            value={formatBRL(check.docBalance)}
                            note={
                              balanceOk
                                ? 'A tabela do app chega exatamente neste saldo.'
                                : `A tabela do app chega em ${check.appBalance !== null ? formatBRL(check.appBalance) : '—'}. Confira o prazo e a taxa no cadastro depois de importar.`
                            }
                          />
                          {check.remainingDoc !== undefined && (
                            <Row
                              label="Parcelas que faltam"
                              value={check.remainingApp}
                              note={remainingOk ? 'Igual ao documento.' : `O documento diz ${check.remainingDoc}.`}
                            />
                          )}
                          <Row
                            label="Saldo de hoje"
                            value={formatBRL(check.today)}
                            note={`${
                              check.businessDays
                                ? `O do documento mais a TR de ${check.businessDays.done} dos ${check.businessDays.total} dias úteis desde o vencimento.`
                                : 'O do documento, atualizado até hoje.'
                            } ${
                              check.trEstimated
                                ? 'A TR deste período ainda é estimada (o Banco Central não respondeu): pode variar alguns reais do app do banco.'
                                : 'Deve ser o mesmo saldo que o app do banco mostra hoje.'
                            }`}
                          />
                        </Section>
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              {step === 1 ? (
                <button type="button" onClick={() => setStep(0)} className={btnGhost}>
                  <ArrowLeft className="w-4 h-4" /> Outro arquivo
                </button>
              ) : (
                <span />
              )}
              {step === 1 && (
                <button
                  type="button"
                  onClick={confirmImport}
                  disabled={!plan || (opts.termMonths ?? 0) < (plan?.minTerm ?? 0)}
                  className={`${btnPrimary} bg-emerald-600 hover:bg-emerald-500 shadow-[0_8px_20px_-8px_rgba(16,185,129,0.7)]`}
                >
                  <ClipboardCheck className="w-4 h-4" /> Importar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
};

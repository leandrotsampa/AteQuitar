import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { FileUp, PartyPopper } from 'lucide-react';
import { btnGhost } from './components/ui/card';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ConfettiLayer, celebrate } from './components/ui/Confetti';
import { useAppDialog } from './components/ui/AppDialog';
import type { WizardResult } from './components/ContractWizard';
import { useAppData, type AppData } from './lib/store';
import { useFinanceModel } from './lib/model';
import { lastPaidMonth } from './lib/finance';
import { fetchMarketRates, missingTrMonths, shouldRefresh } from './lib/rates';
import { runThemeWipe } from './lib/themeTransition';
import { EASE_OUT, instantIf } from './lib/motion';
import { uid, withBank } from './lib/format';
import { demoData } from './lib/demo';
import { installClickSounds, playSound } from './hooks/useSound';
import { useToday } from './hooks/useToday';
import { getUiPrefs, setUiPrefs } from './hooks/useUiPrefs';
import { HomeScreen } from './screens/HomeScreen';
import type { ScreenId, ScreenProps } from './screens/types';
import { ALL_TOUR_STEP_IDS, isTourRunning, runTour, screenStepIds } from './tour/tour';
import { bindTourToData, completeTour, loadTourState, planScreenTour, planTour, saveTourState, skipTour } from './tour/tourState';

const loadHistory = () => import('./screens/HistoryScreen');
const loadAmortize = () => import('./screens/AmortizeScreen');
const loadInvest = () => import('./screens/InvestScreen');
const loadSystems = () => import('./screens/SystemsScreen');
const loadRate = () => import('./screens/RateScreen');
const loadMarket = () => import('./screens/MarketScreen');
const loadLearn = () => import('./screens/LearnScreen');
const loadCheckin = () => import('./components/CheckinModal');
// Boas-vindas e cadastro só são usados na primeira abertura ou ao editar o contrato
const loadWelcome = () => import('./components/Welcome');
const loadWizard = () => import('./components/ContractWizard');
const Welcome = lazy(() => loadWelcome().then((m) => ({ default: m.Welcome })));
const ContractWizard = lazy(() => loadWizard().then((m) => ({ default: m.ContractWizard })));
const loadData = () => import('./components/DataModal');
const loadImport = () => import('./components/ImportDocumentModal');
const HistoryScreen = lazy(() => loadHistory().then((m) => ({ default: m.HistoryScreen })));
const AmortizeScreen = lazy(() => loadAmortize().then((m) => ({ default: m.AmortizeScreen })));
const InvestScreen = lazy(() => loadInvest().then((m) => ({ default: m.InvestScreen })));
const SystemsScreen = lazy(() => loadSystems().then((m) => ({ default: m.SystemsScreen })));
const RateScreen = lazy(() => loadRate().then((m) => ({ default: m.RateScreen })));
const MarketScreen = lazy(() => loadMarket().then((m) => ({ default: m.MarketScreen })));
const LearnScreen = lazy(() => loadLearn().then((m) => ({ default: m.LearnScreen })));
const CheckinModal = lazy(() => loadCheckin().then((m) => ({ default: m.CheckinModal })));
const DataModal = lazy(() => loadData().then((m) => ({ default: m.DataModal })));
const ImportDocumentModal = lazy(() => loadImport().then((m) => ({ default: m.ImportDocumentModal })));
const preloadAll = () => {
  for (const l of [loadHistory, loadAmortize, loadInvest, loadSystems, loadRate, loadMarket, loadLearn, loadCheckin, loadData, loadImport, loadWizard]) void l();
};

const THEME_KEY = 'atequitar_theme';

// Parcelas que o check-in disse que já foram pagas
const paidMonthsOf = (d: AppData) => new Set(d.checkins.filter((c) => !c.scheduled).map((c) => c.yearMonth));

// Aplica o resultado do assistente: contrato e, se veio, o saldo de hoje como ponto real. O saldo
// de hoje é o de depois da última parcela paga: antes do vencimento, a do mês anterior
function applyWizard(prev: AppData, r: WizardResult): AppData {
  const ym = lastPaidMonth(r.contract, paidMonthsOf(prev));
  // Editar o exemplo não o transforma no seu financiamento: o "Usar o meu" continua para sair dele
  if (!ym) return { ...prev, contract: r.contract };
  const current = prev.checkpoints.find((c) => c.yearMonth === ym && c.source === 'banco');
  const others = prev.checkpoints.filter((c) => c !== current);
  // Mesmo saldo de antes: continua o mesmo registro (e a mesma data em que foi informado)
  const checkpoints =
    r.currentBalance > 0
      ? current && Math.abs(current.balance - r.currentBalance) < 0.005
        ? prev.checkpoints
        : [
            ...others,
            {
              id: uid(),
              yearMonth: ym,
              balance: r.currentBalance,
              ...(r.currentRemaining > 0 ? { remaining: r.currentRemaining } : {}),
              source: 'banco' as const,
              createdAt: new Date().toISOString(),
            },
          ]
      : r.balanceCleared
        ? others
        : prev.checkpoints;
  return { ...prev, contract: r.contract, checkpoints };
}

export default function App() {
  const { data, loaded, update } = useAppData();
  const today = useToday();
  const model = useFinanceModel(data, today);
  const reduce = Boolean(useReducedMotion());
  const { dialog, confirm, notify } = useAppDialog();

  // Tema: claro (dia) ou escuro (noite), com o círculo saindo do botão
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
  const toggleTheme = (origin?: HTMLElement | null) => {
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // segue sem lembrar
    }
    playSound('whoosh');
    runThemeWipe(origin ?? null, () => {
      document.documentElement.classList.toggle('dark', next === 'dark');
      flushSync(() => setTheme(next));
    });
  };
  const dark = theme === 'dark';

  useEffect(() => installClickSounds(), []);

  const [screen, setScreen] = useState<ScreenId>('home');
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [screen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setUiPrefs({ sidebar: getUiPrefs().sidebar === 'expanded' ? 'collapsed' : 'expanded' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Taxas do Banco Central: ao abrir (se a última busca tiver mais de 12 h) e quando pedir
  const [ratesLoading, setRatesLoading] = useState(false);
  const dataRef = useRef(data);
  dataRef.current = data;
  // Uma busca por vez (a da abertura e a da TR que falta podem pedir juntas)
  const ratesInFlight = useRef(false);
  const refreshRates = useCallback(
    async (manual = false) => {
      if (ratesInFlight.current) return;
      ratesInFlight.current = true;
      setRatesLoading(true);
      const current = dataRef.current;
      const { rates, failed } = await fetchMarketRates(current.rates, current.contract ?? null);
      ratesInFlight.current = false;
      setRatesLoading(false);
      update((prev) => ({ ...prev, rates }));
      if (manual) {
        if (failed.length === 0) playSound('success');
        else
          void notify({
            title: 'Algumas taxas não atualizaram',
            message: 'Não deu para falar com o Banco Central agora. Os últimos valores conhecidos continuam valendo; tente de novo mais tarde.',
          });
      }
    },
    [update, notify]
  );
  const ratesChecked = useRef(false);
  useEffect(() => {
    if (!loaded || ratesChecked.current) return;
    ratesChecked.current = true;
    if (shouldRefresh(data.rates)) void refreshRates();
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 400));
    idle(preloadAll);
  }, [loaded, data.rates, refreshRates]);

  // Falta a TR oficial de alguma parcela (contrato novo, outro dia de vencimento, mês novo ou
  // busca que falhou): busca já e, se continuar faltando, de novo a cada 30 minutos
  const missingTr = useMemo(() => (data.contract ? missingTrMonths(data.rates, data.contract).length : 0), [data.contract, data.rates]);
  // Outra data de início ou outro dia de vencimento: busca na hora, sem esperar a última tentativa
  const trKey = `${data.contract?.firstDueMonth}|${data.contract?.dueDay}`;
  const trTried = useRef({ key: '', at: 0 });
  useEffect(() => {
    if (!loaded || ratesLoading || missingTr === 0) return;
    const wait = trTried.current.key === trKey ? Math.max(0, trTried.current.at + 30 * 60 * 1000 - Date.now()) : 0;
    const t = window.setTimeout(() => {
      trTried.current = { key: trKey, at: Date.now() };
      void refreshRates();
    }, wait);
    return () => window.clearTimeout(t);
  }, [loaded, ratesLoading, missingTr, trKey, refreshRates]);

  // Marcos de 10 em 10%: comemora quando um novo é alcançado (os que já existiam ao cadastrar ficam quietos)
  const [toast, setToast] = useState<string | null>(null);
  const progress = model?.summary.progress ?? 0;
  useEffect(() => {
    if (!model) return;
    const reached = Math.floor(progress * 10 + 1e-9) * 10;
    const all = Array.from({ length: reached / 10 }, (_, k) => (k + 1) * 10);
    // O 0 marca que os marcos anteriores ao cadastro já foram registrados em silêncio
    if (!data.celebrated.includes(0)) {
      update((prev) => ({ ...prev, celebrated: [0, ...all] }));
      return;
    }
    const fresh = all.filter((m) => !data.celebrated.includes(m));
    if (fresh.length > 0) {
      update((prev) => ({ ...prev, celebrated: [...prev.celebrated, ...fresh] }));
      const top = fresh[fresh.length - 1];
      window.setTimeout(() => {
        celebrate();
        playSound('celebrate');
        setToast(top >= 100 ? 'Casa quitada! Parabéns, ela é toda sua.' : `Você chegou a ${top}% da dívida quitada!`);
      }, 900);
    }
  }, [progress, model, data.celebrated, update]);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinMonth, setCheckinMonth] = useState<string | undefined>();
  const [dataOpen, setDataOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  // Parcelas → Registros a partir do link do cadastro
  const [historyTab, setHistoryTab] = useState<'table' | 'records' | undefined>();
  const goTo = (target: ScreenId) => {
    setHistoryTab(undefined);
    setScreen(target);
  };
  const [onboardingStage, setOnboardingStage] = useState<'welcome' | 'wizard'>('welcome');

  // Tutorial: boas-vindas quando o financiamento aparece pela primeira vez, apresentação de cada
  // tela na primeira visita e o "Como usar" para rever. Nunca por cima de um modal aberto
  const startTour = (target: ScreenId, ids?: string[], news = false) => {
    if (isTourRunning()) return;
    setScreen(target);
    // Espera a tela montar e a entrada animada assentar antes de destacar
    window.setTimeout(() => {
      void runTour({
        screen: target,
        ids,
        news,
        demo: dataRef.current.isDemo,
        reduceMotion: reduce,
        onDone: (shown) => saveTourState(completeTour(loadTourState(), shown)),
      });
    }, 700);
  };
  const overlayOpen = checkinOpen || dataOpen || contractOpen || importOpen;
  const hasModel = Boolean(model);
  // Os tutoriais vistos são dos dados de agora: dados novos começam do zero
  useEffect(() => {
    if (loaded) bindTourToData(data.createdAt, Boolean(data.contract));
    // Só quando os dados trocam (abertura, banco novo ou recomeçar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, data.createdAt]);
  const tourChecked = useRef(false);
  useEffect(() => {
    // Sem financiamento (primeira abertura ou depois de recomeçar): o próximo cadastro tem boas-vindas
    if (loaded && !hasModel) tourChecked.current = false;
    if (!loaded || !hasModel || tourChecked.current) return;
    tourChecked.current = true;
    const plan = planTour(screenStepIds('home'), loadTourState());
    if (plan.kind === 'news') {
      startTour('home', plan.ids, true);
    } else if (plan.kind === 'welcome') {
      // Depois do confete do cadastro (ou da entrada no exemplo)
      window.setTimeout(() => {
        void confirm({
          title: dataRef.current.isDemo ? 'Bem-vindo ao exemplo' : 'Tudo pronto!',
          message:
            'Em 1 minuto você vê onde fica cada coisa: quanto falta, o check-in do mês e as simulações para quitar mais cedo.',
          confirmLabel: 'Mostrar como funciona',
          cancelLabel: 'Explorar sozinho',
        }).then((ok) => {
          if (ok) startTour('home');
          // Explorar sozinho: nenhuma tela se apresenta; só novidades futuras e o "Como usar"
          else saveTourState(skipTour(loadTourState(), ALL_TOUR_STEP_IDS));
        });
      }, 1600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, hasModel]);
  useEffect(() => {
    if (!hasModel || !tourChecked.current || screen === 'home' || overlayOpen || isTourRunning()) return;
    const plan = planScreenTour(screenStepIds(screen), loadTourState());
    if (plan.kind !== 'none') startTour(screen, plan.ids, plan.kind === 'news');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, hasModel, overlayOpen]);

  const startDemo = () => {
    update((prev) => ({ ...prev, ...demoData(), checkpoints: [], checkins: [], isDemo: true, celebrated: [] }));
    playSound('success');
  };
  // Saiu do exemplo para cadastrar o seu: depois do cadastro, oferece rever o passo a passo com os seus números
  const cameFromDemo = useRef(false);
  const leaveDemo = async () => {
    const ok = await confirm({
      title: 'Cadastrar o seu financiamento',
      message: 'O exemplo e tudo o que você registrou nele serão apagados para começar com os seus dados.',
      confirmLabel: 'Começar',
    });
    if (!ok) return;
    update((prev) => ({ ...prev, contract: null, extras: [], checkpoints: [], checkins: [], celebrated: [], isDemo: false }));
    cameFromDemo.current = true;
    setOnboardingStage('wizard');
  };

  if (!loaded) {
    return <div className="app-canvas min-h-screen" />;
  }

  const screenProps: Omit<ScreenProps, 'model'> = {
    data,
    update,
    dark,
    go: goTo,
    historyTab,
    openCheckin: (month?: string) => {
      // Usado direto como onClick em alguns botões: o evento do clique não é um mês
      setCheckinMonth(typeof month === 'string' ? month : undefined);
      setCheckinOpen(true);
    },
    openContract: () => setContractOpen(true),
    openImport: () => setImportOpen(true),
    refreshRates: () => void refreshRates(true),
    ratesLoading,
  };

  return (
    <div className={`app-canvas min-h-screen flex font-sans overflow-hidden ${dark ? 'text-slate-100' : 'text-slate-800'} selection:bg-anil-500/25`}>
      {!model ? (
        // Primeira abertura: boas-vindas e cadastro
        <div className="flex-1 flex flex-col h-screen">
          <TopBar ratesUpdatedAt={data.rates.fetchedAt} ratesLoading={ratesLoading} onRefreshRates={() => void refreshRates(true)} />
          <div className="flex-1 overflow-y-auto">
            <Suspense fallback={null}>
            <AnimatePresence mode="wait">
              {onboardingStage === 'welcome' ? (
                <motion.div key="welcome" exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
                  <Welcome
                    dark={dark}
                    onStart={() => {
                      playSound('tick');
                      setOnboardingStage('wizard');
                    }}
                    onDemo={startDemo}
                    onImport={() => setImportOpen(true)}
                    toggleTheme={toggleTheme}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="wizard"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE_OUT }}
                  className="max-w-6xl mx-auto px-6 lg:px-10 pb-12 pt-2"
                >
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">Vamos cadastrar o seu financiamento</h1>
                  <p className="text-slate-600 dark:text-slate-400 mb-5">Tenha o contrato por perto. Cada campo tem um "?" que mostra onde achar a informação.</p>
                  {/* Atalho: o documento do banco preenche o cadastro e o histórico de uma vez */}
                  <div className="mb-7 flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl bg-anil-50 ring-1 ring-inset ring-anil-600/10 dark:bg-anil-500/10 dark:ring-anil-400/20">
                    <FileUp className="w-5 h-5 text-anil-600 dark:text-anil-300 shrink-0" />
                    <p className="flex-1 text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                      <b className="text-slate-900 dark:text-white">Tem o Documento Descritivo do Crédito em PDF?</b> Importe e o app preenche o cadastro e todas
                      as parcelas pagas, iguais às do banco.
                    </p>
                    <button type="button" onClick={() => setImportOpen(true)} className={`${btnGhost} shrink-0`}>
                      Importar documento
                    </button>
                  </div>
                  <ContractWizard
                    initial={null}
                    dark={dark}
                    onCancel={() => setOnboardingStage('welcome')}
                    onSave={(r) => {
                      update((prev) => ({ ...applyWizard(prev, r), celebrated: [] }));
                      celebrate();
                      playSound('celebrate');
                      if (cameFromDemo.current) {
                        cameFromDemo.current = false;
                        window.setTimeout(() => {
                          void confirm({
                            title: 'Sua casa está cadastrada!',
                            message: 'Quer rever o passo a passo da tela inicial, agora com os seus números?',
                            confirmLabel: 'Rever o passo a passo',
                            cancelLabel: 'Agora não',
                          }).then((ok) => ok && startTour('home'));
                        }, 1600);
                      }
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            </Suspense>
          </div>
        </div>
      ) : (
        <>
          <Sidebar
            active={screen}
            onSelect={goTo}
            nickname={model.contract.nickname}
            progress={model.summary.progress}
            theme={theme}
            toggleTheme={toggleTheme}
            onOpenContract={() => setContractOpen(true)}
            onOpenData={() => setDataOpen(true)}
            onOpenTutorial={() => startTour(screen)}
          />
          <div className="flex-1 flex flex-col min-w-0 h-screen">
            <TopBar
              title={`${model.contract.nickname}${model.contract.bank ? ` ${withBank(model.contract.bank, model.contract.bankPreposition)}` : ''}`}
              calibrated={model.calibrated}
              onCalibrate={() => {
                setCheckinMonth(undefined);
                setCheckinOpen(true);
              }}
              ratesUpdatedAt={data.rates.fetchedAt}
              ratesLoading={ratesLoading}
              onRefreshRates={() => void refreshRates(true)}
              isDemo={data.isDemo}
              onLeaveDemo={leaveDemo}
              onEditContract={() => setContractOpen(true)}
            />
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <main className="relative px-4 sm:px-6 lg:px-8 pb-10 pt-2 max-w-[1240px] w-full mx-auto">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={screen}
                    initial={reduce ? false : { opacity: 0, filter: 'blur(6px)', scale: 0.995 }}
                    animate={{
                      opacity: 1,
                      filter: 'blur(0px)',
                      scale: 1,
                      transition: instantIf(reduce, { duration: 0.42, ease: EASE_OUT }),
                      transitionEnd: { filter: 'none', transform: 'none' },
                    }}
                    exit={{ opacity: 0, filter: 'blur(4px)', transition: instantIf(reduce, { duration: 0.18 }) }}
                  >
                    <Suspense fallback={<div className="skeleton h-64 rounded-3xl" />}>
                      {screen === 'home' && <HomeScreen model={model} {...screenProps} />}
                      {screen === 'history' && <HistoryScreen model={model} {...screenProps} />}
                      {screen === 'amortize' && <AmortizeScreen model={model} {...screenProps} />}
                      {screen === 'invest' && <InvestScreen model={model} {...screenProps} />}
                      {screen === 'systems' && <SystemsScreen model={model} {...screenProps} />}
                      {screen === 'rate' && <RateScreen model={model} {...screenProps} />}
                      {screen === 'market' && <MarketScreen model={model} {...screenProps} />}
                      {screen === 'learn' && <LearnScreen model={model} {...screenProps} />}
                    </Suspense>
                  </motion.div>
                </AnimatePresence>
              </main>
            </div>
          </div>
        </>
      )}

      {/* Editar o contrato: o mesmo assistente, numa camada por cima */}
      <AnimatePresence>
        {contractOpen && model && (
          <motion.div
            key="contract"
            className="app-no-drag fixed inset-0 z-50 app-canvas overflow-y-auto"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            <div className="max-w-6xl mx-auto px-6 lg:px-10 py-10">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">Meu financiamento</h1>
              <p className="text-slate-600 dark:text-slate-400 mb-7">Corrija o que precisar. As contas são refeitas na hora.</p>
              <Suspense fallback={<div className="skeleton h-96 rounded-3xl" />}>
              <ContractWizard
                initial={model.contract}
                realBalance={model.lastRealBalance}
                onOpenRecords={() => {
                  setContractOpen(false);
                  setHistoryTab('records');
                  setScreen('history');
                }}
                dark={dark}
                onCancel={() => setContractOpen(false)}
                onSave={(r) => {
                  update((prev) => applyWizard(prev, r));
                  setContractOpen(false);
                  playSound('success');
                }}
              />
              </Suspense>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {checkinOpen && model && (
          <Suspense key="checkin" fallback={null}>
            <CheckinModal model={model} data={data} update={update} dark={dark} month={checkinMonth} onClose={() => setCheckinOpen(false)} />
          </Suspense>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {importOpen && (
          <Suspense key="import" fallback={null}>
            <ImportDocumentModal data={data} update={update} onClose={() => setImportOpen(false)} />
          </Suspense>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dataOpen && (
          <Suspense key="data" fallback={null}>
            <DataModal
              data={data}
              update={update}
              confirm={confirm}
              notify={notify}
              onClose={() => setDataOpen(false)}
              onReset={() => {
                setDataOpen(false);
                setScreen('home');
                setOnboardingStage('welcome');
              }}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Aviso de conquista */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            role="status"
            className="app-no-drag fixed top-16 left-1/2 z-[90] -translate-x-1/2 flex items-center gap-3 pl-3 pr-5 py-3 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xl"
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          >
            <span className="w-9 h-9 rounded-full bg-sol-400 text-slate-900 flex items-center justify-center">
              <PartyPopper className="w-5 h-5" />
            </span>
            <span className="font-display font-semibold text-[15px]">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfettiLayer />
      {dialog}
    </div>
  );
}

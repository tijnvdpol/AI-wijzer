import { Compass, LogOut, Moon, Sun } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import type { RecommendRequest } from '../../shared/schemas';
import { BudgetPicker } from './components/BudgetPicker';
import { useLogout } from './components/PinGate';
import { HistoryList } from './components/HistoryList';
import { RequestForm } from './components/RequestForm';
import { ResultView } from './components/ResultView';
import { ClarifyQuestion, ErrorBanner, LoadingMessages } from './components/StatusViews';
import { SubscriptionsPanel } from './components/SubscriptionsPanel';
import { useBudget, useHistory, usePreferences, useSettings } from './hooks/useAppState';
import { useRecommend } from './hooks/useRecommend';
import { useTheme } from './hooks/useTheme';

export default function App() {
  const [settings, setSettings] = useSettings();
  const [budget, setBudget] = useBudget();
  const [preferences, setPreferences] = usePreferences();
  const { history, add, clear } = useHistory();
  const { dark, toggle } = useTheme();
  const logout = useLogout();
  const [query, setQuery] = useState('');
  const lastRequest = useRef<RecommendRequest | null>(null);

  const { state, submit: submitRequest, showResult, reset } = useRecommend(add);
  const submit = (req: RecommendRequest) => {
    lastRequest.current = req;
    return submitRequest(req);
  };

  const buildRequest = useCallback(
    (clarification: RecommendRequest['clarification']): RecommendRequest => ({
      query: query.trim(),
      clarification,
      settings,
      budget,
      preferences,
    }),
    [query, settings, budget, preferences],
  );

  const busy = state.status === 'loading';
  const showForm = state.status !== 'result';

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-600 text-white">
            <Compass className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight">AI Wijzer</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">De beste AI-tool voor wat jij wilt maken</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="btn-ghost !px-3"
            aria-label={dark ? 'Schakel naar lichte modus' : 'Schakel naar donkere modus'}
          >
            {dark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
          </button>
          {logout && (
            <button type="button" onClick={logout} className="btn-ghost">
              <LogOut className="h-4 w-4" aria-hidden /> Uitloggen
            </button>
          )}
        </div>
      </header>

      <SubscriptionsPanel settings={settings} onChange={setSettings} />

      {showForm && (
        <>
          <div className="card space-y-6">
            <BudgetPicker budget={budget} onChange={setBudget} />
            <hr className="border-slate-200 dark:border-slate-800" />
            <RequestForm
              query={query}
              onQueryChange={setQuery}
              preferences={preferences}
              onPreferencesChange={setPreferences}
              disabled={busy}
              onSubmit={() => void submit(buildRequest(null))}
            />
          </div>

          {state.status === 'loading' && <LoadingMessages />}
          {state.status === 'clarify' && (
            <ClarifyQuestion
              question={state.question}
              options={state.options}
              onAnswer={(answer) => {
                void submit(buildRequest({ question: state.question, answer }));
              }}
            />
          )}
          {state.status === 'error' && (
            <ErrorBanner
              message={state.message}
              onRetry={() => void submit(lastRequest.current ?? buildRequest(null))}
            />
          )}
          {state.status === 'idle' && (
            <HistoryList
              history={history}
              onClear={clear}
              onOpen={(item) => {
                setQuery(item.query);
                showResult(item.result);
              }}
            />
          )}
        </>
      )}

      {state.status === 'result' && (
        <ResultView
          result={state.result}
          onNew={() => {
            setQuery('');
            reset();
          }}
        />
      )}
    </div>
  );
}

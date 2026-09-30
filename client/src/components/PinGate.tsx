import { Compass, Loader2, Lock } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { UNAUTHORIZED_EVENT } from '../lib/api';

type Phase = 'checking' | 'locked' | 'open';

/** Shows a PIN screen until the server confirms a valid session. The real check happens on the server. */
export function PinGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/sessie')
      .then((r) => r.json() as Promise<{ pinRequired: boolean; authorized: boolean }>)
      .then((s) => setPhase(!s.pinRequired || s.authorized ? 'open' : 'locked'))
      // Server unreachable: show the app; requests will report the problem themselves.
      .catch(() => setPhase('open'));
    const onUnauthorized = () => setPhase('locked');
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!pin.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        setPin('');
        setPhase('open');
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? 'Inloggen mislukt. Probeer het opnieuw.');
      setPin('');
    } catch {
      setError('Geen verbinding met de server.');
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'open') return <>{children}</>;
  if (phase === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Laden">
        <Loader2 className="h-6 w-6 animate-spin text-accent-600" aria-hidden />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-600 text-white">
          <Compass className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="text-xl font-bold">AI Wijzer</h1>
      </div>
      <form onSubmit={(e) => void submit(e)} className="card space-y-4">
        <label className="label flex items-center gap-2" htmlFor="pin">
          <Lock className="h-4 w-4" aria-hidden /> Pincode
        </label>
        <input
          id="pin"
          className="input text-center text-2xl tracking-[0.4em]"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          maxLength={32}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          aria-invalid={error !== ''}
          aria-describedby={error ? 'pin-error' : undefined}
        />
        {error && (
          <p id="pin-error" role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={busy || !pin.trim()}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : 'Openen'}
        </button>
      </form>
    </div>
  );
}

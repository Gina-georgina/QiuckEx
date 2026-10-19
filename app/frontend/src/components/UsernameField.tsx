import { useEffect, useRef, useState } from 'react';
import {
  checkUsernameAvailability,
  validateUsernameFormat,
  type UsernameAvailability,
} from '../lib/api';

type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'taken' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'rate_limited' }
  | { kind: 'error' };

export interface UsernameFieldProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  label?: string;
}

export default function UsernameField({
  value,
  onChange,
  id = 'username',
  label = 'Username',
}: UsernameFieldProps) {
  const [state, setState] = useState<CheckState>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      setState({ kind: 'idle' });
      return;
    }

    const formatError = validateUsernameFormat(trimmed);
    if (formatError) {
      setState({ kind: 'invalid', reason: formatError });
      return;
    }

    setState({ kind: 'checking' });

    const controller = new AbortController();
    abortRef.current = controller;

    const timer = setTimeout(() => {
      checkUsernameAvailability(trimmed, controller.signal)
        .then((result: UsernameAvailability) => {
          if (controller.signal.aborted) return;
          switch (result.status) {
            case 'available':
              setState({ kind: 'available' });
              break;
            case 'taken':
              setState({ kind: 'taken' });
              break;
            case 'invalid':
              setState({ kind: 'invalid', reason: result.reason });
              break;
            case 'rate_limited':
              setState({ kind: 'rate_limited' });
              break;
            default:
              setState({ kind: 'error' });
          }
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setState({ kind: 'error' });
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const statusId = `${id}-status`;

  return (
    <div className="username-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="username"
        aria-describedby={statusId}
        aria-invalid={state.kind === 'invalid' || state.kind === 'taken'}
      />
      <div id={statusId} aria-live="polite" className="username-field__status">
        {state.kind === 'checking' && (
          <span className="username-field__checking">
            <span className="spinner" aria-hidden="true" /> Checking…
          </span>
        )}
        {state.kind === 'available' && (
          <span className="username-field__available" style={{ color: 'green' }}>
            <span aria-hidden="true">✓</span> Available
          </span>
        )}
        {state.kind === 'taken' && (
          <span className="username-field__taken" style={{ color: 'red' }}>
            <span aria-hidden="true">✕</span> Already claimed
          </span>
        )}
        {state.kind === 'invalid' && (
          <span className="username-field__invalid" style={{ color: 'red' }}>
            {state.reason}
          </span>
        )}
        {state.kind === 'rate_limited' && (
          <span className="username-field__rate-limited">Try again shortly</span>
        )}
        {state.kind === 'error' && (
          <span className="username-field__error">Could not check availability</span>
        )}
      </div>
    </div>
  );
}

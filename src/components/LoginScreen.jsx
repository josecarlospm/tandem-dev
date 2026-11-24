import React, { useState } from 'react';
import { Layers, LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react';

const DEMO_EMAIL = 'dev@tandem.local';
const DEMO_PASSWORD = 'tandem-dev';

export default function LoginScreen({ onLogin, errorMessage }) {
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextEmail = email.trim();
    const nextPassword = password.trim();
    if (!nextEmail || !nextPassword) return;
    setLoading(true);
    await onLogin(nextEmail, nextPassword);
    setLoading(false);
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">
            <Layers size={20} />
          </div>
          <h1 className="login-title">Tandem</h1>
          <p className="login-subtitle">Humans and AI coding agents as one team</p>
        </div>

        {errorMessage && (
          <div className="login-error">
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <div className="login-password-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-submit"
            disabled={loading || !email.trim() || !password.trim()}
          >
            <LogIn size={15} />
            <span>{loading ? 'Signing in…' : 'Sign in'}</span>
          </button>
        </form>

        <div className="login-hint-section">
          <button
            type="button"
            className="login-hint-toggle"
            onClick={() => {
              setEmail(DEMO_EMAIL);
              setPassword(DEMO_PASSWORD);
              setShowHint(true);
            }}
          >
            Fill local demo account
          </button>

          {showHint && (
            <div className="login-hint-box">
              <div className="login-hint-row">
                <span className="text-ink-muted">Owner email</span>
                <code>{DEMO_EMAIL}</code>
              </div>
              <div className="login-hint-row">
                <span className="text-ink-muted">Local password</span>
                <code>{DEMO_PASSWORD}</code>
              </div>
              <p className="login-hint-password">
                Fields above are prefilled. Click Sign in, or use the same values from <code className="rounded border border-line-soft bg-white px-1 font-mono text-[11px] text-ink-heading">.env</code> (<code className="rounded border border-line-soft bg-white px-1 font-mono text-[11px] text-ink-heading">TANDEM_INITIAL_PASSWORD</code>).
              </p>
            </div>
          )}
        </div>

        <p className="login-footer">Self-hosted collaborative engineering workspace</p>
      </div>
    </div>
  );
}

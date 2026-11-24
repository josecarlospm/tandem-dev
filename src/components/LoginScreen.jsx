import React, { useState } from 'react';
import { Layers, LogIn, Eye, EyeOff, AlertCircle, Zap, Shield, Users, Bot, Crown, User } from 'lucide-react';

export default function LoginScreen({ onLogin, errorMessage }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    await onLogin(email, password);
    setLoading(false);
  };

  return (
    <div className="login-screen">
      {/* Main Login Card */}
      <div className="login-card">
        {/* Logo & Brand */}
        <div className="login-brand">
          <div className="login-logo">
            <Layers size={20} />
          </div>
          <h1 className="login-title">Tandem</h1>
          <p className="login-subtitle">Humans & AI Coding Agents as One Team</p>
        </div>

        {/* Feature Pills */}
        <div className="login-features">
          <span className="login-feature-pill">
            <Bot size={11} /> CLI Agents
          </span>
          <span className="login-feature-pill">
            <Shield size={11} /> RBAC
          </span>
          <span className="login-feature-pill">
            <Users size={11} /> Channels
          </span>
          <span className="login-feature-pill">
            <Zap size={11} /> Task Board
          </span>
        </div>

        {/* Error Toast */}
        {errorMessage && (
          <div className="login-error">
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              type="email"
              placeholder="name@vibecoding.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
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
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
          </button>
        </form>

        {/* Hint Toggle */}
        <div className="login-hint-section">
          <button
            type="button"
            className="login-hint-toggle"
            onClick={() => setShowHint(!showHint)}
          >
            {showHint ? 'Hide demo accounts' : 'View demo accounts'}
          </button>

          {showHint && (
            <div className="login-hint-box">
              <div className="login-hint-row">
                <span className="login-hint-role owner" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Crown size={11} /> Owner
                </span>
                <code style={{ cursor: 'pointer' }} onClick={() => { setEmail('dev@vibecoding.io'); setPassword('vibe2026'); }}>dev@vibecoding.io</code>
              </div>
              <div className="login-hint-row">
                <span className="login-hint-role admin" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Shield size={11} /> Admin
                </span>
                <code style={{ cursor: 'pointer' }} onClick={() => { setEmail('alex@vibecoding.io'); setPassword('vibe2026'); }}>alex@vibecoding.io</code>
              </div>
              <div className="login-hint-row">
                <span className="login-hint-role user" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <User size={11} /> User
                </span>
                <code style={{ cursor: 'pointer' }} onClick={() => { setEmail('sarah@vibecoding.io'); setPassword('vibe2026'); }}>sarah@vibecoding.io</code>
              </div>
              <div className="login-hint-row">
                <span className="login-hint-role user" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <User size={11} /> User
                </span>
                <code style={{ cursor: 'pointer' }} onClick={() => { setEmail('marcus@vibecoding.io'); setPassword('vibe2026'); }}>marcus@vibecoding.io</code>
              </div>
              <div className="login-hint-password">
                Password: <code>vibe2026</code> (click email to autofill)
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="login-footer">
          Role-Based Access Control · Local Session Auth
        </div>
      </div>
    </div>
  );
}

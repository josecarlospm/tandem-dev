import React, { useState } from 'react';
import { 
  Cpu, Terminal, Sliders, Search, Monitor, RefreshCw, ShieldCheck, Lock, 
  GitBranch, GitPullRequest, Globe, Rocket, ExternalLink, CheckCircle2, Clock,
  BookOpen, Zap, Plus, Trash2, Check, Layers, EyeOff, Compass
} from 'lucide-react';

export default function CLIAgentsHub({ 
  systemEnv, 
  agents = [], 
  harnessConfig = {},
  skills = [],
  quickActions = [],
  integrations = {}, 
  deployments = [], 
  currentUser, 
  onUpdateAgentConfig, 
  onValidateAgentCLI, 
  onRescanSystemTools,
  onUpdateHarnessConfig,
  onUpsertSkill,
  onDeleteSkill,
  onToggleAgentSkill,
  onUpsertQuickAction,
  onDeleteQuickAction,
  onUpdateIntegrationConfig,
  onTestIntegrationConnection,
  onDeployWorkspaceToVercel
}) {
  const [activeSubTab, setActiveSubTab] = useState('agents'); // 'agents' | 'skills' | 'quick-actions' | 'shipping'
  const [editingAgentId, setEditingAgentId] = useState(null);
  const [cliEngine, setCliEngine] = useState('');
  const [cliCommand, setCliCommand] = useState('');
  const [cliArgs, setCliArgs] = useState('');
  const [skipPermissions, setSkipPermissions] = useState(true);

  // Skill editor state
  const [selectedSkillId, setSelectedSkillId] = useState(skills[0]?.id || null);
  const [isCreatingSkill, setIsCreatingSkill] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [skillDesc, setSkillDesc] = useState('');
  const [skillContent, setSkillContent] = useState('');

  // Quick Action form state
  const [qaName, setQaName] = useState('');
  const [qaPrompt, setQaPrompt] = useState('');
  const [qaTargetAgent, setQaTargetAgent] = useState('agent-antigravity');
  const [qaVisibility, setQaVisibility] = useState('public');

  // GitHub & Vercel Editing States
  const [editingGitHub, setEditingGitHub] = useState(false);
  const [ghUrl, setGhUrl] = useState(integrations.github?.instanceUrl || 'https://github.com');
  const [ghRepo, setGhRepo] = useState(integrations.github?.repoPath || 'josecarlospm/tandem-dev');
  const [ghBranch, setGhBranch] = useState(integrations.github?.defaultBranch || 'main');
  const [ghToken, setGhToken] = useState(integrations.github?.accessToken || '');
  const [ghAutoPR, setGhAutoPR] = useState(integrations.github?.autoCreatePR !== false);

  const [editingVercel, setEditingVercel] = useState(false);
  const [vcTeam, setVcTeam] = useState(integrations.vercel?.teamSlug || 'josecarlospm');
  const [vcProject, setVcProject] = useState(integrations.vercel?.projectName || 'tandem-dev');
  const [vcDomain, setVcDomain] = useState(integrations.vercel?.productionDomain || 'tandem-dev.vercel.app');
  const [vcToken, setVcToken] = useState(integrations.vercel?.accessToken || '');
  const [vcAutoPreview, setVcAutoPreview] = useState(integrations.vercel?.autoDeployPreview !== false);

  const canConfigure = currentUser?.role === 'Owner' || currentUser?.role === 'Admin';

  const startEditing = (agent) => {
    if (!canConfigure) return;
    setEditingAgentId(agent.id);
    setCliEngine(agent.cliEngine || 'Antigravity CLI');
    setCliCommand(agent.cliCommand || 'agy');
    setCliArgs(agent.cliArgs || '');
    setSkipPermissions(agent.skipPermissions !== false);
  };

  const saveConfig = (agentId) => {
    if (!canConfigure) return;
    onUpdateAgentConfig(agentId, { cliEngine, cliCommand, cliArgs, skipPermissions });
    setEditingAgentId(null);
  };

  const handleSaveGitHub = () => {
    if (!canConfigure) return;
    onUpdateIntegrationConfig?.('github', {
      instanceUrl: ghUrl,
      repoPath: ghRepo,
      defaultBranch: ghBranch,
      accessToken: ghToken,
      autoCreatePR: ghAutoPR,
      connected: true
    });
    setEditingGitHub(false);
  };

  const handleSaveVercel = () => {
    if (!canConfigure) return;
    onUpdateIntegrationConfig?.('vercel', {
      teamSlug: vcTeam,
      projectName: vcProject,
      productionDomain: vcDomain,
      accessToken: vcToken,
      autoDeployPreview: vcAutoPreview,
      connected: true
    });
    setEditingVercel(false);
  };

  const openSkillForEdit = (sk) => {
    setIsCreatingSkill(false);
    setSelectedSkillId(sk.id);
    setSkillName(sk.name);
    setSkillDesc(sk.description || '');
    setSkillContent(sk.content || '');
  };

  const startCreateSkill = () => {
    setIsCreatingSkill(true);
    setSelectedSkillId(null);
    setSkillName('');
    setSkillDesc('');
    setSkillContent('---\nname: custom-workflow\ndescription: Reusable engineering checklist\n---\n1. Inspect relevant files in parallel.\n2. Implement and verify changes synchronously.');
  };

  const handleSaveSkill = (e) => {
    e.preventDefault();
    if (!canConfigure || !skillName.trim()) return;
    if (isCreatingSkill) {
      onUpsertSkill?.({
        name: skillName,
        description: skillDesc,
        content: skillContent,
        boundAgentIds: ['agent-antigravity']
      });
      setIsCreatingSkill(false);
    } else if (selectedSkill) {
      onUpsertSkill?.({
        id: selectedSkill.id,
        name: skillName || selectedSkill.name,
        description: skillDesc,
        content: skillContent,
        baseRevision: selectedSkill.revision
      });
    }
  };

  const handleCreateQuickAction = (e) => {
    e.preventDefault();
    if (!qaName.trim() || !qaPrompt.trim()) return;
    onUpsertQuickAction?.({
      name: qaName,
      prompt: qaPrompt,
      targetAgentId: qaTargetAgent,
      visibility: canConfigure ? qaVisibility : 'private'
    });
    setQaName('');
    setQaPrompt('');
  };

  const detectedCount = agents.filter(a => a.autoDetected).length;
  const github = integrations.github || {};
  const vercel = integrations.vercel || {};
  const selectedSkill = skills.find(s => s.id === selectedSkillId) || skills[0] || null;
  const visibleQuickActions = quickActions.filter(q => q.visibility === 'public' || q.creatorId === currentUser?.id);

  const subTabs = [
    { id: 'agents', label: `Harness & Runtimes (${detectedCount}/${agents.length})`, icon: Terminal },
    { id: 'skills', label: `Skills (${skills.length})`, icon: BookOpen },
    { id: 'quick-actions', label: `Quick Actions (${visibleQuickActions.length})`, icon: Zap },
    { id: 'shipping', label: 'GitHub & Vercel', icon: Rocket }
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* View Header */}
      <div className="view-header">
        <div className="header-title" style={{ gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={16} color="var(--text-muted)" />
            <span>Multica Harness & Integrations</span>
          </div>

          {/* Segmented Sub-Navigation */}
          <div style={{ display: 'flex', background: 'var(--bg-darkest)', padding: '2px', borderRadius: '7px', border: '1px solid var(--border-color)', gap: '2px' }}>
            {subTabs.map(tab => {
              const Icon = tab.icon;
              const active = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveSubTab(tab.id);
                    if (tab.id === 'skills' && skills[0] && !skillName && !isCreatingSkill) {
                      openSkillForEdit(skills[0]);
                    }
                  }}
                  style={{
                    height: '24px',
                    padding: '0 10px',
                    borderRadius: '5px',
                    border: 'none',
                    fontSize: '11.5px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: active ? 'var(--bg-surface-elevated)' : 'transparent',
                    color: active ? 'var(--text-heading)' : 'var(--text-muted)'
                  }}
                >
                  <Icon size={12} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="header-actions" style={{ gap: '8px' }}>
          <span className="tag-badge" style={{ height: '24px', padding: '0 9px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
            Slots: <strong style={{ color: 'var(--text-heading)' }}>{harnessConfig.activeSlots || 0}/{harnessConfig.maxConcurrentTasks || 2}</strong>
            {(harnessConfig.queuedTasks || 0) > 0 && <span style={{ color: '#f59e0b' }}> (+{harnessConfig.queuedTasks} queued)</span>}
          </span>
          <span className="tag-badge" style={{ height: '24px', padding: '0 9px', fontSize: '11px' }}>
            Host: <strong style={{ color: 'var(--text-heading)' }}>{systemEnv?.platformName || 'Local Environment'}</strong>
          </span>
        </div>
      </div>

      <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {!canConfigure && (
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', color: '#f87171' }}>
            <Lock size={16} style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: '13px', display: 'block', color: 'var(--text-heading)' }}>Read-Only Daemon & Workspace Policy</strong>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Signed in as <strong>{currentUser?.name}</strong> (User). You can create private Quick Actions, while Owners and Admins manage Harness policies, `SKILL.md` bundles, and CLI binaries.
              </span>
            </div>
          </div>
        )}

        {/* TAB 1: HARNESS DAEMON & CLI RUNTIMES */}
        {activeSubTab === 'agents' && (
          <>
            {/* Multica v0.12.1 Harness Daemon Policy Panel */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', padding: '16px 20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(94, 106, 210, 0.14)', border: '1px solid rgba(94, 106, 210, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Monitor size={18} color="#818cf8" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h2 style={{ color: 'var(--text-heading)', fontSize: '14px', fontWeight: 600, margin: 0 }}>
                        Local Execution Harness Daemon
                      </h2>
                      <span className="tag-badge" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
                        v{harnessConfig.version || '0.12.1'}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                      Slot-leased concurrency, 9-stage phase telemetry, idle/turn watchdogs, token stream redaction, and mid-run <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px', color: 'var(--text-heading)' }}>--steer</code> supplements.
                    </p>
                  </div>
                </div>

                {canConfigure && (
                  <button className="btn btn-secondary" onClick={onRescanSystemTools}>
                    <Search size={13} /> Rescan Runtimes
                  </button>
                )}
              </div>

              {/* Harness Policy Controls Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ background: 'var(--bg-darkest)', border: '1px solid var(--border-subtle)', borderRadius: '7px', padding: '9px 11px' }}>
                  <label style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Max Concurrent Slots
                  </label>
                  <select
                    disabled={!canConfigure}
                    value={harnessConfig.maxConcurrentTasks || 2}
                    onChange={(e) => onUpdateHarnessConfig?.({ maxConcurrentTasks: Number(e.target.value) })}
                    style={{ width: '100%', height: '28px', background: 'var(--bg-surface)', color: 'var(--text-heading)', border: '1px solid var(--border-color)', borderRadius: '5px', padding: '0 8px', fontSize: '12px' }}
                  >
                    {[1, 2, 3, 4, 6, 8].map(n => (
                      <option key={n} value={n}>{n} parallel {n === 1 ? 'task' : 'tasks'}</option>
                    ))}
                  </select>
                </div>

                <div style={{ background: 'var(--bg-darkest)', border: '1px solid var(--border-subtle)', borderRadius: '7px', padding: '9px 11px' }}>
                  <label style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Execution Boundary
                  </label>
                  <select
                    disabled={!canConfigure}
                    value={harnessConfig.isolationMode || 'in-place'}
                    onChange={(e) => onUpdateHarnessConfig?.({ isolationMode: e.target.value })}
                    style={{ width: '100%', height: '28px', background: 'var(--bg-surface)', color: 'var(--text-heading)', border: '1px solid var(--border-color)', borderRadius: '5px', padding: '0 8px', fontSize: '12px' }}
                  >
                    <option value="in-place">In-Place Workspace</option>
                    <option value="worktree">Isolated Git Worktree</option>
                  </select>
                </div>

                <div style={{ background: 'var(--bg-darkest)', border: '1px solid var(--border-subtle)', borderRadius: '7px', padding: '9px 11px' }}>
                  <label style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Idle Watchdog
                  </label>
                  <select
                    disabled={!canConfigure}
                    value={harnessConfig.idleWatchdogSeconds || 90}
                    onChange={(e) => onUpdateHarnessConfig?.({ idleWatchdogSeconds: Number(e.target.value) })}
                    style={{ width: '100%', height: '28px', background: 'var(--bg-surface)', color: 'var(--text-heading)', border: '1px solid var(--border-color)', borderRadius: '5px', padding: '0 8px', fontSize: '12px' }}
                  >
                    <option value={45}>45 seconds</option>
                    <option value={90}>90 seconds</option>
                    <option value={180}>3 minutes</option>
                    <option value={300}>5 minutes</option>
                  </select>
                </div>

                <div style={{ background: 'var(--bg-darkest)', border: '1px solid var(--border-subtle)', borderRadius: '7px', padding: '9px 11px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '5px' }}>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Safety Guards
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: 'var(--text-heading)', cursor: canConfigure ? 'pointer' : 'default' }}>
                      <input
                        type="checkbox"
                        disabled={!canConfigure}
                        checked={harnessConfig.redactSecrets !== false}
                        onChange={(e) => onUpdateHarnessConfig?.({ redactSecrets: e.target.checked })}
                        style={{ accentColor: 'var(--accent-primary)' }}
                      />
                      <EyeOff size={11} color="#10b981" /> Redact Tokens
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: 'var(--text-heading)', cursor: canConfigure ? 'pointer' : 'default' }}>
                      <input
                        type="checkbox"
                        disabled={!canConfigure}
                        checked={harnessConfig.autoSteerActiveRuns !== false}
                        onChange={(e) => onUpdateHarnessConfig?.({ autoSteerActiveRuns: e.target.checked })}
                        style={{ accentColor: 'var(--accent-primary)' }}
                      />
                      <Compass size={11} color="#818cf8" /> Auto-Steer
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Agent Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px', alignItems: 'stretch' }}>
              {agents.map(a => {
                const isEditing = editingAgentId === a.id;
                const isSkipPermsActive = a.skipPermissions !== false;

                return (
                  <div key={a.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img src={a.avatar} alt={a.name} className="avatar-img" style={{ width: '38px', height: '38px', border: '1px solid var(--border-strong)', flexShrink: 0 }} />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h3 style={{ color: 'var(--text-heading)', fontSize: '14px', fontWeight: 600, margin: 0 }}>{a.name}</h3>
                              <span 
                                className="tag-badge" 
                                style={{ 
                                  background: a.autoDetected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
                                  color: a.autoDetected ? '#10b981' : '#f59e0b', 
                                  borderColor: a.autoDetected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)' 
                                }}
                              >
                                {a.autoDetected ? 'Connected' : 'Not Found'}
                              </span>
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{a.role}</span>
                          </div>
                        </div>

                        {canConfigure && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ height: '28px', padding: '0 10px', fontSize: '11.5px', flexShrink: 0 }}
                            onClick={() => isEditing ? saveConfig(a.id) : startEditing(a)}
                          >
                            <Sliders size={12} />
                            <span>{isEditing ? 'Save' : 'Configure'}</span>
                          </button>
                        )}
                      </div>

                      {/* Bound SKILL.md Pills */}
                      <div style={{ marginBottom: '12px' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                          Bound Workspace Skills (`SKILL.md`)
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {skills.map(sk => {
                            const bound = (sk.boundAgentIds || []).includes(a.id);
                            return (
                              <button
                                key={sk.id}
                                type="button"
                                disabled={!canConfigure}
                                onClick={() => onToggleAgentSkill?.(sk.id, a.id)}
                                className="tag-badge"
                                title={canConfigure ? 'Click to bind/unbind skill from agent runtime brief' : sk.description}
                                style={{
                                  cursor: canConfigure ? 'pointer' : 'default',
                                  background: bound ? 'rgba(94, 106, 210, 0.16)' : 'rgba(255,255,255,0.03)',
                                  color: bound ? '#a5b4fc' : 'var(--text-muted)',
                                  borderColor: bound ? 'rgba(94, 106, 210, 0.35)' : 'var(--border-subtle)'
                                }}
                              >
                                {bound && <Check size={9.5} />}
                                <span>{sk.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* CLI Details Box */}
                      <div style={{ background: 'var(--bg-darkest)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                        <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          CLI Runtime
                        </div>

                        {!isEditing ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Engine</span>
                              <span style={{ color: 'var(--text-heading)', fontWeight: 500 }}>{a.cliEngine}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>Binary</span>
                              <code style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-normal)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '210px' }}>
                                {a.cliCommand}
                              </code>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Permissions</span>
                              <span style={{ fontSize: '11px', color: isSkipPermsActive ? '#10b981' : '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                                <ShieldCheck size={12} />
                                <span>{isSkipPermsActive ? 'Auto-Approve' : 'Interactive'}</span>
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div>
                              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>CLI Engine</label>
                              <select 
                                value={cliEngine} 
                                onChange={(e) => setCliEngine(e.target.value)}
                                style={{ width: '100%', height: '32px', background: 'var(--bg-surface)', color: 'var(--text-heading)', border: '1px solid var(--border-color)', padding: '0 10px', borderRadius: '6px', fontSize: '12px' }}
                              >
                                <option value="Antigravity CLI">Antigravity CLI (agy)</option>
                                <option value="Claude Code">Claude Code (claude)</option>
                                <option value="Codex CLI">Codex CLI (codex)</option>
                                <option value="Custom CLI">Custom Binary</option>
                              </select>
                            </div>

                            <div>
                              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Binary Path / Command</label>
                              <input 
                                type="text" 
                                className="chat-input"
                                style={{ height: '32px', fontSize: '12px' }}
                                value={cliCommand}
                                onChange={(e) => setCliCommand(e.target.value)}
                              />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '2px' }}>
                              <input 
                                type="checkbox"
                                id={`skip-${a.id}`}
                                checked={skipPermissions}
                                onChange={(e) => setSkipPermissions(e.target.checked)}
                                style={{ accentColor: 'var(--accent-primary)' }}
                              />
                              <label htmlFor={`skip-${a.id}`} style={{ fontSize: '11.5px', color: 'var(--text-normal)', cursor: 'pointer' }}>
                                Pass <code>--dangerously-skip-permissions</code>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Diagnostic Log Box */}
                      <div style={{ background: 'var(--bg-darkest)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 12px', minHeight: '72px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Terminal size={11} /> Diagnostics
                          </span>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                            {a.validationStatus?.testedAt || 'Untested'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: a.validationStatus?.success ? '#10b981' : 'var(--text-normal)', lineHeight: 1.4, whiteSpace: 'pre-wrap', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {a.validationStatus?.message || 'Ready for validation.'}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {canConfigure ? (
                        <button 
                          className="btn btn-secondary" 
                          style={{ height: '28px', fontSize: '11.5px', padding: '0 10px' }}
                          onClick={() => onValidateAgentCLI(a.id)}
                        >
                          <RefreshCw size={11.5} />
                          <span>Verify CLI</span>
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Read-Only</span>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: a.status === 'busy' ? '#818cf8' : '#10b981' }} />
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'capitalize', fontWeight: 500 }}>
                          {a.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* TAB 2: REUSABLE WORKSPACE SKILLS (SKILL.md BUNDLES + REVISION LOCKING) */}
        {activeSubTab === 'skills' && (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '18px', minHeight: '420px' }}>
            {/* Left Skills List */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-heading)' }}>
                  Workspace `SKILL.md` ({skills.length})
                </span>
                {canConfigure && (
                  <button type="button" className="btn btn-primary" style={{ height: '26px', padding: '0 9px', fontSize: '11px' }} onClick={startCreateSkill}>
                    <Plus size={11} /> New Skill
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {skills.map(sk => {
                  const active = !isCreatingSkill && selectedSkill?.id === sk.id;
                  return (
                    <div
                      key={sk.id}
                      onClick={() => openSkillForEdit(sk)}
                      style={{
                        padding: '10px 11px',
                        borderRadius: '7px',
                        cursor: 'pointer',
                        background: active ? 'rgba(94, 106, 210, 0.14)' : 'var(--bg-darkest)',
                        border: `1px solid ${active ? 'rgba(94, 106, 210, 0.38)' : 'var(--border-subtle)'}`
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-heading)' }}>{sk.name}</span>
                        <span className="tag-badge" style={{ height: '17px', fontSize: '9.5px', fontFamily: 'var(--font-mono)' }}>
                          rev {sk.revision}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.35 }}>
                        {sk.description || 'Reusable SKILL.md bundle'}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#818cf8', marginTop: '6px' }}>
                        Bound to {(sk.boundAgentIds || []).length} agent{(sk.boundAgentIds || []).length === 1 ? '' : 's'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Skill Editor */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '18px' }}>
              {(isCreatingSkill || selectedSkill) ? (
                <form onSubmit={handleSaveSkill} style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-heading)', margin: 0 }}>
                        {isCreatingSkill ? 'Create New SKILL.md Bundle' : `Editing: ${selectedSkill.name}`}
                      </h3>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        {isCreatingSkill
                          ? 'Skills are injected into the cached Runtime Brief prefix of bound agents.'
                          : `Optimistic lock base revision: rev ${selectedSkill.revision} · Last updated ${selectedSkill.updatedAt || 'recently'}`}
                      </span>
                    </div>

                    {canConfigure && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {!isCreatingSkill && selectedSkill && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ height: '28px', color: '#f87171' }}
                            onClick={() => onDeleteSkill?.(selectedSkill.id)}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        )}
                        <button type="submit" className="btn btn-primary" style={{ height: '28px' }}>
                          Save SKILL.md
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Skill Name</label>
                      <input
                        type="text"
                        disabled={!canConfigure}
                        className="chat-input"
                        value={isCreatingSkill ? skillName : (skillName || selectedSkill?.name || '')}
                        onChange={(e) => setSkillName(e.target.value)}
                        placeholder="e.g. API Contract Verification"
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Summary</label>
                      <input
                        type="text"
                        disabled={!canConfigure}
                        className="chat-input"
                        value={isCreatingSkill ? skillDesc : (skillDesc !== '' ? skillDesc : (selectedSkill?.description || ''))}
                        onChange={(e) => setSkillDesc(e.target.value)}
                        placeholder="When and why agents use this skill"
                      />
                    </div>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      `SKILL.md` Instructions (YAML Frontmatter + Markdown)
                    </label>
                    <textarea
                      disabled={!canConfigure}
                      className="chat-input"
                      style={{ flex: 1, minHeight: '220px', padding: '12px', fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.5, resize: 'vertical' }}
                      value={isCreatingSkill ? skillContent : (skillContent !== '' ? skillContent : (selectedSkill?.content || ''))}
                      onChange={(e) => setSkillContent(e.target.value)}
                    />
                  </div>
                </form>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Select or create a SKILL.md bundle.</div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SAVED QUICK ACTIONS (Multica v0.12.1 MUL-9985 & MUL-10007) */}
        {activeSubTab === 'quick-actions' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '18px', alignItems: 'start' }}>
            {/* Existing Quick Actions */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={14} color="#818cf8" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                    Saved Quick Actions ({visibleQuickActions.length})
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>1-click runnable from any Board card</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {visibleQuickActions.map((qa, idx) => {
                  const targetAgent = agents.find(a => a.id === qa.targetAgentId);
                  const canDelete = canConfigure || qa.creatorId === currentUser?.id;
                  return (
                    <div
                      key={qa.id}
                      style={{
                        padding: '13px 18px',
                        borderBottom: idx < visibleQuickActions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>{qa.name}</span>
                          <span className="tag-badge" style={{ fontSize: '10px' }}>
                            {targetAgent?.name || qa.targetAgentId}
                          </span>
                          <span className="tag-badge" style={{
                            fontSize: '10px',
                            background: qa.visibility === 'private' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.1)',
                            color: qa.visibility === 'private' ? '#f59e0b' : '#10b981',
                            borderColor: qa.visibility === 'private' ? 'rgba(245, 158, 11, 0.28)' : 'rgba(16, 185, 129, 0.25)'
                          }}>
                            {qa.visibility === 'private' ? 'Private (Scoped)' : 'Workspace Public'}
                          </span>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.45 }}>
                          {qa.prompt}
                        </p>
                      </div>

                      {canDelete && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ height: '26px', padding: '0 8px', color: '#f87171' }}
                          onClick={() => onDeleteQuickAction?.(qa.id)}
                        >
                          <Trash2 size={11.5} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Create Quick Action Form */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '18px' }}>
              <h3 style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-heading)', margin: '0 0 12px 0' }}>
                New Quick Action
              </h3>
              <form onSubmit={handleCreateQuickAction} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Action Name</label>
                  <input
                    type="text"
                    className="chat-input"
                    placeholder="e.g. Fix Failing Lint & Types"
                    value={qaName}
                    onChange={(e) => setQaName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Target Agent</label>
                  <select
                    value={qaTargetAgent}
                    onChange={(e) => setQaTargetAgent(e.target.value)}
                    style={{ width: '100%', height: '34px', background: 'var(--bg-chat-input)', color: 'var(--text-heading)', border: '1px solid var(--border-color)', borderRadius: '7px', padding: '0 10px', fontSize: '12.5px' }}
                  >
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.cliEngine})</option>
                    ))}
                  </select>
                </div>

                {canConfigure && (
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Visibility Scope</label>
                    <select
                      value={qaVisibility}
                      onChange={(e) => setQaVisibility(e.target.value)}
                      style={{ width: '100%', height: '34px', background: 'var(--bg-chat-input)', color: 'var(--text-heading)', border: '1px solid var(--border-color)', borderRadius: '7px', padding: '0 10px', fontSize: '12.5px' }}
                    >
                      <option value="public">Public (All Workspace Members)</option>
                      <option value="private">Private (Only Me)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Reusable Prompt Template</label>
                  <textarea
                    className="chat-input"
                    style={{ minHeight: '95px', padding: '10px', fontSize: '12px', resize: 'vertical' }}
                    placeholder="Instructions injected when this action is triggered on an issue..."
                    value={qaPrompt}
                    onChange={(e) => setQaPrompt(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '4px', justifyContent: 'center' }}>
                  <Plus size={13} /> Save Quick Action
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: GITHUB & VERCEL CLOUD SHIPPING */}
        {activeSubTab === 'shipping' && (
          <>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', padding: '16px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(94, 106, 210, 0.14)', border: '1px solid rgba(94, 106, 210, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Rocket size={18} color="#818cf8" />
                </div>
                <div>
                  <h2 style={{ color: 'var(--text-heading)', fontSize: '14px', fontWeight: 600, margin: 0 }}>
                    Continuous Shipping Pipeline (GitHub Source Control + Vercel Edge)
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                    Push feature branches, open GitHub Pull Requests, and deploy instant Vercel Preview or Production builds directly from any board task.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => onDeployWorkspaceToVercel?.('Production')}
                >
                  <Rocket size={13} /> Ship Production Release
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '16px', alignItems: 'stretch' }}>
              {/* GITHUB INTEGRATION CARD */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(94, 106, 210, 0.14)', border: '1px solid rgba(94, 106, 210, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <GitPullRequest size={18} color="#818cf8" />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 style={{ color: 'var(--text-heading)', fontSize: '14px', fontWeight: 600, margin: 0 }}>GitHub Repository & Actions</h3>
                          <span className="tag-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
                            Connected
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pull Requests, Branch Automation & GitHub Actions</span>
                      </div>
                    </div>

                    {canConfigure && (
                      <button 
                        className="btn btn-secondary" 
                        style={{ height: '28px', padding: '0 10px', fontSize: '11.5px', flexShrink: 0 }}
                        onClick={() => editingGitHub ? handleSaveGitHub() : setEditingGitHub(true)}
                      >
                        <Sliders size={12} />
                        <span>{editingGitHub ? 'Save' : 'Configure'}</span>
                      </button>
                    )}
                  </div>

                  <div style={{ background: 'var(--bg-darkest)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                    {!editingGitHub ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Host</span>
                          <span style={{ color: 'var(--text-heading)', fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}>{github.instanceUrl || 'https://github.com'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Repository</span>
                          <code style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-heading)', fontSize: '11.5px' }}>
                            {github.repoPath || 'vibecoding/collaboration-board'}
                          </code>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Base Branch</span>
                          <span className="tag-badge" style={{ fontFamily: 'var(--font-mono)' }}>
                            <GitBranch size={10} /> {github.defaultBranch || 'main'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Auto-Open PR on Ship</span>
                          <span style={{ color: github.autoCreatePR !== false ? '#10b981' : 'var(--text-muted)', fontSize: '11.5px', fontWeight: 500 }}>
                            {github.autoCreatePR !== false ? 'Enabled' : 'Manual'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '8px' }}>
                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>GitHub Host URL</label>
                            <input type="text" className="chat-input" style={{ height: '30px', fontSize: '12px' }} value={ghUrl} onChange={(e) => setGhUrl(e.target.value)} />
                          </div>
                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Default Branch</label>
                            <input type="text" className="chat-input" style={{ height: '30px', fontSize: '12px' }} value={ghBranch} onChange={(e) => setGhBranch(e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Owner / Repository</label>
                          <input type="text" className="chat-input" style={{ height: '30px', fontSize: '12px' }} value={ghRepo} onChange={(e) => setGhRepo(e.target.value)} placeholder="owner/repository" />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Personal Access Token (PAT)</label>
                          <input type="password" className="chat-input" style={{ height: '30px', fontSize: '12px' }} value={ghToken} onChange={(e) => setGhToken(e.target.value)} placeholder="ghp_..." />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input type="checkbox" id="gh-auto-pr" checked={ghAutoPR} onChange={(e) => setGhAutoPR(e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} />
                          <label htmlFor="gh-auto-pr" style={{ fontSize: '11.5px', color: 'var(--text-normal)', cursor: 'pointer' }}>
                            Automatically open Pull Request when pushing task branches
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ background: 'var(--bg-darkest)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 12px', minHeight: '60px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        GitHub Status
                      </span>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{github.lastSyncedAt || 'Synced'}</span>
                    </div>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#10b981' }}>
                      {github.statusMessage || '[READY] Connected to GitHub REST API v3'}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button className="btn btn-secondary" style={{ height: '28px', fontSize: '11.5px', padding: '0 10px' }} onClick={() => onTestIntegrationConnection?.('github')}>
                    <RefreshCw size={11.5} /> Verify GitHub
                  </button>
                  <a 
                    href={`${(github.instanceUrl || 'https://github.com').replace(/\/$/, '')}/${github.repoPath || 'vibecoding/collaboration-board'}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '11.5px', color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>Open Repo</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>

              {/* VERCEL INTEGRATION CARD */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: 'var(--shadow-sm)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.06)', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Globe size={18} color="var(--text-heading)" />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 style={{ color: 'var(--text-heading)', fontSize: '14px', fontWeight: 600, margin: 0 }}>Vercel Edge Network</h3>
                          <span className="tag-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
                            Connected
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Instant Preview URLs & Zero-Downtime Production</span>
                      </div>
                    </div>

                    {canConfigure && (
                      <button 
                        className="btn btn-secondary" 
                        style={{ height: '28px', padding: '0 10px', fontSize: '11.5px', flexShrink: 0 }}
                        onClick={() => editingVercel ? handleSaveVercel() : setEditingVercel(true)}
                      >
                        <Sliders size={12} />
                        <span>{editingVercel ? 'Save' : 'Configure'}</span>
                      </button>
                    )}
                  </div>

                  <div style={{ background: 'var(--bg-darkest)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                    {!editingVercel ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Team / Org</span>
                          <span style={{ color: 'var(--text-heading)', fontWeight: 500 }}>{vercel.teamSlug || 'vibecoding-team'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Vercel Project</span>
                          <code style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-heading)', fontSize: '11.5px' }}>
                            {vercel.projectName || 'collaboration-board'}
                          </code>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Production Domain</span>
                          <span style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}>
                            {vercel.productionDomain || 'collaboration-board.vercel.app'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Preview Deployments</span>
                          <span style={{ color: vercel.autoDeployPreview !== false ? '#10b981' : 'var(--text-muted)', fontSize: '11.5px', fontWeight: 500 }}>
                            {vercel.autoDeployPreview !== false ? 'Every Branch / PR' : 'Manual Only'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Team Slug</label>
                            <input type="text" className="chat-input" style={{ height: '30px', fontSize: '12px' }} value={vcTeam} onChange={(e) => setVcTeam(e.target.value)} />
                          </div>
                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Project Name</label>
                            <input type="text" className="chat-input" style={{ height: '30px', fontSize: '12px' }} value={vcProject} onChange={(e) => setVcProject(e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Production Domain</label>
                          <input type="text" className="chat-input" style={{ height: '30px', fontSize: '12px' }} value={vcDomain} onChange={(e) => setVcDomain(e.target.value)} placeholder="app.vercel.app" />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Vercel Access Token</label>
                          <input type="password" className="chat-input" style={{ height: '30px', fontSize: '12px' }} value={vcToken} onChange={(e) => setVcToken(e.target.value)} placeholder="vcel_..." />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input type="checkbox" id="vc-auto-prev" checked={vcAutoPreview} onChange={(e) => setVcAutoPreview(e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} />
                          <label htmlFor="vc-auto-prev" style={{ fontSize: '11.5px', color: 'var(--text-normal)', cursor: 'pointer' }}>
                            Automatically generate Preview URLs on branch push
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ background: 'var(--bg-darkest)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 12px', minHeight: '60px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Vercel Status
                      </span>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{vercel.lastSyncedAt || 'Synced'}</span>
                    </div>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#10b981' }}>
                      {vercel.statusMessage || '[READY] Connected to Vercel Edge Network'}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button className="btn btn-secondary" style={{ height: '28px', fontSize: '11.5px', padding: '0 10px' }} onClick={() => onTestIntegrationConnection?.('vercel')}>
                    <RefreshCw size={11.5} /> Verify Vercel
                  </button>
                  <a 
                    href={`https://${vercel.productionDomain || 'collaboration-board.vercel.app'}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '11.5px', color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>Visit Production</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            </div>

            {/* Recent Deployments & Pipelines Feed */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Globe size={14} color="var(--text-muted)" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                    Recent Shipments & Vercel Deployments ({deployments.length})
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Live Edge Build Log</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {deployments.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                    No deployments triggered yet. Ship a task from the Board or click "Ship Production Release".
                  </div>
                ) : (
                  deployments.map((dep, idx) => (
                    <div 
                      key={dep.id} 
                      style={{ 
                        padding: '12px 18px', 
                        borderBottom: idx < deployments.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '14px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '240px', flex: 1 }}>
                        <span 
                          className="tag-badge"
                          style={{
                            background: dep.status === 'READY' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.12)',
                            color: dep.status === 'READY' ? '#10b981' : '#f59e0b',
                            borderColor: dep.status === 'READY' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.3)',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600
                          }}
                        >
                          {dep.status === 'READY' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                          <span>{dep.status}</span>
                        </span>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {dep.cardTitle}
                            </span>
                            <span 
                              className="tag-badge" 
                              style={{ 
                                background: dep.environment === 'Production' ? 'rgba(94, 106, 210, 0.15)' : 'rgba(255,255,255,0.04)',
                                color: dep.environment === 'Production' ? '#a5b4fc' : 'var(--text-muted)',
                                borderColor: dep.environment === 'Production' ? 'rgba(94, 106, 210, 0.3)' : 'var(--border-color)'
                              }}
                            >
                              {dep.environment}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '3px', fontSize: '11.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <GitBranch size={11} /> {dep.branch} ({dep.commitSha})
                            </span>
                            {dep.githubPrNumber && (
                              <a href={dep.githubPrUrl} target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>
                                GitHub PR {dep.githubPrNumber}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}>
                          {dep.duration} · {dep.timestamp}
                        </span>
                        <a 
                          href={dep.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="btn btn-secondary"
                          style={{ height: '26px', padding: '0 10px', fontSize: '11.5px', textDecoration: 'none' }}
                        >
                          <span>Visit Preview</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

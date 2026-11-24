import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Play, Terminal, MessageSquare, Send, Sliders, Loader2, Activity, CreditCard, AlignLeft, CheckSquare, Tag, Plus, Trash2, Edit3, Check,
  GitBranch, GitPullRequest, Globe, Rocket, ExternalLink, Square, Compass, Zap, AlertTriangle, RefreshCw, BookOpen, History, Lock
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

const PHASE_LABELS = {
  claimed: 'Claim',
  prepare_started: 'Prep',
  skills_ready: 'Skills',
  environment_ready: 'Env',
  runtime_started: 'Spawn',
  first_output_received: 'Stream',
  first_tool_use: 'Tool',
  turn_completed: 'Turn',
  finished: 'Done'
};

export default function TaskThreadDrawer({ 
  card, 
  columns = [],
  users = [], 
  agents = [], 
  skills = [],
  quickActions = [],
  integrations = {},
  currentUser,
  onClose,
  onMoveCard,
  onUpdateCard,
  onAddComment,
  onTriggerAgent,
  onSteerCardRun,
  onCancelCardRun,
  onRunQuickAction,
  onShipToGitHub,
  onDeployToVercel,
  onMergeGitHubPR,
  onOpenAgentsHub
}) {
  const [commentText, setCommentText] = useState('');
  const [promptText, setPromptText] = useState('');
  const [steerText, setSteerText] = useState('');
  const [showRunHistory, setShowRunHistory] = useState(false);

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState('');

  // Description editing state
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descText, setDescText] = useState('');

  // Sub-task checklist state
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [showAddSubtaskForm, setShowAddSubtaskForm] = useState(false);

  // Tag picker state
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');

  // Mention popup state
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const logsEndRef = useRef(null);
  const commentInputRef = useRef(null);
  const tagPickerRef = useRef(null);

  const handleAddCustomTag = (e) => {
    e.preventDefault();
    const trimmed = customTagInput.trim();
    if (!trimmed) return;
    const currentTags = card.tags || [];
    if (!currentTags.includes(trimmed)) {
      onUpdateCard({ cardId: card.id, tags: [...currentTags, trimmed] });
    }
    setCustomTagInput('');
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target)) {
        setShowTagPicker(false);
      }
    };
    if (showTagPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTagPicker]);

  useEffect(() => {
    if (card) {
      setTitleText(card.title || '');
      setDescText(card.description || '');
    }
  }, [card?.id, card?.title, card?.description]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [card?.executionLayers?.length, card?.logs?.length]);

  if (!card) return null;

  const assignedAgent = agents.find(a => a.id === card.assignedAgentId) || agents[0];
  const activeRun = card.activeRun || null;
  const isExecuting = !!activeRun || card.columnId === 'col-ai-executing';
  const boundSkills = skills.filter(s => (s.boundAgentIds || []).includes(assignedAgent?.id));
  const visibleQuickActions = quickActions.filter(
    qa => qa.visibility === 'public' || qa.creatorId === currentUser?.id
  );
  const runHistory = card.runHistory || [];

  // Sub-task calculation
  const subtasks = card.subtasks || [];
  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const subtaskProgress = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

  const PRESET_TAGS = ['Security', 'Backend', 'Frontend', 'DevOps', 'Bug', 'Feature', 'Autonomous Task', 'Refactoring', 'Testing'];

  const allTargets = [
    ...agents.map(a => ({ id: a.id, name: a.name, sub: `CLI: ${a.cliEngine}`, avatar: a.avatar, color: a.color, status: a.status || 'online', isAgent: true })),
    ...users.map(u => ({ id: u.id, name: u.name, sub: u.role, avatar: u.avatar, color: u.color || '#3b82f6', status: u.status || 'online', isAgent: false }))
  ];

  const filteredTargets = allTargets.filter(t => 
    t.name.toLowerCase().includes(mentionFilter.toLowerCase()) ||
    t.sub.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  const handleSaveTitle = () => {
    if (titleText.trim() && titleText !== card.title) {
      onUpdateCard({ cardId: card.id, title: titleText });
    }
    setIsEditingTitle(false);
  };

  const handleSaveDesc = () => {
    if (descText !== card.description) {
      onUpdateCard({ cardId: card.id, description: descText });
    }
    setIsEditingDesc(false);
  };

  const handleToggleSubtask = (subtaskId) => {
    const updatedSubtasks = subtasks.map(s => 
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    onUpdateCard({ cardId: card.id, subtasks: updatedSubtasks });
  };

  const handleAddSubtask = (e) => {
    e.preventDefault();
    if (!newSubtaskText.trim()) return;
    const newSub = {
      id: 'st-' + Date.now(),
      text: newSubtaskText.trim(),
      completed: false
    };
    const updatedSubtasks = [...subtasks, newSub];
    onUpdateCard({ cardId: card.id, subtasks: updatedSubtasks });
    setNewSubtaskText('');
    setShowAddSubtaskForm(false);
  };

  const handleDeleteSubtask = (subtaskId) => {
    const updatedSubtasks = subtasks.filter(s => s.id !== subtaskId);
    onUpdateCard({ cardId: card.id, subtasks: updatedSubtasks });
  };

  const handleToggleTag = (tag) => {
    const currentTags = card.tags || [];
    const updatedTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    onUpdateCard({ cardId: card.id, tags: updatedTags });
  };

  const handleCommentChange = (e) => {
    const val = e.target.value;
    setCommentText(val);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    if (lastAtPos !== -1 && !textBeforeCursor.slice(lastAtPos).includes(' ')) {
      const query = textBeforeCursor.slice(lastAtPos + 1);
      setMentionFilter(query);
      setShowMentionPopup(true);
      setSelectedIndex(0);
    } else {
      setShowMentionPopup(false);
    }
  };

  const handleSelectMention = (target) => {
    const cursor = commentInputRef.current?.selectionStart || commentText.length;
    const textBeforeCursor = commentText.slice(0, cursor);
    const textAfterCursor = commentText.slice(cursor);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    if (lastAtPos !== -1) {
      const newText = textBeforeCursor.slice(0, lastAtPos) + `@${target.name} ` + textAfterCursor;
      setCommentText(newText);
      setShowMentionPopup(false);
      commentInputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (showMentionPopup && filteredTargets.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredTargets.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredTargets.length) % filteredTargets.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectMention(filteredTargets[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowMentionPopup(false);
      }
    }
  };

  const handlePostComment = (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(card.id, commentText, !!activeRun);
    setCommentText('');
    setShowMentionPopup(false);
  };

  const handleSteerSubmit = (e) => {
    e.preventDefault();
    if (!steerText.trim()) return;
    onSteerCardRun?.(card.id, steerText.trim());
    setSteerText('');
  };

  const handleDispatchBot = (agentId) => {
    onTriggerAgent(card.id, agentId, promptText || card.description);
    setPromptText('');
  };

  const layers = card.executionLayers || [];

  const getLayerBadgeStyle = (layerType) => {
    switch (layerType) {
      case 'init': return { color: '#38bdf8', label: 'INIT' };
      case 'phase': return { color: '#38bdf8', label: 'PHASE' };
      case 'steer': return { color: '#7c3aed', label: 'STEER' };
      case 'prompt': return { color: '#2563eb', label: 'BRIEF' };
      case 'stdout': return { color: '#10b981', label: 'STREAM' };
      case 'tool': return { color: '#f59e0b', label: 'TOOL' };
      case 'stderr': return { color: '#ef4444', label: 'STDERR' };
      case 'complete': return { color: '#10b981', label: 'DONE' };
      default: return { color: 'var(--text-muted)', label: 'LOG' };
    }
  };

  const displayPhases = activeRun?.phases || card.lastRun?.phases || null;

  return (
    <div className="task-drawer-overlay" onClick={onClose}>
      {/* Centered Card Modal */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="flex w-[860px] max-w-[95vw] max-h-[91vh] flex-col overflow-hidden rounded-xl border border-line bg-white shadow-modal"
        style={{ animation: 'popupSlide 0.16s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-line bg-surface-muted px-6 py-4">
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <CreditCard size={16} color="var(--text-muted)" />
              {!isEditingTitle ? (
                <h2 
                  onClick={() => setIsEditingTitle(true)}
                  title="Click to edit task title"
                  style={{ fontSize: '16px', color: 'var(--text-heading)', fontWeight: 600, margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <span>{card.title}</span>
                  <Edit3 size={13} color="var(--text-muted)" style={{ opacity: 0.6 }} />
                  {isExecuting && (
                    <Loader2 size={14} className="text-accent" style={{ animation: 'spin 1.5s linear infinite' }} />
                  )}
                </h2>
              ) : (
                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <input 
                    type="text" 
                    className="chat-input"
                    style={{ flex: 1, fontSize: '15px', fontWeight: 600, height: '32px' }}
                    value={titleText}
                    onChange={(e) => setTitleText(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                  />
                  <button className="btn btn-primary" style={{ height: '32px' }} onClick={handleSaveTitle}>
                    Save
                  </button>
                </div>
              )}
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '26px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Status</span>
                <select 
                  value={card.columnId} 
                  onChange={(e) => onMoveCard(card.id, e.target.value)}
                  className="rounded border border-line bg-white px-2 py-0.5 text-[11.5px] font-medium text-ink-heading"
                >
                  {columns.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                {card.id.toUpperCase()}
              </span>

              {runHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowRunHistory(!showRunHistory)}
                  className={`tag-badge cursor-pointer ${showRunHistory ? 'border-accent-mid bg-accent-soft text-accent' : 'bg-surface-muted text-ink-muted'}`}
                >
                  <History size={10} />
                  <span>{runHistory.length} run{runHistory.length === 1 ? '' : 's'}</span>
                </button>
              )}
            </div>
          </div>

          <button className="btn btn-secondary" style={{ width: '28px', height: '28px', padding: 0 }} onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        {/* Modal Scrollable Body (2 Columns) */}
        <div className="grid flex-1 grid-cols-[1fr_248px] gap-6 overflow-y-auto p-6">
          
          {/* Left Main Column */}
          <div className="flex min-w-0 flex-col gap-[18px]">
            
            {/* Multica v0.12.1 Live Harness Execution & Steering Banner */}
            {isExecuting && (
              <div className="flex flex-col gap-2.5 rounded-lg border border-accent-mid bg-accent-soft p-3.5">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Loader2 size={16} className="text-accent" style={{ animation: 'spin 1.5s linear infinite', flexShrink: 0 }} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--text-heading)', fontSize: '12.5px', fontWeight: 600 }}>
                          {activeRun?.status === 'queued' ? 'Queued for Execution Slot' : 'Harness Run in Progress'}
                        </span>
                        {activeRun?.runId && (
                          <span className="tag-badge" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', borderColor: 'rgba(37, 99, 235, 0.25)' }}>
                            {activeRun.runId}
                          </span>
                        )}
                        {activeRun?.worktreeMode && (
                          <span className="tag-badge" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                            {activeRun.worktreeMode}
                          </span>
                        )}
                        {activeRun?.supplementsCount > 0 && (
                          <span className="tag-badge" style={{ fontSize: '10px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', borderColor: 'rgba(37, 99, 235, 0.25)' }}>
                            Steered {activeRun.supplementsCount}/3
                          </span>
                        )}
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '11.5px', marginTop: '2px' }}>
                        {assignedAgent?.name} via <code className="rounded border border-line-soft bg-white px-1 font-mono text-[11px] text-ink-heading">{assignedAgent?.cliEngine}</code>
                        {activeRun?.pid ? ` · PID ${activeRun.pid}` : ''}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary h-[27px] border-red-200 px-2.5 text-[11.5px] text-danger"
                    onClick={() => onCancelCardRun?.(card.id)}
                    title="Stop active run safely (terminates exact child PID tree)"
                  >
                    <Square size={11} /> Stop Run
                  </button>
                </div>

                {/* 9-Stage Monotonic Phase Stepper */}
                {displayPhases && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, minmax(0, 1fr))', gap: '4px' }}>
                    {displayPhases.map((p) => {
                      const done = !p.pending;
                      return (
                        <div
                          key={p.phase}
                          title={done ? `${p.phase}: +${p.phaseElapsedMs}ms (total ${p.totalElapsedMs}ms)` : `${p.phase}: pending`}
                          style={{
                            padding: '4px 3px',
                            borderRadius: '5px',
                            textAlign: 'center',
                            background: done ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-main)',
                            border: `1px solid ${done ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
                            fontSize: '9.5px',
                            fontFamily: 'var(--font-mono)',
                            color: done ? '#10b981' : 'var(--text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {PHASE_LABELS[p.phase] || p.phase}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Live Mid-Run Steering Input (--steer) */}
                <form onSubmit={handleSteerSubmit} style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    className="chat-input"
                    style={{ flex: 1, height: '30px', fontSize: '11.5px', background: 'var(--bg-main)' }}
                    placeholder="Steer active turn without restarting (injects [ADDITIONAL GUIDANCE])..."
                    value={steerText}
                    onChange={(e) => setSteerText(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={!steerText.trim()}
                    className="btn btn-primary"
                    style={{ height: '30px', padding: '0 10px', fontSize: '11.5px', opacity: steerText.trim() ? 1 : 0.45 }}
                  >
                    <Compass size={12} /> Steer
                  </button>
                </form>
              </div>
            )}

            {/* Classified Failure Diagnostic Banner (pkg/taskfailure/classify.go) */}
            {!isExecuting && card.lastFailure && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: '220px' }}>
                  <AlertTriangle size={15} className="text-danger" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-heading)' }}>
                        {card.lastFailure.label}
                      </span>
                      <span className="tag-badge" style={{ height: '18px', fontSize: '10px', fontFamily: 'var(--font-mono)', background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                        {card.lastFailure.code}
                      </span>
                      {card.lastFailure.retryable && (
                        <span className="tag-badge" style={{ height: '18px', fontSize: '10px', background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                          Retryable
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px', lineHeight: 1.4 }}>
                      {card.lastFailure.remediation}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ height: '27px', padding: '0 10px', fontSize: '11.5px' }}
                  onClick={() => handleDispatchBot(assignedAgent?.id)}
                >
                  <RefreshCw size={11.5} /> Retry Run
                </button>
              </div>
            )}

            {/* Collapsible Run History Timeline (multica issue runs) */}
            {showRunHistory && runHistory.length > 0 && (
              <div className="rounded-lg border border-line bg-surface-muted px-3.5 py-3">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <History size={13} color="var(--text-muted)" /> Harness Execution Runs ({runHistory.length})
                  </span>
                  <button type="button" onClick={() => setShowRunHistory(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={13} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                  {runHistory.map((r) => (
                    <div key={r.runId} className="rounded-md border border-line-soft bg-white px-2.5 py-2 text-[11.5px]">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <code style={{ color: 'var(--text-heading)', fontSize: '11px' }}>{r.runId}</code>
                          <span className="tag-badge" style={{
                            height: '17px',
                            fontSize: '9.5px',
                            background: r.status === 'completed' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: r.status === 'completed' ? '#059669' : '#dc2626',
                            borderColor: r.status === 'completed' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'
                          }}>
                            {r.status}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>{r.agentName} · {r.worktreeMode}</span>
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          {(r.durationMs / 1000).toFixed(1)}s · {r.finishedAt}
                        </span>
                      </div>
                      {r.excerpt && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.excerpt}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags & Assignees Row */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {/* Tags / Labels */}
              <div style={{ flex: 1, minWidth: '180px', position: 'relative' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                  Labels
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', minHeight: '22px' }}>
                  {card.tags?.map((t, idx) => (
                    <span key={idx} className="tag-badge">
                      {t}
                      <X 
                        size={10} 
                        style={{ cursor: 'pointer', marginLeft: '2px', opacity: 0.65 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateCard({ cardId: card.id, tags: card.tags.filter(tag => tag !== t) });
                        }}
                      />
                    </span>
                  ))}
                  <button 
                    type="button"
                    className="tag-badge" 
                    style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px dashed var(--border-strong)', cursor: 'pointer' }}
                    onClick={() => setShowTagPicker(!showTagPicker)}
                  >
                    <Plus size={10} /> Add Label
                  </button>
                </div>

                {/* Tag Picker Popover Dropdown Overlay */}
                {showTagPicker && (
                  <div 
                    ref={tagPickerRef}
                    className="absolute left-0 top-[calc(100%+6px)] z-[500] flex w-[264px] flex-col gap-2.5 rounded-lg border border-line-strong bg-white p-3 shadow-modal"
                    style={{ animation: 'popupSlide 0.14s ease-out' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Select or Create Label
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setShowTagPicker(false)}
                        title="Close"
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                      >
                        <X size={13} />
                      </button>
                    </div>

                    {/* Preset Tags Grid */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {PRESET_TAGS.map(tag => {
                        const isSelected = (card.tags || []).includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleToggleTag(tag)}
                            className={`tag-badge cursor-pointer ${isSelected ? 'border-accent bg-accent text-white' : 'border-line bg-surface-muted text-ink'}`}
                          >
                            {isSelected && <Check size={9.5} />}
                            <span>{tag}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Tag Input Form */}
                    <form onSubmit={handleAddCustomTag} style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                      <input 
                        type="text"
                        placeholder="New custom label..."
                        value={customTagInput}
                        onChange={(e) => setCustomTagInput(e.target.value)}
                        className="chat-input"
                        style={{ flex: 1, height: '28px', fontSize: '11.5px', padding: '0 8px' }}
                      />
                      <button 
                        type="submit" 
                        disabled={!customTagInput.trim()}
                        className="btn btn-primary"
                        style={{ height: '28px', padding: '0 10px', fontSize: '11.5px', opacity: customTagInput.trim() ? 1 : 0.4 }}
                      >
                        Add
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Assigned AI Agent & Bound Skills */}
              <div style={{ minWidth: '190px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                  Assigned Agent & Skills
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <div className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2 py-1">
                    <img src={assignedAgent?.avatar} alt={assignedAgent?.name} className="avatar-img" style={{ width: '18px', height: '18px' }} />
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-heading)' }}>
                      {assignedAgent?.name}
                    </span>
                  </div>
                  {boundSkills.length > 0 && (
                    <span
                      className="tag-badge"
                      title={`Bound SKILL.md bundles: ${boundSkills.map(s => s.name).join(', ')}`}
                      style={{ cursor: 'pointer' }}
                      onClick={onOpenAgentsHub}
                    >
                      <BookOpen size={10} />
                      <span>{boundSkills.length} skill{boundSkills.length === 1 ? '' : 's'}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Description Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlignLeft size={14} color="var(--text-muted)" /> Description
                </span>
                {!isEditingDesc && (
                  <button className="btn btn-secondary" style={{ height: '24px', padding: '0 8px', fontSize: '11px' }} onClick={() => setIsEditingDesc(true)}>
                    <Edit3 size={11} /> Edit
                  </button>
                )}
              </div>

              {!isEditingDesc ? (
                <div className="rounded-lg border border-line bg-surface-muted px-3.5 py-3 text-[13px] leading-relaxed text-ink">
                  <MarkdownRenderer content={card.description || 'No description provided for this task.'} agents={agents} users={users} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <textarea
                    className="chat-input"
                    style={{ width: '100%', minHeight: '100px', padding: '10px 12px', fontSize: '13px', resize: 'vertical' }}
                    value={descText}
                    onChange={(e) => setDescText(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" style={{ height: '28px', fontSize: '12px' }} onClick={() => setIsEditingDesc(false)}>
                      Cancel
                    </button>
                    <button className="btn btn-primary" style={{ height: '28px', fontSize: '12px' }} onClick={handleSaveDesc}>
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Checklist / Sub-tasks Section */}
            <div className="rounded-lg border border-line bg-surface-muted p-3.5">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckSquare size={14} color="var(--text-muted)" /> Sub-tasks ({completedSubtasks}/{subtasks.length})
                </span>
                <span className={`text-[11px] font-semibold ${subtaskProgress === 100 ? 'text-success' : 'text-ink-muted'}`}>
                  {subtaskProgress}%
                </span>
              </div>

              <div className="mb-3 h-1 overflow-hidden rounded-full bg-surface-sunken">
                <div className="h-full bg-success transition-all duration-200" style={{ width: `${subtaskProgress}%` }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                {subtasks.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '2px 0' }}>
                    No sub-tasks added yet.
                  </div>
                ) : (
                  subtasks.map(st => (
                    <div key={st.id} className="flex items-center gap-2 rounded-md border border-line-soft bg-white px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={st.completed}
                        onChange={() => handleToggleSubtask(st.id)}
                        style={{ width: '14px', height: '14px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                      />
                      <span style={{ flex: 1, fontSize: '12.5px', color: st.completed ? 'var(--text-muted)' : 'var(--text-heading)', textDecoration: st.completed ? 'line-through' : 'none' }}>
                        {st.text}
                      </span>
                      <button 
                        type="button"
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                        onClick={() => handleDeleteSubtask(st.id)}
                        title="Remove sub-task"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {!showAddSubtaskForm ? (
                <button className="btn btn-secondary" style={{ height: '26px', fontSize: '11.5px', padding: '0 10px' }} onClick={() => setShowAddSubtaskForm(true)}>
                  <Plus size={12} /> Add Sub-task
                </button>
              ) : (
                <form onSubmit={handleAddSubtask} style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    className="chat-input"
                    style={{ flex: 1, height: '28px', fontSize: '12px' }}
                    placeholder="Add a sub-task item..."
                    value={newSubtaskText}
                    onChange={(e) => setNewSubtaskText(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="btn btn-primary" style={{ height: '28px', padding: '0 10px', fontSize: '11.5px' }}>
                    Add
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ height: '28px', padding: '0 8px', fontSize: '11.5px' }} onClick={() => setShowAddSubtaskForm(false)}>
                    Cancel
                  </button>
                </form>
              )}
            </div>

            {/* GitHub & Vercel Release Pipeline Section */}
            <div className="rounded-lg border border-line bg-surface-muted p-3.5">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Rocket size={14} color="var(--text-muted)" /> Release & Shipping (GitHub + Vercel)
                </span>
                <span className="tag-badge" style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>
                  <GitBranch size={10} />
                  <span>{card.shipping?.branch || `feat/${(card.title || 'task').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28)}`}</span>
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {/* GitHub PR Box */}
                <div className="flex flex-col justify-between gap-2 rounded-md border border-line-soft bg-white px-3 py-2.5">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-heading)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <GitPullRequest size={12} className="text-accent" /> GitHub PR
                      </span>
                      {card.shipping?.githubPR ? (
                        <span 
                          className="tag-badge"
                          style={{
                            height: '18px',
                            fontSize: '10px',
                            background: card.shipping.githubPR.status === 'merged' ? 'rgba(37, 99, 235, 0.1)' : 'rgba(16, 185, 129, 0.12)',
                            color: card.shipping.githubPR.status === 'merged' ? '#2563eb' : '#059669',
                            borderColor: card.shipping.githubPR.status === 'merged' ? 'rgba(37, 99, 235, 0.25)' : 'rgba(16, 185, 129, 0.25)'
                          }}
                        >
                          {card.shipping.githubPR.number} · {card.shipping.githubPR.status === 'merged' ? 'Merged' : (card.shipping.githubPR.checksStatus === 'running' ? 'Checks Running' : 'Checks Passed')}
                        </span>
                      ) : (
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Not opened</span>
                      )}
                    </div>

                    {card.shipping?.githubPR ? (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        commit {card.shipping.githubPR.commitSha} → {card.shipping.githubPR.targetBranch || 'main'}
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Push branch to {integrations?.github?.repoPath || 'GitHub'}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {!card.shipping?.githubPR ? (
                      <button 
                        type="button"
                        className="btn btn-secondary"
                        style={{ height: '25px', padding: '0 8px', fontSize: '11px', width: '100%' }}
                        onClick={() => onShipToGitHub?.(card.id)}
                      >
                        <GitPullRequest size={11} /> Push & Open PR
                      </button>
                    ) : (
                      <>
                        {card.shipping.githubPR.status !== 'merged' && (
                          <button 
                            type="button"
                            className="btn btn-primary"
                            style={{ height: '25px', padding: '0 8px', fontSize: '11px', flex: 1 }}
                            onClick={() => onMergeGitHubPR?.(card.id)}
                          >
                            <GitPullRequest size={11} /> Merge PR
                          </button>
                        )}
                        <a 
                          href={card.shipping.githubPR.url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary"
                          style={{ height: '25px', padding: '0 8px', fontSize: '11px', textDecoration: 'none' }}
                        >
                          <span>View</span>
                          <ExternalLink size={10} />
                        </a>
                      </>
                    )}
                  </div>
                </div>

                {/* Vercel Deployment Box */}
                <div className="flex flex-col justify-between gap-2 rounded-md border border-line-soft bg-white px-3 py-2.5">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-heading)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Globe size={12} className="text-sky-600" /> Vercel Edge
                      </span>
                      {card.shipping?.vercelDeploy ? (
                        <span 
                          className="tag-badge"
                          style={{
                            height: '18px',
                            fontSize: '10px',
                            background: card.shipping.vercelDeploy.status === 'READY' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                            color: card.shipping.vercelDeploy.status === 'READY' ? '#10b981' : '#f59e0b',
                            borderColor: card.shipping.vercelDeploy.status === 'READY' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'
                          }}
                        >
                          {card.shipping.vercelDeploy.environment} · {card.shipping.vercelDeploy.status}
                        </span>
                      ) : (
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>No build</span>
                      )}
                    </div>

                    {card.shipping?.vercelDeploy ? (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {card.shipping.vercelDeploy.url.replace('https://', '')}
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Deploy instant preview or production URL
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button 
                      type="button"
                      className="btn btn-secondary"
                      style={{ height: '25px', padding: '0 8px', fontSize: '11px', flex: 1 }}
                      onClick={() => onDeployToVercel?.(card.id, 'Preview')}
                    >
                      <Globe size={11} /> {card.shipping?.vercelDeploy ? 'Redeploy' : 'Deploy Preview'}
                    </button>
                    {card.shipping?.vercelDeploy?.url && (
                      <a 
                        href={card.shipping.vercelDeploy.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary"
                        style={{ height: '25px', padding: '0 8px', fontSize: '11px', textDecoration: 'none' }}
                      >
                        <span>Open</span>
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Activity & Comment Thread */}
            <div>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <Activity size={14} color="var(--text-muted)" /> Activity ({card.comments?.length || 0})
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {card.comments?.map(cm => {
                  const isAgent = cm.senderType === 'agent';
                  const agent = agents.find(a => a.id === cm.senderId);
                  const user = users.find(u => u.id === cm.senderId);
                  const senderName = isAgent ? (agent ? agent.name : 'AI Agent') : (user ? user.name : 'Teammate');
                  const avatar = isAgent ? (agent?.avatar) : (user?.avatar);
                  const color = isAgent ? (agent?.color) : (user?.color || 'var(--text-heading)');

                  return (
                    <div key={cm.id} className="flex gap-2.5 rounded-lg border border-line bg-surface-muted px-3 py-2.5">
                      <img src={avatar} alt={senderName} className="avatar-img" style={{ width: '28px', height: '28px' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color }}>{senderName}</span>
                          {isAgent && (
                            <span className="msg-badge">
                              {agent?.cliEngine || 'CLI'}
                            </span>
                          )}
                          {cm.steeredRunId && (
                            <span className="tag-badge h-[17px] border-accent-mid bg-accent-soft text-[9.5px] text-accent">
                              <Compass size={9} /> steered {cm.steeredRunId}
                            </span>
                          )}
                          {cm.originChannelName && (
                            <span className="tag-badge" style={{ height: '18px', fontSize: '10px' }}>
                              <MessageSquare size={9.5} /> #{cm.originChannelName}
                            </span>
                          )}
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{cm.timestamp}</span>
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-normal)', lineHeight: 1.5 }}>
                          <MarkdownRenderer content={cm.text} agents={agents} users={users} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Comment Form */}
              <form onSubmit={handlePostComment} style={{ position: 'relative' }}>
                {showMentionPopup && filteredTargets.length > 0 && (
                  <div className="mention-popup" style={{ left: 0, right: 0, bottom: 'calc(100% + 4px)', maxWidth: '100%' }}>
                    <div className="mention-popup-header">
                      <span>Mention Teammate or Agent ({filteredTargets.length})</span>
                    </div>
                    <div className="mention-popup-list">
                      {filteredTargets.map((target, idx) => (
                        <div 
                          key={target.id}
                          className={`mention-item ${idx === selectedIndex ? 'selected' : ''}`}
                          onClick={() => handleSelectMention(target)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                        >
                          <img src={target.avatar} alt={target.name} className="avatar-img" style={{ width: '22px', height: '22px' }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="mention-name" style={{ color: target.color }}>@{target.name}</div>
                            <div className="mention-sub">{target.sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    ref={commentInputRef}
                    type="text"
                    className="chat-input"
                    placeholder={
                      activeRun
                        ? `Comment to steer active run ${activeRun.runId} live...`
                        : `Leave a comment or type @ to mention ${assignedAgent?.name}...`
                    }
                    value={commentText}
                    onChange={handleCommentChange}
                    onKeyDown={handleKeyDown}
                  />
                  <button type="submit" className="btn btn-primary" style={{ height: '36px', padding: '0 14px' }}>
                    <Send size={14} />
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Side Actions Column */}
          <div className="flex flex-col gap-3.5">
            
            {/* Saved Quick Actions (Multica v0.12.1 MUL-9985) */}
            {visibleQuickActions.length > 0 && (
              <div className="rounded-lg border border-line bg-surface-muted p-3">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Zap size={11.5} className="text-accent" /> Quick Actions
                  </span>
                  <button
                    type="button"
                    onClick={onOpenAgentsHub}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '10.5px', cursor: 'pointer', padding: 0 }}
                  >
                    Manage
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {visibleQuickActions.map(qa => (
                    <button
                      key={qa.id}
                      type="button"
                      className="btn btn-secondary"
                      title={qa.prompt}
                      style={{ width: '100%', justifyContent: 'space-between', height: '29px', padding: '0 9px', fontSize: '11.5px' }}
                      onClick={() => onRunQuickAction?.(qa.id, card.id)}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Play size={10.5} className="text-accent" />
                        <span>{qa.name}</span>
                      </span>
                      {qa.visibility === 'private' && <Lock size={10} color="var(--text-muted)" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Properties Section */}
            <div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                Properties
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', justifyContent: 'flex-start', fontSize: '12px', height: '30px' }}
                  onClick={() => setShowTagPicker(!showTagPicker)}
                >
                  <Tag size={12.5} color="var(--text-muted)" /> Edit Labels
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', justifyContent: 'flex-start', fontSize: '12px', height: '30px' }}
                  onClick={() => setShowAddSubtaskForm(true)}
                >
                  <CheckSquare size={12.5} color="var(--text-muted)" /> Add Sub-task
                </button>
              </div>
            </div>

            {/* AI Execution Controls Section */}
            <div className="rounded-lg border border-line bg-surface-muted p-3">
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                Agent Dispatch
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {agents.map(a => (
                  <button 
                    key={a.id}
                    className="btn btn-agent-run"
                    style={{ width: '100%', justifyContent: 'flex-start', background: a.id === assignedAgent?.id ? undefined : 'transparent', borderColor: a.id === assignedAgent?.id ? undefined : 'var(--border-color)', color: a.id === assignedAgent?.id ? undefined : 'var(--text-normal)' }}
                    onClick={() => handleDispatchBot(a.id)}
                  >
                    <Play size={11.5} />
                    <span>{activeRun && activeRun.agentId === a.id ? `Steer ${a.name}` : `Run ${a.name}`}</span>
                  </button>
                ))}

                <input 
                  type="text" 
                  className="chat-input"
                  style={{ height: '30px', fontSize: '11.5px', marginTop: '4px' }}
                  placeholder="Optional prompt override..."
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                />

                <button 
                  className="btn btn-secondary" 
                  style={{ height: '28px', fontSize: '11.5px', justifyContent: 'center', marginTop: '2px' }}
                  onClick={onOpenAgentsHub}
                >
                  <Sliders size={11.5} /> Harness & Skills Hub
                </button>
              </div>
            </div>

            {/* Ship & Deploy Quick Controls */}
            <div className="rounded-lg border border-line bg-surface-muted p-3">
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                Ship Project
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button 
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'flex-start', fontSize: '11.5px' }}
                  onClick={() => onShipToGitHub?.(card.id)}
                >
                  <GitPullRequest size={12} className="text-accent" />
                  <span>Push & Open GitHub PR</span>
                </button>

                <button 
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'flex-start', fontSize: '11.5px' }}
                  onClick={() => onDeployToVercel?.(card.id, 'Preview')}
                >
                  <Globe size={12} className="text-sky-600" />
                  <span>Deploy Vercel Preview</span>
                </button>

                <button 
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '11.5px', marginTop: '2px' }}
                  onClick={() => {
                    onShipToGitHub?.(card.id);
                    onDeployToVercel?.(card.id, 'Production');
                  }}
                >
                  <Rocket size={12} />
                  <span>Ship to Production</span>
                </button>
              </div>
            </div>

            {/* Live Execution Traces Section */}
            <div className="rounded-lg border border-line bg-surface-muted p-3">
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
                <Terminal size={12} /> Execution Traces ({layers.length})
              </span>

              <div className="terminal-window" style={{ maxHeight: '165px', overflowY: 'auto', fontSize: '11px' }}>
                {layers.length === 0 ? (
                  <div className="text-[11px] text-slate-400">
                    No traces recorded yet.
                  </div>
                ) : (
                  layers.slice(-12).map((l, idx) => {
                    const b = getLayerBadgeStyle(l.layerType);
                    return (
                      <div key={idx} style={{ marginBottom: '4px', fontSize: '10.5px', lineHeight: 1.4 }}>
                        <span style={{ color: b.color, fontWeight: 600 }}>[{b.label}]</span> {l.message}
                      </div>
                    );
                  })
                )}
                <div ref={logsEndRef} />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

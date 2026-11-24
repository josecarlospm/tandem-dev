import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, MessageSquare, Terminal, Bot, Loader2, Hash, Search, ChevronDown, Check, Lock, CheckSquare, LayoutGrid, X, GitPullRequest, Globe
} from 'lucide-react';

function SearchableChannelSelect({ channels = [], selectedChannelId, onSelectChannel, currentUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  const availableChannels = channels.filter(ch => {
    if (!ch.isPrivate) return true;
    return currentUser && ch.allowedUserIds && ch.allowedUserIds.includes(currentUser.id);
  });

  const selectedChannel = availableChannels.find(c => c.id === selectedChannelId) || availableChannels[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredChannels = availableChannels.filter(ch => 
    ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ch.topic && ch.topic.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'var(--bg-chat-input)',
          border: '1px solid var(--border-color)',
          borderRadius: '7px',
          height: '36px',
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
          {selectedChannel?.isPrivate ? (
            <Lock size={13} color="#f59e0b" />
          ) : (
            <Hash size={14} color="var(--text-muted)" />
          )}
          <span style={{ color: 'var(--text-heading)', fontWeight: 500, fontSize: '13px' }}>
            {selectedChannel ? selectedChannel.name : 'Select Channel'}
          </span>
          {selectedChannel?.isPrivate && (
            <span style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', padding: '1px 5px', borderRadius: '4px' }}>
              Private
            </span>
          )}
        </div>
        <ChevronDown size={14} color="var(--text-muted)" />
      </div>

      {isOpen && (
        <div 
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-strong)',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 999,
            padding: '6px',
            maxHeight: '200px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-darkest)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <Search size={13} color="var(--text-muted)" />
            <input 
              type="text" 
              placeholder="Filter channels..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-heading)', fontSize: '12px', width: '100%', outline: 'none', fontFamily: 'var(--font-sans)' }}
              autoFocus
            />
          </div>

          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filteredChannels.length === 0 ? (
              <div style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                No accessible channels found
              </div>
            ) : (
              filteredChannels.map(ch => {
                const isSelected = ch.id === selectedChannelId;
                return (
                  <div 
                    key={ch.id}
                    onClick={() => {
                      onSelectChannel(ch.id);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '5px',
                      background: isSelected ? 'var(--bg-active)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', overflow: 'hidden' }}>
                      {ch.isPrivate ? (
                        <Lock size={13} color="#f59e0b" />
                      ) : (
                        <Hash size={13} color="var(--text-muted)" />
                      )}
                      <span style={{ fontSize: '12.5px', fontWeight: isSelected ? 600 : 450, color: 'var(--text-heading)' }}>
                        {ch.name}
                      </span>
                    </div>
                    {isSelected && <Check size={13} color="#818cf8" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrelloBoardView({ 
  columns = [], 
  cards = [], 
  users = [], 
  agents = [], 
  channels = [],
  activeServerId,
  currentUser,
  onCardClick,
  onMoveCard,
  onCreateCard
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('agent-antigravity');
  const [selectedChannel, setSelectedChannel] = useState(channels[0]?.id || 'c2');

  const [draggingCardId, setDraggingCardId] = useState(null);
  const [dragOverColId, setDragOverColId] = useState(null);

  const handleDragStart = (e, cardId) => {
    e.dataTransfer.setData('text/plain', cardId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingCardId(cardId);
  };

  const handleDragOver = (e, colId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColId !== colId) {
      setDragOverColId(colId);
    }
  };

  const handleDragLeave = (e, colId) => {
    if (dragOverColId === colId) {
      setDragOverColId(null);
    }
  };

  const handleDrop = (e, targetColId) => {
    e.preventDefault();
    setDragOverColId(null);
    const cardId = e.dataTransfer.getData('text/plain') || draggingCardId;
    if (!cardId) return;
    const targetCard = cards.find(c => c.id === cardId);
    if (targetCard && targetCard.columnId !== targetColId) {
      onMoveCard(cardId, targetColId);
    }
    setDraggingCardId(null);
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onCreateCard({
      serverId: activeServerId,
      channelId: selectedChannel,
      columnId: 'col-backlog',
      title: newTitle,
      description: newDesc,
      tags: ['Autonomous Task'],
      assignedAgentId: selectedAgent
    });
    setNewTitle('');
    setNewDesc('');
    setShowAddModal(false);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div className="view-header">
        <div className="header-title">
          <LayoutGrid size={16} color="var(--text-muted)" />
          <span>Task Board</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '4px' }}>
            Drag cards across columns · Click any card to inspect
          </span>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={14} />
            New Task
          </button>
        </div>
      </div>

      {/* Kanban Board Layout */}
      <div className="board-container">
        {columns.map(col => {
          const colCards = cards.filter(c => c.columnId === col.id);
          const isOver = dragOverColId === col.id;

          return (
            <div 
              key={col.id} 
              className="kanban-column"
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={(e) => handleDragLeave(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              style={{
                border: isOver ? '1px dashed var(--accent-primary)' : '1px solid var(--border-color)',
                background: isOver ? 'rgba(94, 106, 210, 0.06)' : undefined,
                transition: 'all 0.14s ease'
              }}
            >
              <div className="column-header">
                <div className="column-title">
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: col.color }} />
                  <span>{col.title}</span>
                </div>
                <span className="column-count">{colCards.length}</span>
              </div>

              <div className="column-cards" style={{ minHeight: '120px' }}>
                {colCards.map(card => {
                  const assignedAgent = agents.find(a => a.id === card.assignedAgentId);
                  const assignedUserObjs = users.filter(u => card.assignedUsers?.includes(u.id));
                  const linkedChannel = channels.find(ch => ch.id === card.channelId);
                  const isRunning = !!card.activeRun || card.columnId === 'col-ai-executing';
                  const isDraggingThis = draggingCardId === card.id;
                  const subtasks = card.subtasks || [];
                  const completedSubtasks = subtasks.filter(s => s.completed).length;

                  return (
                    <div 
                      key={card.id} 
                      className="kanban-card"
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, card.id)}
                      onDragEnd={() => { setDraggingCardId(null); setDragOverColId(null); }}
                      style={{ 
                        opacity: isDraggingThis ? 0.45 : 1,
                        cursor: 'grab',
                        borderColor: isRunning ? 'rgba(129, 140, 248, 0.45)' : undefined
                      }}
                      onClick={() => onCardClick(card)}
                    >
                      <div className="card-tags">
                        {card.tags?.map((t, idx) => (
                          <span key={idx} className="tag-badge">{t}</span>
                        ))}
                        {linkedChannel && (
                          <span 
                            className="tag-badge" 
                            style={{ 
                              background: linkedChannel.isPrivate ? 'rgba(245, 158, 11, 0.1)' : 'rgba(94, 106, 210, 0.1)', 
                              color: linkedChannel.isPrivate ? '#f59e0b' : '#818cf8', 
                              borderColor: linkedChannel.isPrivate ? 'rgba(245, 158, 11, 0.25)' : 'rgba(94, 106, 210, 0.25)' 
                            }}
                          >
                            {linkedChannel.isPrivate ? <Lock size={9.5} /> : <Hash size={9.5} />}
                            <span>{linkedChannel.name}</span>
                          </span>
                        )}
                        {isRunning && (
                          <span className="tag-badge" style={{ background: 'rgba(94, 106, 210, 0.2)', color: '#a5b4fc', borderColor: 'rgba(94, 106, 210, 0.4)', fontFamily: 'var(--font-mono)' }}>
                            <Loader2 size={10} style={{ animation: 'spin 1.5s linear infinite' }} />
                            <span>{card.activeRun?.status === 'queued' ? 'Queued' : (card.activeRun?.runId || 'Running')}</span>
                          </span>
                        )}
                        {!isRunning && card.lastFailure && (
                          <span className="tag-badge" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.28)' }}>
                            <span>{card.lastFailure.label}</span>
                          </span>
                        )}
                      </div>

                      <div className="card-title">{card.title}</div>
                      {card.description && (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.45, lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {card.description}
                        </div>
                      )}

                      {/* AI Agent & Shipping Chips */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                        {assignedAgent && (
                          <div className="agent-chip" style={{ background: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-normal)', border: '1px solid var(--border-subtle)' }}>
                            <Bot size={11} color={assignedAgent.color} />
                            <span>{assignedAgent.name}</span>
                          </div>
                        )}
                        {card.shipping?.githubPR && (
                          <div 
                            className="agent-chip" 
                            title={`GitHub PR ${card.shipping.githubPR.number} (${card.shipping.githubPR.status})`}
                            style={{ background: 'rgba(94, 106, 210, 0.12)', color: '#a5b4fc', border: '1px solid rgba(94, 106, 210, 0.28)', fontFamily: 'var(--font-mono)' }}
                          >
                            <GitPullRequest size={10.5} />
                            <span>PR {card.shipping.githubPR.number}</span>
                          </div>
                        )}
                        {card.shipping?.vercelDeploy && (
                          <div 
                            className="agent-chip" 
                            title={`Vercel ${card.shipping.vercelDeploy.environment}: ${card.shipping.vercelDeploy.status}`}
                            style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)' }}
                          >
                            <Globe size={10.5} />
                            <span>{card.shipping.vercelDeploy.environment === 'Production' ? 'Prod' : 'Preview'}</span>
                          </div>
                        )}
                      </div>

                      {/* Footer Info */}
                      <div className="card-footer">
                        <div className="card-assignees">
                          {assignedUserObjs.map(u => (
                            <img key={u.id} src={u.avatar} alt={u.name} className="mini-avatar" title={`Assigned: ${u.name}`} />
                          ))}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          {subtasks.length > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: completedSubtasks === subtasks.length ? '#10b981' : 'var(--text-muted)' }}>
                              <CheckSquare size={11.5} />
                              {completedSubtasks}/{subtasks.length}
                            </span>
                          )}
                          {card.comments?.length > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <MessageSquare size={11.5} />
                              {card.comments.length}
                            </span>
                          )}
                          {card.logs?.length > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: isRunning ? '#818cf8' : '#10b981' }}>
                              <Terminal size={11.5} />
                              {card.logs.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="task-drawer-overlay" onClick={() => setShowAddModal(false)}>
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-main)', padding: '24px', borderRadius: '12px', width: '440px', maxWidth: '92vw', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-heading)' }}>New Task Card</h3>
              <button className="btn btn-secondary" style={{ width: '28px', height: '28px', padding: 0 }} onClick={() => setShowAddModal(false)}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-normal)', display: 'block', marginBottom: '5px' }}>Task Title</label>
                <input 
                  type="text" 
                  className="chat-input" 
                  placeholder="e.g. Implement WebSocket reconnect handler"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-normal)', display: 'block', marginBottom: '5px' }}>Description & Prompt Instructions</label>
                <textarea 
                  className="chat-input" 
                  style={{ height: '80px', padding: '8px 12px', resize: 'vertical' }}
                  placeholder="Context and acceptance criteria for the AI agent..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '14px', position: 'relative', zIndex: 50 }}>
                <label style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-normal)', display: 'block', marginBottom: '5px' }}>
                  Linked Channel
                </label>
                <SearchableChannelSelect 
                  channels={channels}
                  selectedChannelId={selectedChannel}
                  onSelectChannel={setSelectedChannel}
                  currentUser={currentUser}
                />
              </div>

              <div style={{ marginBottom: '20px', position: 'relative', zIndex: 1 }}>
                <label style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-normal)', display: 'block', marginBottom: '5px' }}>Assigned AI Agent</label>
                <select 
                  value={selectedAgent} 
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  style={{ background: 'var(--bg-chat-input)', color: 'var(--text-heading)', border: '1px solid var(--border-color)', height: '36px', padding: '0 12px', borderRadius: '7px', width: '100%', fontSize: '13px' }}
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.cliEngine})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
   
 </div>
  );
}

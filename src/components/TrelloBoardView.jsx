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
    <div ref={dropdownRef} className="relative w-full">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 cursor-pointer select-none items-center justify-between rounded-lg border border-line bg-white px-3"
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          {selectedChannel?.isPrivate ? (
            <Lock size={13} className="text-warning shrink-0" />
          ) : (
            <Hash size={14} className="text-ink-muted shrink-0" />
          )}
          <span className="text-[13px] font-medium text-ink-heading truncate">
            {selectedChannel ? selectedChannel.name : 'Select Channel'}
          </span>
          {selectedChannel?.isPrivate && (
            <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-px text-[10px] font-medium text-warning">
              Private
            </span>
          )}
        </div>
        <ChevronDown size={14} className="text-ink-muted shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[999] flex max-h-[200px] flex-col gap-1.5 rounded-lg border border-line-strong bg-white p-1.5 shadow-modal">
          <div className="flex items-center gap-1.5 rounded-md border border-line bg-surface-muted px-2.5 py-1.5">
            <Search size={13} className="text-ink-muted shrink-0" />
            <input 
              type="text" 
              placeholder="Filter channels..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border-none bg-transparent text-xs text-ink-heading outline-none font-sans"
              autoFocus
            />
          </div>

          <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
            {filteredChannels.length === 0 ? (
              <div className="px-2 py-2 text-center text-xs text-ink-muted">
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
                    className={`flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 transition-colors ${
                      isSelected ? 'bg-accent-soft' : 'hover:bg-surface-muted'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {ch.isPrivate ? (
                        <Lock size={13} className="text-warning shrink-0" />
                      ) : (
                        <Hash size={13} className="text-ink-muted shrink-0" />
                      )}
                      <span className={`text-[12.5px] text-ink-heading truncate ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                        {ch.name}
                      </span>
                    </div>
                    {isSelected && <Check size={13} className="text-accent shrink-0" />}
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
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="view-header">
        <div className="header-title">
          <LayoutGrid size={16} className="text-ink-muted" />
          <span>Task Board</span>
          <span className="ml-1 text-xs font-normal text-ink-muted">
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
              className={`kanban-column transition-all duration-150 ${
                isOver ? 'border-dashed border-accent bg-accent-soft' : ''
              }`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={(e) => handleDragLeave(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="column-header">
                <div className="column-title">
                  <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: col.color }} />
                  <span>{col.title}</span>
                </div>
                <span className="column-count">{colCards.length}</span>
              </div>

              <div className="column-cards min-h-[120px]">
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
                      className={`kanban-card cursor-grab ${isRunning ? 'border-accent-mid' : ''} ${isDraggingThis ? 'opacity-45' : ''}`}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, card.id)}
                      onDragEnd={() => { setDraggingCardId(null); setDragOverColId(null); }}
                      onClick={() => onCardClick(card)}
                    >
                      <div className="card-tags">
                        {card.tags?.map((t, idx) => (
                          <span key={idx} className="tag-badge">{t}</span>
                        ))}
                        {linkedChannel && (
                          <span 
                            className={`tag-badge ${
                              linkedChannel.isPrivate
                                ? 'border-amber-200 bg-amber-50 text-warning'
                                : 'border-accent-mid bg-accent-soft text-accent'
                            }`}
                          >
                            {linkedChannel.isPrivate ? <Lock size={9.5} /> : <Hash size={9.5} />}
                            <span>{linkedChannel.name}</span>
                          </span>
                        )}
                        {isRunning && (
                          <span className="tag-badge border-accent-mid bg-accent-soft font-mono text-accent">
                            <Loader2 size={10} className="animate-spin" style={{ animationDuration: '1.5s' }} />
                            <span>{card.activeRun?.status === 'queued' ? 'Queued' : (card.activeRun?.runId || 'Running')}</span>
                          </span>
                        )}
                        {!isRunning && card.lastFailure && (
                          <span className="tag-badge border-red-200 bg-red-50 text-danger">
                            <span>{card.lastFailure.label}</span>
                          </span>
                        )}
                      </div>

                      <div className="card-title">{card.title}</div>
                      {card.description && (
                        <div className="line-clamp-2 text-xs leading-snug text-ink-muted">
                          {card.description}
                        </div>
                      )}

                      {/* AI Agent & Shipping Chips */}
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {assignedAgent && (
                          <div className="agent-chip border border-line-soft bg-surface-muted text-ink">
                            <Bot size={11} color={assignedAgent.color} />
                            <span>{assignedAgent.name}</span>
                          </div>
                        )}
                        {card.shipping?.githubPR && (
                          <div 
                            className="agent-chip border border-accent-mid bg-accent-soft font-mono text-accent"
                            title={`GitHub PR ${card.shipping.githubPR.number} (${card.shipping.githubPR.status})`}
                          >
                            <GitPullRequest size={10.5} />
                            <span>PR {card.shipping.githubPR.number}</span>
                          </div>
                        )}
                        {card.shipping?.vercelDeploy && (
                          <div 
                            className="agent-chip border border-emerald-200 bg-emerald-50 text-success"
                            title={`Vercel ${card.shipping.vercelDeploy.environment}: ${card.shipping.vercelDeploy.status}`}
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

                        <div className="flex items-center gap-2.5 text-[11px] text-ink-muted">
                          {subtasks.length > 0 && (
                            <span className={`flex items-center gap-0.5 ${completedSubtasks === subtasks.length ? 'text-success' : ''}`}>
                              <CheckSquare size={11.5} />
                              {completedSubtasks}/{subtasks.length}
                            </span>
                          )}
                          {card.comments?.length > 0 && (
                            <span className="flex items-center gap-0.5">
                              <MessageSquare size={11.5} />
                              {card.comments.length}
                            </span>
                          )}
                          {card.logs?.length > 0 && (
                            <span className={`flex items-center gap-0.5 ${isRunning ? 'text-accent' : 'text-success'}`}>
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
            className="w-[440px] max-w-[92vw] rounded-xl border border-line bg-white p-6 shadow-modal"
          >
            <div className="mb-[18px] flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-ink-heading">New Task Card</h3>
              <button className="btn btn-secondary h-7 w-7 p-0" onClick={() => setShowAddModal(false)}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="mb-3.5">
                <label className="mb-1.5 block text-[11.5px] font-medium text-ink">Task Title</label>
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

              <div className="mb-3.5">
                <label className="mb-1.5 block text-[11.5px] font-medium text-ink">Description & Prompt Instructions</label>
                <textarea 
                  className="chat-input h-20 resize-y px-3 py-2" 
                  placeholder="Context and acceptance criteria for the AI agent..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>

              <div className="relative z-50 mb-3.5">
                <label className="mb-1.5 block text-[11.5px] font-medium text-ink">
                  Linked Channel
                </label>
                <SearchableChannelSelect 
                  channels={channels}
                  selectedChannelId={selectedChannel}
                  onSelectChannel={setSelectedChannel}
                  currentUser={currentUser}
                />
              </div>

              <div className="relative z-[1] mb-5">
                <label className="mb-1.5 block text-[11.5px] font-medium text-ink">Assigned AI Agent</label>
                <select 
                  value={selectedAgent} 
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="form-input h-9"
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.cliEngine})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2">
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

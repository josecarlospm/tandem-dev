import React, { useState, useEffect, useCallback } from 'react';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import DiscordChatView from './components/DiscordChatView';
import TrelloBoardView from './components/TrelloBoardView';
import TaskThreadDrawer from './components/TaskThreadDrawer';
import CLIAgentsHub from './components/CLIAgentsHub';
import UserManagementModal from './components/UserManagementModal';
import { Sparkles, Terminal, Layers, Plus, Folder, AlertTriangle, LogOut } from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';

export default function App() {
  // --- AUTH STATE ---
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('collab_session_token'));
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  // --- WORKSPACE STATE ---
  const [state, setState] = useState(null);
  const [activeServerId, setActiveServerId] = useState('s1');
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'board' | 'agents'
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeChannel, setActiveChannel] = useState(null);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'board') {
      setIsSidebarCollapsed(true);
    } else {
      setIsSidebarCollapsed(false);
    }
  };
  const [activeDM, setActiveDM] = useState(null);
  const [activeCard, setActiveCard] = useState(null);
  const [showAddServerModal, setShowAddServerModal] = useState(false);
  const [showUserManagementModal, setShowUserManagementModal] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  const [errorToast, setErrorToast] = useState(null);
  const [ws, setWs] = useState(null);

  // --- AUTH: Restore session on mount ---
  useEffect(() => {
    const storedToken = localStorage.getItem('collab_session_token');
    if (storedToken) {
      fetch(`${API_BASE}/api/auth/me?token=${storedToken}`)
        .then(res => {
          if (!res.ok) throw new Error('Session expired');
          return res.json();
        })
        .then(data => {
          setCurrentUser(data.user);
          setAuthToken(storedToken);
          setAuthLoading(false);
        })
        .catch(() => {
          localStorage.removeItem('collab_session_token');
          setAuthToken(null);
          setCurrentUser(null);
          setAuthLoading(false);
        });
    } else {
      setAuthLoading(false);
    }
  }, []);

  // --- AUTH: Login ---
  const handleLogin = useCallback(async (email, password) => {
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Login failed.');
        return;
      }
      localStorage.setItem('collab_session_token', data.token);
      setAuthToken(data.token);
      setCurrentUser(data.user);
    } catch (err) {
      setAuthError('Cannot reach server. Is the backend running?');
    }
  }, []);

  // --- AUTH: Logout ---
  const handleLogout = useCallback(async () => {
    if (authToken) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: authToken })
        });
      } catch (e) { /* ignore */ }
    }
    localStorage.removeItem('collab_session_token');
    setAuthToken(null);
    setCurrentUser(null);
    setState(null);
    if (ws) ws.close();
    setWs(null);
  }, [authToken, ws]);

  // --- WEBSOCKET: Connect only when authenticated ---
  useEffect(() => {
    if (!authToken || !currentUser) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname === 'localhost' ? 'localhost:3001' : window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    console.log('[App] Connecting WebSocket to:', wsUrl);
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('[App] Connected to backend WebSocket server');
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, payload } = msg;

        if (type === 'init_state') {
          setState(payload);
          setActiveServerId(payload.activeServerId || 's1');
          setActiveChannel(payload.channels['s1']?.[0] || null);
        }

        if (type === 'users_updated') {
          setState(prev => {
            if (!prev) return prev;
            return { ...prev, users: payload };
          });
          // Keep currentUser in sync (e.g. after role change or profile update)
          const updatedSelf = payload.find(u => u.id === currentUser.id);
          if (updatedSelf) setCurrentUser(updatedSelf);
        }

        if (type === 'error_notification') {
          setErrorToast(payload.message);
          setTimeout(() => setErrorToast(null), 4000);
        }

        if (type === 'user_typing') {
          const { channelId, userId, userName } = payload;
          setTypingUsers(prev => {
            const chTyping = prev[channelId] || {};
            return {
              ...prev,
              [channelId]: { ...chTyping, [userId]: { id: userId, name: userName } }
            };
          });

          setTimeout(() => {
            setTypingUsers(prev => {
              const chTyping = { ...(prev[channelId] || {}) };
              delete chTyping[userId];
              return { ...prev, [channelId]: chTyping };
            });
          }, 3000);
        }

        if (type === 'thread_reply_added') {
          const { parentMessageId, threadReply, messageThreads } = payload;
          setState(prev => {
            if (!prev) return prev;
            return { ...prev, messageThreads };
          });
        }

        if (type === 'unread_counts_updated') {
          setState(prev => {
            if (!prev) return prev;
            return { ...prev, unreadCounts: payload };
          });
        }

        if (type === 'system_env_updated') {
          const { systemEnv, agents } = payload;
          setState(prev => {
            if (!prev) return prev;
            return { ...prev, systemEnv, agents };
          });
        }

        if (type === 'integrations_updated') {
          const { integrations, deployments } = payload;
          setState(prev => {
            if (!prev) return prev;
            return { ...prev, integrations, deployments };
          });
        }

        if (type === 'harness_updated') {
          const { harnessConfig, skills, quickActions } = payload;
          setState(prev => {
            if (!prev) return prev;
            return { ...prev, harnessConfig, skills, quickActions };
          });
        }

        if (type === 'new_message') {
          const { channelId, message } = payload;
          setState(prev => {
            if (!prev) return prev;
            const updatedMsgs = { ...prev.messages };
            if (!updatedMsgs[channelId]) updatedMsgs[channelId] = [];
            updatedMsgs[channelId] = [...updatedMsgs[channelId], message];
            return { ...prev, messages: updatedMsgs };
          });
        }

        if (type === 'server_created') {
          const { server, channels } = payload;
          setState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              servers: [...prev.servers, server],
              channels: { ...prev.channels, [server.id]: channels }
            };
          });
        }

        if (type === 'channel_created') {
          const { serverId, channel } = payload;
          setState(prev => {
            if (!prev) return prev;
            const updatedChannels = { ...prev.channels };
            if (!updatedChannels[serverId]) updatedChannels[serverId] = [];
            updatedChannels[serverId] = [...updatedChannels[serverId], channel];
            const updatedMsgs = { ...prev.messages, [channel.id]: [] };
            return { ...prev, channels: updatedChannels, messages: updatedMsgs };
          });
        }

        if (type === 'channel_updated') {
          const { serverId, channel } = payload;
          setState(prev => {
            if (!prev) return prev;
            const updatedChannels = { ...prev.channels };
            if (updatedChannels[serverId]) {
              updatedChannels[serverId] = updatedChannels[serverId].map(c => c.id === channel.id ? channel : c);
            }
            return { ...prev, channels: updatedChannels };
          });
          setActiveChannel(prev => (prev && prev.id === channel.id) ? channel : prev);
        }

        if (type === 'agent_updated') {
          setState(prev => {
            if (!prev) return prev;
            const updatedAgents = prev.agents.map(a => a.id === payload.id ? payload : a);
            return { ...prev, agents: updatedAgents };
          });
        }

        if (type === 'card_updated') {
          setState(prev => {
            if (!prev) return prev;
            const updatedCards = prev.cards.map(c => c.id === payload.id ? payload : c);
            return { ...prev, cards: updatedCards };
          });

          setActiveCard(prev => (prev && prev.id === payload.id) ? payload : prev);
        }

        if (type === 'card_created') {
          setState(prev => {
            if (!prev) return prev;
            return { ...prev, cards: [...prev.cards, payload] };
          });
        }

        if (type === 'card_log_stream') {
          const { cardId, logLine, activeRun } = payload;
          setState(prev => {
            if (!prev) return prev;
            const updatedCards = prev.cards.map(c => {
              if (c.id === cardId) {
                return {
                  ...c,
                  logs: [...(c.logs || []), logLine],
                  activeRun: activeRun !== undefined ? activeRun : c.activeRun
                };
              }
              return c;
            });
            return { ...prev, cards: updatedCards };
          });

          setActiveCard(prev => {
            if (prev && prev.id === cardId) {
              return {
                ...prev,
                logs: [...(prev.logs || []), logLine],
                activeRun: activeRun !== undefined ? activeRun : prev.activeRun
              };
            }
            return prev;
          });
        }

        if (type === 'agent_status_change') {
          const { agentId, status } = payload;
          setState(prev => {
            if (!prev) return prev;
            const updatedAgents = prev.agents.map(a => a.id === agentId ? { ...a, status } : a);
            return { ...prev, agents: updatedAgents };
          });
        }

      } catch (err) {
        console.error('[WS Client Error]', err);
      }
    };

    setWs(socket);

    return () => socket.close();
  }, [authToken, currentUser?.id]);

  const sendWS = (type, payload) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  };

  const handleSendMessage = (text) => {
    const targetChannelId = activeDM ? activeDM.id : activeChannel.id;
    sendWS('send_chat_message', {
      channelId: targetChannelId,
      senderId: currentUser.id,
      senderType: 'user',
      content: text
    });
  };

  const handleSendThreadReply = (parentMessageId, channelId, content) => {
    sendWS('send_thread_reply', {
      parentMessageId,
      channelId,
      senderId: currentUser.id,
      senderType: 'user',
      content
    });
  };

  const handleTyping = (channelId, user) => {
    sendWS('user_typing', { channelId, userId: user.id, userName: user.name });
  };

  const handleMarkRead = (targetId) => {
    sendWS('mark_read', { targetId });
    setState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        unreadCounts: { ...(prev.unreadCounts || {}), [targetId]: 0 }
      };
    });
  };

  const handleCreateUser = (userData) => {
    sendWS('create_user', { ...userData, requesterId: currentUser.id });
  };

  const handleDeleteUser = (targetUserId) => {
    sendWS('delete_user', { targetUserId, requesterId: currentUser.id });
  };

  const handleCreateServer = (e) => {
    e.preventDefault();
    if (!newServerName.trim()) return;
    sendWS('create_server', { name: newServerName, icon: 'Folder', color: '#8b5cf6' });
    setNewServerName('');
    setShowAddServerModal(false);
  };

  const handleCreateChannel = (channelData) => {
    sendWS('create_channel', { ...channelData, serverId: activeServerId, creatorId: currentUser.id });
  };

  const handleAddChannelMember = (channelId, memberId) => {
    sendWS('add_channel_member', { serverId: activeServerId, channelId, memberId, requesterId: currentUser.id });
  };

  const handleRemoveChannelMember = (channelId, memberId) => {
    sendWS('remove_channel_member', { serverId: activeServerId, channelId, memberId, requesterId: currentUser.id });
  };

  const handleConvertMessageToTask = (messageId, channelId, title, assignedAgentId) => {
    sendWS('convert_message_to_task', {
      messageId,
      channelId,
      serverId: activeServerId,
      title,
      assignedAgentId,
      requesterId: currentUser.id
    });
  };

  const handleMoveCard = (cardId, newColumnId) => {
    sendWS('move_card', { cardId, newColumnId });
  };

  const handleUpdateCard = (cardData) => {
    sendWS('update_card', cardData);
  };

  const handleCreateCard = (cardData) => {
    sendWS('create_card', { ...cardData, serverId: activeServerId });
  };

  const handleAddCardComment = (cardId, text, steer = false) => {
    sendWS('add_card_comment', {
      cardId,
      senderId: currentUser.id,
      senderType: 'user',
      text,
      steer
    });
  };

  const handleTriggerAgent = (cardId, agentId, prompt) => {
    sendWS('trigger_agent_card_execution', { cardId, agentId, prompt, requesterId: currentUser.id });
  };

  const handleSteerCardRun = (cardId, content) => {
    sendWS('steer_card_run', { cardId, senderId: currentUser.id, content });
  };

  const handleCancelCardRun = (cardId) => {
    sendWS('cancel_card_run', { cardId, requesterId: currentUser.id });
  };

  const handleRunQuickAction = (quickActionId, cardId) => {
    sendWS('run_quick_action', { quickActionId, cardId, requesterId: currentUser.id });
  };

  const handleUpdateHarnessConfig = (config) => {
    sendWS('update_harness_config', { config, requesterId: currentUser.id });
  };

  const handleUpsertSkill = (skillPayload) => {
    sendWS('upsert_skill', { ...skillPayload, requesterId: currentUser.id });
  };

  const handleDeleteSkill = (id) => {
    sendWS('delete_skill', { id, requesterId: currentUser.id });
  };

  const handleToggleAgentSkill = (skillId, agentId) => {
    sendWS('toggle_agent_skill', { skillId, agentId, requesterId: currentUser.id });
  };

  const handleUpsertQuickAction = (qaPayload) => {
    sendWS('upsert_quick_action', { ...qaPayload, requesterId: currentUser.id });
  };

  const handleDeleteQuickAction = (id) => {
    sendWS('delete_quick_action', { id, requesterId: currentUser.id });
  };

  const handleUpdateAgentConfig = (agentId, config) => {
    sendWS('update_agent_config', { agentId, ...config, requesterId: currentUser.id });
  };

  const handleValidateAgentCLI = (agentId) => {
    sendWS('validate_agent_cli', { agentId });
  };

  const handleRescanSystemTools = () => {
    sendWS('rescan_system_tools', {});
  };

  const handleUpdateIntegrationConfig = (provider, config) => {
    sendWS('update_integration_config', { provider, config, requesterId: currentUser.id });
  };

  const handleTestIntegrationConnection = (provider) => {
    sendWS('test_integration_connection', { provider });
  };

  const handleShipCardToGitHub = (cardId, branchName, prTitle) => {
    sendWS('ship_card_to_github', { cardId, branchName, prTitle, requesterId: currentUser.id });
  };

  const handleDeployCardToVercel = (cardId, environment = 'Preview') => {
    sendWS('deploy_card_to_vercel', { cardId, environment, requesterId: currentUser.id });
  };

  const handleMergeGitHubPR = (cardId) => {
    sendWS('merge_github_pr', { cardId, requesterId: currentUser.id });
  };

  // --- RENDER: Auth Loading State ---
  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-root)', color: 'var(--text-normal)' }}>
        <div style={{ textAlign: 'center' }}>
          <Layers size={28} color="var(--accent-primary)" style={{ marginBottom: '12px', opacity: 0.9 }} />
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-heading)', letterSpacing: '-0.01em' }}>Restoring Session</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '4px' }}>Authenticating with workspace services...</p>
        </div>
      </div>
    );
  }

  // --- RENDER: Login Screen (Not Authenticated) ---
  if (!authToken || !currentUser) {
    return <LoginScreen onLogin={handleLogin} errorMessage={authError} />;
  }

  // --- RENDER: Workspace Loading (Waiting for WS state) ---
  if (!state) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-root)', color: 'var(--text-normal)' }}>
        <div style={{ textAlign: 'center' }}>
          <Layers size={28} color="var(--accent-primary)" style={{ marginBottom: '12px', opacity: 0.9 }} />
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-heading)', letterSpacing: '-0.01em' }}>Loading Workspace</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '4px' }}>Welcome back, <strong style={{ color: 'var(--text-heading)', fontWeight: 500 }}>{currentUser.name}</strong></p>
        </div>
      </div>
    );
  }

  // --- RENDER: Main Workspace ---
  const activeServer = state.servers.find(s => s.id === activeServerId) || state.servers[0];
  const activeServerCards = state.cards.filter(c => c.serverId === activeServerId || !c.serverId);

  const getServerIconComponent = (iconName, isActive) => {
    const iconColor = isActive ? '#ffffff' : 'currentColor';
    if (iconName === 'Terminal') return <Terminal size={17} color={iconColor} />;
    if (iconName === 'Layers') return <Layers size={17} color={iconColor} />;
    if (iconName === 'Folder') return <Folder size={17} color={iconColor} />;
    return <Sparkles size={17} color={iconColor} />;
  };

  return (
    <div className="app-container" style={{ position: 'relative' }}>
      {/* Global Error Toast Notification */}
      {errorToast && (
        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 9999, background: '#18181c', color: 'var(--text-heading)', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '10px 16px', borderRadius: '8px', boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px', fontWeight: 500 }}>
          <AlertTriangle size={15} color="var(--accent-danger)" />
          <span>{errorToast}</span>
        </div>
      )}

      {/* Workspace Switcher Rail */}
      <div className="server-dock">
        {state.servers.map(server => {
          const isActive = activeServerId === server.id;
          return (
            <div 
              key={server.id}
              className={`server-icon ${isActive ? 'active' : ''}`}
              title={server.name}
              onClick={() => {
                setActiveServerId(server.id);
                const firstCh = state.channels[server.id]?.[0];
                if (firstCh) {
                  setActiveChannel(firstCh);
                  setActiveDM(null);
                  handleMarkRead(firstCh.id);
                }
              }}
            >
              {getServerIconComponent(server.icon, isActive)}
            </div>
          );
        })}

        {/* Add Server Button */}
        <div 
          className="server-icon"
          title="Create New Workspace"
          style={{ background: 'transparent', border: '1px dashed var(--border-strong)' }}
          onClick={() => setShowAddServerModal(true)}
        >
          <Plus size={16} />
        </div>

        {/* Logout Button at bottom of dock */}
        <div style={{ marginTop: 'auto' }}>
          <div 
            className="server-icon"
            title={`Sign Out (${currentUser.name})`}
            style={{ background: 'transparent' }}
            onClick={handleLogout}
          >
            <LogOut size={16} color="var(--text-muted)" />
          </div>
        </div>
      </div>

      {/* Main Sidebar */}
      <Sidebar 
        state={state}
        activeServer={activeServer}
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        activeChannel={activeChannel}
        setActiveChannel={setActiveChannel}
        activeDM={activeDM}
        setActiveDM={setActiveDM}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        unreadCounts={state.unreadCounts || {}}
        onMarkRead={handleMarkRead}
        onOpenCard={(card) => setActiveCard(card)}
        onOpenUserManagement={() => setShowUserManagementModal(true)}
        onCreateChannel={handleCreateChannel}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div className="main-view">
        {activeTab === 'chat' && (
          <DiscordChatView 
            channel={activeChannel}
            activeDM={activeDM}
            messages={state.messages[activeDM ? activeDM.id : activeChannel?.id] || []}
            messageThreads={state.messageThreads || {}}
            users={state.users}
            agents={state.agents}
            currentUser={currentUser}
            typingUsers={typingUsers}
            onSendMessage={handleSendMessage}
            onSendThreadReply={handleSendThreadReply}
            onTyping={handleTyping}
            onAddChannelMember={handleAddChannelMember}
            onRemoveChannelMember={handleRemoveChannelMember}
            onConvertMessageToTask={handleConvertMessageToTask}
            onTriggerAgent={(agentId, prompt) => {
              const agent = state.agents.find(a => a.id === agentId);
              sendWS('send_chat_message', {
                channelId: activeDM ? activeDM.id : activeChannel.id,
                senderId: currentUser.id,
                senderType: 'user',
                content: `@${agent?.name} please run task: ${prompt}`
              });
            }}
          />
        )}

        {activeTab === 'board' && (
          <TrelloBoardView 
            columns={state.columns}
            cards={activeServerCards}
            users={state.users}
            agents={state.agents}
            channels={state.channels[activeServerId] || []}
            activeServerId={activeServerId}
            currentUser={currentUser}
            onCardClick={(card) => setActiveCard(card)}
            onMoveCard={handleMoveCard}
            onCreateCard={handleCreateCard}
            onTriggerAgent={(cardId, agentId, prompt) => handleTriggerAgent(cardId, agentId, prompt)}
          />
        )}

        {activeTab === 'agents' && (
          <CLIAgentsHub 
            systemEnv={state.systemEnv}
            agents={state.agents} 
            harnessConfig={state.harnessConfig || {}}
            skills={state.skills || []}
            quickActions={state.quickActions || []}
            integrations={state.integrations}
            deployments={state.deployments || []}
            currentUser={currentUser}
            onUpdateAgentConfig={handleUpdateAgentConfig}
            onValidateAgentCLI={handleValidateAgentCLI}
            onRescanSystemTools={handleRescanSystemTools}
            onUpdateHarnessConfig={handleUpdateHarnessConfig}
            onUpsertSkill={handleUpsertSkill}
            onDeleteSkill={handleDeleteSkill}
            onToggleAgentSkill={handleToggleAgentSkill}
            onUpsertQuickAction={handleUpsertQuickAction}
            onDeleteQuickAction={handleDeleteQuickAction}
            onUpdateIntegrationConfig={handleUpdateIntegrationConfig}
            onTestIntegrationConnection={handleTestIntegrationConnection}
            onDeployWorkspaceToVercel={(env) => handleDeployCardToVercel(null, env)}
          />
        )}

        {/* Task Detail Drawer */}
        {activeCard && (
          <TaskThreadDrawer 
            card={activeCard}
            columns={state.columns}
            users={state.users}
            agents={state.agents}
            skills={state.skills || []}
            quickActions={state.quickActions || []}
            integrations={state.integrations}
            currentUser={currentUser}
            onClose={() => setActiveCard(null)}
            onMoveCard={handleMoveCard}
            onUpdateCard={handleUpdateCard}
            onAddComment={handleAddCardComment}
            onTriggerAgent={(cardId, agentId, prompt) => handleTriggerAgent(cardId, agentId, prompt)}
            onSteerCardRun={handleSteerCardRun}
            onCancelCardRun={handleCancelCardRun}
            onRunQuickAction={handleRunQuickAction}
            onShipToGitHub={handleShipCardToGitHub}
            onDeployToVercel={handleDeployCardToVercel}
            onMergeGitHubPR={handleMergeGitHubPR}
            onOpenAgentsHub={() => {
              setActiveCard(null);
              setActiveTab('agents');
            }}
          />
        )}

        {/* Create Server Modal */}
        {showAddServerModal && (
          <div className="task-drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAddServerModal(false); }}>
            <div style={{ background: '#141418', padding: '24px', borderRadius: '12px', width: '400px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)' }}>
              <h3 style={{ color: 'var(--text-heading)', fontSize: '15px', fontWeight: 600, marginBottom: '16px', letterSpacing: '-0.01em' }}>Create New Workspace</h3>
              <form onSubmit={handleCreateServer}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Workspace Name</label>
                  <input 
                    type="text" 
                    className="chat-input" 
                    placeholder="e.g. Frontend Team, QA Automation..."
                    value={newServerName}
                    onChange={(e) => setNewServerName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddServerModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Create Workspace</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* User Management & RBAC Modal */}
        {showUserManagementModal && (
          <UserManagementModal 
            currentUser={currentUser}
            users={state.users}
            onClose={() => setShowUserManagementModal(false)}
            onCreateUser={handleCreateUser}
            onDeleteUser={handleDeleteUser}
          />
        )}
      </div>
    </div>
  );
}

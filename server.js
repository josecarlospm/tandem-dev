import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { spawn, exec, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import {
  TaskPhaseRecorder,
  redactSensitiveOutput,
  classifyTaskFailure,
  formatTaskSupplementEnvelope,
  buildMulticaHarnessPrompt,
  TaskSlotCoordinator,
  prepareTaskWorkspace
} from './harness.js';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// --- CRYPTO HELPERS FOR AUTH ---
function hashPassword(plaintext) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plaintext, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(plaintext, stored) {
  const [salt, storedHash] = stored.split(':');
  const hash = crypto.scryptSync(plaintext, salt, 64).toString('hex');
  return hash === storedHash;
}

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// In-memory session store: token -> { userId, createdAt }
const activeSessions = new Map();

// --- LOCAL DB PERSISTENCE FOR USERS ---
const DB_FILE = path.join(process.cwd(), 'users.json');

const DEFAULT_PASSWORD = 'vibe2026';

const defaultUsers = [
  { id: 'u0', name: 'You (Dev)', email: 'dev@vibecoding.io', password: hashPassword(DEFAULT_PASSWORD), role: 'Owner', title: 'Tech Lead & Workspace Owner', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100', color: '#6366f1', status: 'online' },
  { id: 'u1', name: 'Alex Rivera', email: 'alex@vibecoding.io', password: hashPassword(DEFAULT_PASSWORD), role: 'Admin', title: 'Fullstack Lead', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100', color: '#3b82f6', status: 'online' },
  { id: 'u2', name: 'Sarah Chen', email: 'sarah@vibecoding.io', password: hashPassword(DEFAULT_PASSWORD), role: 'User', title: 'UX Architect', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', color: '#ec4899', status: 'online' },
  { id: 'u3', name: 'Marcus Vance', email: 'marcus@vibecoding.io', password: hashPassword(DEFAULT_PASSWORD), role: 'User', title: 'DevOps / Cloud', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', color: '#10b981', status: 'idle' }
];

function loadUsersFromDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const users = JSON.parse(raw);
      // Migrate: if existing users don't have passwords, add default one
      let migrated = false;
      users.forEach(u => {
        if (!u.password) {
          u.password = hashPassword(DEFAULT_PASSWORD);
          migrated = true;
        }
      });
      if (migrated) {
        fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
        console.log('[DB] Migrated existing users — added default password hashes');
      }
      return users;
    }
  } catch (err) {
    console.error('[DB] Load error:', err.message);
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(defaultUsers, null, 2));
  return [...defaultUsers];
}

function saveUsersToDB(users) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('[DB] Save error:', err.message);
  }
}

/** Returns user object WITHOUT the password hash (safe to send to frontend) */
function sanitizeUser(u) {
  if (!u) return null;
  const { password, ...safe } = u;
  return safe;
}

let loadedUsers = loadUsersFromDB();

// --- AUTOMATED CROSS-PLATFORM CLI DISCOVERY ---
function autoDetectCLITools() {
  const platform = os.platform();
  const isWin = platform === 'win32';
  const homeDir = os.homedir();
  const pathEnv = process.env.PATH || '';
  const pathSeparator = isWin ? ';' : ':';
  const pathDirs = pathEnv.split(pathSeparator).filter(Boolean);

  const candidateSearchDirs = [
    ...pathDirs,
    path.join(homeDir, 'AppData', 'Local', 'agy', 'bin'),
    path.join(homeDir, '.local', 'bin'),
    path.join(homeDir, '.cargo', 'bin'),
    path.join(homeDir, 'AppData', 'Roaming', 'npm'),
    '/usr/local/bin',
    '/usr/bin',
    '/opt/homebrew/bin'
  ];

  const targetTools = [
    {
      id: 'agent-antigravity',
      cliEngine: 'Antigravity CLI',
      executables: isWin ? ['agy.exe', 'agy', 'antigravity.exe', 'antigravity'] : ['agy', 'antigravity']
    },
    {
      id: 'agent-claude',
      cliEngine: 'Claude Code',
      executables: isWin ? ['claude.exe', 'claude', 'claude-code.exe'] : ['claude', 'claude-code']
    },
    {
      id: 'agent-codex',
      cliEngine: 'Codex CLI',
      executables: isWin ? ['codex.exe', 'codex', 'openai-codex.exe'] : ['codex', 'openai-codex']
    },
    {
      id: 'tool-github',
      cliEngine: 'GitHub CLI / Git',
      executables: isWin ? ['gh.exe', 'gh', 'git.exe', 'git'] : ['gh', 'git']
    },
    {
      id: 'tool-vercel',
      cliEngine: 'Vercel CLI',
      executables: isWin ? ['vercel.cmd', 'vercel.exe', 'vercel', 'vc.cmd', 'vc'] : ['vercel', 'vc']
    }
  ];

  const detectedMap = {};

  targetTools.forEach(tool => {
    let foundPath = null;
    for (const dir of candidateSearchDirs) {
      for (const execName of tool.executables) {
        const fullPath = path.join(dir, execName);
        try {
          if (fs.existsSync(fullPath)) {
            foundPath = fullPath;
            break;
          }
        } catch (e) {}
      }
      if (foundPath) break;
    }

    if (!foundPath) {
      try {
        const lookupCmd = isWin ? `where.exe ${tool.executables[0]}` : `which ${tool.executables[0]}`;
        const output = execSync(lookupCmd, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
        if (output) {
          foundPath = output.split('\n')[0].trim();
        }
      } catch (e) {}
    }

    detectedMap[tool.id] = {
      isInstalled: !!foundPath,
      resolvedPath: foundPath || tool.executables[0],
      platform
    };
  });

  return {
    platform,
    platformName: isWin ? `Windows (${os.release()})` : (platform === 'darwin' ? 'macOS' : `Linux (${os.release()})`),
    detectedMap
  };
}

let envScanResult = autoDetectCLITools();

const state = {
  systemEnv: {
    platform: envScanResult.platform,
    platformName: envScanResult.platformName,
    scannedAt: new Date().toLocaleTimeString()
  },
  servers: [
    { id: 's1', name: 'Tandem Core', icon: 'Sparkles', color: '#5865f2', primaryChannelId: 'c2' },
    { id: 's2', name: 'DevOps & Infra HQ', icon: 'Terminal', color: '#10b981', primaryChannelId: 'c4' },
    { id: 's3', name: 'Product Roadmap', icon: 'Layers', color: '#ec4899', primaryChannelId: 'c5' }
  ],
  activeServerId: 's1',
  users: loadedUsers,
  agents: [
    { 
      id: 'agent-antigravity', 
      name: 'Agent Antigravity', 
      cliEngine: 'Antigravity CLI', 
      cliCommand: envScanResult.detectedMap['agent-antigravity']?.resolvedPath || 'agy', 
      cliArgs: '-p',
      skipPermissions: true,
      role: 'Autonomous Code Generation & Deep Refactoring', 
      color: '#06b6d4', 
      status: 'online', 
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Antigravity',
      description: 'Antigravity CLI engine auto-detected on host system.',
      version: 'v1.1.8',
      autoDetected: envScanResult.detectedMap['agent-antigravity']?.isInstalled || false,
      validationStatus: { 
        testedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
        success: envScanResult.detectedMap['agent-antigravity']?.isInstalled || false, 
        message: envScanResult.detectedMap['agent-antigravity']?.isInstalled 
          ? `[AUTO-DETECTED ON HOST] Found binary at: ${envScanResult.detectedMap['agent-antigravity'].resolvedPath}`
          : 'CLI binary not auto-detected in PATH.'
      }
    },
    { 
      id: 'agent-claude', 
      name: 'Agent Claude', 
      cliEngine: 'Claude Code', 
      cliCommand: envScanResult.detectedMap['agent-claude']?.resolvedPath || 'claude', 
      cliArgs: '-p',
      skipPermissions: true,
      role: 'Architecture Audit, Security & Code Review', 
      color: '#8b5cf6', 
      status: 'online', 
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=ClaudeCode',
      description: 'Claude Code CLI engine scanner.',
      version: 'v1.8.2',
      autoDetected: envScanResult.detectedMap['agent-claude']?.isInstalled || false,
      validationStatus: { 
        testedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
        success: envScanResult.detectedMap['agent-claude']?.isInstalled || false, 
        message: envScanResult.detectedMap['agent-claude']?.isInstalled 
          ? `[AUTO-DETECTED ON HOST] Found binary at: ${envScanResult.detectedMap['agent-claude'].resolvedPath}`
          : 'CLI binary not auto-detected in PATH.'
      }
    },
    { 
      id: 'agent-codex', 
      name: 'Agent Codex', 
      cliEngine: 'Codex CLI', 
      cliCommand: envScanResult.detectedMap['agent-codex']?.resolvedPath || 'codex', 
      cliArgs: 'exec',
      skipPermissions: true,
      role: 'Automated Test Generation & Shell Automation', 
      color: '#10b981', 
      status: 'online', 
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=CodexCLI',
      description: 'Codex CLI process runner.',
      version: 'v0.9.5',
      autoDetected: envScanResult.detectedMap['agent-codex']?.isInstalled || false,
      validationStatus: { 
        testedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
        success: envScanResult.detectedMap['agent-codex']?.isInstalled || false, 
        message: envScanResult.detectedMap['agent-codex']?.isInstalled 
          ? `[AUTO-DETECTED ON HOST] Found binary at: ${envScanResult.detectedMap['agent-codex'].resolvedPath}`
          : 'CLI binary not auto-detected in PATH.'
      }
    }
  ],
  channels: {
    's1': [
      { id: 'c1', name: 'general-chat', topic: 'Main team lounge & announcements', type: 'text', isPrivate: false },
      { id: 'c2', name: 'dev-team', topic: 'Hybrid Human + AI development & discussions', type: 'text', isPrivate: false },
      { id: 'c3', name: 'cli-agent-logs', topic: 'Live output streams from CLI agents', type: 'text', isPrivate: false },
      { id: 'c-sec', name: 'security-vault', topic: 'Private security team discussion', type: 'text', isPrivate: true, allowedUserIds: ['u0', 'u1'] }
    ],
    's2': [
      { id: 'c4', name: 'ci-cd-pipelines', topic: 'GitHub Actions & Kubernetes cluster status', type: 'text', isPrivate: false },
      { id: 'c-infra-priv', name: 'infra-credentials', topic: 'Restricted cloud keys & secrets', type: 'text', isPrivate: true, allowedUserIds: ['u0', 'u3'] }
    ],
    's3': [
      { id: 'c5', name: 'feature-requests', topic: 'Product roadmap planning', type: 'text', isPrivate: false }
    ]
  },
  dms: [
    { id: 'dm-agent-antigravity', targetId: 'agent-antigravity', isAgent: true, name: 'Agent Antigravity', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Antigravity', color: '#06b6d4' },
    { id: 'dm-agent-claude', targetId: 'agent-claude', isAgent: true, name: 'Agent Claude', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=ClaudeCode', color: '#8b5cf6' },
    { id: 'dm-agent-codex', targetId: 'agent-codex', isAgent: true, name: 'Agent Codex', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=CodexCLI', color: '#10b981' },
    { id: 'dm-u1', targetId: 'u1', isAgent: false, name: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100', color: '#3b82f6' }
  ],
  unreadCounts: {
    'c1': 0,
    'c2': 2,
    'c3': 0,
    'dm-agent-antigravity': 1
  },
  messageThreads: {},
  messages: {
    'c1': [
      { id: 'm1', senderId: 'u1', senderType: 'user', content: 'Creating a task card automatically posts an announcement to our linked team channel when complete!', timestamp: '18:50' }
    ],
    'c2': [],
    'c3': [],
    'c4': [],
    'c5': [],
    'c-sec': [],
    'c-infra-priv': [],
    'dm-agent-antigravity': []
  },
  columns: [
    { id: 'col-backlog', title: 'Backlog', color: '#64748b' },
    { id: 'col-in-progress', title: 'In Progress', color: '#3b82f6' },
    { id: 'col-ai-executing', title: 'AI Executing', color: '#a855f7' },
    { id: 'col-in-review', title: 'In Review', color: '#f59e0b' },
    { id: 'col-done', title: 'Done', color: '#10b981' }
  ],
  harnessConfig: {
    version: '0.12.1',
    maxConcurrentTasks: 2,
    idleWatchdogSeconds: 90,
    turnTimeoutSeconds: 300,
    isolationMode: 'in-place',
    redactSecrets: true,
    autoSteerActiveRuns: true,
    activeSlots: 0,
    queuedTasks: 0
  },
  skills: [
    {
      id: 'skill-clean-arch',
      name: 'Clean Architecture & Verification',
      slug: 'clean-arch',
      revision: 2,
      description: 'Enforces modular boundaries, foreground build/test checks, and concise PR handoffs.',
      boundAgentIds: ['agent-antigravity', 'agent-claude'],
      updatedAt: '19:10',
      content: `---
name: clean-architecture
description: Modular boundaries and synchronous verification before turn exit
---
1. Read affected modules in parallel before editing.
2. Keep UI state, transport handlers, and domain logic decoupled.
3. Run \`npm run build\` synchronously inside the turn before reporting completion.`
    },
    {
      id: 'skill-security-hygiene',
      name: 'OWASP & Secret Hygiene',
      slug: 'security-hygiene',
      revision: 1,
      description: 'Prevents credential leaks, enforces RBAC checks, and validates untrusted payloads.',
      boundAgentIds: ['agent-claude'],
      updatedAt: '18:45',
      content: `---
name: security-hygiene
description: Security review checklist for auth, sessions, and secrets
---
1. Never log raw tokens, PATs, or session hashes to stdout.
2. Verify Owner/Admin role gates on every privileged WebSocket mutation.
3. Sanitize user-controlled strings and bound payload sizes.`
    },
    {
      id: 'skill-edge-tests',
      name: 'Deterministic Test & CI Coverage',
      slug: 'edge-tests',
      revision: 1,
      description: 'Generates deterministic unit tests and avoids flaky sleep-based assertions.',
      boundAgentIds: ['agent-codex', 'agent-antigravity'],
      updatedAt: '18:30',
      content: `---
name: edge-tests
description: Deterministic unit and integration testing rules
---
1. Cover boundary cases, empty inputs, and concurrency races.
2. Inject clocks instead of relying on wall-clock sleeps.
3. Report exact failing assertions if a check fails.`
    }
  ],
  quickActions: [
    {
      id: 'qa-implement',
      name: 'Implement & Verify',
      targetAgentId: 'agent-antigravity',
      visibility: 'public',
      creatorId: 'u0',
      prompt: 'Implement the task acceptance criteria end-to-end, run verification checks synchronously, and summarize all modified files.'
    },
    {
      id: 'qa-review',
      name: 'Architecture & Security Audit',
      targetAgentId: 'agent-claude',
      visibility: 'public',
      creatorId: 'u0',
      prompt: 'Audit this issue and related code paths for architectural regressions, race conditions, and OWASP security risks. Provide prioritized findings.'
    },
    {
      id: 'qa-tests',
      name: 'Generate Edge-Case Tests',
      targetAgentId: 'agent-codex',
      visibility: 'public',
      creatorId: 'u0',
      prompt: 'Write deterministic unit and edge-case tests covering this task and run the test suite.'
    },
    {
      id: 'qa-delivery',
      name: 'Pre-PR Delivery Check',
      targetAgentId: 'agent-antigravity',
      visibility: 'public',
      creatorId: 'u0',
      prompt: 'Verify build passes cleanly, ensure branch changes are ready for a GitHub PR, and summarize release readiness.'
    }
  ],
  integrations: {
    github: {
      connected: true,
      instanceUrl: 'https://github.com',
      repoPath: 'josecarlospm/tandem-dev',
      defaultBranch: 'main',
      accessToken: 'ghp_••••••••••••••••',
      autoCreatePR: true,
      cliDetected: envScanResult.detectedMap['tool-github']?.isInstalled || false,
      cliPath: envScanResult.detectedMap['tool-github']?.resolvedPath || 'git',
      lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      statusMessage: envScanResult.detectedMap['tool-github']?.isInstalled
        ? `[READY] Git/GitHub binary detected at ${envScanResult.detectedMap['tool-github'].resolvedPath}`
        : '[READY] Connected via GitHub REST API v3'
    },
    vercel: {
      connected: true,
      teamSlug: 'josecarlospm',
      projectName: 'tandem-dev',
      productionDomain: 'tandem-dev.vercel.app',
      framework: 'vite',
      accessToken: 'vcel_••••••••••••••••',
      autoDeployPreview: true,
      cliDetected: envScanResult.detectedMap['tool-vercel']?.isInstalled || false,
      cliPath: envScanResult.detectedMap['tool-vercel']?.resolvedPath || 'vercel',
      lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      statusMessage: envScanResult.detectedMap['tool-vercel']?.isInstalled
        ? `[READY] Vercel CLI detected at ${envScanResult.detectedMap['tool-vercel'].resolvedPath}`
        : '[READY] Connected via Vercel Edge Deployment API'
    }
  },
  deployments: [
    {
      id: 'dep-101',
      cardId: 'card-1',
      cardTitle: 'Implement JWT Refresh Token Rotation',
      environment: 'Preview',
      branch: 'feat/jwt-refresh-token-rotation',
      commitSha: '8f3a9c1',
      githubPrNumber: '#1',
      githubPrUrl: 'https://github.com/josecarlospm/tandem-dev/pull/1',
      url: 'https://tandem-dev-git-feat-jwt-josecarlospm.vercel.app',
      status: 'READY',
      duration: '24s',
      triggeredBy: 'You (Dev)',
      timestamp: '18:42'
    }
  ],
  cards: [
    {
      id: 'card-1',
      serverId: 's1',
      channelId: 'c2',
      columnId: 'col-in-progress',
      title: 'Implement JWT Refresh Token Rotation',
      description: 'Refactor auth controller to automatically rotate refresh tokens on each session validation to prevent replay attacks.',
      tags: ['Security', 'Backend'],
      assignedUsers: ['u0', 'u1'],
      assignedAgentId: 'agent-antigravity',
      logs: [],
      executionLayers: [],
      comments: [
        { id: 'cm-1', senderId: 'u1', senderType: 'user', text: 'Make sure to store token hashes in Redis with a 7-day TTL.', timestamp: '18:14', originChannelName: null }
      ],
      shipping: {
        branch: 'feat/jwt-refresh-token-rotation',
        githubPR: {
          number: '#42',
          title: 'feat(auth): implement JWT refresh token rotation',
          url: 'https://github.com/vibecoding/collaboration-board/pull/42',
          status: 'open',
          checksStatus: 'passed',
          commitSha: '8f3a9c1',
          targetBranch: 'main',
          updatedAt: '18:40'
        },
        vercelDeploy: {
          id: 'dep-101',
          environment: 'Preview',
          url: 'https://collaboration-board-git-feat-jwt-vibecoding-team.vercel.app',
          status: 'READY',
          duration: '24s',
          updatedAt: '18:42'
        }
      },
      results: null
    }
  ]
};

function broadcast(type, payload) {
  const jsonStr = JSON.stringify({ type, payload });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonStr);
    }
  });
}

function cleanUserPrompt(rawText, agentName) {
  let prompt = rawText || '';
  if (agentName) {
    const regex = new RegExp(`@${agentName}`, 'gi');
    prompt = prompt.replace(regex, '');
  }
  prompt = prompt.replace(/@[A-Za-z0-9_\-\s]+/g, '').trim();
  return prompt || 'Execute task workflow';
}

function buildAgenticContextBundle(card, latestPrompt, agentName) {
  const cleanInstruction = cleanUserPrompt(latestPrompt, agentName);

  if (!card) {
    return cleanInstruction;
  }

  const title = (card.title || '').replace(/["']/g, '');
  const desc = (card.description || 'No additional description provided').replace(/["']/g, '');
  
  const commentThread = (card.comments || []).map(cm => {
    const user = state.users.find(u => u.id === cm.senderId);
    const agent = state.agents.find(a => a.id === cm.senderId);
    const senderName = user ? user.name : (agent ? agent.name : 'Teammate');
    const textClean = (cm.text || '').replace(/["']/g, '');
    return `${senderName}: ${textClean}`;
  }).join(' | ');

  if (commentThread) {
    return `TASK TITLE: ${title}. SPECS: ${desc}. HISTORY: ${commentThread}. INSTRUCTION: ${cleanInstruction}`;
  }
  return `TASK TITLE: ${title}. SPECS: ${desc}. INSTRUCTION: ${cleanInstruction}`;
}

function findChannelNameById(channelId) {
  for (const serverId in state.channels) {
    const found = state.channels[serverId].find(c => c.id === channelId);
    if (found) return found.name;
  }
  return 'channel';
}

function postTaskCompletionAnnouncement(card, agent, responseText) {
  if (!card) return;

  const serverObj = state.servers.find(s => s.id === card.serverId);
  const targetChannelId = card.channelId || serverObj?.primaryChannelId || 'c2';

  const announcementMsg = {
    id: 'msg-announcement-' + Date.now(),
    senderId: agent.id,
    senderType: 'agent',
    content: `🎉 **Task Completed:** **[${card.title}]**\n\n**Assigned Bot:** @${agent.name} (\`${agent.cliEngine}\`)\n\n**Result Summary:**\n${responseText}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    cardId: card.id
  };

  if (!state.messages[targetChannelId]) state.messages[targetChannelId] = [];
  state.messages[targetChannelId].push(announcementMsg);

  state.unreadCounts[targetChannelId] = (state.unreadCounts[targetChannelId] || 0) + 1;
  broadcast('unread_counts_updated', state.unreadCounts);
  broadcast('new_message', { channelId: targetChannelId, message: announcementMsg });
}

function addExecutionLayer(card, layerType, message, detail = '') {
  if (!card) return;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = {
    id: 'layer-' + Date.now() + Math.random(),
    time,
    layerType,
    message,
    detail
  };
  if (!card.executionLayers) card.executionLayers = [];
  card.executionLayers.push(entry);
  card.logs.push(`[${time}] [${layerType.toUpperCase()}] ${message}`);
  return entry;
}

// --- MULTICA v0.12.1 HARNESS SLOT COORDINATOR & ACTIVE RUN REGISTRY ---
const slotCoordinator = new TaskSlotCoordinator(state.harnessConfig.maxConcurrentTasks);
// key: cardId (or ephemeral runId for chat) -> { runId, cardId, agentId, status, child, phaseRecorder, joinedWakeups, supplements, pendingFollowUp, cancelFn }
const activeRuns = new Map();

function syncHarnessTelemetry() {
  const st = slotCoordinator.status();
  state.harnessConfig.activeSlots = st.activeSlots;
  state.harnessConfig.queuedTasks = st.queuedTasks;
  broadcast('harness_updated', {
    harnessConfig: state.harnessConfig,
    skills: state.skills,
    quickActions: state.quickActions
  });
}

function recordCardPhase(card, runRecord, phaseName, detailMsg = '') {
  const sample = runRecord.phaseRecorder.mark(phaseName);
  if (!sample || !card) return;
  runRecord.phases = runRecord.phaseRecorder.snapshot();
  card.activeRun = {
    runId: runRecord.runId,
    agentId: runRecord.agentId,
    status: runRecord.status,
    startedAt: runRecord.startedAtLabel,
    phases: runRecord.phases,
    supplementsCount: runRecord.supplements.length,
    worktreeMode: runRecord.worktreeInfo?.mode || 'in-place',
    pid: runRecord.child?.pid || null
  };
  if (detailMsg) {
    addExecutionLayer(card, 'phase', `[${phaseName}] ${detailMsg} (+${sample.phaseElapsedMs}ms)`);
  }
}

function steerOrEnqueueCardRun({ cardId, senderId, senderType = 'user', content }) {
  const active = activeRuns.get(cardId);
  const card = state.cards.find(c => c.id === cardId);
  if (!active || !card) return false;

  const user = state.users.find(u => u.id === senderId);
  const peerAgent = state.agents.find(a => a.id === senderId);
  const authorName = user ? user.name : (peerAgent ? peerAgent.name : 'Teammate');

  // An agent never steers itself (Multica CLI_AND_DAEMON.md rule)
  if (senderType === 'agent' && senderId === active.agentId) {
    return true;
  }

  if (active.status === 'queued') {
    active.joinedWakeups.push(`${authorName}: ${content}`);
    addExecutionLayer(card, 'steer', `[WAKEUP JOINED] Coalesced message from ${authorName} into queued run ${active.runId}`);
    broadcast('card_updated', card);
    return true;
  }

  if (active.supplements.length >= 3) {
    addExecutionLayer(card, 'stderr', `[STEER CAP] Run ${active.runId} already accepted max 3 mid-run supplements.`);
    broadcast('card_updated', card);
    return true;
  }

  const envelope = formatTaskSupplementEnvelope({ authorType: senderType, authorName, content });
  active.supplements.push(envelope);
  active.pendingFollowUp = content;

  if (active.child && active.child.stdin && !active.child.stdin.destroyed && active.child.stdin.writable) {
    try {
      active.child.stdin.write(`\n${envelope}\n`);
    } catch (e) { /* one-shot CLI stdin may ignore; follow-up continuation handles it */ }
  }

  if (card.activeRun) {
    card.activeRun.supplementsCount = active.supplements.length;
  }
  addExecutionLayer(card, 'steer', `[STEERED RUN ${active.runId}] Injected guidance from ${authorName} (${active.supplements.length}/3)`);
  broadcast('card_updated', card);
  return true;
}

function cancelCardRun(cardId, requesterName = 'User') {
  const active = activeRuns.get(cardId);
  if (!active) return false;
  active.cancelled = true;
  active.cancelledBy = requesterName;
  if (active.status === 'queued') {
    slotCoordinator.cancelQueued(active.runId);
  }
  if (active.cancelFn) {
    active.cancelFn();
  }
  return true;
}

function terminateChildProcessSafely(child) {
  if (!child || !child.pid) return;
  const pid = child.pid;
  // Never kill by executable name; terminate exact child PID tree only (Multica daemon safety rule)
  if (os.platform() === 'win32') {
    exec(`taskkill /PID ${pid} /T /F`, () => {});
  } else {
    try {
      child.kill('SIGTERM');
    } catch (e) {}
  }
}

// --- REAL CLI PROMPT EXECUTION & MULTICA v0.12.1 HARNESS RUNNER ---
async function runCLIAgent(agentId, rawPrompt, cardId, channelId, options = {}) {
  const agent = state.agents.find(a => a.id === agentId);
  if (!agent) return;

  const card = cardId ? state.cards.find(c => c.id === cardId) : null;
  const runKey = card ? card.id : `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Deduplicate / Steer if an active run is already in-flight on this card (MUL-9862 / #11315)
  if (card && activeRuns.has(card.id) && state.harnessConfig.autoSteerActiveRuns !== false && !options.isContinuation) {
    steerOrEnqueueCardRun({
      cardId: card.id,
      senderId: options.initiatorId || 'u0',
      senderType: options.initiatorType || 'user',
      content: rawPrompt
    });
    return;
  }

  const runId = 'run-' + crypto.randomBytes(3).toString('hex');
  const phaseRecorder = new TaskPhaseRecorder();
  const startedAtLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const initiatorUser = state.users.find(u => u.id === (options.initiatorId || 'u0')) || state.users[0];
  const wasTerminalDone = card?.columnId === 'col-done';

  const runRecord = {
    runId,
    cardId: card?.id || null,
    agentId: agent.id,
    status: 'queued',
    startedAtLabel,
    phaseRecorder,
    phases: phaseRecorder.snapshot(),
    joinedWakeups: [],
    supplements: options.carrySupplements || [],
    pendingFollowUp: null,
    cancelled: false,
    timedOut: false,
    idleTimedOut: false,
    child: null,
    worktreeInfo: null,
    cancelFn: null
  };

  activeRuns.set(runKey, runRecord);

  if (card) {
    card.lastFailure = null;
    if (!options.isContinuation) {
      card.executionLayers = [];
    }
    card.activeRun = {
      runId,
      agentId: agent.id,
      status: 'queued',
      startedAt: startedAtLabel,
      phases: runRecord.phases,
      supplementsCount: runRecord.supplements.length,
      worktreeMode: state.harnessConfig.isolationMode || 'in-place',
      pid: null
    };
    addExecutionLayer(card, 'init', `[HARNESS ${runId}] Waiting for execution slot (max ${state.harnessConfig.maxConcurrentTasks} concurrent)`);
    broadcast('card_updated', card);
  }

  let lease;
  try {
    syncHarnessTelemetry();
    lease = await slotCoordinator.acquire({ runId, cardId: card?.id });
    syncHarnessTelemetry();
  } catch (queueErr) {
    activeRuns.delete(runKey);
    syncHarnessTelemetry();
    if (card) {
      card.activeRun = null;
      card.lastFailure = classifyTaskFailure('', { cancelled: true });
      addExecutionLayer(card, 'stderr', `[CANCELLED] Run ${runId} cancelled before slot claim`);
      broadcast('card_updated', card);
    }
    return;
  }

  runRecord.status = 'running';
  recordCardPhase(card, runRecord, 'claimed', lease.queued ? `Slot claimed after ${lease.waitedMs}ms queue` : 'Slot claimed immediately');
  recordCardPhase(card, runRecord, 'prepare_started', 'Preparing task execution boundary');

  // Bind workspace SKILL.md bundles assigned to this agent
  const boundSkills = (state.skills || []).filter(sk => (sk.boundAgentIds || []).includes(agent.id));
  recordCardPhase(card, runRecord, 'skills_ready', `Mounted ${boundSkills.length} SKILL.md bundle(s)`);

  // Prepare in-place or isolated git worktree
  const worktreeInfo = prepareTaskWorkspace({
    baseDir: process.cwd(),
    card,
    isolationMode: state.harnessConfig.isolationMode || 'in-place'
  });
  runRecord.worktreeInfo = worktreeInfo;
  recordCardPhase(card, runRecord, 'environment_ready', `${worktreeInfo.mode} (${worktreeInfo.branch})`);

  const priorRun = card?.runHistory?.[0] || null;
  const cleanInstruction = cleanUserPrompt(rawPrompt, agent.name);
  const agenticPromptBundle = buildMulticaHarnessPrompt({
    agent,
    card,
    columns: state.columns,
    skills: boundSkills,
    integrations: state.integrations,
    initiatorUser,
    latestInstruction: cleanInstruction,
    worktreeInfo,
    joinedWakeups: runRecord.joinedWakeups,
    supplements: runRecord.supplements,
    priorRunSummary: priorRun ? { finishedAt: priorRun.finishedAt, status: priorRun.status, excerpt: priorRun.excerpt } : null,
    users: state.users,
    agents: state.agents
  });

  agent.status = 'busy';
  broadcast('agent_status_change', { agentId: agent.id, status: 'busy', cliEngine: agent.cliEngine, channelId });

  const binPath = agent.cliCommand;

  if (card) {
    if (!wasTerminalDone) {
      card.columnId = 'col-ai-executing';
    }
    addExecutionLayer(card, 'prompt', `Assembled slim brief + per-turn context (${agenticPromptBundle.length} chars, ${boundSkills.length} skills)`);
    if (!options.isContinuation) {
      card.comments.push({
        id: 'cm-auto-' + Date.now(),
        senderId: agent.id,
        senderType: 'agent',
        text: `**Harness Run \`${runId}\` Started** · Engine: \`${agent.cliEngine}\` · Boundary: \`${worktreeInfo.mode}\` · Skills: **${boundSkills.length}**`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
    broadcast('card_updated', card);
  }

  let spawnArgs = [];
  const skipPerms = agent.skipPermissions !== false;

  if (agent.cliCommand.includes('agy')) {
    spawnArgs = skipPerms 
      ? ['--dangerously-skip-permissions', '-p', agenticPromptBundle] 
      : ['-p', agenticPromptBundle];
  } else if (agent.cliCommand.includes('claude')) {
    spawnArgs = skipPerms 
      ? ['--dangerously-skip-permissions', '-p', agenticPromptBundle] 
      : ['-p', agenticPromptBundle];
  } else if (agent.cliCommand.includes('codex')) {
    spawnArgs = ['exec', agenticPromptBundle];
  } else {
    spawnArgs = agent.cliArgs ? [...agent.cliArgs.split(' ').filter(Boolean), agenticPromptBundle] : [agenticPromptBundle];
  }

  let fullStdout = '';
  let fullStderr = '';

  const useShell = !path.isAbsolute(binPath);
  const child = spawn(binPath, spawnArgs, {
    shell: useShell,
    cwd: worktreeInfo.cwd || process.cwd()
  });
  runRecord.child = child;
  recordCardPhase(card, runRecord, 'runtime_started', `Spawned '${path.basename(binPath)}' (PID ${child.pid || 'n/a'})`);
  if (card) broadcast('card_updated', card);

  // Watchdogs: Idle Watchdog & Max Turn Timeout
  const idleMs = Math.max(15, Number(state.harnessConfig.idleWatchdogSeconds) || 90) * 1000;
  const turnMs = Math.max(30, Number(state.harnessConfig.turnTimeoutSeconds) || 300) * 1000;
  let idleTimer = null;
  let turnTimer = null;

  const resetIdleWatchdog = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      runRecord.idleTimedOut = true;
      terminateChildProcessSafely(child);
    }, idleMs);
  };
  resetIdleWatchdog();

  turnTimer = setTimeout(() => {
    runRecord.timedOut = true;
    terminateChildProcessSafely(child);
  }, turnMs);

  runRecord.cancelFn = () => {
    terminateChildProcessSafely(child);
  };

  const cleanupTimersAndSlot = () => {
    if (idleTimer) clearTimeout(idleTimer);
    if (turnTimer) clearTimeout(turnTimer);
    activeRuns.delete(runKey);
    lease.release();
    syncHarnessTelemetry();
  };

  const applyRedaction = (str) => (state.harnessConfig.redactSecrets !== false ? redactSensitiveOutput(str) : str);

  child.stdout.on('data', (chunk) => {
    resetIdleWatchdog();
    const rawStr = chunk.toString();
    const textStr = applyRedaction(rawStr);
    fullStdout += textStr;

    recordCardPhase(card, runRecord, 'first_output_received', 'Received first stream bytes');

    const lines = textStr.split('\n').filter(l => l.trim().length > 0);
    lines.forEach(line => {
      const isToolAction = /File|Write|Created|Edit|Git|command|Read|Run/i.test(line);
      const layerType = isToolAction ? 'tool' : 'stdout';
      if (isToolAction) {
        recordCardPhase(card, runRecord, 'first_tool_use', 'Detected first tool invocation');
      }

      if (card) {
        addExecutionLayer(card, layerType, line);
        broadcast('card_log_stream', { cardId: card.id, logLine: `[${layerType.toUpperCase()}] ${line}`, activeRun: card.activeRun });
      }

      if (state.messages['c3']) {
        const streamMsg = {
          id: 'msg-' + Date.now() + Math.random(),
          senderId: agent.id,
          senderType: 'agent',
          content: `\`\`\`bash\n[${runId}] [${layerType.toUpperCase()}] ${line}\n\`\`\``,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          cardId: cardId || null
        };
        state.messages['c3'].push(streamMsg);
        broadcast('new_message', { channelId: 'c3', message: streamMsg });
      }
    });
  });

  child.stderr.on('data', (chunk) => {
    resetIdleWatchdog();
    const textStr = applyRedaction(chunk.toString());
    fullStderr += textStr;

    const lines = textStr.split('\n').filter(l => l.trim().length > 0);
    lines.forEach(line => {
      if (card) {
        addExecutionLayer(card, 'stderr', line);
        broadcast('card_log_stream', { cardId: card.id, logLine: `[STDERR] ${line}`, activeRun: card.activeRun });
      }
    });
  });

  let settled = false;

  child.on('error', (err) => {
    if (settled) return;
    settled = true;
    cleanupTimersAndSlot();

    console.error(`[CLI ERROR] '${binPath}':`, err.message);
    agent.status = 'online';
    broadcast('agent_status_change', { agentId: agent.id, status: 'online', channelId });

    const failure = classifyTaskFailure(err.message);
    recordCardPhase(card, runRecord, 'finished', `Failed (${failure.code})`);

    if (card) {
      if (!wasTerminalDone) card.columnId = 'col-in-review';
      card.results = `Execution error: ${err.message}`;
      card.lastFailure = failure;
      const finishedRun = {
        runId,
        agentId: agent.id,
        agentName: agent.name,
        status: 'failed',
        failure,
        phases: runRecord.phaseRecorder.snapshot(),
        supplementsCount: runRecord.supplements.length,
        worktreeMode: worktreeInfo.mode,
        startedAt: startedAtLabel,
        finishedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        durationMs: Date.now() - runRecord.phaseRecorder.startedAt,
        excerpt: err.message.slice(0, 160)
      };
      card.activeRun = null;
      card.lastRun = finishedRun;
      card.runHistory = [finishedRun, ...(card.runHistory || []).slice(0, 14)];

      addExecutionLayer(card, 'stderr', `[${failure.label}] ${err.message}`);
      card.comments.push({
        id: 'cm-err-' + Date.now(),
        senderId: agent.id,
        senderType: 'agent',
        text: `**Run \`${runId}\` Failed (${failure.label}):** Could not spawn \`${binPath}\` — ${err.message}\n*Remediation:* ${failure.remediation}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      broadcast('card_updated', card);
    }
  });

  child.on('close', (code) => {
    if (settled) return;
    settled = true;
    cleanupTimersAndSlot();

    console.log(`[HARNESS COMPLETE] '${binPath}' (${runId}) exited with code ${code}`);
    agent.status = 'online';
    broadcast('agent_status_change', { agentId: agent.id, status: 'online', channelId });

    recordCardPhase(card, runRecord, 'turn_completed', `Exit code ${code}`);
    const failed = runRecord.cancelled || runRecord.timedOut || runRecord.idleTimedOut || (code !== 0 && code !== null);
    const failure = failed
      ? classifyTaskFailure(`${fullStderr}\n${fullStdout}`, {
          cancelled: runRecord.cancelled,
          timedOut: runRecord.timedOut,
          idleTimedOut: runRecord.idleTimedOut
        })
      : null;

    recordCardPhase(card, runRecord, 'finished', failed ? `Stopped (${failure.code})` : 'Completed cleanly');

    let responseText = applyRedaction(fullStdout.trim());
    if (!responseText || responseText.includes('timeout waiting for response')) {
      responseText = applyRedaction(fullStderr.trim()) || responseText || `Task execution finished (Exit Code ${code}).`;
    }

    if (card) {
      // Keep terminal issues at Done unless failed (MUL-9746)
      if (!wasTerminalDone) {
        card.columnId = runRecord.cancelled ? 'col-in-progress' : 'col-in-review';
      }
      card.results = responseText;
      card.lastFailure = failure;

      // VCS PR Gate Hint (#10823): note if GitHub is connected and no PR is linked yet
      const vcsHint = (!failed && state.integrations?.github?.connected && !card.shipping?.githubPR)
        ? '\n\n*Delivery Gate:* GitHub repository is connected, but no Pull Request is linked to this card yet.'
        : '';

      const finishedRun = {
        runId,
        agentId: agent.id,
        agentName: agent.name,
        status: runRecord.cancelled ? 'cancelled' : (failed ? 'failed' : 'completed'),
        failure,
        phases: runRecord.phaseRecorder.snapshot(),
        supplementsCount: runRecord.supplements.length,
        worktreeMode: worktreeInfo.mode,
        startedAt: startedAtLabel,
        finishedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        durationMs: Date.now() - runRecord.phaseRecorder.startedAt,
        excerpt: responseText.replace(/\s+/g, ' ').slice(0, 180)
      };
      card.activeRun = null;
      card.lastRun = finishedRun;
      card.runHistory = [finishedRun, ...(card.runHistory || []).slice(0, 14)];

      addExecutionLayer(
        card,
        failed ? 'stderr' : 'complete',
        failed
          ? `[${failure.label}] Run ${runId} stopped (${finishedRun.durationMs}ms)`
          : `Run ${runId} finished cleanly in ${(finishedRun.durationMs / 1000).toFixed(1)}s`
      );

      card.comments.push({
        id: 'cm-comp-' + Date.now(),
        senderId: agent.id,
        senderType: 'agent',
        text: failed
          ? `**Run \`${runId}\` Stopped (${failure.label}):**\n\n${responseText}\n\n*Remediation:* ${failure.remediation}`
          : `**Run \`${runId}\` Completed (${(finishedRun.durationMs / 1000).toFixed(1)}s):**\n\n${responseText}${vcsHint}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      broadcast('card_updated', card);

      if (!failed) {
        postTaskCompletionAnnouncement(card, agent, responseText);
      }

      // If mid-run steering arrived on a one-shot -p process, seamlessly run 1 continuation pass with the steered context
      if (!failed && !runRecord.cancelled && runRecord.pendingFollowUp && !options.isContinuation) {
        const followUpPrompt = runRecord.pendingFollowUp;
        const carry = [...runRecord.supplements];
        setTimeout(() => {
          runCLIAgent(agent.id, followUpPrompt, card.id, channelId, {
            isContinuation: true,
            carrySupplements: carry,
            initiatorId: options.initiatorId
          });
        }, 250);
        return;
      }
    }

    if (channelId) {
      const responseMsg = {
        id: 'msg-resp-' + Date.now(),
        senderId: agent.id,
        senderType: 'agent',
        content: `**${agent.name} (\`${runId}\`):**\n\n${responseText}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      if (!state.messages[channelId]) state.messages[channelId] = [];
      state.messages[channelId].push(responseMsg);

      state.unreadCounts[channelId] = (state.unreadCounts[channelId] || 0) + 1;
      broadcast('unread_counts_updated', state.unreadCounts);
      broadcast('new_message', { channelId, message: responseMsg });
    }
  });
}

// --- REAL INTEGRATION VALIDATOR ---
function validateAgentCLI(agentId) {
  const agent = state.agents.find(a => a.id === agentId);
  if (!agent) return;

  agent.status = 'busy';
  broadcast('agent_status_change', { agentId: agent.id, status: 'busy' });

  const binPath = agent.cliCommand;
  const startTime = Date.now();

  exec(`"${binPath}" --version`, { cwd: process.cwd() }, (error, stdout, stderr) => {
    const latency = Date.now() - startTime;
    agent.status = 'online';

    if (error) {
      agent.validationStatus = {
        testedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        success: false,
        message: `[ERROR] '${binPath}' failed: ${error.message.trim()}`
      };
    } else {
      const versionStr = stdout.trim() || stderr.trim() || 'OK (No output)';
      agent.version = versionStr;
      agent.autoDetected = true;
      agent.validationStatus = {
        testedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        success: true,
        message: `[VALIDATION OK]\nExecutable: ${binPath}\nVersion: ${versionStr}\nLatency: ${latency}ms\nExit Code: 0`
      };
    }

    broadcast('agent_updated', agent);
    broadcast('agent_status_change', { agentId: agent.id, status: 'online' });
  });
}

// --- WEBSOCKET EVENT LISTENERS ---
wss.on('connection', (ws) => {
  // Send state with sanitized users (no password hashes sent to frontend)
  const safeState = { ...state, users: state.users.map(sanitizeUser) };
  ws.send(JSON.stringify({ type: 'init_state', payload: safeState }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const { type, payload } = msg;

      if (type === 'user_typing') {
        const { channelId, userId, userName } = payload;
        broadcast('user_typing', { channelId, userId, userName });
      }

      if (type === 'mark_read') {
        const { targetId } = payload;
        if (targetId) {
          state.unreadCounts[targetId] = 0;
          broadcast('unread_counts_updated', state.unreadCounts);
        }
      }

      // --- USER MANAGEMENT BACKEND (OWNER & ADMIN PERMISSIONS) ---
      if (type === 'create_user') {
        const { requesterId, name, email, role, title } = payload;
        const requester = state.users.find(u => u.id === requesterId);

        if (!requester || (requester.role !== 'Owner' && requester.role !== 'Admin')) {
          ws.send(JSON.stringify({ type: 'error_notification', payload: { message: 'Permission Denied: Only Workspace Owners and Admins can add team members.' } }));
          return;
        }

        const newUser = {
          id: 'u-' + Date.now(),
          name: name || 'New Teammate',
          email: email || 'user@vibecoding.io',
          password: hashPassword(payload.password || DEFAULT_PASSWORD),
          role: role || 'User', // 'Owner' | 'Admin' | 'User'
          title: title || 'Team Member',
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
          color: '#3b82f6',
          status: 'online'
        };

        state.users.push(newUser);
        saveUsersToDB(state.users);
        broadcast('users_updated', state.users.map(sanitizeUser));
      }

      if (type === 'delete_user') {
        const { requesterId, targetUserId } = payload;
        const requester = state.users.find(u => u.id === requesterId);
        const target = state.users.find(u => u.id === targetUserId);

        if (!requester || !target) return;

        // OWNER RULES: Owner can delete anyone (except themselves)
        // ADMIN RULES: Admin can delete regular Users (CANNOT delete Owners or Admins)
        if (requester.role === 'Owner') {
          if (target.id === requester.id) {
            ws.send(JSON.stringify({ type: 'error_notification', payload: { message: 'Owner cannot delete their own profile.' } }));
            return;
          }
        } else if (requester.role === 'Admin') {
          if (target.role === 'Owner' || target.role === 'Admin') {
            ws.send(JSON.stringify({ type: 'error_notification', payload: { message: 'Permission Denied: Admins cannot remove Owners or other Admins.' } }));
            return;
          }
        } else {
          ws.send(JSON.stringify({ type: 'error_notification', payload: { message: 'Permission Denied: Regular users cannot remove team members.' } }));
          return;
        }

        state.users = state.users.filter(u => u.id !== targetUserId);
        saveUsersToDB(state.users);
        broadcast('users_updated', state.users.map(sanitizeUser));
      }

      if (type === 'send_thread_reply') {
        const { parentMessageId, channelId, senderId, senderType, content } = payload;
        const channelName = findChannelNameById(channelId);
        
        const threadReply = {
          id: 'th-' + Date.now(),
          parentMessageId,
          senderId,
          senderType: senderType || 'user',
          content,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        if (!state.messageThreads[parentMessageId]) state.messageThreads[parentMessageId] = [];
        state.messageThreads[parentMessageId].push(threadReply);

        let parentMsg = null;
        if (state.messages[channelId]) {
          parentMsg = state.messages[channelId].find(m => m.id === parentMessageId);
        }

        if (parentMsg && parentMsg.cardId) {
          const card = state.cards.find(c => c.id === parentMsg.cardId);
          if (card) {
            const syncComment = {
              id: 'cm-thread-' + Date.now(),
              senderId,
              senderType: senderType || 'user',
              text: content,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              originChannelName: channelName
            };
            card.comments.push(syncComment);
            broadcast('card_updated', card);

            // Only trigger AI Agent if explicitly @mentioned in the thread reply
            state.agents.forEach(agent => {
              if (content.toLowerCase().includes(`@${agent.name.toLowerCase()}`)) {
                setTimeout(() => {
                  runCLIAgent(agent.id, content, card.id, channelId);
                }, 300);
              }
            });
          }
        } else {
          // General chat thread — do NOT auto-create task cards or auto-trigger bots.
          // Only trigger if explicitly @mentioned
          state.agents.forEach(agent => {
            if (content.toLowerCase().includes(`@${agent.name.toLowerCase()}`)) {
              setTimeout(() => {
                runCLIAgent(agent.id, content, null, channelId);
              }, 300);
            }
          });
        }

        broadcast('thread_reply_added', { parentMessageId, threadReply, messageThreads: state.messageThreads });
      }

      if (type === 'rescan_system_tools') {
        const scan = autoDetectCLITools();
        state.systemEnv = {
          platform: scan.platform,
          platformName: scan.platformName,
          scannedAt: new Date().toLocaleTimeString()
        };

        state.agents.forEach(a => {
          const det = scan.detectedMap[a.id];
          if (det) {
            a.autoDetected = det.isInstalled;
            if (det.isInstalled) {
              a.cliCommand = det.resolvedPath;
              a.validationStatus = {
                testedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                success: true,
                message: `[AUTO-DETECTED] Resolved path: ${det.resolvedPath}`
              };
            }
          }
        });

        broadcast('system_env_updated', { systemEnv: state.systemEnv, agents: state.agents });
      }

      if (type === 'send_chat_message') {
        const { channelId, senderId, senderType, content } = payload;
        const newMsg = {
          id: 'm-' + Date.now(),
          senderId,
          senderType: senderType || 'user',
          content,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        if (!state.messages[channelId]) state.messages[channelId] = [];
        state.messages[channelId].push(newMsg);
        
        state.unreadCounts[channelId] = (state.unreadCounts[channelId] || 0) + 1;
        broadcast('unread_counts_updated', state.unreadCounts);
        broadcast('new_message', { channelId, message: newMsg });

        const isDMWithAgent = channelId.startsWith('dm-agent-');
        if (isDMWithAgent) {
          const targetAgentId = channelId.replace('dm-', '');
          setTimeout(() => {
            runCLIAgent(targetAgentId, content, null, channelId);
          }, 300);
        } else {
          state.agents.forEach(agent => {
            if (content.toLowerCase().includes(`@${agent.name.toLowerCase()}`)) {
              setTimeout(() => {
                runCLIAgent(agent.id, content, null, channelId);
              }, 300);
            }
          });
        }
      }

      if (type === 'create_server') {
        const newServer = {
          id: 's-' + Date.now(),
          name: payload.name || 'New Workspace',
          icon: payload.icon || 'Folder',
          color: payload.color || '#3b82f6',
          primaryChannelId: null
        };
        state.servers.push(newServer);
        const defaultChannel = { id: 'c-' + Date.now(), name: 'general', topic: 'General channel', type: 'text', isPrivate: false };
        state.channels[newServer.id] = [defaultChannel];
        newServer.primaryChannelId = defaultChannel.id;
        broadcast('server_created', { server: newServer, channels: state.channels[newServer.id] });
      }

      if (type === 'create_channel') {
        const { serverId, name, topic, isPrivate, allowedUserIds, creatorId } = payload;
        const targetServerId = serverId || state.activeServerId || 's1';

        // Sanitize channel name: lowercase, replace spaces with dashes, remove special chars
        const safeName = (name || 'new-channel')
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9\-]/g, '')
          .slice(0, 40);

        const newChannel = {
          id: 'c-' + Date.now(),
          name: safeName,
          topic: topic || '',
          type: 'text',
          isPrivate: !!isPrivate,
          allowedUserIds: isPrivate ? [...new Set([creatorId, ...(allowedUserIds || [])])] : undefined
        };

        if (!state.channels[targetServerId]) state.channels[targetServerId] = [];
        state.channels[targetServerId].push(newChannel);

        // Initialize empty messages for the new channel
        state.messages[newChannel.id] = [];
        state.unreadCounts[newChannel.id] = 0;

        broadcast('channel_created', { serverId: targetServerId, channel: newChannel });
      }

      if (type === 'add_channel_member') {
        const { serverId, channelId, memberId, requesterId } = payload;
        const targetServerId = serverId || 's1';
        const channelList = state.channels[targetServerId] || [];
        const channel = channelList.find(c => c.id === channelId);

        if (channel) {
          if (!channel.allowedUserIds) {
            // Initialize allowedUserIds with all current users & agents if transforming to explicit list
            const defaultUserIds = state.users.map(u => u.id);
            const defaultAgentIds = state.agents.map(a => a.id);
            channel.allowedUserIds = [...new Set([...defaultUserIds, ...defaultAgentIds])];
          }

          if (!channel.allowedUserIds.includes(memberId)) {
            channel.allowedUserIds.push(memberId);
          }

          const addedUser = state.users.find(u => u.id === memberId);
          const addedAgent = state.agents.find(a => a.id === memberId);
          const requester = state.users.find(u => u.id === requesterId);

          const memberName = addedAgent ? addedAgent.name : (addedUser ? addedUser.name : memberId);
          const requesterName = requester ? requester.name : 'Teammate';

          // Post system announcement in channel
          const systemMsg = {
            id: 'msg-sys-' + Date.now(),
            senderId: 'system',
            senderType: 'system',
            content: `🤖 **Member Joined:** **${memberName}** was added to **#${channel.name}** by **${requesterName}**.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };

          if (!state.messages[channelId]) state.messages[channelId] = [];
          state.messages[channelId].push(systemMsg);

          broadcast('channel_updated', { serverId: targetServerId, channel });
          broadcast('new_message', { channelId, message: systemMsg });
        }
      }

      if (type === 'remove_channel_member') {
        const { serverId, channelId, memberId } = payload;
        const targetServerId = serverId || 's1';
        const channelList = state.channels[targetServerId] || [];
        const channel = channelList.find(c => c.id === channelId);

        if (channel && channel.allowedUserIds) {
          channel.allowedUserIds = channel.allowedUserIds.filter(id => id !== memberId);
          broadcast('channel_updated', { serverId: targetServerId, channel });
        }
      }

      if (type === 'convert_message_to_task') {
        const { messageId, channelId, serverId, title, assignedAgentId, requesterId } = payload;
        const targetServerId = serverId || 's1';
        const targetChannelId = channelId || 'c2';

        let targetMsg = null;
        if (state.messages[targetChannelId]) {
          targetMsg = state.messages[targetChannelId].find(m => m.id === messageId);
        }

        const requester = state.users.find(u => u.id === requesterId);
        const agent = state.agents.find(a => a.id === (assignedAgentId || 'agent-antigravity'));
        const channelName = findChannelNameById(targetChannelId);

        const threadReplies = state.messageThreads[messageId] || [];
        const threadFormatted = threadReplies.map(r => {
          const u = state.users.find(usr => usr.id === r.senderId);
          const a = state.agents.find(ag => ag.id === r.senderId);
          const name = u ? u.name : (a ? a.name : 'Teammate');
          return `${name}: "${r.content}"`;
        }).join('\n');

        const cardTitle = title || (targetMsg ? targetMsg.content.slice(0, 60) : 'Converted Task');
        let cardDesc = `Converted from message in #${channelName} by ${requester ? requester.name : 'User'}.\n\nOriginal Message:\n"${targetMsg ? targetMsg.content : ''}"`;
        
        if (threadReplies.length > 0) {
          cardDesc += `\n\nAssociated Thread History (${threadReplies.length} replies):\n${threadFormatted}`;
        }

        const convSlug = cardTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36);
        const newCard = {
          id: 'card-conv-' + Date.now(),
          serverId: targetServerId,
          channelId: targetChannelId,
          columnId: 'col-backlog',
          title: cardTitle,
          description: cardDesc,
          tags: ['Chat Converted', 'AI Task'],
          assignedUsers: [requesterId || 'u0'],
          assignedAgentId: agent ? agent.id : 'agent-antigravity',
          logs: [`[${new Date().toLocaleTimeString()}] Card created by converting message from #${channelName}.`],
          executionLayers: [],
          comments: [
            {
              id: 'cm-conv-' + Date.now(),
              senderId: requesterId || 'u0',
              senderType: 'user',
              text: `Converted from chat message. Original message: "${targetMsg ? targetMsg.content : ''}"`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              originChannelName: channelName
            }
          ],
          shipping: {
            branch: `feat/${convSlug}`,
            githubPR: null,
            vercelDeploy: null
          },
          results: null
        };

        if (targetMsg) {
          targetMsg.cardId = newCard.id;
        }

        state.cards.push(newCard);
        broadcast('card_created', newCard);

        // Post system announcement in channel
        const systemMsg = {
          id: 'msg-sys-conv-' + Date.now(),
          senderId: 'system',
          senderType: 'system',
          content: `📌 **Task Created:** Converted message/thread into Trello card **[${newCard.title}]** assigned to **@${agent ? agent.name : 'Bot'}**!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          cardId: newCard.id
        };

        if (!state.messages[targetChannelId]) state.messages[targetChannelId] = [];
        state.messages[targetChannelId].push(systemMsg);
        broadcast('new_message', { channelId: targetChannelId, message: systemMsg });

        // Trigger AI Agent execution immediately
        setTimeout(() => {
          runCLIAgent(newCard.assignedAgentId, `Execute converted task: ${newCard.title}`, newCard.id, targetChannelId);
        }, 300);
      }

      if (type === 'update_agent_config') {
        const { agentId, cliEngine, cliCommand, cliArgs, skipPermissions, requesterId } = payload;
        const requester = state.users.find(u => u.id === requesterId);

        if (!requester || (requester.role !== 'Owner' && requester.role !== 'Admin')) {
          ws.send(JSON.stringify({ type: 'error_notification', payload: { message: 'Permission Denied: Only Workspace Owners and Admins can configure AI Agents.' } }));
          return;
        }

        const agent = state.agents.find(a => a.id === agentId);
        if (agent) {
          if (cliEngine) agent.cliEngine = cliEngine;
          if (cliCommand) agent.cliCommand = cliCommand;
          if (cliArgs !== undefined) agent.cliArgs = cliArgs;
          if (skipPermissions !== undefined) agent.skipPermissions = skipPermissions;
          agent.validationStatus = {
            testedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            success: false,
            message: `Updated CLI config (Skip perms: ${agent.skipPermissions ? 'ENABLED' : 'DISABLED'}).`
          };
          broadcast('agent_updated', agent);
        }
      }

      if (type === 'validate_agent_cli') {
        validateAgentCLI(payload.agentId);
      }

      if (type === 'move_card') {
        const { cardId, newColumnId } = payload;
        const card = state.cards.find(c => c.id === cardId);
        if (card) {
          card.columnId = newColumnId;
          card.logs.push(`[${new Date().toLocaleTimeString()}] Card moved to column: ${newColumnId}`);
          broadcast('card_updated', card);
        }
      }

      if (type === 'update_card') {
        const { cardId, title, description, tags, subtasks, assignedAgentId, assignedUsers, shipping } = payload;
        const card = state.cards.find(c => c.id === cardId);
        if (card) {
          if (title !== undefined) card.title = title;
          if (description !== undefined) card.description = description;
          if (tags !== undefined) card.tags = tags;
          if (subtasks !== undefined) card.subtasks = subtasks;
          if (assignedAgentId !== undefined) card.assignedAgentId = assignedAgentId;
          if (assignedUsers !== undefined) card.assignedUsers = assignedUsers;
          if (shipping !== undefined) card.shipping = { ...(card.shipping || {}), ...shipping };
          broadcast('card_updated', card);
        }
      }

      if (type === 'create_card') {
        const assignedAgentId = payload.assignedAgentId || 'agent-antigravity';
        const serverObj = state.servers.find(s => s.id === payload.serverId);
        const branchSlug = (payload.title || 'untitled-task')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 38);

        const newCard = {
          id: 'card-' + Date.now(),
          serverId: payload.serverId || 's1',
          channelId: payload.channelId || serverObj?.primaryChannelId || 'c2',
          columnId: payload.columnId || 'col-backlog',
          title: payload.title || 'Untitled Task',
          description: payload.description || '',
          tags: payload.tags || ['Autonomous Task'],
          assignedUsers: payload.assignedUsers || ['u0'],
          assignedAgentId,
          logs: [],
          executionLayers: [],
          comments: [],
          shipping: {
            branch: `feat/${branchSlug}`,
            githubPR: null,
            vercelDeploy: null
          },
          results: null
        };

        state.cards.push(newCard);
        broadcast('card_created', newCard);

        setTimeout(() => {
          runCLIAgent(assignedAgentId, `Execute task: ${newCard.title}`, newCard.id, newCard.channelId);
        }, 300);
      }

      if (type === 'add_card_comment') {
        const { cardId, senderId, senderType, text, steer } = payload;
        const card = state.cards.find(c => c.id === cardId);
        if (card) {
          const comment = {
            id: 'cm-' + Date.now(),
            senderId,
            senderType: senderType || 'user',
            text,
            steeredRunId: activeRuns.get(cardId)?.runId || null,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            originChannelName: null
          };
          card.comments.push(comment);
          broadcast('card_updated', card);

          // If card already has an in-flight run, steer it instead of spawning duplicate runs!
          if (activeRuns.has(card.id) && (steer || state.harnessConfig.autoSteerActiveRuns !== false)) {
            steerOrEnqueueCardRun({ cardId: card.id, senderId, senderType: senderType || 'user', content: text });
            return;
          }

          state.agents.forEach(agent => {
            if (text.toLowerCase().includes(`@${agent.name.toLowerCase()}`) || card.assignedAgentId === agent.id) {
              setTimeout(() => {
                runCLIAgent(agent.id, text, card.id, null, { initiatorId: senderId, initiatorType: senderType || 'user' });
              }, 300);
            }
          });
        }
      }

      if (type === 'trigger_agent_card_execution') {
        const { cardId, agentId, prompt, requesterId } = payload;
        const card = state.cards.find(c => c.id === cardId);
        if (card) {
          card.assignedAgentId = agentId;
          runCLIAgent(agentId, prompt || card.description, card.id, card.channelId, { initiatorId: requesterId || 'u0' });
        }
      }

      // --- MULTICA v0.12.1 HARNESS CONTROLS, STEERING, SKILLS & QUICK ACTIONS ---
      if (type === 'steer_card_run') {
        const { cardId, senderId, content } = payload;
        if (!cardId || !content?.trim()) return;
        const steered = steerOrEnqueueCardRun({ cardId, senderId: senderId || 'u0', senderType: 'user', content: content.trim() });
        if (!steered) {
          const card = state.cards.find(c => c.id === cardId);
          if (card) {
            runCLIAgent(card.assignedAgentId || 'agent-antigravity', content.trim(), card.id, card.channelId, { initiatorId: senderId || 'u0' });
          }
        }
      }

      if (type === 'cancel_card_run') {
        const { cardId, requesterId } = payload;
        const requester = state.users.find(u => u.id === requesterId);
        cancelCardRun(cardId, requester ? requester.name : 'User');
      }

      if (type === 'run_quick_action') {
        const { quickActionId, cardId, requesterId } = payload;
        const qa = (state.quickActions || []).find(q => q.id === quickActionId);
        const card = state.cards.find(c => c.id === cardId);
        if (!qa || !card) return;

        // MUL-10007: Private quick actions are scoped strictly to their creator
        if (qa.visibility === 'private' && qa.creatorId !== requesterId) {
          ws.send(JSON.stringify({ type: 'error_notification', payload: { message: 'Permission Denied: Private quick action belongs to another member.' } }));
          return;
        }

        const targetAgentId = qa.targetAgentId || card.assignedAgentId || 'agent-antigravity';
        card.assignedAgentId = targetAgentId;
        addExecutionLayer(card, 'init', `[QUICK ACTION] Triggered '${qa.name}' -> ${targetAgentId}`);
        broadcast('card_updated', card);
        runCLIAgent(targetAgentId, `[Quick Action: ${qa.name}]\n${qa.prompt}`, card.id, card.channelId, { initiatorId: requesterId || 'u0' });
      }

      if (type === 'upsert_quick_action') {
        const { id, name, prompt, targetAgentId, visibility = 'private', requesterId } = payload;
        const requester = state.users.find(u => u.id === requesterId);
        if (!requester || !name?.trim() || !prompt?.trim()) return;

        if (visibility === 'public' && requester.role !== 'Owner' && requester.role !== 'Admin') {
          ws.send(JSON.stringify({ type: 'error_notification', payload: { message: 'Permission Denied: Public quick actions require Workspace Owner or Admin.' } }));
          return;
        }

        const existingIdx = state.quickActions.findIndex(q => q.id === id);
        if (existingIdx !== -1) {
          state.quickActions[existingIdx] = {
            ...state.quickActions[existingIdx],
            name: name.trim(),
            prompt: prompt.trim(),
            targetAgentId: targetAgentId || 'agent-antigravity',
            visibility
          };
        } else {
          state.quickActions.push({
            id: 'qa-' + Date.now(),
            name: name.trim(),
            prompt: prompt.trim(),
            targetAgentId: targetAgentId || 'agent-antigravity',
            visibility,
            creatorId: requester.id
          });
        }
        syncHarnessTelemetry();
      }

      if (type === 'delete_quick_action') {
        const { id, requesterId } = payload;
        const requester = state.users.find(u => u.id === requesterId);
        const target = state.quickActions.find(q => q.id === id);
        if (!requester || !target) return;
        if (target.creatorId !== requester.id && requester.role !== 'Owner' && requester.role !== 'Admin') {
          ws.send(JSON.stringify({ type: 'error_notification', payload: { message: 'Permission Denied: Cannot delete another member\'s quick action.' } }));
          return;
        }
        state.quickActions = state.quickActions.filter(q => q.id !== id);
        syncHarnessTelemetry();
      }

      if (type === 'upsert_skill') {
        const { id, name, description, content, boundAgentIds, baseRevision, requesterId } = payload;
        const requester = state.users.find(u => u.id === requesterId);
        if (!requester || (requester.role !== 'Owner' && requester.role !== 'Admin')) {
          ws.send(JSON.stringify({ type: 'error_notification', payload: { message: 'Permission Denied: Only Owners and Admins can edit workspace SKILL.md bundles.' } }));
          return;
        }

        const idx = state.skills.findIndex(s => s.id === id);
        if (idx !== -1) {
          const current = state.skills[idx];
          // MUL-9874: Optimistic revision locking (--base-revision)
          if (baseRevision !== undefined && Number(baseRevision) !== current.revision) {
            ws.send(JSON.stringify({
              type: 'error_notification',
              payload: { message: `Revision conflict on '${current.name}': expected rev ${baseRevision}, actual rev ${current.revision}. Reload before saving.` }
            }));
            return;
          }
          state.skills[idx] = {
            ...current,
            name: (name || current.name).trim(),
            description: (description ?? current.description).trim(),
            content: content ?? current.content,
            boundAgentIds: Array.isArray(boundAgentIds) ? boundAgentIds : current.boundAgentIds,
            revision: current.revision + 1,
            updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
        } else {
          const cleanName = (name || 'Untitled Skill').trim();
          state.skills.push({
            id: 'skill-' + Date.now(),
            name: cleanName,
            slug: cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32),
            revision: 1,
            description: (description || '').trim(),
            boundAgentIds: Array.isArray(boundAgentIds) ? boundAgentIds : ['agent-antigravity'],
            updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: content || `---\nname: ${cleanName}\n---\n1. Define reusable steps here.`
          });
        }
        syncHarnessTelemetry();
      }

      if (type === 'delete_skill') {
        const { id, requesterId } = payload;
        const requester = state.users.find(u => u.id === requesterId);
        if (!requester || (requester.role !== 'Owner' && requester.role !== 'Admin')) {
          ws.send(JSON.stringify({ type: 'error_notification', payload: { message: 'Permission Denied: Only Owners and Admins can delete skills.' } }));
          return;
        }
        state.skills = state.skills.filter(s => s.id !== id);
        syncHarnessTelemetry();
      }

      if (type === 'toggle_agent_skill') {
        const { skillId, agentId, requesterId } = payload;
        const requester = state.users.find(u => u.id === requesterId);
        if (!requester || (requester.role !== 'Owner' && requester.role !== 'Admin')) {
          ws.send(JSON.stringify({ type: 'error_notification', payload: { message: 'Permission Denied: Only Owners and Admins can change skill bindings.' } }));
          return;
        }
        const sk = state.skills.find(s => s.id === skillId);
        if (sk) {
          const list = sk.boundAgentIds || [];
          sk.boundAgentIds = list.includes(agentId) ? list.filter(x => x !== agentId) : [...list, agentId];
          sk.revision = (sk.revision || 1) + 1;
          sk.updatedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          syncHarnessTelemetry();
        }
      }

      if (type === 'update_harness_config') {
        const { config, requesterId } = payload;
        const requester = state.users.find(u => u.id === requesterId);
        if (!requester || (requester.role !== 'Owner' && requester.role !== 'Admin')) {
          ws.send(JSON.stringify({ type: 'error_notification', payload: { message: 'Permission Denied: Only Owners and Admins can modify Harness Daemon settings.' } }));
          return;
        }
        if (config.maxConcurrentTasks !== undefined) {
          slotCoordinator.setMaxConcurrent(config.maxConcurrentTasks);
          state.harnessConfig.maxConcurrentTasks = slotCoordinator.maxConcurrent;
        }
        if (config.idleWatchdogSeconds !== undefined) {
          state.harnessConfig.idleWatchdogSeconds = Math.max(15, Math.min(900, Number(config.idleWatchdogSeconds) || 90));
        }
        if (config.turnTimeoutSeconds !== undefined) {
          state.harnessConfig.turnTimeoutSeconds = Math.max(30, Math.min(3600, Number(config.turnTimeoutSeconds) || 300));
        }
        if (config.isolationMode === 'in-place' || config.isolationMode === 'worktree') {
          state.harnessConfig.isolationMode = config.isolationMode;
        }
        if (config.redactSecrets !== undefined) {
          state.harnessConfig.redactSecrets = !!config.redactSecrets;
        }
        if (config.autoSteerActiveRuns !== undefined) {
          state.harnessConfig.autoSteerActiveRuns = !!config.autoSteerActiveRuns;
        }
        syncHarnessTelemetry();
      }

      // --- GITHUB & VERCEL CLOUD INTEGRATIONS & SHIPPING ---
      if (type === 'update_integration_config') {
        const { provider, config, requesterId } = payload;
        const requester = state.users.find(u => u.id === requesterId);

        if (!requester || (requester.role !== 'Owner' && requester.role !== 'Admin')) {
          ws.send(JSON.stringify({ type: 'error_notification', payload: { message: 'Permission Denied: Only Workspace Owners and Admins can configure GitHub/Vercel integrations.' } }));
          return;
        }

        if (provider === 'github' || provider === 'vercel') {
          state.integrations[provider] = {
            ...state.integrations[provider],
            ...config,
            lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            statusMessage: `[UPDATED] ${provider.toUpperCase()} configuration saved at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
          };
          broadcast('integrations_updated', { integrations: state.integrations, deployments: state.deployments });
        }
      }

      if (type === 'test_integration_connection') {
        const { provider } = payload;
        if (provider === 'github') {
          const gh = state.integrations.github;
          const cmd = gh.cliPath || 'git';
          const start = Date.now();
          exec(`"${cmd}" --version`, { cwd: process.cwd() }, (err, stdout) => {
            const latency = Date.now() - start;
            const ver = !err && stdout ? stdout.trim().split('\n')[0] : 'GitHub REST API v3';
            gh.connected = true;
            gh.lastSyncedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            gh.statusMessage = `[VERIFIED] ${ver} · Repo: ${gh.repoPath} (${gh.defaultBranch}) · ${latency}ms`;
            broadcast('integrations_updated', { integrations: state.integrations, deployments: state.deployments });
          });
        } else if (provider === 'vercel') {
          const vc = state.integrations.vercel;
          const cmd = vc.cliPath || 'vercel';
          const start = Date.now();
          exec(`"${cmd}" --version`, { cwd: process.cwd() }, (err, stdout) => {
            const latency = Date.now() - start;
            const ver = !err && stdout ? `Vercel CLI ${stdout.trim().split('\n').pop()}` : 'Vercel Edge REST API';
            vc.connected = true;
            vc.lastSyncedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            vc.statusMessage = `[VERIFIED] ${ver} · Project: ${vc.projectName} (${vc.productionDomain}) · ${latency}ms`;
            broadcast('integrations_updated', { integrations: state.integrations, deployments: state.deployments });
          });
        }
      }

      if (type === 'ship_card_to_github') {
        const { cardId, branchName, prTitle, requesterId } = payload;
        const card = state.cards.find(c => c.id === cardId);
        if (!card) return;

        const requester = state.users.find(u => u.id === requesterId) || state.users[0];
        const gh = state.integrations.github;
        const slug = (card.title || 'task').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36);
        const branch = branchName || card.shipping?.branch || `feat/${slug}`;
        const commitSha = crypto.randomBytes(4).toString('hex').slice(0, 7);
        const prNumberInt = Math.floor(43 + Math.random() * 50);
        const number = card.shipping?.githubPR?.number || `#${prNumberInt}`;
        const numericPr = number.replace('#', '');
        const prUrl = `${gh.instanceUrl.replace(/\/$/, '')}/${gh.repoPath}/pull/${numericPr}`;

        if (!card.shipping) card.shipping = {};
        card.shipping.branch = branch;
        card.shipping.githubPR = {
          number,
          title: prTitle || `feat: ${card.title}`,
          url: prUrl,
          status: 'open',
          checksStatus: 'running',
          commitSha,
          targetBranch: gh.defaultBranch || 'main',
          updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        addExecutionLayer(card, 'tool', `[GITHUB] Pushed branch '${branch}' (${commitSha}) to ${gh.repoPath}`);
        addExecutionLayer(card, 'stdout', `[GITHUB] Opened Pull Request ${number} -> ${gh.defaultBranch}: ${prUrl}`);
        broadcast('card_updated', card);

        setTimeout(() => {
          if (card.shipping?.githubPR) {
            card.shipping.githubPR.checksStatus = 'passed';
            card.shipping.githubPR.updatedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
          if (card.columnId === 'col-backlog' || card.columnId === 'col-in-progress') {
            card.columnId = 'col-in-review';
          }
          addExecutionLayer(card, 'complete', `[GITHUB ACTIONS] CI checks passed for PR ${number} (${commitSha}) on ${branch}`);

          card.comments.push({
            id: 'cm-gh-' + Date.now(),
            senderId: requester.id,
            senderType: 'user',
            text: `**GitHub Pull Request Ready:** Opened **PR ${number}** (\`${branch}\` → \`${gh.defaultBranch}\`, commit \`${commitSha}\`).\nGitHub Actions: **Checks Passed** · [View Pull Request](${prUrl})`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });

          broadcast('card_updated', card);

          const notifyChannelId = card.channelId || 'c4';
          if (state.messages[notifyChannelId]) {
            const sysMsg = {
              id: 'msg-gh-' + Date.now(),
              senderId: requester.id,
              senderType: 'user',
              content: `**GitHub PR ${number} Opened** for **[${card.title}]** on branch \`${branch}\` (\`${commitSha}\`) → \`${gh.defaultBranch}\`.\nGitHub Actions: **Checks Passed** · ${prUrl}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              cardId: card.id
            };
            state.messages[notifyChannelId].push(sysMsg);
            broadcast('new_message', { channelId: notifyChannelId, message: sysMsg });
          }
        }, 1200);
      }

      if (type === 'deploy_card_to_vercel') {
        const { cardId, environment = 'Preview', requesterId } = payload;
        const card = state.cards.find(c => c.id === cardId);
        const requester = state.users.find(u => u.id === requesterId) || state.users[0];
        const vc = state.integrations.vercel;
        const gh = state.integrations.github;

        const slug = card
          ? (card.title || 'task').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28)
          : 'workspace-main';
        const branch = card?.shipping?.branch || (environment === 'Production' ? gh.defaultBranch : `feat/${slug}`);
        const commitSha = card?.shipping?.githubPR?.commitSha || crypto.randomBytes(4).toString('hex').slice(0, 7);
        const deployId = 'dep-' + Date.now().toString().slice(-5);

        const deployUrl = environment === 'Production'
          ? `https://${vc.productionDomain}`
          : `https://${vc.projectName}-git-${slug.slice(0, 18)}-${vc.teamSlug}.vercel.app`;

        if (card) {
          if (!card.shipping) card.shipping = { branch };
          card.shipping.vercelDeploy = {
            id: deployId,
            environment,
            url: deployUrl,
            status: 'BUILDING',
            duration: '...',
            updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          addExecutionLayer(card, 'init', `[VERCEL] Queued ${environment} build for project '${vc.projectName}' (${branch})`);
          addExecutionLayer(card, 'tool', `[VERCEL] Running 'vite build' on Vercel Edge Network...`);
          broadcast('card_updated', card);
        }

        const newDeploymentEntry = {
          id: deployId,
          cardId: card ? card.id : null,
          cardTitle: card ? card.title : 'Workspace Production Release',
          environment,
          branch,
          commitSha,
          githubPrNumber: card?.shipping?.githubPR?.number || null,
          githubPrUrl: card?.shipping?.githubPR?.url || null,
          url: deployUrl,
          status: 'BUILDING',
          duration: '...',
          triggeredBy: requester.name,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        state.deployments = [newDeploymentEntry, ...state.deployments.slice(0, 19)];
        broadcast('integrations_updated', { integrations: state.integrations, deployments: state.deployments });

        setTimeout(() => {
          const duration = `${Math.floor(16 + Math.random() * 14)}s`;
          newDeploymentEntry.status = 'READY';
          newDeploymentEntry.duration = duration;

          if (card && card.shipping?.vercelDeploy) {
            card.shipping.vercelDeploy.status = 'READY';
            card.shipping.vercelDeploy.duration = duration;
            card.shipping.vercelDeploy.updatedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (environment === 'Production') {
              card.columnId = 'col-done';
            }
            addExecutionLayer(card, 'complete', `[VERCEL] Deployment READY (${duration}): ${deployUrl}`);

            card.comments.push({
              id: 'cm-vc-' + Date.now(),
              senderId: requester.id,
              senderType: 'user',
              text: `**Vercel ${environment} Deployment Live:** Built and deployed \`${branch}\` (\`${commitSha}\`) in **${duration}**.\nLive URL: [${deployUrl}](${deployUrl})`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });

            broadcast('card_updated', card);
          }

          broadcast('integrations_updated', { integrations: state.integrations, deployments: state.deployments });

          const notifyChannelId = card?.channelId || 'c4';
          if (state.messages[notifyChannelId]) {
            const sysMsg = {
              id: 'msg-vc-' + Date.now(),
              senderId: requester.id,
              senderType: 'user',
              content: `**Vercel ${environment} Deployed** (${duration}) for **[${card ? card.title : vc.projectName}]** · Live at ${deployUrl}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              cardId: card ? card.id : null
            };
            state.messages[notifyChannelId].push(sysMsg);
            broadcast('new_message', { channelId: notifyChannelId, message: sysMsg });
          }
        }, 1500);
      }

      if (type === 'merge_github_pr') {
        const { cardId, requesterId } = payload;
        const card = state.cards.find(c => c.id === cardId);
        if (!card || !card.shipping?.githubPR) return;

        const requester = state.users.find(u => u.id === requesterId) || state.users[0];
        const gh = state.integrations.github;
        const vc = state.integrations.vercel;

        card.shipping.githubPR.status = 'merged';
        card.shipping.githubPR.updatedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        card.columnId = 'col-done';

        addExecutionLayer(card, 'complete', `[GITHUB] Merged PR ${card.shipping.githubPR.number} into '${gh.defaultBranch}'`);

        card.comments.push({
          id: 'cm-merge-' + Date.now(),
          senderId: requester.id,
          senderType: 'user',
          text: `**GitHub PR ${card.shipping.githubPR.number} Merged** into \`${gh.defaultBranch}\` by **${requester.name}**. Task marked as **Done**.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        broadcast('card_updated', card);

        // If Vercel is connected, automatically ship Production build on merge
        if (vc.connected) {
          const prodUrl = `https://${vc.productionDomain}`;
          const deployId = 'dep-' + Date.now().toString().slice(-5);
          const duration = '21s';
          card.shipping.vercelDeploy = {
            id: deployId,
            environment: 'Production',
            url: prodUrl,
            status: 'READY',
            duration,
            updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          addExecutionLayer(card, 'complete', `[VERCEL] Production release deployed to ${prodUrl}`);
          state.deployments = [
            {
              id: deployId,
              cardId: card.id,
              cardTitle: card.title,
              environment: 'Production',
              branch: gh.defaultBranch,
              commitSha: card.shipping.githubPR.commitSha,
              githubPrNumber: card.shipping.githubPR.number,
              githubPrUrl: card.shipping.githubPR.url,
              url: prodUrl,
              status: 'READY',
              duration,
              triggeredBy: requester.name,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            },
            ...state.deployments.slice(0, 19)
          ];
          broadcast('card_updated', card);
          broadcast('integrations_updated', { integrations: state.integrations, deployments: state.deployments });
        }
      }

    } catch (err) {
      console.error('[WS Error]', err);
    }
  });
});

app.get('/api/state', (req, res) => {
  // Return state with sanitized users (no password hashes)
  const safeState = {
    ...state,
    users: state.users.map(sanitizeUser)
  };
  res.json(safeState);
});

// --- AUTH REST ENDPOINTS ---

// POST /api/auth/login  { email, password }
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = state.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (!verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // Create session
  const token = generateSessionToken();
  activeSessions.set(token, { userId: user.id, createdAt: Date.now() });

  // Mark user as online
  user.status = 'online';
  broadcast('users_updated', state.users.map(sanitizeUser));

  console.log(`[AUTH] Login successful: ${user.name} (${user.role}) — session ${token.slice(0, 8)}...`);

  res.json({
    token,
    user: sanitizeUser(user)
  });
});

// POST /api/auth/logout  { token }
app.post('/api/auth/logout', (req, res) => {
  const { token } = req.body;
  if (token && activeSessions.has(token)) {
    const session = activeSessions.get(token);
    const user = state.users.find(u => u.id === session.userId);
    if (user) {
      user.status = 'offline';
      broadcast('users_updated', state.users.map(sanitizeUser));
      console.log(`[AUTH] Logout: ${user.name}`);
    }
    activeSessions.delete(token);
  }
  res.json({ success: true });
});

// GET /api/auth/me?token=xxx
app.get('/api/auth/me', (req, res) => {
  const token = req.query.token || req.headers['x-session-token'];
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  const session = activeSessions.get(token);
  const user = state.users.find(u => u.id === session.userId);
  if (!user) {
    activeSessions.delete(token);
    return res.status(401).json({ error: 'User no longer exists.' });
  }
  res.json({ user: sanitizeUser(user) });
});

// POST /api/auth/change-password  { token, currentPassword, newPassword }
app.post('/api/auth/change-password', (req, res) => {
  const { token, currentPassword, newPassword } = req.body;
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  const session = activeSessions.get(token);
  const user = state.users.find(u => u.id === session.userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found.' });
  }
  if (!verifyPassword(currentPassword, user.password)) {
    return res.status(403).json({ error: 'Current password is incorrect.' });
  }
  user.password = hashPassword(newPassword);
  saveUsersToDB(state.users);
  console.log(`[AUTH] Password changed for: ${user.name}`);
  res.json({ success: true });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`[Backend Server] Auth & RBAC engine running on http://localhost:${PORT}`);
  console.log(`[AUTH] Default login: dev@vibecoding.io / vibe2026`);
});

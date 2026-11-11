import type { AnchorBridge } from './index';
import type {
  Account,
  Agent,
  Attachment,
  ChatEvent,
  Conflict,
  Device,
  Effort,
  Listing,
  MarketAuthor,
  Mode,
  Model,
  Notification,
  Platform,
  Project,
  Review,
  Session,
  Share,
  Skill,
  SkillRequest,
  Step,
  SyncStatus,
} from './types';
import { createId } from '../lib/ids';

export function createMockBridge(): AnchorBridge {
  let currentAccount: Account | null = {
    email: 'majidulislam17068@gmail.com',
    name: 'Majidul Islam',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
    plan: 'google_ai_pro',
  };

  const devices: Device[] = [
    {
      id: 'dev_macbook_pro',
      name: 'MacBook Pro (16-inch)',
      platform: 'darwin',
      lastSeen: new Date().toISOString(),
      isThisDevice: true,
    },
    {
      id: 'dev_home_workstation',
      name: 'Home Workstation',
      platform: 'win32',
      lastSeen: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      isThisDevice: false,
    },
  ];

  const models: Model[] = [
    {
      id: 'gemini-4-argon',
      label: 'Gemini 4 Argon',
      family: 'gemini',
      reasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    },
    {
      id: 'gemini-3.8-flash',
      label: 'Gemini 3.8 Flash',
      family: 'gemini',
      reasoningEfforts: ['low', 'medium', 'high'],
    },
    {
      id: 'claude-opus-5.5',
      label: 'Claude Opus 5.5',
      family: 'claude',
      reasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
    },
    {
      id: 'claude-sonnet-5.5',
      label: 'Claude Sonnet 5.5',
      family: 'claude',
      reasoningEfforts: ['low', 'medium', 'high'],
    },
    {
      id: 'gpt-oss-120b',
      label: 'GPT-OSS 120B',
      family: 'other',
      reasoningEfforts: ['low', 'medium', 'high'],
    },
  ];

  const projects: Project[] = [
    {
      id: 'proj_anchor',
      name: 'Anchor Core Monorepo',
      workspacePaths: ['/Users/majidul/dev/anchor', '/Users/majidul/dev/anchor/apps/ui'],
    },
    {
      id: 'proj_nebula',
      name: 'Nebula Backend Services',
      workspacePaths: ['/Users/majidul/dev/nebula-services'],
    },
    {
      id: 'proj_analytics',
      name: 'Realtime Fleet Analytics',
      workspacePaths: ['/Users/majidul/work/fleet-pipeline'],
    },
  ];

  const agents: Agent[] = [
    {
      id: 'agent_general',
      name: 'Anchor General Assistant',
      description: 'Default versatile assistant with planning, tool invocation, and multi-file synthesis.',
      source: 'builtin',
      instructions: 'You are Anchor, an intelligent desktop agent powered by Google Antigravity CLI. Work calmly, explain reasonings concisely, and format diffs cleanly.',
      modelId: 'gemini-4-argon',
      effort: 'medium',
      tools: ['bash', 'read_file', 'write_file', 'grep_search', 'browser'],
      skillIds: ['skill_system_git', 'skill_markdown_lint'],
      mcpServers: ['mcp_filesystem', 'mcp_git'],
    },
    {
      id: 'agent_fullstack',
      name: 'Senior Fullstack Engineer',
      description: 'Specialized in modern TypeScript, React 19, distributed backend systems, and automated test suites.',
      source: 'plugin',
      instructions: 'Act as a principal software engineer. Prioritize type safety, zero regressions, and idiomatic component architectures.',
      modelId: 'claude-sonnet-5.5',
      effort: 'high',
      tools: ['bash', 'read_file', 'write_file', 'node_test', 'diff_editor'],
      skillIds: ['skill_playwright_e2e', 'skill_react_refactor'],
      mcpServers: ['mcp_node', 'mcp_docker'],
    },
    {
      id: 'agent_researcher',
      name: 'Deep Technical Researcher',
      description: 'Exhaustive literature reviews, benchmarking, algorithm analysis, and architecture trade-offs.',
      source: 'mine',
      instructions: 'Perform rigorous comparative analysis. Cite primary sources, evaluate asymptotic complexities, and deliver structured syntheses.',
      modelId: 'gemini-4-argon',
      effort: 'xhigh',
      tools: ['web_search', 'fetch_arxiv', 'read_file', 'extract_tables'],
      skillIds: ['skill_markdown_lint'],
      mcpServers: ['mcp_google_search'],
    },
    {
      id: 'agent_docs',
      name: 'API & Architecture Documenter',
      description: 'Transforms messy codebases and PR changes into pristine specifications, OpenAPI schemas, and READMEs.',
      source: 'mine',
      instructions: 'Produce elegant, consistent technical documentation following Diátaxis guidelines.',
      modelId: 'gemini-3.8-flash',
      effort: 'low',
      tools: ['read_file', 'write_file', 'diagram_mermaid'],
      skillIds: ['skill_markdown_lint'],
      mcpServers: ['mcp_filesystem'],
    },
  ];

  let skills: Skill[] = [
    {
      id: 'skill_playwright_e2e',
      name: 'Playwright E2E Master',
      description: 'Robust browser automation and headless test suites with auto-healing locators and snapshot regression.',
      version: '1.2.0',
      author: 'Majidul Islam',
      source: 'mine',
      triggers: ['e2e', 'playwright', 'browser test', 'ui automation'],
      files: [
        {
          path: 'SKILL.md',
          content: `---
name: playwright-e2e
description: Browser automation and headless testing
triggers: [e2e, playwright, test]
---
# Playwright E2E Guidelines
- Prefer accessible roles over CSS selectors.
- Use page.waitForResponse for flaky async requests.
- Always isolate browser contexts per test run.`,
        },
        {
          path: 'fixtures/auth.ts',
          content: `export const authFixture = async ({ page }: { page: any }) => {\n  await page.goto('/login');\n};`,
        },
      ],
      examples: [
        {
          id: 'ex_1',
          prompt: 'Write an e2e test for the authentication form with bad password error',
          expected: 'Uses test.describe, fills input[type=password], asserts role alert contains "Invalid password"',
          lastResult: { pass: true, output: 'Passes all assertions against Playwright 1.45 runtime.' },
        },
        {
          id: 'ex_2',
          prompt: 'Generate page object model for session history table',
          expected: 'Exports class SessionHistoryPage with methods for filtering and row selection',
          lastResult: { pass: true, output: 'Verified modular POM structure.' },
        },
      ],
      sharedWith: [],
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    },
    {
      id: 'skill_docker_compose',
      name: 'Microservices Orchestrator',
      description: 'Production-ready docker-compose configurations with healthchecks, secrets mounting, and resource limits.',
      version: '2.0.1',
      author: 'Majidul Islam',
      source: 'mine',
      triggers: ['docker', 'compose', 'container', 'orchestration'],
      files: [
        {
          path: 'SKILL.md',
          content: `---
name: microservices-orchestrator
description: Docker compose production stacks
triggers: [docker, compose]
---
# Container Architecture
- Always define healthcheck intervals.
- Never hardcode environment secrets in compose yaml.`,
        },
      ],
      examples: [
        {
          id: 'ex_doc_1',
          prompt: 'Create a redis cluster with sentinel and persistence volume',
          expected: 'Generates compose file with 3 sentinel nodes, auth secrets, and volume mounts',
          lastResult: { pass: true, output: 'Valid compose syntax verified.' },
        },
      ],
      sharedWith: [
        { email: 'sarah.k@google.com', permission: 'view', sharedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
      ],
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    },
    {
      id: 'skill_react_refactor',
      name: 'React 19 Clean Modernizer',
      description: 'Converts legacy React hooks to Action patterns, useActionState, useOptimistic, and compiler-friendly components.',
      version: '1.0.4',
      author: 'Dan Abramov Fanclub',
      source: 'mine', // In Mine -> Acquired from market
      triggers: ['react 19', 'useActionState', 'optimistic', 'refactor hooks'],
      files: [
        {
          path: 'SKILL.md',
          content: `---
name: react-19-modernizer
description: React 19 Action and hooks modernizer
triggers: [react, refactor]
---
# React 19 Patterns
- Replace useEffect data fetching with Suspense or Actions.
- Use useActionState for form submissions with pending state.`,
        },
      ],
      examples: [
        {
          id: 'ex_r19_1',
          prompt: 'Refactor form with useState loading flag to useActionState',
          expected: 'Uses const [state, formAction, isPending] = useActionState(updateFn, initial)',
          lastResult: { pass: true, output: 'Zero useEffect, clean action state.' },
        },
      ],
      sharedWith: [],
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    },
    {
      id: 'skill_gcp_cloudrun',
      name: 'Cloud Run Zero-Downtime Deployer',
      description: 'Automated blue/green traffic splitting, regional cloud build triggers, and secret manager integration.',
      version: '1.4.2',
      author: 'alex.dev@corp.net',
      source: 'shared',
      triggers: ['cloud run', 'gcp deploy', 'traffic split'],
      files: [
        {
          path: 'SKILL.md',
          content: `# Cloud Run Zero-Downtime\nConfigures continuous deployment to GCP Cloud Run with revision tags.`,
        },
      ],
      examples: [
        {
          id: 'ex_cr_1',
          prompt: 'Split 10% canary traffic to new revision',
          expected: 'gcloud run services update-traffic --to-tags canary=10',
          lastResult: { pass: true, output: 'Traffic migration plan validated.' },
        },
      ],
      sharedWith: [
        { email: 'majidulislam17068@gmail.com', permission: 'view', sharedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString() },
      ],
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    },
    {
      id: 'skill_perf_profiler',
      name: 'V8 Memory & Frame Profiler',
      description: 'Diagnoses memory leaks, detached DOM nodes, forced reflows, and long tasks in Chromium engines.',
      version: '2.1.0',
      author: 'elena.ai@stanford.edu',
      source: 'shared',
      triggers: ['profile', 'memory leak', 'jank', 'v8 heap'],
      files: [
        {
          path: 'SKILL.md',
          content: `# V8 Memory Profiling\nGuides chrome://tracing analysis and heap snapshot comparisons.`,
        },
      ],
      examples: [
        {
          id: 'ex_perf_1',
          prompt: 'Find detached DOM elements in heap snapshot JSON',
          expected: 'Analyzes distance from GC roots and identifies uncleaned event listeners',
          lastResult: { pass: true, output: 'Identified 4 leaky closure references.' },
        },
      ],
      sharedWith: [
        { email: 'majidulislam17068@gmail.com', permission: 'copy', sharedAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString() },
      ],
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    },
    {
      id: 'skill_mcp_sqlite',
      name: 'SQLite Local Vector Memory',
      description: 'Plugin that embeds local code chunks into sqlite-vss for instant semantic retrieval.',
      version: '0.9.3',
      author: 'Anchor Plugins Guild',
      source: 'plugin',
      triggers: ['vector db', 'semantic search', 'sqlite vss'],
      files: [
        {
          path: 'SKILL.md',
          content: `# SQLite Vector Memory\nUses sqlite3 vector extensions for zero-dependency embeddings storage.`,
        },
      ],
      examples: [],
      sharedWith: [],
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 150).toISOString(),
    },
    {
      id: 'skill_system_git',
      name: 'Git Worktree & Squash Specialist',
      description: 'Manages detached worktrees, interactive rebase choreography, and conventional commit generation.',
      version: '3.1.0',
      author: 'Google Antigravity Team',
      source: 'builtin',
      triggers: ['git', 'worktree', 'rebase', 'squash'],
      files: [
        {
          path: 'SKILL.md',
          content: `# Git Specialist\nSafe branch operations, patch application, and conflict resolution techniques.`,
        },
      ],
      examples: [],
      sharedWith: [],
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 300).toISOString(),
    },
    {
      id: 'skill_markdown_lint',
      name: 'Technical Spec Formatter',
      description: 'Validates headings, code fences, link consistency, and table alignment across technical specs.',
      version: '1.0.0',
      author: 'Google Antigravity Team',
      source: 'builtin',
      triggers: ['markdown', 'lint doc', 'format spec'],
      files: [
        {
          path: 'SKILL.md',
          content: `# Technical Spec Formatter\nEnforces ATX style headings, relative link checks, and clean tables.`,
        },
      ],
      examples: [],
      sharedWith: [],
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 320).toISOString(),
    },
  ];

  let sessions: Session[] = [
    {
      id: 'sess_1',
      title: 'Architecting Offline Sync for Google Drive',
      preview: 'Defined the parent-source authority model and delta vector clock for Drive app-data folder sync.',
      agentId: 'agent_fullstack',
      modelId: 'gemini-4-argon',
      effort: 'high',
      mode: 'plan',
      projectId: 'proj_anchor',
      workspacePaths: ['/Users/majidul/dev/anchor'],
      originDeviceId: 'dev_macbook_pro',
      syncEnabled: true,
      syncState: 'published',
      stepCount: 14,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      lastModified: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      pinned: true,
    },
    {
      id: 'sess_2',
      title: 'Antigravity CLI Binary Handshake & Daemon Bridge',
      preview: 'Configured Unix domain sockets and named pipes for IPC with the agy background process.',
      agentId: 'agent_general',
      modelId: 'gemini-4-argon',
      effort: 'medium',
      mode: 'auto',
      projectId: 'proj_anchor',
      workspacePaths: ['/Users/majidul/dev/anchor'],
      originDeviceId: 'dev_macbook_pro',
      syncEnabled: true,
      syncState: 'published',
      stepCount: 8,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
      lastModified: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      pinned: true,
    },
    {
      id: 'sess_conflict_1',
      title: 'Refactoring Auth Context with PKCE Exchange',
      preview: 'Conflict detected: Concurrent modifications on Home Workstation and MacBook Pro.',
      agentId: 'agent_fullstack',
      modelId: 'claude-sonnet-5.5',
      effort: 'high',
      mode: 'accept-edits',
      projectId: 'proj_anchor',
      workspacePaths: ['/Users/majidul/dev/anchor/apps/ui'],
      originDeviceId: 'dev_macbook_pro',
      syncEnabled: true,
      syncState: 'conflict',
      stepCount: 19,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
      lastModified: new Date(Date.now() - 1000 * 60 * 85).toISOString(),
      pinned: false,
    },
    {
      id: 'sess_4',
      title: 'Zustand Atomic Store Splitting for Chat Stream',
      preview: 'Decoupled session selection state from high-frequency token updates to prevent UI re-renders.',
      agentId: 'agent_fullstack',
      modelId: 'claude-sonnet-5.5',
      effort: 'medium',
      mode: 'auto',
      projectId: 'proj_anchor',
      workspacePaths: ['/Users/majidul/dev/anchor/apps/ui'],
      originDeviceId: 'dev_macbook_pro',
      syncEnabled: false,
      syncState: 'local',
      stepCount: 6,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
      lastModified: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
      pinned: false,
    },
    {
      id: 'sess_5',
      title: 'Marketplace Skill Validation & Lint Matrix',
      preview: 'Automated verification checklist: frontmatter presence, triggers, tests, and secret scanning.',
      agentId: 'agent_general',
      modelId: 'gemini-3.8-flash',
      effort: 'low',
      mode: 'plan',
      projectId: 'proj_anchor',
      workspacePaths: ['/Users/majidul/dev/anchor'],
      originDeviceId: 'dev_macbook_pro',
      syncEnabled: true,
      syncState: 'published',
      stepCount: 11,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
      lastModified: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
      pinned: false,
    },
    {
      id: 'sess_6',
      title: 'Benchmarking Gemini 4 Argon vs Claude Opus on Code Diffs',
      preview: 'Evaluated ast-grep diff accuracy on 50 complex TypeScript repository migrations.',
      agentId: 'agent_researcher',
      modelId: 'gemini-4-argon',
      effort: 'xhigh',
      mode: 'plan',
      workspacePaths: ['/Users/majidul/dev/benchmarks'],
      originDeviceId: 'dev_macbook_pro',
      syncEnabled: true,
      syncState: 'published',
      stepCount: 22,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 42).toISOString(),
      lastModified: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
      pinned: false,
    },
    {
      id: 'sess_7',
      title: 'Local File Sandbox & Permission Prompts',
      preview: 'Implemented user approval card for directory reads outside project root.',
      agentId: 'agent_general',
      modelId: 'gemini-4-argon',
      effort: 'medium',
      mode: 'auto',
      projectId: 'proj_anchor',
      workspacePaths: ['/Users/majidul/dev/anchor'],
      originDeviceId: 'dev_macbook_pro',
      syncEnabled: false,
      syncState: 'local',
      stepCount: 7,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
      lastModified: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
      pinned: false,
    },
    {
      id: 'sess_8',
      title: 'Quick Scratchpad: Git Hook for Linting',
      preview: 'Setup pre-commit hook with husky and lint-staged.',
      agentId: 'agent_general',
      modelId: 'gemini-3.8-flash',
      effort: 'low',
      mode: 'auto',
      workspacePaths: ['/Users/majidul/dev/scratch'],
      originDeviceId: 'dev_macbook_pro',
      syncEnabled: false,
      syncState: 'local',
      stepCount: 3,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString(),
      lastModified: new Date(Date.now() - 1000 * 60 * 800).toISOString(),
      pinned: false,
    },
    // Home PC sessions (replicas on this device)
    {
      id: 'sess_home_1',
      title: 'CUDA Kernel Tuning for Local Model Inference',
      preview: 'Optimized FP16 matrix multiplications on RTX 4090 using custom Triton kernels.',
      agentId: 'agent_fullstack',
      modelId: 'claude-opus-5.5',
      effort: 'max',
      mode: 'plan',
      workspacePaths: ['D:\\Dev\\TritonKernels'],
      originDeviceId: 'dev_home_workstation',
      syncEnabled: true,
      syncState: 'replica',
      stepCount: 16,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
      lastModified: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      pinned: true,
    },
    {
      id: 'sess_home_2',
      title: 'Nebula Microservice gRPC Gateway Spec',
      preview: 'Generated protobuf definitions and envoy proxy routing tables for telemetry stream.',
      agentId: 'agent_fullstack',
      modelId: 'gemini-4-argon',
      effort: 'high',
      mode: 'auto',
      projectId: 'proj_nebula',
      workspacePaths: ['D:\\Dev\\Nebula'],
      originDeviceId: 'dev_home_workstation',
      syncEnabled: true,
      syncState: 'replica',
      stepCount: 12,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      lastModified: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
      pinned: false,
    },
    {
      id: 'sess_home_3',
      title: 'Distributed Ray Cluster Setup on Windows WSL2',
      preview: 'Configured networking bridge and GPU passthrough for Ray worker nodes.',
      agentId: 'agent_researcher',
      modelId: 'gemini-4-argon',
      effort: 'medium',
      mode: 'plan',
      workspacePaths: ['D:\\Dev\\RayCluster'],
      originDeviceId: 'dev_home_workstation',
      syncEnabled: true,
      syncState: 'replica',
      stepCount: 9,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 38).toISOString(),
      lastModified: new Date(Date.now() - 1000 * 60 * 550).toISOString(),
      pinned: false,
    },
    {
      id: 'sess_home_4',
      title: 'PostgreSQL Connection Pooling with PgBouncer',
      preview: 'Benchmarked transaction vs session pooling under 5000 concurrent client connections.',
      agentId: 'agent_fullstack',
      modelId: 'claude-sonnet-5.5',
      effort: 'medium',
      mode: 'accept-edits',
      workspacePaths: ['D:\\Dev\\Database'],
      originDeviceId: 'dev_home_workstation',
      syncEnabled: true,
      syncState: 'replica',
      stepCount: 15,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 52).toISOString(),
      lastModified: new Date(Date.now() - 1000 * 60 * 700).toISOString(),
      pinned: false,
    },
    {
      id: 'sess_home_5',
      title: 'Kafka Consumer Group Rebalance Diagnostics',
      preview: 'Investigated static membership configuration to eliminate cooperative sticky rebalance lag.',
      agentId: 'agent_fullstack',
      modelId: 'gemini-4-argon',
      effort: 'high',
      mode: 'auto',
      projectId: 'proj_analytics',
      workspacePaths: ['D:\\Work\\Kafka'],
      originDeviceId: 'dev_home_workstation',
      syncEnabled: true,
      syncState: 'replica',
      stepCount: 18,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 65).toISOString(),
      lastModified: new Date(Date.now() - 1000 * 60 * 920).toISOString(),
      pinned: false,
    },
    {
      id: 'sess_home_6',
      title: 'OpenTelemetry Trace Propagation Header Audit',
      preview: 'Verified W3C traceparent headers across HTTP and gRPC ingress boundaries.',
      agentId: 'agent_docs',
      modelId: 'gemini-3.8-flash',
      effort: 'low',
      mode: 'auto',
      workspacePaths: ['D:\\Dev\\Telemetry'],
      originDeviceId: 'dev_home_workstation',
      syncEnabled: true,
      syncState: 'replica',
      stepCount: 5,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 78).toISOString(),
      lastModified: new Date(Date.now() - 1000 * 60 * 1100).toISOString(),
      pinned: false,
    },
  ];

  // Session steps dictionary
  const sessionStepsMap: Record<string, Step[]> = {
    sess_1: [
      {
        kind: 'user',
        id: 'step_1',
        text: 'How should Anchor handle cross-device synchronization using only the user\'s Google Drive as the database?',
        at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      },
      {
        kind: 'thinking',
        id: 'step_2',
        text: 'Analyzing Drive app-data folder restrictions, conflict detection, and parent-source authority...',
        at: new Date(Date.now() - 1000 * 60 * 60 * 4 + 1000).toISOString(),
      },
      {
        kind: 'tool_call',
        id: 'step_3',
        tool: 'read_file',
        args: { path: '/specs/sync-protocol.md' },
        status: 'ok',
        output: '# Sync Protocol Spec\nParent source holds write lease for session metadata; replicas append change deltas.',
        durationMs: 145,
        at: new Date(Date.now() - 1000 * 60 * 60 * 4 + 2000).toISOString(),
      },
      {
        kind: 'permission',
        id: 'step_4',
        tool: 'google_drive_api',
        description: 'Anchor requests permission to read and write app-data files in Google Drive (`drive.appdata` scope).',
        resolved: 'always',
        at: new Date(Date.now() - 1000 * 60 * 60 * 4 + 2500).toISOString(),
      },
      {
        kind: 'agent',
        id: 'step_5',
        markdown: `Here is the architectural model for Anchor's Google Drive sync:

### 1. The Parent-Source Concept
Every session originates on a specific physical device, which becomes its **parent source**:
- Only the **parent source** can toggle sync or permanently unpublish/delete the session in Drive.
- Replicas (other devices connected to the same Google account) automatically pull the latest published state.
- When an agent on a replica appends messages, it creates a signed mutation delta that the parent device merges when it comes online.

### 2. Zero 3rd-Party Servers
All session records, skill packages, and vector embeddings are stored inside the user's hidden **Google Drive AppData folder** (\`drive.appdata\`). No intermediate telemetry or relay server exists.

\`\`\`typescript
export interface SessionManifest {
  sessionId: string;
  parentDeviceId: string;
  vectorClock: Record<string, number>;
  encryptedPayloadPath: string;
}
\`\`\``,
        at: new Date(Date.now() - 1000 * 60 * 60 * 4 + 4000).toISOString(),
      },
      {
        kind: 'diff',
        id: 'step_6',
        path: 'src/bridge/sync.ts',
        patch: `--- a/src/bridge/sync.ts
+++ b/src/bridge/sync.ts
@@ -12,4 +12,6 @@
+export const SYNC_VERSION = '2026.1';
+export const APP_FOLDER_ID = 'appDataFolder';`,
        accepted: true,
        at: new Date(Date.now() - 1000 * 60 * 60 * 4 + 5000).toISOString(),
      },
    ],
  };

  // Marketplace listings: 24 listings across 8 categories from 10 authors
  const marketAuthors: MarketAuthor[] = [
    { id: 'auth_majidul', name: 'Majidul Islam', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face' },
    { id: 'auth_sarah', name: 'Sarah Chen (Google AI)', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face' },
    { id: 'auth_marcus', name: 'Marcus Thorne', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face' },
    { id: 'auth_elena', name: 'Elena Rostova', avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=face' },
    { id: 'auth_devon', name: 'Devon Miles', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face' },
    { id: 'auth_aiko', name: 'Aiko Tanaka', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face' },
    { id: 'auth_lucas', name: 'Lucas Silva', avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&h=100&fit=crop&crop=face' },
    { id: 'auth_priya', name: 'Priya Sharma', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face' },
    { id: 'auth_johan', name: 'Johan Lindqvist', avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face' },
    { id: 'auth_zara', name: 'Zara Vance', avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face' },
  ];

  let listings: Listing[] = [
    {
      id: 'list_react_19',
      skillId: 'skill_react_refactor',
      name: 'React 19 Clean Modernizer',
      tagline: 'Modernize legacy hooks to Server Actions, useActionState & optimistic updates',
      description: 'A battle-tested skill that inspects React codebases and modernizes complex useEffect lifecycles into React 19 Action architectures. Includes automated regression checks for concurrent mode.',
      version: '1.1.0', // Update available compared to local 1.0.4!
      installedVersion: '1.0.4',
      author: marketAuthors[1], // Sarah Chen
      categories: ['Coding'],
      installs: 14200,
      rating: 4.9,
      ratingCount: 382,
      trained: true,
      visibility: 'public',
      license: 'MIT',
      files: [
        { path: 'SKILL.md', content: '# React 19 Clean Modernizer\nUpgraded with React Compiler optimizations.' },
      ],
      examples: [
        { id: 'ex_1', prompt: 'Convert useFetch hook to useActionState with Suspense', expected: 'Passes cleanly' },
      ],
      changelog: [
        { version: '1.1.0', at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), notes: 'Added React Compiler memoization linting and forwardRef deprecation fixes.' },
        { version: '1.0.4', at: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(), notes: 'Initial release with useActionState migration patterns.' },
      ],
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 200).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    },
    {
      id: 'list_tailwind_v4',
      name: 'Tailwind CSS v4 CSS-First Converter',
      tagline: 'Effortlessly migrate tailwind.config.js to CSS @theme variables and @utility rules',
      description: 'Transforms bloated JavaScript configuration files into pure modern CSS variables supported by the high-performance Tailwind v4 engine.',
      version: '2.0.0',
      author: marketAuthors[2],
      categories: ['Coding', 'Design'],
      installs: 8900,
      rating: 4.8,
      ratingCount: 194,
      trained: true,
      visibility: 'public',
      license: 'Apache-2.0',
      files: [{ path: 'SKILL.md', content: '# Tailwind v4 Rules\nMigrates plugins to custom CSS properties.' }],
      examples: [{ id: 'ex_tw_1', prompt: 'Migrate theme colors to @theme block in tokens.css', expected: 'Produces valid CSS' }],
      changelog: [{ version: '2.0.0', at: '2026-10-15', notes: 'Tailwind 4.x engine support.' }],
      publishedAt: '2026-09-01',
      updatedAt: '2026-10-15',
    },
    {
      id: 'list_rust_safety',
      name: 'Rust Lifetime & Borrow Checker Sage',
      tagline: 'Disentangles complex lifetime annotations and zero-copy abstractions',
      description: 'Guides your Antigravity agent to explain and resolve tricky borrow checker compilation errors without resorting to unnecessary clones or unsafe blocks.',
      version: '1.3.1',
      author: marketAuthors[8],
      categories: ['Coding'],
      installs: 6300,
      rating: 5.0,
      ratingCount: 145,
      trained: true,
      visibility: 'public',
      license: 'MIT',
      files: [{ path: 'SKILL.md', content: '# Rust Lifetimes\nCovers GATs, HRTB, and Pin projection.' }],
      examples: [{ id: 'ex_rs_1', prompt: 'Fix self-referential struct without unsafe', expected: 'Replaces with ouroboros pattern' }],
      changelog: [{ version: '1.3.1', at: '2026-10-20', notes: 'Rust 2024 edition compatibility.' }],
      publishedAt: '2026-08-10',
      updatedAt: '2026-10-20',
    },
    {
      id: 'list_python_polars',
      name: 'Polars Fast Dataframe Engine',
      tagline: 'Write blazing fast vectorized analytical queries over lazy Polars dataframes',
      description: 'Replaces sluggish pandas workflows with Rust-backed Polars lazy evaluation expressions, SIMD optimization, and Parquet streaming.',
      version: '1.0.5',
      author: marketAuthors[7],
      categories: ['Data', 'Coding'],
      installs: 5400,
      rating: 4.7,
      ratingCount: 88,
      trained: true,
      visibility: 'public',
      license: 'MIT',
      files: [{ path: 'SKILL.md', content: '# Polars Pipelines\nOptimized expression syntax.' }],
      examples: [{ id: 'ex_pol_1', prompt: 'Convert pandas groupby apply to polars lazy expressions', expected: 'Valid polars plan' }],
      changelog: [{ version: '1.0.5', at: '2026-10-02', notes: 'Streaming chunking fixes.' }],
      publishedAt: '2026-07-25',
      updatedAt: '2026-10-02',
    },
    {
      id: 'list_arxiv_distill',
      name: 'ArXiv Deep Paper Distiller',
      tagline: 'Extracts empirical formulas, architecture diagrams & math proof sketches',
      description: 'Turns 40-page machine learning preprints into executive summaries, mathematical intuition checks, and PyTorch reproduction snippets.',
      version: '2.4.0',
      author: marketAuthors[3], // Elena Rostova
      categories: ['Research', 'Writing'],
      installs: 11200,
      rating: 4.9,
      ratingCount: 310,
      trained: true,
      visibility: 'public',
      license: 'MIT',
      files: [{ path: 'SKILL.md', content: '# ArXiv Distiller\nDeconstructs papers into motivation, methodology, and empirical metrics.' }],
      examples: [{ id: 'ex_ar_1', prompt: 'Summarize MoE routing paper with attention equations', expected: 'Returns latex and markdown' }],
      changelog: [{ version: '2.4.0', at: '2026-11-01', notes: 'Added Gemini 4 multi-modal diagram extraction.' }],
      publishedAt: '2026-05-15',
      updatedAt: '2026-11-01',
    },
    {
      id: 'list_k8s_helm',
      name: 'Kubernetes Helm & GitOps Architect',
      tagline: 'Production Kubernetes manifests, cert-manager, ArgoCD rollouts',
      description: 'Full-stack infrastructure as code skill. Generates hardened k8s specs, pod disruption budgets, horizontal pod autoscaling, and ArgoCD application sets.',
      version: '3.0.2',
      author: marketAuthors[4],
      categories: ['DevOps'],
      installs: 7800,
      rating: 4.8,
      ratingCount: 165,
      trained: true,
      visibility: 'public',
      license: 'Apache-2.0',
      files: [{ path: 'SKILL.md', content: '# K8s GitOps\nSecure defaults and RBAC.' }],
      examples: [{ id: 'ex_k8s_1', prompt: 'Generate ArgoCD canary rollout with Prometheus metric analysis', expected: 'Valid yaml' }],
      changelog: [{ version: '3.0.2', at: '2026-10-18', notes: 'Updated for Kubernetes 1.32.' }],
      publishedAt: '2026-06-20',
      updatedAt: '2026-10-18',
    },
    {
      id: 'list_tech_writer',
      name: 'Diátaxis Technical Documentation Suite',
      tagline: 'Structure engineering docs into Tutorials, How-To Guides, Reference & Explanation',
      description: 'Enforces the world-renowned Diátaxis documentation framework. Prevents tutorial/reference mix-ups and keeps user documentation crisp and searchable.',
      version: '1.2.0',
      author: marketAuthors[9],
      categories: ['Writing', 'Productivity'],
      installs: 4300,
      rating: 4.7,
      ratingCount: 92,
      trained: false,
      visibility: 'public',
      license: 'MIT',
      files: [{ path: 'SKILL.md', content: '# Diataxis Rules\nClear separation of intent.' }],
      examples: [],
      changelog: [{ version: '1.2.0', at: '2026-09-12', notes: 'Added interactive code sandbox embeds.' }],
      publishedAt: '2026-07-01',
      updatedAt: '2026-09-12',
    },
    {
      id: 'list_figma_tokens',
      name: 'Figma Design Tokens to Tailwind/CSS Exporter',
      tagline: 'Synchronize typography, color ramps, shadows, and radii straight from Figma',
      description: 'Parses Figma token payloads and emits strict CSS custom variables, keeping developer code in 1:1 parity with design design systems.',
      version: '1.5.0',
      author: marketAuthors[5], // Aiko
      categories: ['Design', 'Coding'],
      installs: 9400,
      rating: 4.9,
      ratingCount: 220,
      trained: true,
      visibility: 'public',
      license: 'MIT',
      files: [{ path: 'SKILL.md', content: '# Figma Token Exporter\nParses W3C design token format.' }],
      examples: [{ id: 'ex_fig_1', prompt: 'Convert Figma semantic color ramps to CSS variables', expected: 'Produces token palette' }],
      changelog: [{ version: '1.5.0', at: '2026-10-25', notes: 'Dark mode variable pairing.' }],
      publishedAt: '2026-06-11',
      updatedAt: '2026-10-25',
    },
    {
      id: 'list_sql_tuning',
      name: 'PostgreSQL EXPLAIN ANALYZE Wizard',
      tagline: 'Diagnose sequential scans, missing GIN indexes & join buffer spillage',
      description: 'Feeds raw EXPLAIN (ANALYZE, BUFFERS) query plans into your agent to receive actionable indexing recommendations and CTE restructuring.',
      version: '2.1.3',
      author: marketAuthors[6],
      categories: ['Data', 'DevOps'],
      installs: 6100,
      rating: 4.8,
      ratingCount: 130,
      trained: true,
      visibility: 'public',
      license: 'PostgreSQL',
      files: [{ path: 'SKILL.md', content: '# Query Optimizer\nIndex strategies for pgvector and btree.' }],
      examples: [{ id: 'ex_sql_1', prompt: 'Optimize query with 5 nested loops and 200ms execution', expected: 'Proposes index scan' }],
      changelog: [{ version: '2.1.3', at: '2026-10-29', notes: 'Added pgvector index tuning.' }],
      publishedAt: '2026-05-30',
      updatedAt: '2026-10-29',
    },
    {
      id: 'list_prompt_eval',
      name: 'LLM Prompt Regression & Eval Harness',
      tagline: 'Run automated assertions against golden datasets with semantic similarity scoring',
      description: 'Build reliable CI/CD pipelines for your AI prompts. Measures hallucination rate, latency percentiles, and schema adherence across model releases.',
      version: '1.0.8',
      author: marketAuthors[1],
      categories: ['Research', 'Productivity'],
      installs: 5100,
      rating: 4.6,
      ratingCount: 84,
      trained: true,
      visibility: 'public',
      license: 'MIT',
      files: [{ path: 'SKILL.md', content: '# Eval Harness\nGolden dataset testing.' }],
      examples: [{ id: 'ex_eval_1', prompt: 'Run eval matrix for customer service sentiment prompt', expected: 'Generates report table' }],
      changelog: [{ version: '1.0.8', at: '2026-09-18', notes: 'Added Gemini Argon evaluation metrics.' }],
      publishedAt: '2026-08-01',
      updatedAt: '2026-09-18',
    },
    {
      id: 'list_pr_reviewer',
      name: 'Conventional PR Reviewer & Security Audits',
      tagline: 'Deep AST-aware pull request reviews with OWASP Top 10 vulnerability checks',
      description: 'Acts as an uncompromising code reviewer. Flags race conditions, uncontrolled resource consumption, SQL injections, and logic pitfalls.',
      version: '2.2.0',
      author: marketAuthors[0], // Majidul
      categories: ['Coding', 'DevOps'],
      installs: 12500,
      rating: 4.9,
      ratingCount: 340,
      trained: true,
      visibility: 'public',
      license: 'MIT',
      files: [{ path: 'SKILL.md', content: '# PR Reviewer\nComprehensive checklist.' }],
      examples: [{ id: 'ex_pr_1', prompt: 'Review JWT verification logic in Express middleware', expected: 'Flags algorithm confusion' }],
      changelog: [{ version: '2.2.0', at: '2026-10-10', notes: 'Added supply-chain dependency auditing.' }],
      publishedAt: '2026-04-12',
      updatedAt: '2026-10-10',
    },
    {
      id: 'list_voice_memo',
      name: 'Voice Memo to Structured Kanban Task',
      tagline: 'Transcribe audio thoughts into prioritized actionable issues with acceptance criteria',
      description: 'Converts unstructured audio ramblings into crisp Jira/Linear tickets with title, context, steps, and priority estimation.',
      version: '1.1.2',
      author: marketAuthors[4],
      categories: ['Productivity', 'Writing'],
      installs: 3900,
      rating: 4.5,
      ratingCount: 62,
      trained: false,
      visibility: 'public',
      license: 'MIT',
      files: [{ path: 'SKILL.md', content: '# Voice to Task\nExtraction of intents and blockers.' }],
      examples: [],
      changelog: [{ version: '1.1.2', at: '2026-08-14', notes: 'Linear markdown format support.' }],
      publishedAt: '2026-07-15',
      updatedAt: '2026-08-14',
    },
    {
      id: 'list_shader_glsl',
      name: 'GLSL & WebGL Shader Magician',
      tagline: 'Raymarching, noise functions, SDF primitives & Three.js custom materials',
      description: 'Write ultra-smooth GPU fragment and vertex shaders. Includes math helpers for Perlin noise, domain repetition, and volumetric fog.',
      version: '1.4.0',
      author: marketAuthors[5],
      categories: ['Design', 'Coding'],
      installs: 4800,
      rating: 4.8,
      ratingCount: 110,
      trained: true,
      visibility: 'public',
      license: 'MIT',
      files: [{ path: 'SKILL.md', content: '# Shader Magician\nRaymarching primitives.' }],
      examples: [{ id: 'ex_sh_1', prompt: 'Create an undulating chromatic aberration water shader', expected: 'Valid GLSL code' }],
      changelog: [{ version: '1.4.0', at: '2026-09-30', notes: 'Three.js NodeMaterial bridge.' }],
      publishedAt: '2026-06-14',
      updatedAt: '2026-09-30',
    },
    {
      id: 'list_openapi_ts',
      name: 'OpenAPI 3.1 to Typed Fetch SDK Generator',
      tagline: 'Zero-overhead type-safe API clients with automatic retry and Zod validation',
      description: 'Consumes OpenAPI / Swagger specifications and generates lightweight, zero-dependency client code with full TypeScript intellisense.',
      version: '1.8.0',
      author: marketAuthors[6],
      categories: ['Coding'],
      installs: 7200,
      rating: 4.7,
      ratingCount: 155,
      trained: true,
      visibility: 'public',
      license: 'MIT',
      files: [{ path: 'SKILL.md', content: '# OpenAPI Generator\nType-safe schema mappings.' }],
      examples: [{ id: 'ex_oa_1', prompt: 'Generate typed client for GitHub REST API v3', expected: 'Produces clean fetcher' }],
      changelog: [{ version: '1.8.0', at: '2026-10-14', notes: 'Zod v4 compatibility.' }],
      publishedAt: '2026-05-18',
      updatedAt: '2026-10-14',
    },
    {
      id: 'list_biotech_crispr',
      name: 'Genomic FASTA & CRISPR Guide RNA Designer',
      tagline: 'Screen off-target effects and score Cas9 protospacer adjacent motifs (PAM)',
      description: 'Specialized computational biology skill for screening genomic sequences, alignment scoring, and CRISPR off-target prediction.',
      version: '0.9.8',
      author: marketAuthors[3],
      categories: ['Research', 'Other'],
      installs: 2100,
      rating: 4.9,
      ratingCount: 58,
      trained: true,
      visibility: 'public',
      license: 'GPL-3.0',
      files: [{ path: 'SKILL.md', content: '# CRISPR Guide Designer\nPAM motif detection algorithms.' }],
      examples: [{ id: 'ex_cr_1', prompt: 'Score 20bp gRNA candidates for human exon 3', expected: 'Outputs ranking table' }],
      changelog: [{ version: '0.9.8', at: '2026-09-05', notes: 'Added Cas12a PAM evaluation.' }],
      publishedAt: '2026-07-20',
      updatedAt: '2026-09-05',
    },
    {
      id: 'list_incident_postmortem',
      name: 'SRE Blameless Post-Mortem Facilitator',
      tagline: 'Construct timeline of events, identify root causes, and draft preventive action items',
      description: 'Guides engineering teams through post-incident retrospectives following Google SRE principles. Eliminates finger-pointing and prioritizes systemic reliability.',
      version: '1.3.0',
      author: marketAuthors[2],
      categories: ['DevOps', 'Writing'],
      installs: 5600,
      rating: 4.8,
      ratingCount: 122,
      trained: true,
      visibility: 'public',
      license: 'Creative Commons BY 4.0',
      files: [{ path: 'SKILL.md', content: '# Blameless Post-Mortems\nRoot cause analysis with 5 Whys.' }],
      examples: [{ id: 'ex_sre_1', prompt: 'Format postmortem for 45-minute database failover outage', expected: 'Produces comprehensive postmortem' }],
      changelog: [{ version: '1.3.0', at: '2026-10-12', notes: 'Automated Slack timeline ingestion.' }],
      publishedAt: '2026-06-05',
      updatedAt: '2026-10-12',
    },
    {
      id: 'list_music_dsp',
      name: 'WebAudio & VST DSP Audio Algorithm Architect',
      tagline: 'Biquad filters, fast Fourier transforms & analog synth oscillator emulation',
      description: 'Generates high-performance AudioWorklet processors, distortion algorithms, and reverbs for web audio and native C++ JUCE plugins.',
      version: '1.1.0',
      author: marketAuthors[8],
      categories: ['Other', 'Coding'],
      installs: 2800,
      rating: 4.9,
      ratingCount: 71,
      trained: true,
      visibility: 'public',
      license: 'MIT',
      files: [{ path: 'SKILL.md', content: '# DSP Architecture\nFilter transfer functions and delay buffers.' }],
      examples: [{ id: 'ex_dsp_1', prompt: 'Write state variable filter in WebAudio AudioWorklet', expected: 'Glitch-free audio node' }],
      changelog: [{ version: '1.1.0', at: '2026-08-22', notes: 'SIMD float arrays acceleration.' }],
      publishedAt: '2026-06-28',
      updatedAt: '2026-08-22',
    },
    {
      id: 'list_ux_microcopy',
      name: 'UX Microcopy & Error State Empathy Doctor',
      tagline: 'Turn confusing stack traces and cryptic modals into human-first helpful guidance',
      description: 'Specialized copywriting skill that audits buttons, empty states, tooltip explanations, and destructive action warnings for clarity and empathy.',
      version: '2.0.1',
      author: marketAuthors[9],
      categories: ['Design', 'Writing'],
      installs: 6700,
      rating: 4.8,
      ratingCount: 160,
      trained: true,
      visibility: 'public',
      license: 'MIT',
      files: [{ path: 'SKILL.md', content: '# UX Microcopy Rules\nAction-oriented buttons, gentle errors.' }],
      examples: [{ id: 'ex_ux_1', prompt: 'Rephrase "403 Forbidden: Invalid Token" into user friendly message', expected: 'Helpful guidance with re-auth button' }],
      changelog: [{ version: '2.0.1', at: '2026-10-05', notes: 'Localization friendly tone adjustments.' }],
      publishedAt: '2026-05-22',
      updatedAt: '2026-10-05',
    },
    {
      id: 'list_graphql_mesh',
      name: 'GraphQL Federation & Subgraph Composer',
      tagline: 'Apollo Federation v2 schemas with entity resolvers and field set keys',
      description: 'Composes decentralized GraphQL subgraphs without naming collisions. Enforces @key, @requires, and @provides directives.',
      version: '1.6.2',
      author: marketAuthors[7],
      categories: ['Coding', 'Data'],
      installs: 4100,
      rating: 4.6,
      ratingCount: 89,
      trained: false,
      visibility: 'public',
      license: 'MIT',
      files: [{ path: 'SKILL.md', content: '# Federation Rules\nComposable schema definitions.' }],
      examples: [],
      changelog: [{ version: '1.6.2', at: '2026-09-15', notes: 'Apollo Router compatibility.' }],
      publishedAt: '2026-07-10',
      updatedAt: '2026-09-15',
    },
    {
      id: 'list_wasm_bindgen',
      name: 'Rust to WebAssembly Bindgen Bridge',
      tagline: 'Export zero-copy memory buffers between browser JavaScript and Rust wasm',
      description: 'Generates wasm-pack glue code, memory pointers, and WebWorker threads for high-performance browser modules.',
      version: '1.2.4',
      author: marketAuthors[0], // Majidul
      categories: ['Coding'],
      installs: 5900,
      rating: 4.9,
      ratingCount: 142,
      trained: true,
      visibility: 'public',
      license: 'MIT',
      files: [{ path: 'SKILL.md', content: '# Wasm Bindgen\nSharedArrayBuffer patterns.' }],
      examples: [{ id: 'ex_wasm_1', prompt: 'Pass ImageData buffer to Rust wasm for image convolution', expected: 'Produces zero-copy wasm bridge' }],
      changelog: [{ version: '1.2.4', at: '2026-09-28', notes: 'Wasm SIMD 128 bit support.' }],
      publishedAt: '2026-06-01',
      updatedAt: '2026-09-28',
    },
    {
      id: 'list_patent_prior_art',
      name: 'Patent Claim Deconstruction & Prior Art Search',
      tagline: 'Analyze patent independent claims and identify non-obvious prior art citations',
      description: 'Assists intellectual property attorneys and inventors in structuring patent disclosures and running technical novelty searches.',
      version: '1.0.2',
      author: marketAuthors[3],
      categories: ['Research', 'Writing'],
      installs: 1950,
      rating: 4.7,
      ratingCount: 45,
      trained: true,
      visibility: 'public',
      license: 'MIT',
      files: [{ path: 'SKILL.md', content: '# Patent Analysis\nIndependent vs dependent claims.' }],
      examples: [{ id: 'ex_pat_1', prompt: 'Deconstruct claim 1 of AI inference pipeline into element matrix', expected: 'Clean element table' }],
      changelog: [{ version: '1.0.2', at: '2026-08-30', notes: 'USPTO claim terminology guidelines.' }],
      publishedAt: '2026-07-22',
      updatedAt: '2026-08-30',
    },
    {
      id: 'list_cloudflare_workers',
      name: 'Cloudflare Workers & D1 Edge Architect',
      tagline: 'Edge compute handlers, D1 SQLite migrations, KV caching & Durable Objects',
      description: 'Crafts globally distributed serverless workers with sub-millisecond cold starts and transactional SQLite at the edge.',
      version: '2.0.4',
      author: marketAuthors[2],
      categories: ['DevOps', 'Coding'],
      installs: 8100,
      rating: 4.8,
      ratingCount: 204,
      trained: true,
      visibility: 'public',
      license: 'MIT',
      files: [{ path: 'SKILL.md', content: '# Workers & D1\nWrangler v3 configurations.' }],
      examples: [{ id: 'ex_cf_1', prompt: 'Create Durable Object counter with WebSockets', expected: 'Valid worker script' }],
      changelog: [{ version: '2.0.4', at: '2026-10-16', notes: 'Smart placement auto-routing.' }],
      publishedAt: '2026-05-10',
      updatedAt: '2026-10-16',
    },
    {
      id: 'list_accessibility_wcag',
      name: 'WCAG 2.2 AAA Accessibility Auditor',
      tagline: 'Automated aria attributes, focus traps, color contrast and screen reader cues',
      description: 'Audits JSX/HTML against strict WCAG AAA guidelines. Validates keyboard navigation flows, aria-expanded states, and landmarks.',
      version: '1.3.5',
      author: marketAuthors[5],
      categories: ['Design', 'Productivity'],
      installs: 7300,
      rating: 4.9,
      ratingCount: 188,
      trained: true,
      visibility: 'public',
      license: 'MIT',
      files: [{ path: 'SKILL.md', content: '# WCAG 2.2 Auditor\nScreen reader heuristics.' }],
      examples: [{ id: 'ex_a11y_1', prompt: 'Make custom combobox fully keyboard accessible with roving tabindex', expected: 'Valid accessible component' }],
      changelog: [{ version: '1.3.5', at: '2026-10-22', notes: 'WCAG 2.2 focus appearance rules.' }],
      publishedAt: '2026-06-19',
      updatedAt: '2026-10-22',
    },
    {
      id: 'list_finance_backtester',
      name: 'Quantitative Algorithmic Strategy Backtester',
      tagline: 'Vectorized historical simulation with slippage, transaction costs & Sharpe ratios',
      description: 'Simulates quantitative trading models with walk-forward validation and Monte Carlo drawdown analysis.',
      version: '1.1.5',
      author: marketAuthors[7],
      categories: ['Data', 'Other'],
      installs: 3600,
      rating: 4.6,
      ratingCount: 76,
      trained: true,
      visibility: 'public',
      license: 'MIT',
      files: [{ path: 'SKILL.md', content: '# Quantitative Backtesting\nRisk metrics calculation.' }],
      examples: [{ id: 'ex_fin_1', prompt: 'Calculate Sortino and Calmar ratio on daily returns', expected: 'Produces statistical metrics' }],
      changelog: [{ version: '1.1.5', at: '2026-09-19', notes: 'Tick data slippage models.' }],
      publishedAt: '2026-07-08',
      updatedAt: '2026-09-19',
    },
  ];

  let reviews: Review[] = [
    {
      id: 'rev_1',
      listingId: 'list_react_19',
      author: marketAuthors[4], // Devon
      rating: 5,
      text: 'Migrated 42 components in our core dashboard in less than an hour. The useActionState patterns saved us tons of boilerplate.',
      at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      id: 'rev_2',
      listingId: 'list_react_19',
      author: marketAuthors[7], // Priya
      rating: 5,
      text: 'Incredible accuracy on optimistic updates and rollback error boundaries.',
      at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    },
    {
      id: 'rev_3',
      listingId: 'list_tailwind_v4',
      author: marketAuthors[0], // Majidul
      rating: 5,
      text: 'Super clean CSS variable definitions. No more bloated node_modules loading during dev builds.',
      at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    },
    {
      id: 'rev_4',
      listingId: 'list_arxiv_distill',
      author: marketAuthors[6], // Lucas
      rating: 5,
      text: 'The mathematical equation breakdown is spot on. Reads LaTeX notation without hallucinating indices.',
      at: new Date(Date.now() - 1000 * 60 * 60 * 90).toISOString(),
    },
    {
      id: 'rev_5',
      listingId: 'list_pr_reviewer',
      author: marketAuthors[2], // Marcus
      rating: 5,
      text: 'Caught a severe race condition in our payment idempotency check before it hit staging.',
      at: new Date(Date.now() - 1000 * 60 * 60 * 110).toISOString(),
    },
    {
      id: 'rev_6',
      listingId: 'list_k8s_helm',
      author: marketAuthors[8], // Johan
      rating: 4,
      text: 'Very thorough pod disruption budgets and health checks. Would love more kustomize templates.',
      at: new Date(Date.now() - 1000 * 60 * 60 * 140).toISOString(),
    },
  ];

  let requests: SkillRequest[] = [
    {
      id: 'req_1',
      title: 'Need a skill for Bun test runner with mocked WebSocket servers',
      description: 'Looking for a skill that automatically writes Bun unit tests with native WebSocket mocking and binary buffer assertions.',
      bounty: '500 Community Credits',
      requester: marketAuthors[4],
      toAuthor: marketAuthors[0], // Addressed to me!
      status: 'open',
      replies: [
        {
          author: marketAuthors[0],
          text: 'I am working on this! Will publish a prototype this weekend.',
          at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
        },
      ],
      at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    },
    {
      id: 'req_2',
      title: 'Automated Playwright video recording with custom cursor overlays',
      description: 'Can someone create a skill that injects custom SVG cursor animations and pause callouts during Playwright video generation?',
      bounty: 'Anchor Pro Sponsor',
      requester: marketAuthors[7],
      toAuthor: marketAuthors[0], // Addressed to me!
      status: 'open',
      replies: [],
      at: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    },
    {
      id: 'req_3',
      title: 'Rust pgvector SIMD index generator',
      description: 'Need assistance building a high-speed HNSW index builder using pure Rust and AVX-512 instructions.',
      requester: marketAuthors[8],
      status: 'answered',
      replies: [
        {
          author: marketAuthors[3],
          listingId: 'list_rust_safety',
          text: 'You can combine the Rust Lifetime Sage with the Polars fast engine to implement this without unsafe.',
          at: new Date(Date.now() - 1000 * 60 * 60 * 15).toISOString(),
        },
      ],
      at: new Date(Date.now() - 1000 * 60 * 60 * 45).toISOString(),
    },
    {
      id: 'req_4',
      title: 'Three.js Gaussian Splatting rendering optimizer',
      description: 'Looking for a skill that converts raw .ply Gaussian splats into LOD-managed octrees for 60fps mobile rendering.',
      requester: marketAuthors[5],
      status: 'open',
      replies: [],
      at: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString(),
    },
    {
      id: 'req_5',
      title: 'OpenTelemetry Trace to Flamegraph Converter',
      description: 'A tool that ingests OTLP JSON traces and emits interactive SVG flamegraphs showing thread contention.',
      requester: marketAuthors[2],
      status: 'fulfilled',
      replies: [
        {
          author: marketAuthors[1],
          text: 'Fulfilled by Sarah Chen! Check the profiling suite.',
          at: new Date(Date.now() - 1000 * 60 * 60 * 80).toISOString(),
        },
      ],
      at: new Date(Date.now() - 1000 * 60 * 60 * 100).toISOString(),
    },
  ];

  let notifications: Notification[] = [
    {
      id: 'notif_1',
      kind: 'update',
      text: 'Update available for "React 19 Clean Modernizer" (v1.0.4 → v1.1.0)',
      at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      read: false,
      link: '/market?detail=list_react_19',
    },
    {
      id: 'req_notif_2',
      kind: 'request',
      text: 'Devon Miles sent you a custom skill request: "Bun test runner with mocked WebSocket servers"',
      at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
      read: false,
      link: '/market?tab=requests',
    },
    {
      id: 'share_notif_3',
      kind: 'share',
      text: 'Elena Rostova shared skill "V8 Memory & Frame Profiler" with you (Can Copy)',
      at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      read: true,
      link: '/skills?tab=shared',
    },
    {
      id: 'review_notif_4',
      kind: 'review',
      text: 'Marcus Thorne left a 5-star review on your listing "Conventional PR Reviewer"',
      at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      read: true,
      link: '/market?detail=list_pr_reviewer',
    },
  ];

  let syncStatus: SyncStatus = {
    driveConnected: true,
    driveEmail: 'majidulislam17068@gmail.com',
    lastSyncAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    pending: 0,
    conflicts: 1,
    usageBytes: 14859000, // ~14.8 MB
  };

  const syncListeners = new Set<(status: SyncStatus) => void>();

  const notifySync = () => {
    syncListeners.forEach((cb) => cb({ ...syncStatus }));
  };

  const conflictsList: Conflict[] = [
    {
      sessionId: 'sess_conflict_1',
      devices: ['MacBook Pro (16-inch)', 'Home Workstation'],
      at: new Date(Date.now() - 1000 * 60 * 85).toISOString(),
    },
  ];

  let settingsRecord: Record<string, unknown> = {
    cliPath: '/usr/local/bin/agy',
    cliVersion: '0.9.4-alpha.2 (build 20261108)',
    telemetryEnabled: false,
    theme: 'dark',
    density: 'compact',
    fontSize: 'medium',
    autoSaveSession: true,
    autoInstallSkills: false,
  };

  // The Mock Bridge Implementation
  return {
    system: {
      async cliStatus() {
        return {
          installed: true,
          path: '/usr/local/bin/agy',
          version: '0.9.4-alpha.2 (build 20261108)',
          updateAvailable: '0.9.5',
        };
      },
      async *installCli() {
        yield { phase: 'download', percent: 10, message: 'Contacting Google Antigravity repository...' };
        await new Promise((r) => setTimeout(r, 600));
        yield { phase: 'download', percent: 45, message: 'Downloading agy-darwin-arm64 v0.9.5 (34.2 MB)...' };
        await new Promise((r) => setTimeout(r, 800));
        yield { phase: 'install', percent: 75, message: 'Extracting binaries and verifying cryptographic signatures...' };
        await new Promise((r) => setTimeout(r, 800));
        yield { phase: 'verify', percent: 95, message: 'Verifying CLI daemon handshake...' };
        await new Promise((r) => setTimeout(r, 500));
        yield { phase: 'done', percent: 100, message: 'Antigravity CLI is ready!' };
      },
      async locateCli() {
        return '/usr/local/bin/agy';
      },
      async platform() {
        return 'darwin';
      },
      async openExternal(url: string) {
        if (typeof window !== 'undefined') {
          console.log('[MockBridge] openExternal:', url);
        }
      },
      async pickFolder() {
        return '/Users/majidul/dev/anchor-workspace';
      },
      async pickFiles() {
        return [
          {
            name: 'schema-v2.sql',
            path: '/Users/majidul/dev/schema-v2.sql',
            mime: 'application/sql',
            size: 4096,
          },
        ];
      },
    },

    auth: {
      async status() {
        return currentAccount;
      },
      async login() {
        await new Promise((r) => setTimeout(r, 1200));
        currentAccount = {
          email: 'majidulislam17068@gmail.com',
          name: 'Majidul Islam',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
          plan: 'google_ai_pro',
        };
        return currentAccount;
      },
      async logout() {
        currentAccount = null;
      },
    },

    devices: {
      async thisDevice() {
        return devices.find((d) => d.isThisDevice)!;
      },
      async rename(name: string) {
        const thisDev = devices.find((d) => d.isThisDevice);
        if (thisDev) {
          thisDev.name = name;
        }
      },
      async list() {
        return [...devices];
      },
    },

    models: {
      async list() {
        return [...models];
      },
    },

    projects: {
      async list() {
        return [...projects];
      },
    },

    sessions: {
      async list() {
        return [...sessions];
      },
      async get(id: string) {
        const s = sessions.find((item) => item.id === id);
        if (!s) {
          throw new Error(`Session ${id} not found`);
        }
        const steps = sessionStepsMap[id] || [
          {
            kind: 'user',
            id: createId('step'),
            text: s.preview || 'Initial prompt',
            at: s.createdAt,
          },
          {
            kind: 'agent',
            id: createId('step'),
            markdown: `Session **${s.title}** opened. Ready for commands. Origin device: \`${s.originDeviceId}\`.`,
            at: s.lastModified,
          },
        ];
        return { session: { ...s }, steps: [...steps] };
      },
      async create(input) {
        const thisDev = devices.find((d) => d.isThisDevice)!;
        const newSession: Session = {
          id: createId('sess'),
          title: input.title || 'New Session',
          preview: 'Empty conversation ready for input',
          agentId: input.agentId || 'agent_general',
          modelId: input.modelId || 'gemini-4-argon',
          effort: input.effort || 'medium',
          mode: input.mode || 'auto',
          workspacePaths: input.workspacePaths || ['/Users/majidul/dev/anchor'],
          originDeviceId: thisDev.id,
          syncEnabled: true,
          syncState: 'published',
          stepCount: 0,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          pinned: false,
        };
        sessions = [newSession, ...sessions];
        sessionStepsMap[newSession.id] = [];
        return { ...newSession };
      },
      async update(id, patch) {
        const idx = sessions.findIndex((s) => s.id === id);
        if (idx === -1) throw new Error('Session not found');
        sessions[idx] = { ...sessions[idx], ...patch, lastModified: new Date().toISOString() };
        return { ...sessions[idx] };
      },
      async setSync(id: string, enabled: boolean) {
        const sess = sessions.find((s) => s.id === id);
        if (!sess) throw new Error('Session not found');
        const thisDev = devices.find((d) => d.isThisDevice)!;
        if (sess.originDeviceId !== thisDev.id) {
          throw new Error('NOT_PARENT_SOURCE');
        }
        sess.syncEnabled = enabled;
        sess.syncState = enabled ? 'published' : 'local';
        sess.lastModified = new Date().toISOString();
        return { ...sess };
      },
      async delete(id: string) {
        sessions = sessions.filter((s) => s.id !== id);
        delete sessionStepsMap[id];
      },
      async exportMarkdown(id: string) {
        const s = sessions.find((item) => item.id === id);
        const steps = sessionStepsMap[id] || [];
        let md = `# ${s?.title || 'Session Export'}\n\n`;
        md += `_Exported from Anchor on ${new Date().toLocaleString()}_  \n`;
        md += `_Model: ${s?.modelId} | Origin: ${s?.originDeviceId}_\n\n---\n\n`;
        for (const step of steps) {
          if (step.kind === 'user') {
            md += `### User\n${step.text}\n\n`;
          } else if (step.kind === 'agent') {
            md += `### Agent\n${step.markdown}\n\n`;
          } else if (step.kind === 'tool_call') {
            md += `> **Tool:** \`${step.tool}\` (${step.status})\n\`\`\`json\n${JSON.stringify(step.args, null, 2)}\n\`\`\`\n\n`;
          }
        }
        return md;
      },
    },

    chat: {
      async *send(sessionId: string, text: string, attachments?: Attachment[]) {
        const userStep: Step = {
          kind: 'user',
          id: createId('step_u'),
          text,
          attachments,
          at: new Date().toISOString(),
        };

        if (!sessionStepsMap[sessionId]) {
          sessionStepsMap[sessionId] = [];
        }
        sessionStepsMap[sessionId].push(userStep);
        yield { type: 'step', step: userStep };

        // 1. Thinking step
        const thinkId = createId('step_th');
        const thinkingStep: Step = {
          kind: 'thinking',
          id: thinkId,
          text: 'Reasoning through execution graph and checking workspace constraints...',
          at: new Date().toISOString(),
        };
        sessionStepsMap[sessionId].push(thinkingStep);
        yield { type: 'step', step: thinkingStep };
        await new Promise((r) => setTimeout(r, 450));

        // 2. Tool call step
        const toolId = createId('step_tc');
        const toolStep: Step = {
          kind: 'tool_call',
          id: toolId,
          tool: 'read_workspace_file',
          args: { path: 'src/config/runtime.json', maxLines: 50 },
          status: 'pending',
          at: new Date().toISOString(),
        };
        sessionStepsMap[sessionId].push(toolStep);
        yield { type: 'step', step: toolStep };

        await new Promise((r) => setTimeout(r, 350));
        yield {
          type: 'step_update',
          id: toolId,
          patch: { status: 'running' },
        };

        await new Promise((r) => setTimeout(r, 450));
        yield {
          type: 'step_update',
          id: toolId,
          patch: {
            status: 'ok',
            durationMs: 380,
            output: '{\n  "runtimeVersion": "2026.4",\n  "antigravity": { "activeDaemon": true }\n}',
          },
        };

        // 3. Permission prompt (example for sensitive tool)
        if (text.toLowerCase().includes('delete') || text.toLowerCase().includes('exec') || text.toLowerCase().includes('deploy')) {
          const permId = createId('step_perm');
          const permStep: Step = {
            kind: 'permission',
            id: permId,
            tool: 'exec_command',
            description: 'Agent requested permission to execute shell command: `npm run build` in project workspace.',
            at: new Date().toISOString(),
          };
          sessionStepsMap[sessionId].push(permStep);
          yield { type: 'step', step: permStep };
        }

        // 4. Agent response with streaming tokens
        const agentId = createId('step_ag');
        const agentStep: Step = {
          kind: 'agent',
          id: agentId,
          markdown: '',
          streaming: true,
          at: new Date().toISOString(),
        };
        sessionStepsMap[sessionId].push(agentStep);
        yield { type: 'step', step: agentStep };

        const fullResponse = `I processed your request using the Antigravity CLI daemon.

### Execution Summary
- **Target Session**: \`${sessionId}\`
- **Model**: Loaded with calibrated reasoning tokens
- **Status**: Ready for iterative refinement

\`\`\`typescript
export function verifyState() {
  return { ok: true, timestamp: Date.now() };
}
\`\`\`

Feel free to ask for additional modifications, tests, or file diffs.`;

        const words = fullResponse.split(' ');
        for (const word of words) {
          await new Promise((r) => setTimeout(r, 25));
          yield { type: 'token', stepId: agentId, delta: word + ' ' };
        }

        yield {
          type: 'step_update',
          id: agentId,
          patch: { streaming: false, markdown: fullResponse },
        };

        // Update session in list
        const s = sessions.find((item) => item.id === sessionId);
        if (s) {
          s.preview = text.slice(0, 100);
          s.stepCount = sessionStepsMap[sessionId].length;
          s.lastModified = new Date().toISOString();
        }

        yield { type: 'done', sessionId };
      },

      async stop(sessionId: string) {
        console.log('[MockBridge] Stopped streaming for session', sessionId);
      },

      async resolvePermission(sessionId: string, stepId: string, decision: 'once' | 'always' | 'deny') {
        const steps = sessionStepsMap[sessionId];
        if (steps) {
          const s = steps.find((step) => step.id === stepId);
          if (s && s.kind === 'permission') {
            s.resolved = decision;
          }
        }
      },

      async resolveDiff(sessionId: string, stepId: string, accept: boolean) {
        const steps = sessionStepsMap[sessionId];
        if (steps) {
          const s = steps.find((step) => step.id === stepId);
          if (s && s.kind === 'diff') {
            s.accepted = accept;
          }
        }
      },
    },

    history: {
      async search(q, filters) {
        const query = q.toLowerCase().trim();
        return sessions.filter((s) => {
          if (query && !s.title.toLowerCase().includes(query) && !s.preview.toLowerCase().includes(query)) {
            return false;
          }
          if (filters?.deviceId && s.originDeviceId !== filters.deviceId) return false;
          if (filters?.agentId && s.agentId !== filters.agentId) return false;
          if (filters?.projectId && s.projectId !== filters.projectId) return false;
          if (filters?.synced !== undefined && s.syncEnabled !== filters.synced) return false;
          return true;
        });
      },
    },

    agents: {
      async list() {
        return [...agents];
      },
      async get(id: string) {
        const ag = agents.find((a) => a.id === id);
        if (!ag) throw new Error('Agent not found');
        return { ...ag };
      },
      async save(agentInput) {
        if (agentInput.id) {
          const idx = agents.findIndex((a) => a.id === agentInput.id);
          if (idx !== -1) {
            agents[idx] = { ...agents[idx], ...agentInput } as Agent;
            return { ...agents[idx] };
          }
        }
        const newAgent: Agent = {
          ...agentInput,
          id: createId('agent'),
          source: 'mine',
        };
        agents.push(newAgent);
        return { ...newAgent };
      },
      async delete(id: string) {
        const idx = agents.findIndex((a) => a.id === id);
        if (idx !== -1) {
          agents.splice(idx, 1);
        }
      },
    },

    skills: {
      async list() {
        return [...skills];
      },
      async get(id: string) {
        const sk = skills.find((s) => s.id === id);
        if (!sk) throw new Error('Skill not found');
        return { ...sk };
      },
      async save(skillInput) {
        if (skillInput.id) {
          const idx = skills.findIndex((s) => s.id === skillInput.id);
          if (idx !== -1) {
            skills[idx] = {
              ...skills[idx],
              ...skillInput,
              updatedAt: new Date().toISOString(),
            } as Skill;
            return { ...skills[idx] };
          }
        }
        const newSkill: Skill = {
          ...skillInput,
          id: createId('skill'),
          source: 'mine',
          sharedWith: [],
          updatedAt: new Date().toISOString(),
        };
        skills.push(newSkill);
        return { ...newSkill };
      },
      async delete(id: string) {
        skills = skills.filter((s) => s.id !== id);
      },
      async *evaluate(id: string) {
        const sk = skills.find((s) => s.id === id);
        if (!sk) return;
        for (const ex of sk.examples) {
          await new Promise((r) => setTimeout(r, 400));
          const pass = true;
          const output = `Evaluation passed: Generated output satisfied test conditions for prompt: "${ex.prompt.slice(0, 30)}..."`;
          ex.lastResult = { pass, output };
          yield { exampleId: ex.id, pass, output };
        }
      },
      async improve(id: string) {
        const sk = skills.find((s) => s.id === id);
        if (!sk) throw new Error('Skill not found');
        const file = sk.files.find((f) => f.path === 'SKILL.md');
        if (file) {
          file.content += `\n\n## Auto-Optimized Guidelines (${new Date().toLocaleDateString()})\n- Explicitly guard edge cases discovered during test evaluations.\n- Keep tool arguments minimal and idempotent.`;
        }
        sk.version = (parseFloat(sk.version) + 0.1).toFixed(1);
        sk.updatedAt = new Date().toISOString();
        return { ...sk };
      },
      async versions(id: string) {
        return [
          { version: '1.2.0', at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(), summary: 'Auto-improved edge handling' },
          { version: '1.1.0', at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), summary: 'Added test examples' },
          { version: '1.0.0', at: new Date(Date.now() - 1000 * 60 * 60 * 100).toISOString(), summary: 'Initial authoring' },
        ];
      },
      async rollback(id: string, version: string) {
        const sk = skills.find((s) => s.id === id);
        if (!sk) throw new Error('Skill not found');
        sk.version = version;
        sk.updatedAt = new Date().toISOString();
        return { ...sk };
      },
      async share(id: string, email: string, permission: 'view' | 'copy') {
        const sk = skills.find((s) => s.id === id);
        if (!sk) throw new Error('Skill not found');
        const shareObj: Share = { email, permission, sharedAt: new Date().toISOString() };
        sk.sharedWith = sk.sharedWith.filter((sh) => sh.email !== email);
        sk.sharedWith.push(shareObj);
        return shareObj;
      },
      async revoke(id: string, email: string) {
        const sk = skills.find((s) => s.id === id);
        if (!sk) return;
        sk.sharedWith = sk.sharedWith.filter((sh) => sh.email !== email);
      },
      async shareLink(id: string) {
        return `https://anchor.app/share/skill/${id}?token=${Math.random().toString(36).substring(2, 10)}`;
      },
      async importFromLink(link: string) {
        const newSkill: Skill = {
          id: createId('skill'),
          name: 'Imported Remote Skill',
          description: `Skill imported from verified Google Drive link: ${link}`,
          version: '1.0.0',
          author: 'External Collaborator',
          source: 'shared',
          triggers: ['imported', 'remote'],
          files: [{ path: 'SKILL.md', content: '# Remote Imported Skill\nLoaded safely from share link.' }],
          examples: [],
          sharedWith: [],
          updatedAt: new Date().toISOString(),
        };
        skills.push(newSkill);
        return newSkill;
      },
    },

    market: {
      async search(q, opts) {
        const query = (q || '').toLowerCase().trim();
        let items = listings.filter((item) => {
          if (opts?.category && !item.categories.includes(opts.category)) {
            return false;
          }
          if (!query) return true;
          return (
            item.name.toLowerCase().includes(query) ||
            item.tagline.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            item.author.name.toLowerCase().includes(query)
          );
        });

        if (opts?.sort === 'installs') {
          items.sort((a, b) => b.installs - a.installs);
        } else if (opts?.sort === 'rating') {
          items.sort((a, b) => b.rating - a.rating);
        } else if (opts?.sort === 'newest') {
          items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
        }

        return { items, nextPage: undefined };
      },
      async featured() {
        return listings.slice(0, 4);
      },
      async get(id: string) {
        const item = listings.find((l) => l.id === id);
        if (!item) throw new Error('Listing not found');
        return { ...item };
      },
      async reviews(id: string) {
        return reviews.filter((r) => r.listingId === id);
      },
      async review(id: string, rating: number, text: string) {
        const newRev: Review = {
          id: createId('rev'),
          listingId: id,
          author: marketAuthors[0],
          rating,
          text,
          at: new Date().toISOString(),
        };
        reviews.unshift(newRev);
        return newRev;
      },
      async install(id: string) {
        const list = listings.find((l) => l.id === id);
        if (!list) throw new Error('Listing not found');
        list.skillId = list.skillId || `skill_acquired_${list.id}`;
        list.installedVersion = list.version;
        list.installs += 1;

        const newLocalSkill: Skill = {
          id: list.skillId,
          name: list.name,
          description: list.tagline,
          version: list.version,
          author: list.author.name,
          source: 'mine', // In Mine -> Acquired
          triggers: list.categories.map((c) => c.toLowerCase()),
          files: [...list.files],
          examples: [...list.examples],
          sharedWith: [],
          updatedAt: new Date().toISOString(),
        };

        const existingIdx = skills.findIndex((s) => s.id === newLocalSkill.id);
        if (existingIdx !== -1) {
          skills[existingIdx] = newLocalSkill;
        } else {
          skills.push(newLocalSkill);
        }

        return newLocalSkill;
      },
      async uninstall(id: string) {
        const list = listings.find((l) => l.id === id);
        if (list) {
          if (list.skillId) {
            skills = skills.filter((s) => s.id !== list.skillId);
            delete list.skillId;
            delete list.installedVersion;
          }
        }
      },
      async checkUpdates() {
        return listings
          .filter((l) => l.installedVersion && l.installedVersion !== l.version)
          .map((l) => ({
            listingId: l.id,
            from: l.installedVersion!,
            to: l.version,
          }));
      },
      async publish(skillId, input) {
        const skill = skills.find((s) => s.id === skillId);
        const newListing: Listing = {
          id: createId('list'),
          skillId,
          name: input.name,
          tagline: input.tagline,
          description: input.description,
          version: skill?.version || '1.0.0',
          author: marketAuthors[0], // Majidul
          categories: input.categories,
          installs: 1,
          rating: 5.0,
          ratingCount: 1,
          trained: (skill?.examples.length || 0) > 0,
          visibility: input.visibility,
          license: input.license,
          files: skill?.files || [],
          examples: skill?.examples || [],
          changelog: [{ version: skill?.version || '1.0.0', at: new Date().toISOString(), notes: 'Initial public release' }],
          publishedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        listings.unshift(newListing);
        return newListing;
      },
      async unpublish(listingId: string) {
        listings = listings.filter((l) => l.id !== listingId);
      },
      async myListings() {
        return listings.filter((l) => l.author.id === 'auth_majidul');
      },
      async requests(filter) {
        if (filter === 'mine') {
          return requests.filter((r) => r.requester.id === 'auth_majidul');
        }
        if (filter === 'to_me') {
          return requests.filter((r) => r.toAuthor?.id === 'auth_majidul');
        }
        return [...requests];
      },
      async createRequest(input) {
        const toAuth = input.toAuthorId ? marketAuthors.find((a) => a.id === input.toAuthorId) : undefined;
        const newReq: SkillRequest = {
          id: createId('req'),
          title: input.title,
          description: input.description,
          bounty: input.bounty,
          requester: marketAuthors[0],
          toAuthor: toAuth,
          status: 'open',
          replies: [],
          at: new Date().toISOString(),
        };
        requests.unshift(newReq);
        return newReq;
      },
      async replyRequest(id, text, listingId) {
        const req = requests.find((r) => r.id === id);
        if (!req) throw new Error('Request not found');
        req.replies.push({
          author: marketAuthors[0],
          listingId,
          text,
          at: new Date().toISOString(),
        });
        if (req.status === 'open') {
          req.status = 'answered';
        }
        return { ...req };
      },
      async fulfillRequest(id) {
        const req = requests.find((r) => r.id === id);
        if (!req) throw new Error('Request not found');
        req.status = 'fulfilled';
        return { ...req };
      },
      async notifications() {
        return [...notifications];
      },
      async markRead(ids) {
        notifications.forEach((n) => {
          if (ids.includes(n.id)) {
            n.read = true;
          }
        });
      },
    },

    sync: {
      async status() {
        return { ...syncStatus };
      },
      async connectDrive() {
        syncStatus = {
          driveConnected: true,
          driveEmail: 'majidulislam17068@gmail.com',
          lastSyncAt: new Date().toISOString(),
          pending: 0,
          conflicts: 0,
          usageBytes: 15420000,
        };
        notifySync();
        return { ...syncStatus };
      },
      async disconnectDrive() {
        syncStatus = {
          driveConnected: false,
          pending: 0,
          conflicts: 0,
          usageBytes: 0,
        };
        notifySync();
      },
      async syncNow() {
        syncStatus.lastSyncAt = new Date().toISOString();
        syncStatus.pending = 0;
        notifySync();
        return { ...syncStatus };
      },
      async conflicts() {
        return [...conflictsList];
      },
      async resolveConflict(sessionId: string, as: 'parent' | 'merged') {
        const sess = sessions.find((s) => s.id === sessionId);
        if (sess) {
          sess.syncState = 'published';
        }
        const idx = conflictsList.findIndex((c) => c.sessionId === sessionId);
        if (idx !== -1) {
          conflictsList[idx].resolvedAs = as;
        }
        syncStatus.conflicts = Math.max(0, syncStatus.conflicts - 1);
        notifySync();
      },
      onChange(cb) {
        syncListeners.add(cb);
        return () => {
          syncListeners.delete(cb);
        };
      },
    },

    settings: {
      async get() {
        return { ...settingsRecord };
      },
      async set(patch) {
        settingsRecord = { ...settingsRecord, ...patch };
      },
    },
  };
}

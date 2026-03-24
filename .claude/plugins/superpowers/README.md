# Superpowers

Superpowers is a complete software development workflow for your coding agents, built on top of a set of composable "skills" and some initial instructions that make sure your agent uses them.

## How it works

It starts from the moment you fire up your coding agent. As soon as it sees that you're building something, it *doesn't* just jump into trying to write code. Instead, it steps back and asks you what you're really trying to do. 

Once it's teased a spec out of the conversation, it shows it to you in chunks short enough to actually read and digest. 

After you've signed off on the design, your agent puts together an implementation plan that's clear enough for an enthusiastic junior engineer with poor taste, no judgement, no project context, and an aversion to testing to follow. It emphasizes true red/green TDD, YAGNI (You Aren't Gonna Need It), and DRY. 

Next up, once you say "go", it launches a *subagent-driven-development* process, having agents work through each engineering task, inspecting and reviewing their work, and continuing forward. It's not uncommon for Claude to be able to work autonomously for a couple hours at a time without deviating from the plan you put together.

There's a bunch more to it, but that's the core of the system. And because the skills trigger automatically, you don't need to do anything special. Your coding agent just has Superpowers.


## Sponsorship

If Superpowers has helped you do stuff that makes money and you are so inclined, I'd greatly appreciate it if you'd consider [sponsoring my opensource work](https://github.com/sponsors/obra).

Thanks! 

- Jesse


## Installation

**Note:** Installation differs by platform. Claude Code or Cursor have built-in plugin marketplaces. Codex and OpenCode require manual setup.


### Claude Code (via Plugin Marketplace)

In Claude Code, register the marketplace first:

```bash
/plugin marketplace add obra/superpowers-marketplace
```

Then install the plugin from this marketplace:

```bash
/plugin install superpowers@superpowers-marketplace
```

### Cursor (via Plugin Marketplace)

In Cursor Agent chat, install from marketplace:

```text
/plugin-add superpowers
```

### Codex

Tell Codex:

```
Fetch and follow instructions from https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.codex/INSTALL.md
```

**Detailed docs:** [docs/README.codex.md](docs/README.codex.md)

### OpenCode

Tell OpenCode:

```
Fetch and follow instructions from https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.opencode/INSTALL.md
```

**Detailed docs:** [docs/README.opencode.md](docs/README.opencode.md)

### Verify Installation

Start a new session in your chosen platform and ask for something that should trigger a skill (for example, "help me plan this feature" or "let's debug this issue"). The agent should automatically invoke the relevant superpowers skill.

## The Core Workflow

### Phase 1: 规划阶段 (Planning Phase)

**1. brainstorming** - 项目启动前的头脑风暴
- 触发时机：开始编写代码之前
- 核心功能：通过提问细化粗略想法，探索替代方案，分段展示设计供验证
- 输出产物：设计文档（Spec）
- 命令：`/superpowers:brainstorm`

**2. using-git-worktrees** - 创建隔离的工作空间
- 触发时机：设计批准后
- 核心功能：在新分支上创建隔离工作区，运行项目设置，验证测试基线
- 输出产物：独立的 git worktree
- 命令：`/superpowers:using-git-worktrees`

**3. writing-plans** - 创建详细实施计划
- 触发时机：设计批准后
- 核心功能：将工作分解为小任务（每个2-5分钟），每个任务包含确切的文件路径、完整代码、验证步骤
- 输出产物：实施计划文档
- 命令：`/superpowers:write-plan`

### Phase 2: 执行阶段 (Execution Phase)

根据任务特点，选择以下三种执行方式之一：

**4a. executing-plans** - 分批执行 + 人工审查检查点
- 适用场景：大型复杂项目、需要分阶段人工审查、风险较高的任务
- 执行方式：批量执行任务（默认每批3个），每批完成后等待人工审查反馈
- 审查机制：批次间人工检查点
- 命令：`/superpowers:execute-plan`

**4b. subagent-driven-development** - 当前会话 + 自动两阶段审查
- 适用场景：任务基本独立、需要快速迭代、质量要求高
- 执行方式：为每个任务派发全新子代理，在当前会话中连续执行
- 审查机制：每个任务完成后自动进行两阶段审查（规格合规性 → 代码质量）
- 命令：`/superpowers:subagent-driven-development`

**4c. dispatching-parallel-agents** - 并行处理独立问题
- 适用场景：多个不相关的失败/bug/子系统问题，可以同时解决
- 执行方式：同时派发多个代理，并行工作
- 审查机制：所有代理完成后集成审查
- 命令：`/superpowers:dispatching-parallel-agents`

### Phase 3: 质量保证 (Quality Assurance)

**5. test-driven-development** - 测试驱动开发
- 触发时机：实施过程中
- 核心功能：强制执行 RED-GREEN-REFACTOR 循环：编写失败测试 → 观察失败 → 编写最小代码 → 观察通过 → 提交
- 质量保证：删除在测试之前编写的代码

**6. requesting-code-review** - 请求代码审查
- 触发时机：任务之间
- 核心功能：根据计划审查，按严重程度报告问题
- 质量保证：关键问题阻止进度

**7. verification-before-completion** - 完成前验证
- 触发时机：声称工作完成之前
- 核心功能：运行验证命令，确认输出，确保真正修复

### Phase 4: 完成阶段 (Completion Phase)

**8. finishing-a-development-branch** - 完成开发分支
- 触发时机：所有任务完成后
- 核心功能：验证测试，展示选项（合并/PR/保留/丢弃），清理 worktree
- 输出产物：集成的代码或 Pull Request

---

**重要提示：** 代理会在执行任何任务前自动检查相关技能。这些是强制性工作流程，而非建议。

### 执行方式选择决策树

```
有实施计划？
├─ 是 → 任务是否独立？
│   ├─ 是 → 需要人工审查？
│   │   ├─ 是 → executing-plans（分批执行 + 人工检查点）
│   │   └─ 否 → subagent-driven-development（自动两阶段审查）
│   └─ 否（紧密耦合）→ 手动执行或重新规划
└─ 否 → 是多个独立问题？
    ├─ 是 → dispatching-parallel-agents（并行处理）
    └─ 否 → 先使用 brainstorming 和 writing-plans
```

## What's Inside

### Skills Library

**Testing**
- **test-driven-development** - RED-GREEN-REFACTOR cycle (includes testing anti-patterns reference)

**Debugging**
- **systematic-debugging** - 4-phase root cause process (includes root-cause-tracing, defense-in-depth, condition-based-waiting techniques)
- **verification-before-completion** - Ensure it's actually fixed

**Collaboration** 
- **brainstorming** - Socratic design refinement
- **writing-plans** - Detailed implementation plans
- **executing-plans** - Batch execution with checkpoints
- **dispatching-parallel-agents** - Concurrent subagent workflows
- **requesting-code-review** - Pre-review checklist
- **receiving-code-review** - Responding to feedback
- **using-git-worktrees** - Parallel development branches
- **finishing-a-development-branch** - Merge/PR decision workflow
- **subagent-driven-development** - Fast iteration with two-stage review (spec compliance, then code quality)

**Meta**
- **writing-skills** - Create new skills following best practices (includes testing methodology)
- **using-superpowers** - Introduction to the skills system

## Philosophy

- **Test-Driven Development** - Write tests first, always
- **Systematic over ad-hoc** - Process over guessing
- **Complexity reduction** - Simplicity as primary goal
- **Evidence over claims** - Verify before declaring success

Read more: [Superpowers for Claude Code](https://blog.fsck.com/2025/10/09/superpowers/)

## Contributing

Skills live directly in this repository. To contribute:

1. Fork the repository
2. Create a branch for your skill
3. Follow the `writing-skills` skill for creating and testing new skills
4. Submit a PR

See `skills/writing-skills/SKILL.md` for the complete guide.

## Updating

Skills update automatically when you update the plugin:

```bash
/plugin update superpowers
```

## License

MIT License - see LICENSE file for details

## Support

- **Issues**: https://github.com/obra/superpowers/issues
- **Marketplace**: https://github.com/obra/superpowers-marketplace

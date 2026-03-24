---
name: executing-plans-agents
description: 当需要在独立 session 中执行实现计划时使用，自动按复杂度将任务分组为多个串行子代理，每个子代理完成后经过两阶段审查（规格合规性 → 代码质量）才启动下一个
---

# Executing Plans Agents

## 概述

加载计划，分析任务复杂度，按功能内聚性规划多个**串行**子代理批次，每批次实现完成后进行两阶段审查，全部通过后才启动下一个子代理。

**核心原则：** 复杂度感知分组 + 串行执行 + 双阶段自动审查 = 高质量自主推进

**启动时公告：** "我正在使用 executing-plans-agents skill 来执行此计划。"

---

## 复杂度分级标准

| 标记 | 步骤数 | 涉及文件 | 处理方式 |
|------|--------|---------|---------|
| S（小） | ≤3 步 | 1-2 个文件 | 2-3 个相关 S 任务合并为 1 个子代理 |
| M（中） | 4-7 步 | 3-5 个文件 | 1 个 M 任务独立为 1 个子代理 |
| L（大） | 8+ 步 | 6+ 个文件或架构变更 | 1 个 L 任务独立（必要时拆分为多个子代理） |

**分组规则：**
- 优先按**功能内聚性**分组（同一模块、同一特性的任务）
- S 任务：2-3 个相关 S 任务合并；孤立的 S 任务可独立成一个子代理
- M 任务：每个独立成一个子代理
- L 任务：每个独立成一个子代理；若估计工作量极大，可拆分为多个子代理
- 严禁跨功能边界强行合并

---

## 执行流程

### Step 1：加载并审查计划

1. 读取计划文件（完整内容）
2. 批判性审查计划：
   - 是否存在模糊或缺失的需求？
   - 任务之间是否存在隐含的依赖关系？
   - 是否有技术风险或架构疑问？
3. 若有疑虑：在开始前向用户提出并等待确认
4. 若无疑虑：使用 TodoWrite 记录所有任务，然后继续

---

### Step 2：复杂度分析与子代理规划

对计划中每个任务逐一评估复杂度（S / M / L），然后按功能内聚性分组，规划子代理批次。

**向用户公告规划结果，格式如下：**

```
复杂度分析完成：
- 任务 1（初始化配置）：S
- 任务 2（添加工具函数）：S
- 任务 3（实现核心模块）：M
- 任务 4（集成外部 API）：L

子代理规划（共 3 个子代理，串行执行）：
- 子代理 1：任务 1 + 任务 2（S+S，功能内聚：配置与工具层）
- 子代理 2：任务 3（M，核心模块实现）
- 子代理 3：任务 4（L，外部 API 集成）

准备开始执行，请确认。
```

等待用户确认后再启动子代理。

---

### Step 3：串行执行子代理

**对每个子代理，按以下顺序执行：**

#### 3a. 派发实现子代理

使用 Task tool（subagent_type=general-purpose）派发实现子代理。

参考 prompt 模板：
`/Users/fits-vue/.claude/plugins/cache/superpowers-dev-codeplugins/superpowers/4.3.1/skills/subagent-driven-development/implementer-prompt.md`

**派发时必须提供：**
- 本批次所有任务的完整文本（直接粘贴，不让子代理读文件）
- 场景说明：本批次在整体计划中的位置、依赖关系、架构背景
- 工作目录

**子代理提问时：**
- 清晰完整地回答
- 提供必要的额外上下文
- 不得催促子代理跳过问题直接实现

子代理自我审查完成并提交后，进入 Step 4。

---

### Step 4：两阶段审查

**Phase 1 先于 Phase 2，严禁乱序。**

#### Phase 1：规格合规性审查

参考 prompt 模板：
`/Users/fits-vue/.claude/plugins/cache/superpowers-dev-codeplugins/superpowers/4.3.1/skills/subagent-driven-development/spec-reviewer-prompt.md`

派发规格合规性审查子代理，验证：
- 是否实现了所有被请求的内容
- 是否存在遗漏的需求
- 是否构建了未请求的额外功能
- 实现是否符合规格意图

**结果判断：**
- 若审查通过（✅）：进入 Phase 2
- 若发现问题（❌）：
  1. 派发修复子代理（同一任务上下文，明确指出问题）
  2. 重新进行 Phase 1 审查
  3. 循环直到通过，方可进入 Phase 2

#### Phase 2：代码质量审查

仅在 Phase 1 通过后才派发。

参考 prompt 模板：
`/Users/fits-vue/.claude/plugins/cache/superpowers-dev-codeplugins/superpowers/4.3.1/skills/subagent-driven-development/code-quality-reviewer-prompt.md`

使用 `superpowers:code-reviewer` 子代理，传入：
- `WHAT_WAS_IMPLEMENTED`：来自实现子代理的报告
- `PLAN_OR_REQUIREMENTS`：本批次任务文本
- `BASE_SHA`：本批次开始前的 commit SHA
- `HEAD_SHA`：当前 commit SHA
- `DESCRIPTION`：本批次任务摘要

**结果判断：**
- 若审查通过（✅）：在 TodoWrite 中标记本批次所有任务为 completed，进入下一个子代理（回到 Step 3）
- 若发现问题（❌）：
  1. 派发修复子代理处理质量问题
  2. 重新进行 Phase 2 审查（无需重复 Phase 1，除非修复涉及规格变更）
  3. 循环直到通过

---

### Step 5：所有子代理完成后报告

所有子代理均通过两阶段审查后，向用户汇报：

```
所有子代理执行完毕：

子代理 1（任务 1+2）：✅ 规格合规 + ✅ 代码质量
子代理 2（任务 3）：✅ 规格合规 + ✅ 代码质量
子代理 3（任务 4）：✅ 规格合规 + ✅ 代码质量

变更文件摘要：[列出主要变更文件]
所有提交：[列出 commit SHA 和摘要]

准备进入收尾阶段。
```

---

### Step 6：完成开发分支

- 公告：「我正在使用 finishing-a-development-branch skill 完成此工作。」
- **必须调用：** `superpowers:finishing-a-development-branch`
- 按照该 skill 的指引验证测试、呈现选项并执行

---

## Critical Rules（严格禁止）

**关于并行执行：**
- **严禁**同时派发多个实现子代理（会导致 git 冲突和上下文污染）
- 必须等待当前子代理的两阶段审查全部通过，才能启动下一个子代理

**关于审查阶段：**
- **严禁**跳过任何审查阶段（Phase 1 和 Phase 2 都是必须的）
- **严禁**在 Phase 1 未通过前启动 Phase 2
- **严禁**以子代理的自我审查替代正式两阶段审查
- 审查发现问题 = 未完成，必须修复后重新审查

**关于实现质量：**
- **严禁**在 main/master 分支上开始实现（需用户明确同意或已有 worktree）
- **严禁**让子代理自行读取计划文件（由控制器提供完整任务文本）
- **严禁**跳过 Step 6 的收尾流程

**关于遇到阻碍：**
- 遇到阻碍时立即停止，向用户寻求澄清，不得猜测或绕过
- 不得强行推进无法解决的依赖问题

---

## 何时停止并寻求帮助

**立即停止执行，当：**
- 子代理连续两次审查仍无法通过
- 遇到计划中未描述的阻断性依赖
- 任务指令存在根本性歧义
- 测试持续失败且原因不明
- 实现过程中发现计划有重大缺陷

**停止时：** 向用户汇报当前进度、遇到的问题和需要的帮助，等待指引后再继续。

---

## Integration（依赖的 Skills）

**必须使用的工作流 Skills：**
- **superpowers:using-git-worktrees** - 必须：在开始前建立隔离工作区
- **superpowers:writing-plans** - 创建本 skill 所执行的计划
- **superpowers:requesting-code-review** - Phase 2 代码质量审查的模板
- **superpowers:finishing-a-development-branch** - Step 6 完成开发分支

**子代理应使用的 Skills：**
- **superpowers:test-driven-development** - 子代理在实现每个任务时遵循 TDD

**相关替代 Skills：**
- **superpowers:subagent-driven-development** - 在当前 session 执行（每任务一个子代理，无分组）
- **superpowers:executing-plans** - 批量执行但无自动子代理审查

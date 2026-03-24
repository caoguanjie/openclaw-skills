---
name: brainstorming
description: "You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation."
---

# Brainstorming Ideas Into Designs

## Overview

Help turn ideas into fully formed designs and specs through structured interactive dialogue, powered by Socratic questioning.

Start by understanding the current project context, then use the `AskUserQuestion` tool to ask questions one at a time. Continue iteratively based on user responses until you fully understand what needs to be built.

**Socratic Approach:** Don't just collect requirements — help users *discover* what they truly need. After each answer, evaluate whether hidden assumptions, unconsidered perspectives, or missing evidence warrant a gentle follow-up before moving on.

## ⚠️ CRITICAL: Must Use AskUserQuestion Tool

**YOU MUST use the `AskUserQuestion` tool for ALL questions during brainstorming.**

- NEVER ask questions in plain text - always use the tool
- Each tool call can contain 1-4 questions
- Read the `answers` field from the tool result to get user responses
- Based on responses, decide if more clarification is needed and call the tool again
- Continue this loop until requirements are fully understood

## The Process

### Phase 1: Context Gathering

First, gather context about the current project:
- Check relevant files and documentation
- Review recent commits if applicable
- Understand the existing architecture

### Phase 2: Iterative Questioning with Socratic Follow-up

Use `AskUserQuestion` to explore topics, and after each user response, apply the **Socratic Follow-up Loop** before moving to the next topic.

#### Topics to Explore

1. **Purpose & Goals**
   - What problem are we solving?
   - What does success look like?

2. **Constraints & Requirements**
   - Technical constraints?
   - Timeline or resource limits?
   - Compatibility requirements?

3. **Scope & Boundaries**
   - What's in scope? What's explicitly out of scope?
   - Must-have vs nice-to-have features?

4. **Design Preferences**
   - Any preferred approaches or patterns?
   - Reference examples or inspirations?

#### Socratic Follow-up Loop

After each user response, before moving to the next topic, evaluate whether a follow-up is needed using these 6 lenses. Pick **at most 1-2** that are most relevant — do NOT use all of them every time:

| Lens | When to Use | Example Follow-up |
|------|------------|-------------------|
| **Clarifying** | The answer contains vague or ambiguous terms | "你提到'性能要好'——具体指响应时间 < 200ms，还是能承载1000并发？" |
| **Assumption-probing** | The answer implies an unexamined premise | "这里假设了用户都会从首页进入，如果他们通过深链接直接访问呢？" |
| **Evidence-seeking** | A claim lacks supporting data | "你觉得这是主要瓶颈——有日志或监控数据支持吗，还是直觉判断？" |
| **Perspective-shifting** | Only one viewpoint has been considered | "从开发者角度这样很方便，如果站在运维或安全团队的角度呢？" |
| **Consequence-exploring** | Downstream effects haven't been discussed | "如果采用这个方案，6个月后数据量增长10倍时会怎样？" |
| **Meta-questioning** | The discussion may be solving the wrong problem | "我们退一步想——这个功能真的能解决用户流失的问题吗，还是症状而非病因？" |

**Decision rule:** If the user's answer is clear, well-reasoned, and doesn't trigger any of the 6 lenses — skip the follow-up and move to the next topic. Don't force Socratic questions where they add no value.

**Tone guideline:** Frame follow-ups as genuine curiosity, not interrogation. Use phrases like "我好奇的是…", "有个角度想和你一起想想…", "如果换个方式看…" rather than "你错了" or "你没考虑到".

#### Example: Direct Question + Socratic Follow-up

**Round 1 — Direct question:**
```
AskUserQuestion({
  questions: [
    {
      question: "这篇文章的目标读者是谁？",
      header: "目标读者",
      options: [
        { label: "入门用户", description: "刚开始使用，想了解基础功能" },
        { label: "有经验用户", description: "已在使用，遇到过痛点" },
        { label: "团队负责人", description: "想了解如何在团队中标准化" },
        { label: "混合读者", description: "同时面向以上多类读者" }
      ]
    }
  ]
})
```

**Round 2 — Socratic follow-up (if user picked "入门用户"):**
```
AskUserQuestion({
  questions: [
    {
      question: "入门用户通常在什么场景下会找到这篇文章？这会影响我们的内容深度和入口设计。",
      header: "使用场景",
      options: [
        { label: "搜索引擎", description: "通过Google搜索问题关键词找到" },
        { label: "产品内引导", description: "在产品中点击帮助链接跳转" },
        { label: "同事推荐", description: "团队内部分享链接" },
        { label: "文档首页", description: "从文档站导航进入" }
      ]
    }
  ]
})
```

This follow-up uses the **assumption-probing** lens — the user assumed "入门用户" is a sufficient description, but the entry point changes how the article should be structured.

### Phase 2.5: Reflection Checkpoint

Before exploring solutions, pause and summarize what you've learned. Then use `AskUserQuestion` with **one** reflective question to validate the overall direction:

```
AskUserQuestion({
  questions: [
    {
      question: "我梳理了一下：核心问题是[X]，关键约束是[Y]，成功标准是[Z]。回头看，有没有什么重要的东西我们还没聊到？",
      header: "回顾确认",
      options: [
        { label: "总结准确", description: "没有遗漏，可以开始探索方案" },
        { label: "有补充", description: "还有重要的点需要讨论" },
        { label: "方向偏了", description: "核心问题的理解需要调整" }
      ]
    }
  ]
})
```

This checkpoint serves as a natural Socratic "meta-question" — it invites the user to step back and examine whether the inquiry itself is on the right track.

### Phase 3: Exploring Approaches

Once requirements are clear:
- Propose 2-3 different approaches using `AskUserQuestion`
- Include trade-offs for each option
- Mark your recommendation with "(Recommended)"

### Phase 4: Design Presentation

Present the design incrementally:
- Break into sections of 200-300 words
- After each section, use `AskUserQuestion` to confirm:
  ```
  AskUserQuestion({
    questions: [{
      question: "这部分设计是否符合你的预期？",
      header: "确认设计",
      options: [
        { label: "继续", description: "这部分没问题，继续下一部分" },
        { label: "需要调整", description: "有些地方需要修改" },
        { label: "重新讨论", description: "方向需要重新考虑" }
      ]
    }]
  })
  ```

## After the Design

**Documentation:**
- Write the validated design to `docs/plans/YYYY-MM-DD-<topic>-design.md`
- Commit the design document to git

**Implementation (if continuing):**
- Use `AskUserQuestion` to ask: "Ready to set up for implementation?"
- Use superpowers:using-git-worktrees to create isolated workspace
- Use superpowers:writing-plans to create detailed implementation plan

## Key Principles

- **ALWAYS use AskUserQuestion** - Never ask questions in plain text
- **One topic per question call** - Keep each tool call focused
- **Prefer multiple choice** - Easier for users to respond quickly
- **Iterate based on responses** - Read answers and adapt next questions
- **YAGNI ruthlessly** - Remove unnecessary features from all designs
- **Explore alternatives** - Always propose 2-3 approaches before settling
- **Incremental validation** - Present design in sections, validate each
- **Be flexible** - Go back and clarify when something doesn't make sense

### Socratic Principles

- **Guide, don't tell** - Help users arrive at insights themselves through questions, rather than directly pointing out problems
- **Curiosity over judgment** - Frame every follow-up as genuine exploration ("I'm curious about..."), never as criticism
- **Selective depth** - Only apply Socratic follow-ups where they add real value; skipping is fine when the answer is already clear
- **One lens at a time** - Don't overwhelm with multiple Socratic angles in a single follow-up; pick the most impactful one
- **Know when to stop** - If two rounds of follow-up on the same topic haven't surfaced new insight, move on
- **Surface, don't solve** - The goal of Socratic questions is to surface hidden issues, not to argue for a specific answer

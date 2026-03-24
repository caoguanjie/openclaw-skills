---
name: fanqie-draft-scheduler
description: Automate Fanqie Novel writer-console draft publishing and timed release setup with Playwright. Use when the user wants to open the 番茄小说作家后台, enter 草稿箱, batch-process draft chapters, click 编辑/下一步/提交, handle 内容风险检测 prompts, choose 是否使用AI, and configure 定时发布 for a chapter range. Also use when the user wants strict stop-on-mismatch behavior for chapter numbering or a reusable workflow for Fanqie draft scheduling.
---

# Fanqie Draft Scheduler

Use this skill for high-repetition Fanqie Novel author-console tasks where chapters in the draft box must be converted into scheduled releases.

## Workflow

1. Confirm the release plan before touching the browser.
2. Reuse a persistent Playwright profile so login does not need to be repeated.
3. Open the Fanqie writer draft page and inspect the visible draft rows.
4. Validate that the current target chapter matches the expected chapter number.
5. Open the chapter editor from the draft list and walk through the publish flow.
6. Configure AI usage and timed release.
7. Verify the chapter leaves the draft list.
8. Stop immediately on numbering mismatch or missing target chapter.

## Clarify Before Running

Confirm these items with the user when they are not already explicit:

- Target book / draft-box URL
- Start and end chapter numbers
- First release date
- Daily release times
- Whether numbering mismatch should stop immediately
- Whether unexpected popups should be skipped only within the current chapter flow

For the workflow derived from this conversation, the canonical rules are:

- `第14章 -> 2026-03-11 06:00`
- Four chapters per day at `06:00`, `12:00`, `16:00`, `22:00`
- If chapter numbering does not match the expected sequence, stop immediately
- If a popup differs from the described flow, try to skip that popup branch without skipping the chapter itself

## Required Tools

- Use `playwright-skill` for browser automation
- Use a persistent browser context, typically `/tmp/fanqie-playwright-profile`
- Default to a visible browser (`headless: false`)

## Observed Fanqie Flow

Typical draft URL pattern:

```text
https://fanqienovel.com/main/writer/chapter-manage/<book-id-and-title>?type=2
```

Observed publish flow for an existing draft:

1. Open 草稿箱
2. Find the target row
3. Click the row's `编辑` link (`href` contains `modifydraft`)
4. In the editor, click `下一步`
5. If `发布提示` appears, click `提交`
6. If `是否进行内容风险检测？` appears, click `确定`
7. In `发布设置`:
   - choose `否` for `是否使用AI`
   - enable `定时发布`
   - set `日期`
   - set `时间`
   - click `确认发布`
8. Verify the page returns to chapter management and the chapter is no longer in the draft list

## Guardrails

Always apply these checks:

- If the page redirects to `/login` or a passport page, stop and ask the user to log in
- Read the visible draft rows before editing anything
- Compare the minimum visible chapter number with the expected target chapter number
- If the expected chapter is missing, stop immediately
- After each publish, reopen the draft list and confirm that chapter disappeared from drafts
- Do not silently continue past numbering mismatches

## Scheduling Logic

Use this formula for the schedule generated from a starting chapter and four daily time slots:

```text
index = chapter_num - base_chapter
 day_offset = floor(index / 4)
 slot = index % 4
 date = base_date + day_offset
 time = [06:00, 12:00, 16:00, 22:00][slot]
```

Example:

- `第14章 -> 2026-03-11 06:00`
- `第15章 -> 2026-03-11 12:00`
- `第16章 -> 2026-03-11 16:00`
- `第17章 -> 2026-03-11 22:00`
- `第18章 -> 2026-03-12 06:00`

If needed, generate the full mapping with:

```bash
python3 .claude/skills/fanqie-draft-scheduler/scripts/generate_schedule.py 14 120 2026-03-11
```

## Browser Automation Pattern

Use a `/tmp` script file and run it via `playwright-skill`.

Suggested shape:

```javascript
const { chromium } = require('playwright');

const DRAFT_URL = '...';
const USER_DATA_DIR = '/tmp/fanqie-playwright-profile';

(async () => {
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    slowMo: 40,
    viewport: { width: 1440, height: 960 },
  });
  const page = context.pages()[0] || (await context.newPage());

  // 1. goto drafts
  // 2. verify visible rows
  // 3. click modifydraft link
  // 4. next -> submit -> confirm risk
  // 5. choose AI=no, enable timed publish, set date/time
  // 6. confirm publish
  // 7. verify chapter left draft list
})();
```

## Selectors And UI Anchors

Prefer resilient selectors over brittle coordinates:

- Draft editor link: `a[href*="modifydraft"]`
- Next button: `getByRole('button', { name: /下一步/ })`
- Submit button in publish prompt: `getByRole('button', { name: /^提交$/ })`
- Risk confirm: `getByRole('button', { name: /^确定$/ })`
- Publish settings modal: `.arco-modal.publish-confirm-container-new`
- AI choice `否`: label containing `否`
- Schedule switch: `button[role="switch"]`
- Date input: `input[placeholder="请选择日期"]`
- Time input: `input[placeholder="请选择时间"]`
- Final confirm: `getByRole('button', { name: '确认发布' })`

## Recovery Strategy

If the user accidentally clicks inside the browser or the run is interrupted:

1. Re-open the draft page
2. Read the remaining draft rows
3. Resume from the smallest remaining chapter number
4. Recompute the correct date/time from the original base chapter and base date
5. Continue until the draft list is empty or the requested end chapter is reached

## Output Expectations

At the end, report:

- Which chapter range was completed
- Where the run stopped, if it stopped early
- Whether any retries were needed
- Final draft count, ideally `共0篇草稿` / `暂无草稿` when the full target range is done

---
name: hr-system
description: Automate FITS EHR RedseaPlatform login plus the fixed 外出申请 and 请假申请 workflows. Use when the user wants to log in to https://ehr.fits.com.cn/RedseaPlatform/, read HR_USER and HR_PASS from environment variables or a local .env file, solve the login captcha from the original image/base64 data rather than screenshots, open the fixed 外出申请链接 or 请假申请链接, ask for the required business fields before submission, submit the request, and verify the created approval item. This skill must use the agent-browser skill for browser automation.
---

# HR System

## Overview

Use this skill for the FITS EHR fixed workflows:

- 外出申请
- 请假申请

Keep the workflow tight: load credentials, read and use the `agent-browser` skill, log in, open the fixed form URL, ask for missing business fields, fill the form, submit, and verify success.

Read:

- `references/egress-application.md` for 外出申请
- `references/leave-application.md` for 请假申请

Use `scripts/read_hr_env.py` to load credentials before asking the user for secrets.

## Workflow

### 0. Load the browser skill first

Before any browser action, read and follow the `agent-browser` skill.

If it is not already loaded, run:

```bash
openskills read agent-browser
```

Do not improvise browser tooling when `agent-browser` is available.

### 0.1 Use a canonical browser session

For this HR workflow, use a fixed `agent-browser` session name:

```bash
agent-browser --session fits_ehr ...
```

or equivalently:

```bash
npx -y agent-browser --session fits_ehr ...
```

Why:

- Reuse the authenticated session across login, 外出申请, and 请假申请
- Avoid creating new browser contexts unnecessarily
- Make the workflow deterministic and faster

Default to `fits_ehr` unless there is a concrete need for isolation.

### 0.2 Preferred command pattern

Prefer these command shapes consistently:

```bash
npx -y agent-browser --session fits_ehr open "<url>"
npx -y agent-browser --session fits_ehr snapshot -i -c
npx -y agent-browser --session fits_ehr get url
npx -y agent-browser --session fits_ehr eval "<js>"
npx -y agent-browser --session fits_ehr wait 2000
```

Reuse these patterns instead of inventing ad hoc command forms each time.

### 0.3 Normalize user inputs before browser actions

Before filling any HR form, normalize user-provided values:

- Convert datetime values to `yyyy-MM-dd HH:mm`
- Replace Chinese punctuation such as `：` with `:`
- Strip extra spaces and words like `年`, `月`, `日`
- If the user gives a city but omits the province, derive the province when it is obvious (example: `广州` → `广东省`)
- If the user gives an ambiguous datetime, stop and ask for the exact full datetime before submitting

Do this normalization before login retry loops, form filling, and success verification.

### 0.4 Command construction rule

For non-trivial browser JavaScript:

- Do **not** inline long JS snippets directly into a one-line shell command
- Prefer writing the JS to a temporary file and executing it
- Prefer a short Python wrapper that calls `subprocess.run([...])` / `subprocess.check_output([...])`

This avoids zsh quoting issues, history expansion problems, and fragile shell escaping.

### 1. Load credentials

Run:

```bash
python3 scripts/read_hr_env.py
```

Rules:

- Prefer existing environment variables `HR_USER` and `HR_PASS`.
- If they are absent, read them from the nearest `.env`.
- If either value is still missing, ask the user only for the missing item.
- Never hardcode credentials into the skill files.

### 1.1 Credential handling safety

- Read credentials only from environment variables or `.env`
- Do **not** paste `HR_USER` / `HR_PASS` directly into shell command strings unless there is no safer practical option in the current runtime
- Prefer helper scripts that read environment variables at runtime
- Never echo credentials back to the user after they are provided


### 2. Open login page and authenticate

Use `agent-browser`.

Preferred flow:

1. Open the login URL from `references/egress-application.md`.
2. Inspect the captcha image source from the DOM.
3. Do **not** use screenshot OCR.
4. If the captcha source is a `data:` URL, decode/read its base64 directly.
5. If the captcha source is a normal URL, fetch the original image bytes inside the logged browser context and convert them to base64 or otherwise read the original image content.
6. Interpret the captcha from the original image data.
7. Fill account, password, captcha, then log in.
8. Confirm login by checking that the page leaves the login screen and lands in the EHR portal.

If already logged in, reuse the existing authenticated browser session instead of logging in again.

Prefer this login decision tree:

1. If an authenticated `fits_ehr` session already exists, reuse it.
2. Otherwise open the login page and prepare the captcha.
3. Save the captcha image locally.
4. Send the local captcha image to **TELEGRAM** instead of asking the user to inspect a local file path manually.
5. Wait for the user to reply with the captcha text through the normal conversation channel.
6. Attempt login.
7. If login fails and the page is still the login page, assume the captcha is stale/incorrect first:
   - refresh captcha
   - save the new captcha locally
   - resend the new captcha to **TELEGRAM**
   - ask the user only for the new captcha text

Do not ask the user to open `/tmp/.../captcha.jpg` manually if **TELEGRAM** fallback is available.

### 2.1 Logged-in session detection

Treat the session as authenticated only if:

- the current URL is no longer the login page, and
- the page title or main content clearly indicates the EHR portal / workbench / process center

Do not assume that an existing `fits_ehr` session is already logged in only because the session exists.

### 2.2 Captcha fallback priority

When human captcha help is needed, use this fallback order:

1. If **TELEGRAM** capability is available, send the captcha image to **TELEGRAM**
2. Otherwise, open the local captcha image on the user's machine with `open <path>`
3. Only if neither is available, send the local file path in chat and ask the user to inspect it manually

Canonical local files:

- first captcha: `/tmp/openclaw/hr-captcha.jpg`
- refreshed captcha: `/tmp/openclaw/hr-captcha-refresh.jpg`

Recommended login command sequence:

```bash
npx -y agent-browser --session fits_ehr open "https://ehr.fits.com.cn/RedseaPlatform/"
npx -y agent-browser --session fits_ehr snapshot -i -c
npx -y agent-browser --session fits_ehr eval "<read captcha src / original image data>"
npx -y agent-browser --session fits_ehr fill @account "<HR_USER>"
npx -y agent-browser --session fits_ehr fill @password "<HR_PASS>"
npx -y agent-browser --session fits_ehr fill @captcha "<captcha>"
npx -y agent-browser --session fits_ehr click @login
npx -y agent-browser --session fits_ehr wait 3000
npx -y agent-browser --session fits_ehr get url
```

Re-snapshot after login if the page changed.

### 3. Choose the target workflow

Decide which fixed workflow the user wants:

- 外出申请 → use `references/egress-application.md`
- 请假申请 → use `references/leave-application.md`

If the user gives a direct workflow URL, prefer that URL and still use the matching reference file for field mapping and rules.

### 4. Open the fixed workflow URL

Navigate directly to the verified workflow URL in the relevant reference file.

Recommended open pattern:

```bash
npx -y agent-browser --session fits_ehr open "<workflow-url>"
npx -y agent-browser --session fits_ehr wait 2000
npx -y agent-browser --session fits_ehr snapshot -i -c
```

After navigation, snapshot the page and confirm the expected required fields are present.

### 5. Ask the user for business fields before submitting

Before final submission, ask for the required fields if they were not already supplied in the user request.

For 外出申请, ask only the missing values from `references/egress-application.md`.

For 请假申请, ask only the missing values from `references/leave-application.md`.

If the user gives an ambiguous or malformed time, stop and ask for the exact full datetime before submitting.

### 6. Fill the form robustly

Use the field mapping in the relevant reference file.

Rules:

- Try normal browser fill first.
- If readonly date/city fields do not accept normal fill, set the DOM value directly and dispatch `input`, `change`, and `blur` events.
- If the auto-calculated duration does not populate after start/end time is set, set it to the correct value manually only after verifying the intended unit.
- If city values are set manually and matching province fields exist, populate the province fields too.
- For 请假申请, prefer the actual enum value shown on the page. Example: if the user says “带薪年假”, map it to the page option `带薪年休假`.
- Re-snapshot after filling and verify the visible values on screen before submitting.

### 7. Submit and confirm

1. Click `确认提交` / `#confirmSubmit`
2. Wait briefly and re-snapshot
3. If a confirmation modal appears with text like `确认提交?`, click the visible `确定`
4. Prefer a verified selector when available, such as `#custom-confirm-modal-ok`
5. Wait for redirect or list refresh
6. If no redirect happens, inspect whether the page is still waiting for final confirmation or is blocked by validation
7. If validation warnings appear, report them explicitly instead of guessing

Once the user has already provided the business fields, proceed through the confirmation modal automatically unless the page shows an unexpected warning or validation issue.

### 8. Verify success

Use two verification levels:

1. Open the fixed portal “我的流程” verification URL from the reference file for user-facing confirmation
2. Open the direct workflow list page from the reference file for reliable structured extraction

Do not rely only on the immediate post-submit redirect.

Verify success by checking that the newly created item appears in the workflow list page, then capture:

- 流水号
- 标题/流程名称
- 流程名称
- 申请时间
- 当前状态
- 当前环节

Return a short summary with those values.

### 8.1 Workflow list extraction rule

The workflow list may render data in separate table sections:

- one section for `流水号` and `标题/流程名称`
- another section for `状态`, `流程名称`, `申请时间`, `当前环节`

If so:

1. capture the newest matching workflow serial row first
2. capture the newest matching workflow status row second
3. merge the two pieces into one final result

Do not assume a single DOM row will contain every field.

## Guardrails

- Always use the `agent-browser` skill for browser automation.
- Stay scoped to the verified 外出申请 and 请假申请 workflows.
- Prefer direct URLs and verified field names over exploratory clicking.
- If the page structure changes materially, report the changed element instead of guessing.
- Use layered captcha fallback: **TELEGRAM** first, local `open` second, manual local path only as a last resort.
- Prefer direct list URLs for machine verification and portal URLs for user-facing confirmation.

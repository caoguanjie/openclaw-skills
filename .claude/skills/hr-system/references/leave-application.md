# FITS EHR 请假申请固定流程

## Fixed URL

```text
https://ehr.fits.com.cn/RedseaPlatform/WorkformEngine.mc?method=goToWorkFlow&formId=621a4e4e-25be-401b-b810-91bf00eb74a0&reqType=START&processType=96816&packageId=fengde&defProcessId=96816-6-20190103180525&version=2.0&formUrl=/WorkformEngine.mc?method=goToWorkFlow&formId=621a4e4e-25be-401b-b810-91bf00eb74a0&systemId=null
```

## Fixed verification URL

```text
https://ehr.fits.com.cn/RedseaPlatform/PtPortal.mc?method=classic#iframe&0&nworktoday-40175-99568-18541-37356&nworktoday-40175-99568-18541|/RedseaPlatform/jsp/workFlow/processRun/weProcess/we_process_div_new.jsp?1=1&_t=1773715779884&menuName=%E6%88%91%E7%9A%84%E6%B5%81%E7%A8%8B&_t=1773715779885
```

## Direct verification list URL

```text
https://ehr.fits.com.cn/RedseaPlatform/jsp/workFlow/processRun/weProcess/we_process_div_new.jsp?toTab=apply
```

## Canonical session

Use:

```bash
npx -y agent-browser --session fits_ehr ...
```

Keep the same `fits_ehr` session from login through submission and verification.

## Required user inputs

Ask for:

- 请假类型
- 开始时间
- 结束时间
- 请假理由

Optional:

- 代理人
- 证明文件本地路径

If the user provides an incomplete datetime, ask again for the exact full datetime.
Normalize datetime to `yyyy-MM-dd HH:mm` before filling.

Suggested compact prompt:

```text
请补充这些请假信息：
- 请假类型：
- 开始时间：
- 结束时间：
- 请假理由：
- 代理人（可空）：
- 证明文件本地路径（可空）：
```

## Verified page structure

- main reason field: `leave_reason`
- agent field: `work_agent`
- hidden/main leave type mirror field: `qj_type`
- line-item leave type select: `e5e1905a-8c06-4ae9-9c22-eabc83af8328.leave_type`
- line-item start time: `e5e1905a-8c06-4ae9-9c22-eabc83af8328.start_time`
- line-item end time: `e5e1905a-8c06-4ae9-9c22-eabc83af8328.end_time`
- auto duration fields:
  - `e5e1905a-8c06-4ae9-9c22-eabc83af8328.leave_days`
  - `e5e1905a-8c06-4ae9-9c22-eabc83af8328.leave_hours`
  - `e5e1905a-8c06-4ae9-9c22-eabc83af8328.QJ_days`
  - `e5e1905a-8c06-4ae9-9c22-eabc83af8328.QJ_hours`
- common submit button: `#confirmSubmit`
- common confirmation modal OK button: `#custom-confirm-modal-ok`

## Verified leave type options

- `01` → 带薪年休假
- `09` → 事假
- `04` → 病假
- `11` → 调休假
- `02` → 婚假
- `03` → 丧假
- `15` → 流产假
- `14` → 陪产假
- `05` → 产假
- `07` → 产检假
- `06` → 护理假
- `10` → 探亲假
- `17` → 工伤假
- `16` → 特殊病假

Normalize user wording to page wording when needed. Example:

- 用户说 `带薪年假` → 页面值使用 `带薪年休假`

## Form behavior notes

- Start/end time fields are readonly in the DOM.
- Normal fill may fail on readonly fields; direct DOM assignment plus `input`/`change`/`blur` dispatch is a reliable fallback.
- The page auto-links leave type and time to calculate duration and unit.
- If the page contains both a visible leave type control and a hidden/mirror field such as `qj_type`, keep them consistent.
- Verified example: `2026-03-18 09:00` to `2026-03-18 18:00` under `带薪年休假` calculated to `1.0000 天`, and the page total displayed `1.00 天`.
- Some leave categories on the page show special reminders about required proof files; if the selected leave type obviously requires a proof file and the user did not provide one, warn before submission.
- After filling leave type and time, re-snapshot and verify the visible duration/unit before submitting.
- If the auto-calculated duration fields do not populate, inspect the page state first; only fill duration manually after verifying the intended unit.

## Submission notes

After clicking `#confirmSubmit`:

1. wait briefly and re-snapshot
2. if a confirmation modal appears with text like `确认提交?`, click `#custom-confirm-modal-ok` or the visible `确定`
3. if no redirect happens, inspect whether the page is blocked by validation or still waiting for final confirmation
4. if proof-file warnings or leave-policy warnings appear, report them explicitly instead of guessing

## Success verification

After submission:

1. open the fixed verification URL above for user-facing confirmation
2. open the direct verification list URL for reliable structured extraction

Then verify the new item appears in the application list and capture:

- 流水号
- 标题/流程名称
- 流程名称
- 申请时间
- 当前状态
- 当前环节

Verified example result shape:

- 流程名称：`请假流程`
- 常见状态：`审批中`

## Extraction notes

The verification page may render the newest application in two logical table sections:

- a serial/title section containing values such as `FITS-QJLC-...` and the workflow title
- a status section containing `审批中`, `请假流程`, `申请时间`, and `当前环节`

When this happens:

1. capture the newest `FITS-QJLC-...` row for `流水号` and `标题/流程名称`
2. capture the newest `请假流程` row for `当前状态`, `申请时间`, and `当前环节`
3. merge them into one final result

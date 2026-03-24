# FITS EHR 外出申请固定流程

## Fixed URLs

- Login URL: `https://ehr.fits.com.cn/RedseaPlatform/`
- Egress apply URL:

```text
https://ehr.fits.com.cn/RedseaPlatform/WorkformEngine.mc?method=goToWorkFlow&formId=b8a8e477-3384-4203-8873-284373948aa5&reqType=START&processType=96816&packageId=fengde&defProcessId=96816-2-20190103114659&version=1.0&formUrl=/WorkformEngine.mc?method=goToWorkFlow&formId=b8a8e477-3384-4203-8873-284373948aa5&systemId=null
```

- Fixed verification URL:

```text
https://ehr.fits.com.cn/RedseaPlatform/PtPortal.mc?method=classic#iframe&0&nworktoday-40175-99568-18541-37356&nworktoday-40175-99568-18541|/RedseaPlatform/jsp/workFlow/processRun/weProcess/we_process_div_new.jsp?1=1&_t=1773715779884&menuName=%E6%88%91%E7%9A%84%E6%B5%81%E7%A8%8B&_t=1773715779885
```

- Direct verification list URL:

```text
https://ehr.fits.com.cn/RedseaPlatform/jsp/workFlow/processRun/weProcess/we_process_div_new.jsp?toTab=apply
```

## Canonical session

Use:

```bash
npx -y agent-browser --session fits_ehr ...
```

Keep the same `fits_ehr` session from login through submission and verification.

## Verified login elements

- account input: `#j_username`
- password input: `#j_password_2`
- captcha input: `#randCode`
- captcha image: `#randCodeImg`
- login button: `#login-btn`

## Captcha handling rule

Never use screenshot OCR for this login page.

Preferred order:

1. Read the captcha image `src`.
2. If it is a `data:` URL, decode/read its base64 directly.
3. If it is an image URL, fetch the original image bytes in the browser session and convert them to a data URL or base64.
4. Read the captcha from the original image content.

## Verified 外出申请 field mapping

- `START_DATE` → 开始时间
- `END_DATE` → 结束时间
- `egress_hour` → 外出时长
- `FROM_PROVINCE` → 始发地省份
- `FROM_CITY` → 始发城市
- `FROM_ADDRESS` → 始发地详细地址
- `TO_PROVINCE` → 目的地省份
- `TO_CITY` → 目的城市
- `TO_ADDRESS` → 目的地详细地址
- `REASON` → 事由

## Form behavior notes

- `START_DATE`, `END_DATE`, `FROM_CITY`, `TO_CITY` are readonly in the DOM.
- `FROM_PROVINCE` and `TO_PROVINCE` may also need to be populated when city values are injected manually.
- Standard browser fill may not work reliably for readonly fields.
- Robust fallback: set the DOM value manually and dispatch `input`, `change`, and `blur`.
- Verified time format: `yyyy-MM-dd HH:mm`
- Verified submit button: `#confirmSubmit`
- A confirmation dialog may appear with buttons `取消` and `确定`.
- Verified confirmation modal OK button: `#custom-confirm-modal-ok`

## Required user inputs

Ask for these values before submitting:

- 开始时间
- 结束时间
- 始发地省份（if not derivable from the city）
- 始发城市
- 始发地详细地址
- 目的地省份（if not derivable from the city）
- 目的城市
- 目的地详细地址
- 事由

Suggested prompt:

```text
请补充这些外出申请信息：
- 开始时间：
- 结束时间：
- 始发城市：
- 始发地详细地址：
- 目的城市：
- 目的地详细地址：
- 事由：
```

## Success verification

After submission:

1. open the fixed verification URL above for user-facing confirmation
2. open the direct verification list URL for reliable structured extraction

Then verify the new item appears in the application list with:

- 流程名称：`外出申请流程`
- 常见状态：`审批中`

Return:

- 流水号
- 标题/流程名称
- 流程名称
- 申请时间
- 当前状态
- 当前环节

## Extraction notes

The verification page may render the newest application in two logical table sections:

- a serial/title section containing values such as `FITS-WCSQ-...` and the workflow title
- a status section containing `审批中`, `外出申请流程`, `申请时间`, and `当前环节`

When this happens:

1. capture the newest `FITS-WCSQ-...` row for `流水号` and `标题/流程名称`
2. capture the newest `外出申请流程` row for `当前状态`, `申请时间`, and `当前环节`
3. merge them into one final result

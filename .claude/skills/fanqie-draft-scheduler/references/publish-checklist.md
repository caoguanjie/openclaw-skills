# Fanqie Publish Checklist

Use this reference when implementing or reviewing a Fanqie draft scheduling run.

## Preconditions

- User confirmed chapter range
- User confirmed base date and daily time slots
- User confirmed stop-on-mismatch rule
- Playwright persistent profile is available
- Draft page URL opens without redirecting to login

## Per-Chapter Checklist

1. Read draft rows currently visible on the smallest-number page
2. Verify the smallest visible chapter equals the expected target chapter
3. Open the target row's `modifydraft` editor link
4. Click `下一步`
5. If `发布提示` appears, click `提交`
6. If `是否进行内容风险检测？` appears, click `确定`
7. In `发布设置` choose `否` for AI
8. Enable `定时发布`
9. Set the computed date and time
10. Click `确认发布`
11. Reopen drafts and verify the chapter disappeared

## Stop Conditions

- Expected chapter number does not match visible ordering
- Expected target row is missing
- Login expired
- Publish confirmation does not return a success signal
- Published chapter still appears in the draft list

## Resume Rule

Resume from the smallest remaining draft chapter and keep using the original schedule baseline.

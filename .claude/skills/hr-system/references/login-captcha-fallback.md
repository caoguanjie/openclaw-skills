# FITS EHR 登录验证码回退

## Use this path when

- There is no active logged-in `fits_ehr` session
- Automatic captcha solving is not available or not reliable enough

## Goal

Use the most ergonomic available delivery path for the current runtime.

Preferred order:

1. Save the current captcha image locally
2. If **TELEGRAM** capability is available, send the local image to **TELEGRAM**
3. Otherwise, open the local image on the user's machine with `open <path>`
4. Only if neither of the above is available, send the local path in chat
5. Wait for the user to reply with the captcha text
6. Attempt login
7. If login fails, refresh the captcha and repeat

## Canonical local files

- First captcha: `/tmp/openclaw/hr-captcha.jpg`
- Refreshed captcha: `/tmp/openclaw/hr-captcha-refresh.jpg`

## Delivery behavior

Use whatever capability is already available in the runtime.

The skill requires this behavior:

- **TELEGRAM available**:
  - send the first captcha image to **TELEGRAM**
  - if login fails, send the refreshed captcha image to **TELEGRAM**
  - make it clear that the previous captcha is expired
- **No TELEGRAM, but local desktop open available**:
  - open the first captcha locally
  - if login fails, open the refreshed captcha locally
  - make it clear that the previous captcha is expired
- **Neither available**:
  - provide the local file path in chat as a last resort

## Retry rule

If login does not leave the login page, treat captcha mismatch/staleness as the first suspect.

Then:

1. Refresh captcha
2. Save the new captcha image
3. Deliver the new image using the best currently available path
4. Ask only for the new captcha text

Do not keep retrying the same captcha image.

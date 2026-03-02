# SocialPlug Curl Playbook

Use this when SocialPlug changes form fields or cookie behavior.

## What you send me

Paste one full working browser `curl` request for:

- `POST https://panel.socialplug.io/orderform/submit`

and (if possible) the matching page load:

- `GET https://panel.socialplug.io/order/youtube-services/portal...`

## What I will return to you

I will always give you these copy-ready sections:

1. `ProviderCredential` DB row values (Prisma Studio)
2. `.env` values
3. Required submit headers
4. Required submit form fields
5. Optional/fallback fields
6. Exact code diffs to apply

## Output format (I will use this)

```txt
PRISMA STUDIO (ProviderCredential)
provider=socialplug
key=cookies
value="<full cookie string from -b>"

ENV
SOCIALPLUG_EMAIL="..."

HEADERS
referer: https://panel.socialplug.io/order/youtube-services/portal
origin: https://panel.socialplug.io
x-requested-with: XMLHttpRequest
content-type: application/x-www-form-urlencoded; charset=UTF-8

FORM (required)
_token=<csrf token from page>
orderform=youtube-services
field_1[3]=...
options_1[3][0]=...
options_1[3][1]=Custom Comments
field_5=<youtube url>
field_10=<newline comments>
processor=balance
payment-method=balance

FORM (optional/fallback)
email=<if endpoint demands it>
dynamic-radio=<if endpoint demands it>
coupon=
```

## Quick checklist before retrying worker

1. Update `ProviderCredential` row (`provider=socialplug`, `key=cookies`) in Prisma Studio.
2. Update `SOCIALPLUG_EMAIL` only if current payload needs `email`.
3. Restart queue worker.
4. Approve/regenerate one YouTube queue item and test.

## Notes

- Cookies can expire often (`cf_clearance`, session, xsrf cookies).
- Preferred storage is DB (`ProviderCredential`) so updates are done in Prisma Studio without redeploy.
- Keep this curl private (contains active auth cookies).
- If request returns `422 email required`, we enable email field.
- If request returns `500`, we compare payload keys against latest curl first.

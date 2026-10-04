# Connection roadmap

## Available today: Paste & review

Paste a payment notification or receipt text. Local JavaScript rules recognize a currency-prefixed amount, common category keywords, an ISO date (`YYYY-MM-DD`), and income words such as “credited” or “received.” The user reviews an ordinary transaction form before saving.

If several currency-prefixed amounts appear, the amount stays blank. Dates otherwise default to today. This is a convenience parser, not AI, OCR, or a bank integration. It does not convert currencies, validate a receipt's authenticity, or handle every language or notification format. The text is not sent over the network; users should remove private details from the proposed description before saving.

## Planned: Gmail receipt drafts

Proposed flow: explicit opt-in → user-selected receipts → extracted drafts → duplicate review → user-approved import → disconnect/delete controls.

A production release would require Google OAuth configuration, a narrowly scoped permission design, token lifecycle handling, a privacy policy, and any applicable verification. Gmail read permissions can be restricted scopes; Google documents the requirements in [Choose Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes). Never place a client secret or refresh token in this static app or Local Storage. Decide whether a user-selected-message add-on or a secure backend is appropriate before requesting inbox-wide access.

## Planned: Google Pay / UPI statement import

Begin with a supported statement format supplied by the user, parse it locally where possible, and offer row-by-row validation plus duplicate review. Design file-size limits, currency validation, date handling, and error reporting before launch.

The documented [Google Pay Web API](https://developers.google.com/pay/api/web/overview) is a merchant checkout/payment-token API. It is not a generic API for reading a consumer's personal UPI history. Automatic history sync is therefore **not implemented or promised** here. Any future provider connection needs an officially supported data-access route, explicit consent, and its own security review.

No “Connect” button in this submission pretends authentication succeeded. The roadmap dialogs describe future behavior; the app requests no bank credentials, OTPs, email access, or payment permissions.

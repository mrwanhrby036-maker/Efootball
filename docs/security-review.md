# Browser-visible data review — 2026-11-20

## Scope and findings

This is a targeted review of the current repository and local HTTP server, not a penetration test or a guarantee about the live deployment or third-party code.

- A pattern scan of the 23 current text files (before adding this note) found no recognizable private keys, GitHub tokens, AWS access-key IDs, Google API keys, Supabase secret keys, JWTs, or non-empty literal API-key/client-secret assignments. Pattern scans can miss secrets; deployment environment values and Git history were not audited.
- Frontend HTML, JavaScript, public API addresses, the background video, and advertising zone identifiers are intentionally public. DevTools cannot securely be disabled or used as a security boundary.
- User-entered text and generated passwords exist in that user's page/DOM, and can be inspected by that user and by scripts running in the page. This is distinct from exposing server credentials.
- The keyboard conversion engine itself does not automatically transmit or persist input. Its clipboard and WhatsApp features run on explicit user actions; WhatsApp sharing intentionally places the output in an external URL.
- The user-requested AutoTag SDK (`https://acscdn.com/script/aclib.js`) now loads on the tools pages, including the password and keyboard pages. Third-party scripts execute with page privileges. No claim is made here that those scripts do or do not collect input. For stronger privacy, remove advertising/other third-party JavaScript from sensitive-input tools, or isolate those tools on a separate, third-party-script-free origin.
- The password generator now fails closed when Web Crypto is unavailable or fails; it no longer uses a legacy `Math.random()` fallback. Random selections use rejection sampling. The default readable pattern deliberately has less entropy than fully random mode, and the UI warns about this tradeoff.

## Fixes in this branch

- Replace AdSense loaders and banner slots on all twelve pages with a shared, failure-tolerant AutoTag initializer for zone `cojloeaark`. Allow the SDK domain explicitly in CSP, without wildcard network access or removing the existing security policy. See `docs/advertising.md` for the unverified provider-runtime dependencies and account-side setup.

- Add the requested readable password pattern: an initial capital, lowercase syllables, two digits and a final symbol by default (nine characters). Keep a fully random alternative, honor selected character types, regenerate on option changes, and remove absolute strength/cracking-time claims from the password page.
- Correct the keyboard example from `vj` (رت) to `vf` (رب), yielding exactly **الحمد لله رب العالمين**. Keep the actual key map faithful instead of applying hidden word substitutions.
- Align all eight preset inputs with their displayed outputs and remove a copied script that referenced a nonexistent input.
- Replace the local server's unrestricted file serving with a public-file allowlist. Block dotfiles, environment/configuration files, server/API source, traversal and symlink escapes. Preserve clean page URLs and video access.
- Add the response helpers the local API needs so invalid requests return proper JSON errors rather than crashing the development server.
- Ignore environment-file variants in Git, retaining only the empty `.env.example` template.
- Exclude environment files, repository metadata, local-server code, tests and review notes from future Vercel deployment inputs via `.vercelignore`. Do not exclude `api/`, which must execute server-side.

These ignore rules do not remove anything already committed or invalidate a leaked credential. If a real credential is ever exposed, rotate/revoke it first, then remove it from the code and history as appropriate.

## Validation and deployment limits

Run `npm test`: nineteen tests cover inline-script/JSON syntax, the exact Arabic phrase in both directions and Caps Lock, all presets, public routes, video MIME/size, private-path blocking, symlink blocking, malformed requests and API error responses. Password tests additionally cover all 15 nonempty character-option combinations across all lengths from 8 to 40 in both modes, default formatting, UI synchronization, secure-random failures, rejection sampling and no automatic network/persistence calls in the generator. `git diff --check` also passes.

Local-server tests do not prove how Vercel serves an existing deployment: Vercel does not run this development static server. Its existing deployment file tree could not be retrieved through the connector (404). The `.vercelignore` change applies only to future deployments. No manual Vercel deployment or environment-variable change is part of this work.

Keep real credentials in server-only environment variables and never interpolate them into frontend bundles, HTML, public configuration or API responses. Check the deployed site and network traffic again after a new deployment before making a live-site security claim.

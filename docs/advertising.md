# AutoTag integration

## Configuration

All twelve HTML pages load `/assets/js/ads.js` once with `defer`. This shared initializer adds the provider's original SDK over HTTPS:

- SDK: `https://acscdn.com/script/aclib.js`
- Script element ID: `aclib`
- Public zone ID supplied by the owner: `cojloeaark`
- Invocation: `window.aclib.runAutoTag({ zoneId: 'cojloeaark' })`

The call waits for SDK load, rather than running before `aclib` exists. Duplicate initialization and SDK-load errors do not interrupt the tools. No provider credentials are stored in frontend code. Old AdSense loaders, slots, push calls, unused banner CSS and the obsolete Google seller record have been removed; Google Search verification is preserved.

`ads.txt` contains only explanatory comments until the owner supplies the new provider's exact seller records. Do not substitute the AutoTag zone ID for a seller/account ID. If the provider requires authorized sellers for this account, that account-side step is still outstanding.

## Security and runtime limitations

- The existing CSP is retained. `script-src`, `connect-src` and `frame-src` explicitly allow `https://acscdn.com` and its subdomains. Old Google advertising origins were removed. Public market API and font origins remain available.
- The initial SDK URL was retrieved successfully, but its obfuscated third-party implementation was not executed or security-audited. The mock tests validate our integration, not the provider's ad-serving behavior.
- AutoTag may request additional configuration, creative, tracking or frame domains depending on the zone. Those hosts are not known from the owner's snippet. If the browser reports a CSP violation, capture the exact blocked URL and request type, verify it against provider guidance, then add only the needed origin to the matching directive. Do not remove CSP, enable `unsafe-eval`, or use unrestricted `https:` / `*` as a workaround.
- The SDK runs in the page, including the password and keyboard tools, as explicitly requested by the owner. Third-party JavaScript can access page content. Switching ad networks does not make sensitive-input tools isolated or private. A separate ad-free origin is recommended for sensitive tools.
- Actual formats, pop-ups/pop-unders if enabled, consent requirements, frequency caps, site approval and inventory depend on the provider account. The integration cannot guarantee an immediately visible ad. Review zone formats and applicable consent requirements in the provider dashboard.
- No manual Vercel deployment or account change is made. This change reaches the live site only after the GitHub changes are merged and its automatic deployment completes.

## Verification

Run `npm test`. Advertising-specific tests check all twelve page references, SDK load ordering, the exact zone ID, duplicate prevention, missing/blocked SDK behavior, provider exceptions, and the narrowly scoped CSP. The local server must return `/assets/js/ads.js` as `application/javascript`.

After deployment, test with a normal browser on the approved domain, inspect Network/Console, and distinguish blocked SDK requests, CSP errors, provider errors and legitimate no-fill responses. Never click live ads for testing.

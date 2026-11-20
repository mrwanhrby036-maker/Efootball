# Fixed banner integration

## Placement and configuration

All twelve HTML pages have one labelled banner placement: above the hero on the homepage, and above the main tool panel on tool pages. The slot is `#nexus-banner`, inside `.ad-banner`. It reserves a minimum height but has no fabricated ad content. Actual banner size and fill are controlled by the provider; fixed-size creatives can scroll horizontally on narrower screens rather than changing their contents or covering the tool.

The banner loader and rendering call are embedded directly in each page's HTML. There are no separately hosted frontend JavaScript files or committed test scripts. The only external JavaScript dependency for advertising is the provider's SDK:

- SDK: `https://acscdn.com/script/aclib.js`
- SDK script element ID: `aclib`
- Public banner zone ID supplied by the owner: `12474522`
- Invocation: `window.aclib.runBanner({ zoneId: '12474522' })`

The inline loader asynchronously loads the SDK, then inserts a self-contained inline rendering script into the slot. This preserves the script-parent placement semantics of the owner's embed rather than invoking it from the document head. Duplicate initialization and SDK-load errors do not interrupt the tools. The `data-ad-state` value `requested` only means that the call was made, not that the network supplied an ad.

The former AutoTag call is no longer used. AdSense loaders, slots, push calls and the obsolete Google seller record remain removed; Google Search verification is preserved.

`ads.txt` contains only explanatory comments until the owner supplies the new provider's exact seller records. Do not substitute the banner zone ID for a seller/account ID. If the provider requires authorized sellers for this account, that account-side step is still outstanding.

## Security and runtime limitations

- The existing CSP is retained. `script-src`, `connect-src` and `frame-src` explicitly allow `https://acscdn.com` and its subdomains. Public market API and font origins remain available.
- The initial SDK URL was retrieved successfully, but its obfuscated third-party implementation was not executed or security-audited. The in-memory checks validate our integration, not the provider's ad-serving behavior.
- The SDK may request additional configuration, creative, tracking or frame domains depending on the zone. Those hosts are not known from the owner's snippet. If the browser reports a CSP violation, capture the exact blocked URL and request type, verify it against provider guidance, then add only the needed origin to the matching directive. Do not remove CSP, enable `unsafe-eval`, or use unrestricted `https:` / `*` as a workaround.
- The SDK runs in the page, including the password and keyboard tools, as explicitly requested by the owner. Third-party JavaScript can access page content. Switching ad networks does not make sensitive-input tools isolated or private. A separate ad-free origin is recommended for sensitive tools.
- Actual creatives, consent requirements, frequency caps, site approval and inventory depend on the provider account. The integration cannot guarantee an immediately visible ad.
- No manual Vercel deployment or account change is made. This change reaches the live site only after the GitHub changes are merged and its automatic deployment completes.

## Verification

Verification is run using in-memory Node checks, without committing separate JavaScript test files. Checks cover page placements, SDK load ordering, the exact zone ID, execution from inside the slot, duplicate prevention, missing/blocked SDK behavior, provider exceptions, and the scoped CSP. Frontend code is inline in HTML; the pre-existing `server.js` and `api/tiktok.js` remain server-side and are not moved into browser pages.

After deployment, test with a normal browser on the approved domain, inspect Network/Console, and distinguish blocked SDK requests, CSP errors, provider errors and legitimate no-fill responses. Never click live ads for testing.

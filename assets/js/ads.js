/* AutoTag zone IDs are public identifiers, not API credentials. */
(function () {
    'use strict';

    // Avoid duplicate SDK loads / ad requests if this initializer runs twice.
    if (document.getElementById('aclib')) return;

    var sdk = document.createElement('script');
    sdk.id = 'aclib';
    sdk.type = 'text/javascript';
    sdk.src = 'https://acscdn.com/script/aclib.js';
    sdk.async = true;
    var requested = false;
    sdk.onload = function () {
        if (requested) return;
        if (!window.aclib || typeof window.aclib.runAutoTag !== 'function') {
            console.warn('AutoTag: provider API is unavailable.');
            return;
        }
        requested = true;
        try {
            window.aclib.runAutoTag({ zoneId: 'cojloeaark' });
        } catch (error) {
            // Ad provider failures must not interrupt the tools or disclose input.
            console.warn('AutoTag: initialization failed.');
        }
    };
    sdk.onerror = function () {
        console.warn('AutoTag: SDK failed to load or was blocked.');
    };
    document.head.appendChild(sdk);
}());

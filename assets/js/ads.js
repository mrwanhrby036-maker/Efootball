/* Advertising zone IDs are public identifiers, not API credentials. */
(function () {
    'use strict';

    var slot = document.getElementById('nexus-banner');
    if (!slot || document.getElementById('aclib')) return;

    var sdk = document.createElement('script');
    sdk.id = 'aclib';
    sdk.type = 'text/javascript';
    sdk.src = 'https://acscdn.com/script/aclib.js';
    sdk.async = true;
    var requested = false;
    sdk.onload = function () {
        if (requested) return;
        if (!window.aclib || typeof window.aclib.runBanner !== 'function') {
            slot.dataset.adState = 'unavailable';
            console.warn('Banner: provider API is unavailable.');
            return;
        }
        requested = true;
        // Execute the call from a script INSIDE the slot. Providers may locate
        // their banner using document.currentScript.parentNode, as in the supplied embed.
        var caller = document.createElement('script');
        caller.src = '/assets/js/banner.js';
        caller.onerror = function () {
            slot.dataset.adState = 'unavailable';
            console.warn('Banner: initializer failed to load.');
        };
        slot.appendChild(caller);
    };
    sdk.onerror = function () {
        slot.dataset.adState = 'unavailable';
        console.warn('Banner: SDK failed to load or was blocked.');
    };
    document.head.appendChild(sdk);
}());

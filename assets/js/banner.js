(function () {
    'use strict';

    var script = document.currentScript;
    var slot = script && script.parentNode;
    if (!slot || slot.id !== 'nexus-banner' || slot.dataset.adState === 'requested') return;

    if (!window.aclib || typeof window.aclib.runBanner !== 'function') {
        slot.dataset.adState = 'unavailable';
        console.warn('Banner: provider API is unavailable.');
        return;
    }
    // Requested is not a claim of fill: only the provider can supply an ad.
    slot.dataset.adState = 'requested';
    try {
        window.aclib.runBanner({ zoneId: '12474522' });
    } catch (error) {
        slot.dataset.adState = 'unavailable';
        console.warn('Banner: initialization failed.');
    }
}());

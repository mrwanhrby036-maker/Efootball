/**
 * NEXUS ULTRA V5 - Global Core JavaScript
 * Handles live ticker data, currency conversion, toast notifications,
 * FAQ accordions, and common utilities.
 */

'use strict';

// ─────────────────────────────────────────────────────────────
// Robust Fallback Market Data (Prevents any NaN display)
// ─────────────────────────────────────────────────────────────
var FALLBACK_GOLD_OUNCE_USD = 2685.50; // Realistic global gold ounce price (~$2,685)

var fallbackRates = {
    global: 1.0,
    USD: 1.0,
    EGP: 49.60,
    SAR: 3.75,
    AED: 3.67,
    KWD: 0.308,
    QAR: 3.64,
    BHD: 0.376,
    OMR: 0.385,
    YER: 250.25,
    JOD: 0.709,
    LYD: 4.88,
    LYB: 4.88,
    SYP: 13000.0,
    TND: 3.12,
    MAD: 10.05,
    DZD: 133.50
};

// Working state
var liveRates = Object.assign({}, fallbackRates);
var globalGoldOunceUSD = FALLBACK_GOLD_OUNCE_USD;
var isLiveDataLoaded = false;

var countryNames = {
    global: 'دولار أمريكي (USD)',
    USD: 'دولار أمريكي (USD)',
    EGP: 'جنيه مصري (EGP)',
    SAR: 'ريال سعودي (SAR)',
    AED: 'درهم إماراتي (AED)',
    KWD: 'دينار كويتي (KWD)',
    QAR: 'ريال قطري (QAR)',
    BHD: 'دينار بحريني (BHD)',
    OMR: 'ريال عماني (OMR)',
    YER: 'ريال يمني (YER)',
    JOD: 'دينار أردني (JOD)',
    LYD: 'دينار ليبي (LYD)',
    LYB: 'دينار ليبي (LYD)',
    SYP: 'ليرة سورية (SYP)',
    TND: 'دينار تونسي (TND)',
    MAD: 'درهم مغربي (MAD)',
    DZD: 'دينار جزائري (DZD)'
};

// ─────────────────────────────────────────────────────────────
// Toast Notifications
// ─────────────────────────────────────────────────────────────
function showToast(msg) {
    var toast = document.getElementById('cyberToast');
    if (!toast) return;
    var toastSubText = document.getElementById('toastSubText');
    if (toastSubText) {
        toastSubText.innerText = msg;
    }
    toast.classList.add('show');
    setTimeout(function() {
        toast.classList.remove('show');
    }, 3200);
}

// ─────────────────────────────────────────────────────────────
// Copy to Clipboard (Secure)
// ─────────────────────────────────────────────────────────────
function copyText(text, msg) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
            showToast(msg || ('تم النسخ بنجاح: ' + text.substring(0, 30)));
        }).catch(function() {
            fallbackCopyText(text, msg);
        });
    } else {
        fallbackCopyText(text, msg);
    }
}

function fallbackCopyText(text, msg) {
    var textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showToast(msg || 'تم النسخ بنجاح');
    } catch (err) {
        alert('يرجى تحديد النص ونسخه يدوياً');
    }
    document.body.removeChild(textArea);
}

// ─────────────────────────────────────────────────────────────
// URL Security Sanitizer (Defends against XSS)
// ─────────────────────────────────────────────────────────────
function isSafeHttpUrl(value) {
    return typeof value === 'string' && /^https?:\/\//i.test(value);
}

// ─────────────────────────────────────────────────────────────
// Live Ticker Update (Instantly populates with fallback, then updates from API)
// ─────────────────────────────────────────────────────────────
function updateTopTicker() {
    var topOunce = document.getElementById('topGoldOunce');
    var topUsdEgp = document.getElementById('topUsdEgp');
    var topUsdSar = document.getElementById('topUsdSar');

    var safeOunce = (!isNaN(globalGoldOunceUSD) && globalGoldOunceUSD > 0) ? globalGoldOunceUSD : FALLBACK_GOLD_OUNCE_USD;
    var safeEgp = (liveRates && !isNaN(liveRates.EGP) && liveRates.EGP > 0) ? liveRates.EGP : fallbackRates.EGP;
    var safeSar = (liveRates && !isNaN(liveRates.SAR) && liveRates.SAR > 0) ? liveRates.SAR : fallbackRates.SAR;

    if (topOunce) {
        topOunce.innerText = safeOunce.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '$';
    }
    if (topUsdEgp) {
        topUsdEgp.innerText = safeEgp.toFixed(2) + ' ج.م';
    }
    if (topUsdSar) {
        topUsdSar.innerText = safeSar.toFixed(2) + ' ر.س';
    }
}

// ─────────────────────────────────────────────────────────────
// Fetch Market Data from APIs (With Graceful Fallbacks)
// ─────────────────────────────────────────────────────────────
async function fetchLiveMarketData() {
    var currencyUpdated = false;
    var goldUpdated = false;

    // 1. Fetch Exchange Rates
    try {
        var currencyRes = await fetch('https://open.er-api.com/v6/latest/USD');
        if (currencyRes.ok) {
            var currencyData = await currencyRes.json();
            if (currencyData && currencyData.rates) {
                for (var key in fallbackRates) {
                    if (currencyData.rates[key] && !isNaN(currencyData.rates[key])) {
                        liveRates[key] = parseFloat(currencyData.rates[key]);
                    }
                }
                // Handle Libyan Dinar aliases
                if (currencyData.rates.LYD) {
                    liveRates.LYD = parseFloat(currencyData.rates.LYD);
                    liveRates.LYB = parseFloat(currencyData.rates.LYD);
                }
                currencyUpdated = true;
            }
        }
    } catch (e) {
        console.warn('Currency API unreachable, using realistic fallback rates:', e);
    }

    // 2. Fetch Gold Price (PAXGUSDT token represents 1 fine troy ounce of gold)
    try {
        var goldRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
        if (goldRes.ok) {
            var goldData = await goldRes.json();
            if (goldData && goldData.price && !isNaN(parseFloat(goldData.price))) {
                var parsedPrice = parseFloat(goldData.price);
                if (parsedPrice > 500 && parsedPrice < 10000) {
                    globalGoldOunceUSD = parsedPrice;
                    goldUpdated = true;
                }
            }
        }
    } catch (e) {
        console.warn('Gold API unreachable, using realistic fallback price:', e);
    }

    isLiveDataLoaded = currencyUpdated || goldUpdated;

    // Update ticker immediately
    updateTopTicker();

    // If on the gold tool page, update UI cards
    if (typeof updateGoldUI === 'function') {
        updateGoldUI();
    }
}

// ─────────────────────────────────────────────────────────────
// Global DOM Initialization
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    // Populate ticker with instant fallback to avoid delay or NaN
    updateTopTicker();

    // Fetch live data asynchronously
    fetchLiveMarketData();

    // Setup FAQ Accordion listeners
    var faqQuestions = document.querySelectorAll('.faq-question');
    faqQuestions.forEach(function(q) {
        q.addEventListener('click', function() {
            var parent = this.parentElement;
            if (parent) {
                parent.classList.toggle('open');
            }
        });
    });

    // Setup Homepage tool search filter if present
    var searchInput = document.getElementById('toolSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            var filter = this.value.trim().toLowerCase();
            var cards = document.querySelectorAll('.tool-card');
            cards.forEach(function(card) {
                var title = card.querySelector('.tool-card-title') ? card.querySelector('.tool-card-title').innerText.toLowerCase() : '';
                var desc = card.querySelector('.tool-card-desc') ? card.querySelector('.tool-card-desc').innerText.toLowerCase() : '';
                var tag = card.querySelector('.tool-card-tag') ? card.querySelector('.tool-card-tag').innerText.toLowerCase() : '';
                if (title.indexOf(filter) !== -1 || desc.indexOf(filter) !== -1 || tag.indexOf(filter) !== -1) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }
});

/**
 * NEXUS ULTRA V5 - Global Core JavaScript
 * Handles live market ticker, custom cyberpunk dropdowns, toast notifications,
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
// Live Ticker Update (Instantly populates with fallback, then updates from live stream)
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
// Fetch Market Data (With Graceful Fallbacks)
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
        // Fallback active
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
        // Fallback active
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
// CUSTOM CYBER DROPDOWN COMPONENT
// Replaces boring default browser / OS popups with stunning dark neon dropdowns
// ─────────────────────────────────────────────────────────────
function initCustomCyberSelects() {
    var selects = document.querySelectorAll('select.cyber-select');
    selects.forEach(function(select) {
        if (select.dataset.customized === 'true') return;
        select.dataset.customized = 'true';

        // Hide native select
        select.style.display = 'none';

        // Create dropdown container
        var container = document.createElement('div');
        container.className = 'cyber-dropdown';
        select.parentNode.insertBefore(container, select);
        container.appendChild(select);

        // Create trigger button
        var trigger = document.createElement('div');
        trigger.className = 'cyber-dropdown-trigger';
        trigger.setAttribute('tabindex', '0');

        var triggerText = document.createElement('span');
        triggerText.className = 'trigger-text';

        var arrow = document.createElement('i');
        arrow.className = 'fa-solid fa-chevron-down arrow-icon';

        trigger.appendChild(triggerText);
        trigger.appendChild(arrow);
        container.appendChild(trigger);

        // Create menu
        var menu = document.createElement('div');
        menu.className = 'cyber-dropdown-menu';

        // If more than 5 options, add live search filter
        var hasSearch = select.options.length > 5;
        var searchInput = null;
        if (hasSearch) {
            var searchBox = document.createElement('div');
            searchBox.className = 'cyber-dropdown-search';
            searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.placeholder = '🔍 ابحث في القائمة...';
            searchBox.appendChild(searchInput);
            menu.appendChild(searchBox);

            searchInput.addEventListener('input', function(e) {
                var q = e.target.value.toLowerCase().trim();
                var items = listContainer.querySelectorAll('.cyber-dropdown-item');
                items.forEach(function(item) {
                    var text = item.innerText.toLowerCase();
                    item.style.display = (text.indexOf(q) !== -1) ? 'flex' : 'none';
                });
            });

            searchBox.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        }

        // List container
        var listContainer = document.createElement('div');
        listContainer.className = 'cyber-dropdown-list';

        function updateTriggerText() {
            var selectedOpt = select.options[select.selectedIndex];
            if (selectedOpt) {
                triggerText.innerText = selectedOpt.text;
            }
        }

        // Populate items
        for (var i = 0; i < select.options.length; i++) {
            (function(opt, index) {
                var item = document.createElement('div');
                item.className = 'cyber-dropdown-item' + (index === select.selectedIndex ? ' selected' : '');

                var label = document.createElement('span');
                label.textContent = opt.text;

                var check = document.createElement('i');
                check.className = 'fa-solid fa-check check-icon';
                check.style.display = (index === select.selectedIndex) ? 'inline-block' : 'none';

                item.appendChild(label);
                item.appendChild(check);

                item.addEventListener('click', function(e) {
                    e.stopPropagation();
                    select.selectedIndex = index;

                    // Trigger native change event so all tool scripts update instantly
                    var evt = new Event('change', { bubbles: true });
                    select.dispatchEvent(evt);

                    updateTriggerText();

                    // Update selected visual state
                    var allItems = listContainer.querySelectorAll('.cyber-dropdown-item');
                    allItems.forEach(function(it) {
                        it.classList.remove('selected');
                        var icon = it.querySelector('.check-icon');
                        if (icon) icon.style.display = 'none';
                    });
                    item.classList.add('selected');
                    check.style.display = 'inline-block';

                    container.classList.remove('open');
                });

                listContainer.appendChild(item);
            })(select.options[i], i);
        }

        menu.appendChild(listContainer);
        container.appendChild(menu);

        updateTriggerText();

        // Listen for programmatical select changes
        select.addEventListener('change', function() {
            updateTriggerText();
            var allItems = listContainer.querySelectorAll('.cyber-dropdown-item');
            allItems.forEach(function(it, idx) {
                var icon = it.querySelector('.check-icon');
                if (idx === select.selectedIndex) {
                    it.classList.add('selected');
                    if (icon) icon.style.display = 'inline-block';
                } else {
                    it.classList.remove('selected');
                    if (icon) icon.style.display = 'none';
                }
            });
        });

        // Toggle open/close
        trigger.addEventListener('click', function(e) {
            e.stopPropagation();
            var isOpen = container.classList.contains('open');
            document.querySelectorAll('.cyber-dropdown.open').forEach(function(d) {
                if (d !== container) d.classList.remove('open');
            });
            container.classList.toggle('open');
            if (!isOpen && searchInput) {
                searchInput.value = '';
                var items = listContainer.querySelectorAll('.cyber-dropdown-item');
                items.forEach(function(item) { item.style.display = 'flex'; });
                setTimeout(function() { searchInput.focus(); }, 100);
            }
        });
    });

    // Close on click outside
    document.addEventListener('click', function() {
        document.querySelectorAll('.cyber-dropdown.open').forEach(function(d) {
            d.classList.remove('open');
        });
    });

    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.cyber-dropdown.open').forEach(function(d) {
                d.classList.remove('open');
            });
        }
    });
}

// ─────────────────────────────────────────────────────────────
// Global DOM Initialization
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    // Populate ticker with instant fallback to avoid delay or NaN
    updateTopTicker();

    // Fetch live market data asynchronously
    fetchLiveMarketData();

    // Transform all selects into Custom Cyber Dropdowns
    initCustomCyberSelects();

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

// ==UserScript==
// @name         Karl
// @version      0.1.1
// @description  Karl likes to walk
// @author       christopher.lester@delta.com
// @match        https://linecontrol-react.dal-prod.emro.aero/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(`
        [data-karl-label] {
            visibility: visible !important;
            display: block !important;
        }
    `);

    function applyKarl() {
        document.querySelectorAll('div[style*="grid-template-columns"]').forEach(row => {
            if (row.children.length < 10) return;
            const crewCol = row.children[9];
            if (!crewCol) return;
            const etaText = row.children[4]?.textContent.trim() ?? '';
            const timeMatch = etaText.match(/(\d{1,2}):/);
            const etaHour = timeMatch ? parseInt(timeMatch[1], 10) : NaN;
            const karlGate = [3, 6].some(i => row.children[i]?.textContent.includes('D11') || row.children[i]?.textContent.includes('D13'));
            let karlLabel = crewCol.querySelector('[data-karl-label]');
            if (karlGate && etaHour > 7 && etaHour < 14) {
                if (!karlLabel) {
                    karlLabel = document.createElement('span');
                    karlLabel.setAttribute('data-karl-label', 'true');
                    karlLabel.textContent = 'Karl Russell';
                    crewCol.appendChild(karlLabel);
                }
            } else {
                if (karlLabel) karlLabel.remove();
            }
        });
    }

    applyKarl();
    setInterval(applyKarl, 500);
})();

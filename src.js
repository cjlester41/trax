// ==UserScript==
// @name         Trax
// @namespace    http://tampermonkey.net/
// @version      2.0.3
// @description  format Trax for readability and add MEL/CDL/TIR/FCP pills with hover-over descriptions
// @author       cjlester@outlook.com
// @match        https://linecontrol-react.dal-prod.emro.aero/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

    const displayMode = GM_getValue('displayMode', 'compact'); // 'kiosk' | 'default' | 'compact'

    const isKiosk   = displayMode === 'kiosk';
    const isDefault = displayMode === 'default';
    const isLarge   = isKiosk || isDefault;

    const css = `
        /* Hide times without GT and status text like 'to land'/'to depart' - use clip-path for complete invisibility */
        div[data-hidden-text] {
            clip-path: polygon(0 0, 0 0, 0 0, 0 0) !important;
            height: 0 !important;
            width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
        }

        /* Style for relocated times in column 8 */
        div[data-time-out] {
            color: #888 !important;
            font-size: 1em !important;
            display: inline-flex;
            align-items: center;
            gap: 0.25em;
        }

        /* GT time field - same gray as orig/dest and a/c location */
        [data-gt-formatted] {
            color: #888 !important;
        }

        /* Stack TO/ARR and GND/TIME vertically */
        .sup-sub-stack {
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            font-size: 0.5em;
            gap: 0;
            line-height: 0.75;
            vertical-align: middle;
        }

        .sup-sub-stack sup,
        .sup-sub-stack sub {
            margin: 0;
            padding: 0;
            line-height: 1;
        }
            
        /* Hide detail panels by default — they stay in the DOM so the deferred token scanner
           can read them, but are only shown when the user clicks the expand button. */
        div.grid.gap-0.border[style*="grid-template-columns: 1.25fr 1fr 1.25fr 1fr 1fr 1.5fr 1fr 1fr 1.25fr 1.5fr 3fr 0.5fr"] {
            display: none !important;
        }

        /* Show a detail panel when our JS has marked it as expanded via data-trax-expanded. */
        div.grid.gap-0.border[data-trax-expanded="true"][style*="grid-template-columns: 1.25fr 1fr 1.25fr 1fr 1fr 1.5fr 1fr 1fr 1.25fr 1.5fr 3fr 0.5fr"] {
            display: grid !important;
        }

        /* Keep panel in DOM during collapse — JS Web Animations API animates height. */
        div.grid.gap-0.border[data-trax-collapsing][style*="grid-template-columns: 1.25fr 1fr 1.25fr 1fr 1fr 1.5fr 1fr 1fr 1.25fr 1.5fr 3fr 0.5fr"] {
            display: grid !important;
        }

        /* Own chevron rotation via CSS so React re-renders can't flip it.
           data-trax-row-expanded is set/cleared on the row by our click handler. */
        div.grid.gap-0:not(.sticky)[style*="grid-template-columns"] svg[viewBox="0 0 24 24"] {
            transform: rotate(180deg);
        }
        div.grid.gap-0:not(.sticky)[data-trax-row-expanded][style*="grid-template-columns"] svg[viewBox="0 0 24 24"] {
            transform: rotate(0deg);
        }

        /* Resize grid: col1 narrow, col12 doubled */
        div[style*="grid-template-columns: 1.25fr 1fr 1.25fr"] {
            grid-template-columns: ${isLarge
                ? '0.4fr 1.0fr 1.3fr 1fr 0.9fr 1.25fr 1fr 0.9fr 1.2fr 1.85fr 3fr 0.5fr'
                : '0.55fr 1.0fr 1.3fr 1fr 0.9fr 1.25fr 1fr 0.9fr 1.1fr 1.3fr 3fr 0.5fr'} !important;
        }

        /* Hide pills container in A/C status column (col 1), keep only icon */
        div[style*="grid-template-columns"]:not(.sticky) > div:nth-child(1) > div > div > div:not(:first-child) {
            display: none !important;
        }

        /* Reduce A/C status icon to 75% */
        svg[width="35"][height="34"] {
            transform: scale(${isLarge ? '1.0' : '0.75'}) !important;
        }

        /* Compact row padding and base text size/weight */
        div[style*="grid-template-columns"]:not(.sticky) > div {
            padding-top: ${isKiosk ? '6px' : '3px'} !important;
            padding-bottom: ${isKiosk ? '6px' : '3px'} !important;
            font-size: ${isKiosk ? '1.5rem' : '1.2rem'} !important;
            font-weight: 400 !important;
        }

        ${isLarge ? `
        /* Kiosk/maximized mode: hide scrollbar */
        ::-webkit-scrollbar { display: none !important; }
        * { scrollbar-width: none !important; }
        ` : ''}
        ${isKiosk ? `
        /* Kiosk mode: hide the page header */
        header.px-6.py-3.shadow-sm {
            display: none !important;
        }
        ` : ''}

        /* Normalize all nested text elements in rows to inherit font (but not sup/sub/sup-sub-stack) */
        div[style*="grid-template-columns"]:not(.sticky) > div *:not(sup):not(sub):not(.sup-sub-stack) {
            font-size: inherit !important;
            font-weight: inherit !important;
        }

        /* Keep pills smaller and bolder */
        div[style*="grid-template-columns"]:not(.sticky) > div span:not(.sup-sub-stack)[class*="rounded-full"],
        div[style*="grid-template-columns"]:not(.sticky) > div span:not(.sup-sub-stack)[data-deferred-pill] {
            font-size: 0.9rem !important;
            font-weight: 600 !important;
        }

        /* Crew(s) col: shrink text to half of base size */
        div[style*="grid-template-columns"]:not(.sticky) > div:nth-child(10) {
            font-size: ${isKiosk ? '0.75rem' : '0.525rem'} !important;
        }

        /* Deferred token marker row */
        div[data-deferred-marker] {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
            align-self: flex-start !important;
            gap: 4px !important;
            margin-top: 2px;
        }

        /* Deferred token pills stay inline */
        span[data-deferred-pill] {
            display: inline-flex !important;
            align-items: center !important;
            width: auto !important;
            flex-shrink: 0 !important;
            cursor: pointer !important;
            pointer-events: all !important;
        }

        /* Override blue page/header backgrounds to black */
        :root {
            --customer-color: #000 !important;
            --surface-primary-dark: #000 !important;
            --surface-overlay-dark: #222 !important;
            --gray-5-dark: #222 !important;
            --gray-6-dark: #101215 !important;
            --gray-7-dark: #000 !important;
        }

        /* Hide the station summary bar */
        div.flex.px-2.pb-2.pt-1.items-center.justify-between {
            display: none !important;
        }

        /* Hide notification bubbles (from style.css) */
        span.absolute {
            display: none !important;
        }

        /* Hide the add-crew button (SVG viewBox 0 0 20 18) */
        button:has(svg[viewBox="0 0 20 18"]) {
            display: none !important;
        }

        /* Remove underline from A/C column (col 2) links */
        div[style*="grid-template-columns"]:not(.sticky) > div:nth-child(2) {
            padding-left: 18px !important;
        }
        div[style*="grid-template-columns"]:not(.sticky) > div:nth-child(2) div.underline {
            text-decoration: none !important;
        }
        div[style*="grid-template-columns"]:not(.sticky) > div:nth-child(2) a {
            text-decoration: none !important;
        }

        /* Suppress modal backdrop darkening when the deferred popup opens.
           The app renders a fixed full-screen overlay (Tailwind: fixed inset-0)
           with a semi-transparent black background. Make it transparent. */
        div.fixed.inset-0 {
            background-color: transparent !important;
        }

        /* Deferred popup dialog: black background, thin white border, hide external-link icons.
           The panel is a HeadlessUI dialog (id^=headlessui-dialog-panel); the visible card
           is the inner div.rounded-xl. There are no <img> tags — the "images" are the
           12×12 external-link SVG anchor buttons, hidden via their aria-label. */
        div[id^="headlessui-dialog-panel"] .rounded-xl {
            background-color: var(--gray-6-dark) !important;
            border: 1px solid rgba(255, 255, 255, 0.35) !important;
        }

        /* Suppress hover background on the maintenance column cell */
        div[style*="grid-template-columns"]:not(.sticky) > div:nth-child(11):hover {
            background-color: transparent !important;
        }
        
    `;

    GM_addStyle(css);

    let runTimeout;
    let lastDeferredDebugSummary = '';
    const DEFERRED_TOKENS = ['MEL', 'CDL', 'TIR', 'FCP', 'CREW'];

    // Content-based key for expanded rows — survives React replacing the DOM node.
    // Bug fixed: children[1] (A/C tail) contains 'ETOPS' in fresh React nodes but 'E' after
    // our processAllRows injection. Without normalization the stored key (post-injection)
    // never matches the restore-time key (pre-injection), so panels never re-open.
    // Also include children[4] / children[7] — the two time columns we never touch — for
    // uniqueness when two aircraft share the same tail+route.
    const expandedRowKeys = new Set();
    function getRowKey(row) {
        // Only use columns that never change during live data updates:
        //   col1 = A/C tail (normalize ETOPS→E to match post-injection state)
        //   col5 = ORIG/DEST airports — extract only 3-letter codes; gate numbers change
        //   col3, col6 = gate columns — included to disambiguate same-tail aircraft on same
        //     route. textContent is order-invariant so it is unaffected by data-gate-swapped
        //     child reordering. Gate values are stable within a session.
        // Deliberately exclude time columns (cols 4, 7) — they update every live refresh.
        const ac = (row.children[1]?.textContent ?? '').replace(/\s+/g, '').replace(/ETOPS/g, 'E');
        const airports = [...((row.children[5]?.textContent ?? '').matchAll(/\b([A-Z]{3})\b/g))].map(m => m[1]).join('');
        const gate3 = (row.children[3]?.textContent ?? '').replace(/\s+/g, '');
        const gate6 = (row.children[6]?.textContent ?? '').replace(/\s+/g, '');
        return ac ? `${ac}|${airports}|${gate3}|${gate6}` : '';
    }

    function setMgColor(row, useGray) {
        const maintenanceColumn = row.children[10];
        if (!maintenanceColumn) return;

        maintenanceColumn.querySelectorAll('span').forEach(span => {
            if (span.textContent.trim() === 'MG') {
                span.style.backgroundColor = useGray ? '#555' : 'rgb(241, 184, 13)';
                span.style.color = 'black';
            }
        });
    }

    function setOrigDestColors(row) {
        const origDestColumn = row.children[5];
        if (!origDestColumn) return;

        const nodes = [origDestColumn, ...origDestColumn.querySelectorAll('*')];
        nodes.forEach((node) => {
            const isAmberNode = node.classList.contains('flight-table-orig-term')
                || Boolean(node.closest('.flight-table-orig-term'))
                || node.classList.contains('advisory-delayed')
                || Boolean(node.closest('.advisory-delayed'));

            if (isAmberNode) {
                if (node.hasAttribute('data-orig-dest-gray')) {
                    node.style.removeProperty('color');
                    node.removeAttribute('data-orig-dest-gray');
                }
                return;
            }

            node.style.setProperty('color', '#888', 'important');
            node.setAttribute('data-orig-dest-gray', 'true');
        });
    }

    function unsetOrigDestColors(row) {
        const origDestColumn = row.children[5];
        if (!origDestColumn) return;
        // Include origDestColumn itself — querySelectorAll only returns descendants.
        [origDestColumn, ...origDestColumn.querySelectorAll('[data-orig-dest-gray]')].forEach(node => {
            if (node.hasAttribute('data-orig-dest-gray')) {
                node.style.removeProperty('color');
                node.removeAttribute('data-orig-dest-gray');
            }
        });
    }

    function setGateNumberGray(row, apply) {
        [3, 6].forEach(colIdx => {
            const cell = row.children[colIdx];
            if (!cell) return;
            const flexCol = cell.querySelector('.flex-col');
            if (!flexCol) return;
            Array.from(flexCol.children).forEach(el => {
                if (/^\d+$/.test(el.textContent.trim())) {
                    if (apply) {
                        el.style.setProperty('color', 'var(--gray-3-dark)', 'important');
                    } else {
                        el.style.removeProperty('color');
                    }
                }
            });
        });
    }

    function applyAmberToAcColumn(row) {
        const acColumn = row.children[1];
        if (!acColumn) return;
        acColumn.style.setProperty('color', '#f89800', 'important');
        acColumn.classList.add('advisory-delayed');
        Array.from(acColumn.children).forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
                child.style.setProperty('color', '#f89800', 'important');
                child.classList.add('advisory-delayed');
            }
        });
    }

    function isMainFlightRow(row) {
        return row && row.children.length >= 11 && Boolean(row.children[2]?.querySelector('.flex-col > div'));
    }

    function getDeferredTokenMapFromDetails() {
        const rowTokenMap = new Map();
        const allGridRows = Array.from(document.querySelectorAll('div[style*="grid-template-columns"]'));
        const detailTokenCounts = { CDL: 0, MEL: 0, TIR: 0 };

        const deferredBodies = Array.from(document.querySelectorAll('div[class*="whitespace-pre-line"]')).filter((body) => {
            const header = body.previousElementSibling;
            return Boolean(header) && /\bDeferred\b/i.test(header.textContent || '');
        });

        deferredBodies.forEach((body) => {
            const bodyText = body.textContent || '';
            const foundTokens = DEFERRED_TOKENS.flatMap((token) => {
                const match = bodyText.match(new RegExp(`\\b(${token})(?:\\s*\\((\\d+)\\))?`, 'i'));
                if (!match) return [];
                const display = match[2] ? `${token} (${match[2]})` : token;
                return [{ name: token, display }];
            });
            if (foundTokens.length === 0) return;

            foundTokens.forEach(({ name }) => {
                detailTokenCounts[name] = (detailTokenCounts[name] || 0) + 1;
            });

            const detailGridRow = body.closest('div[style*="grid-template-columns"]');
            if (!detailGridRow) return;

            const detailIndex = allGridRows.indexOf(detailGridRow);
            if (detailIndex < 0) return;

            for (let j = detailIndex - 1; j >= 0; j--) {
                const candidate = allGridRows[j];
                if (isMainFlightRow(candidate)) {
                    const currentTokens = rowTokenMap.get(candidate) || new Map();
                    foundTokens.forEach(({ name, display }) => {
                        if (!currentTokens.has(name) || display.includes('(')) {
                            currentTokens.set(name, display);
                        }
                    });
                    rowTokenMap.set(candidate, currentTokens);
                    break;
                }
            }
        });

        const rowsWithAnyToken = rowTokenMap.size;
        const debugSummary = `rows=${rowsWithAnyToken}, CDL=${detailTokenCounts.CDL}, MEL=${detailTokenCounts.MEL}, TIR=${detailTokenCounts.TIR}`;
        if (debugSummary !== lastDeferredDebugSummary) {
            console.log(`[Trax] Deferred detail summary: ${debugSummary}`);
            lastDeferredDebugSummary = debugSummary;
        }

        return rowTokenMap;
    }

    function setDeferredMarkers(row, rowTokenMapFromDetails) {
        const maintenanceColumn = row.children[10];
        if (!maintenanceColumn) return;

        // Exclude our previously-injected marker text so pills don't self-perpetuate
        // after the underlying source text is removed.
        const existingMarker = maintenanceColumn.querySelector('[data-deferred-marker]');
        let rowText;
        if (existingMarker) {
            const clone = row.cloneNode(true);
            clone.querySelector('[data-deferred-marker]')?.remove();
            rowText = clone.textContent || '';
        } else {
            rowText = row.textContent || '';
        }
        // Extract {name, display} from the row text, capturing optional (n)
        const rowTokensMap = new Map();
        DEFERRED_TOKENS.forEach((token) => {
            const match = rowText.match(new RegExp(`\\b(${token})(?:\\s*\\((\\d+)\\))?`, 'i'));
            if (!match) return;
            const display = match[2] ? `${token} (${match[2]})` : token;
            rowTokensMap.set(token, display);
        });

        const mappedTokensMap = rowTokenMapFromDetails.get(row) || new Map();

        // Merge: prefer entries that include a count in parentheses
        const mergedMap = new Map(rowTokensMap);
        mappedTokensMap.forEach((display, name) => {
            if (!mergedMap.has(name) || display.includes('(')) {
                mergedMap.set(name, display);
            }
        });

        // Order by DEFERRED_TOKENS order
        const allTokens = DEFERRED_TOKENS
            .filter(name => mergedMap.has(name))
            .map(name => ({ name, display: mergedMap.get(name) }));

        // ---------------------------------------------------------------------------
        // CREW → MEL INJECTION / INCREMENT LOGIC
        //
        // CREW is never rendered as its own pill. Instead, its presence signals that
        // a crew-related deferral exists, which should surface as an MEL indicator:
        //
        //   • CREW present + MEL absent
        //       → Inject a synthetic "MEL" pill so maintenance is alerted.
        //
        //   • CREW present + MEL already exists (plain "MEL" or "MEL (n)")
        //       → Do NOT add a second pill. Instead increment the existing MEL count:
        //            "MEL"      → "MEL (2)"
        //            "MEL (n)"  → "MEL (n+1)"
        //       This reflects that the CREW deferral adds another open maintenance item.
        // ---------------------------------------------------------------------------
        const hasCrew = mergedMap.has('CREW');
        const hasMel  = mergedMap.has('MEL');

        // Pre-compute the effective MEL display string whenever CREW is present.
        let effectiveMelDisplay = null;
        if (hasCrew) {
            if (!hasMel) {
                // No existing MEL — inject a plain pill.
                effectiveMelDisplay = 'MEL';
            } else {
                // MEL already exists — increment its count.
                const existingMelDisplay = mergedMap.get('MEL'); // e.g. "MEL" or "MEL (3)"
                const countMatch = existingMelDisplay.match(/MEL\s*\((\d+)\)/i);
                if (countMatch) {
                    // "MEL (n)" → "MEL (n+1)"
                    effectiveMelDisplay = `MEL (${parseInt(countMatch[1], 10) + 1})`;
                } else {
                    // Plain "MEL" (no count) → "MEL (2)"
                    effectiveMelDisplay = 'MEL (2)';
                }
            }
        }

        const displayTokens = DEFERRED_TOKENS
            .filter(name => name !== 'CREW')
            .filter(name => mergedMap.has(name) || (name === 'MEL' && hasCrew && !hasMel))
            .map(name => {
                if (name === 'MEL' && hasCrew) {
                    // Use the CREW-adjusted display (incremented or injected).
                    return { name, display: effectiveMelDisplay };
                }
                return { name, display: mergedMap.has(name) ? mergedMap.get(name) : name };
            });

        // ---------------------------------------------------------------------------


        const currentState = allTokens.length > 0 ? allTokens.map(t => t.display).join(',') : 'none';
        const previousState = row.getAttribute('data-deferred-tokens');
        if (previousState !== currentState) {
            const acText = row.children[1] ? row.children[1].textContent.trim() : 'unknown-a/c';
            const source = mappedTokensMap.size > 0 ? 'detail-panel-nearest-row' : (rowTokensMap.size > 0 ? 'row' : 'none');
            console.log(`[Trax] Deferred tokens=${currentState} for ${acText} (source=${source})`);
            row.setAttribute('data-deferred-tokens', currentState);
        }

        let deferredMarker = maintenanceColumn.querySelector('[data-deferred-marker]');

        if (allTokens.length === 0) {
            if (deferredMarker) deferredMarker.remove();
            return;
        }

        if (!deferredMarker) {
            deferredMarker = document.createElement('div');
            deferredMarker.setAttribute('data-deferred-marker', 'true');
        }
        // Always move marker to the end of the flex-[7] sub-div so any page-generated
        // pills that appear later remain before our custom pills. appendChild moves an
        // already-attached node, so this is safe to call every pass.
        const innerTarget = maintenanceColumn.children[0]?.children[0] || maintenanceColumn;
        innerTarget.appendChild(deferredMarker);

        deferredMarker.innerHTML = '';

        // Only add left spacing when there is visible content preceding the marker.
        // A sibling may itself be visible but contain only hidden spans (e.g. a WIFI wrapper div
        // whose only child span was set to display:none), so we check inside each sibling too.
        let hasVisiblePrev = false;
        let prevSib = deferredMarker.previousElementSibling;
        while (prevSib) {
            if (prevSib.style.display !== 'none') {
                const innerSpans = prevSib.querySelectorAll('span');
                if (innerSpans.length > 0) {
                    // Has spans — visible only if at least one span is not hidden and has text
                    if (Array.from(innerSpans).some(s => s.style.display !== 'none' && s.textContent.trim())) {
                        hasVisiblePrev = true;
                        break;
                    }
                } else if (prevSib.textContent.trim()) {
                    // No spans, but has text
                    hasVisiblePrev = true;
                    break;
                }
            }
            prevSib = prevSib.previousElementSibling;
        }
        deferredMarker.style.marginLeft = hasVisiblePrev ? '6px' : '0';

        displayTokens.forEach(({ name, display }) => {
            const pill = document.createElement('span');
            pill.setAttribute('data-deferred-pill', 'true');
            pill.textContent = display;
            pill.style.borderRadius = '9999px';
            pill.style.padding = '2px 8px';
            pill.style.fontSize = '0.75rem';
            pill.style.fontWeight = '600';
            pill.style.lineHeight = '1.2';

            pill.style.setProperty('background-color', 'lightgray', 'important');
            pill.style.setProperty('color', 'black', 'important');
            if (name === 'MEL') {
                pill.style.setProperty('background-color', '#2d0000', 'important');
                pill.style.setProperty('color', 'white', 'important');
            } else if (name === 'CDL') {
                pill.style.setProperty('background-color', '#00234b', 'important');
                pill.style.setProperty('color', 'white', 'important');
            } else if (name === 'TIR') {
                pill.style.setProperty('background-color', '#555', 'important');
                pill.style.setProperty('color', 'white', 'important');
            } else if (name === 'FCP') {
                pill.style.setProperty('background-color', '#e01c33', 'important');
                pill.style.setProperty('color', 'white', 'important');
            }
            deferredMarker.appendChild(pill);
        });
    }

    function processAllRows() {
        // Fallback restoration: queueMicrotask may have failed if the key was stale when it ran
        // (React renders 'ETOPS' in fresh nodes; our injection hasn't run yet at microtask time).
        // By the time processAllRows runs the ETOPS injection has already fired, so getRowKey
        // here always matches what was stored at click-time.
        if (expandedRowKeys.size > 0) {
            document.querySelectorAll('div.grid.gap-0:not(.sticky)[style*="grid-template-columns"]').forEach(row => {
                const key = getRowKey(row);
                if (!key || !expandedRowKeys.has(key)) return;
                if (!row.hasAttribute('data-trax-row-expanded')) row.setAttribute('data-trax-row-expanded', 'true');
                const dp = row.nextElementSibling;
                if (dp && dp.classList.contains('border') && !dp.hasAttribute('data-trax-expanded') && !dp.hasAttribute('data-trax-collapsing')) {
                    dp.setAttribute('data-trax-expanded', 'true');
                }
            });
        }
        // Rename first header cell from "A/C Status" to "Status"
        document.querySelectorAll('div.sticky[style*="grid-template-columns"]').forEach(headerRow => {
            const firstCell = headerRow.children[0];
            if (!firstCell) return;
            const span = firstCell.querySelector('span');
            if (span && span.textContent.trim() === 'A/C Status') {
                span.textContent = 'Status';
            }
        });

        const rowTokenMapFromDetails = getDeferredTokenMapFromDetails();
        const seenAcWithCrew = new Set();

        document.querySelectorAll('div[style*="grid-template-columns"]').forEach((row) => {
            if (row.children.length < 3) return;

            // Crew deduplication: hide crew content for subsequent rows sharing the same A/C.
            // Target only the inner content element so the cell's border/divider stays visible.
            if (row.children.length >= 10) {
                const acKey = row.children[1]?.textContent.trim();
                const crewCol = row.children[9];
                if (acKey && crewCol) {
                    const crewInner = crewCol.querySelector('.flex-col') || Array.from(crewCol.children).find(el => !el.hasAttribute('data-karl-label')) || null;
                    if (seenAcWithCrew.has(acKey)) {
                        if (crewInner) crewInner.style.setProperty('visibility', 'hidden', 'important');
                    } else {
                        if (crewInner) crewInner.style.removeProperty('visibility');
                        if (crewInner && crewInner.textContent.trim().length > 0) seenAcWithCrew.add(acKey);
                    }
                }
            }

            const flightStatsColumn = row.children[2];
            const flightStatusContainer = flightStatsColumn.querySelector('.flex-col > div');
            if (!flightStatusContainer) return;

            let timeWithGTField = null;
            let timeWithoutGTField = null;
            
            Array.from(flightStatusContainer.children).forEach(field => {
                // Clear any previously applied style.all override so data-hidden-text CSS can apply.
                if (field.style.all) field.style.all = '';
                const text = field.textContent.trim();
                if (text.includes(':') && /\d/.test(text)) {
                    if (text.includes('GT') || field.hasAttribute('data-gt-formatted')) {
                        timeWithGTField = field;
                    } else {
                        timeWithoutGTField = field;
                    }
                }
                if (text.toLowerCase().includes('to land') || text.toLowerCase().includes('to depart')) {
                    field.setAttribute('data-hidden-text', 'true');
                } else {
                    // Clear stale hide flags so statuses like ON/OUT remain visible.
                    field.removeAttribute('data-hidden-text');
                }
            });

            // Detect amber in ORIG/DEST column BEFORE setOrigDestColors can gray it out.
            // The app marks delayed flights with class 'advisory-delayed' and inline amber color.
            const origDestCol = row.children[5];
            const hasAmberText = Boolean(
                origDestCol && (
                    origDestCol.classList.contains('advisory-delayed') ||
                    origDestCol.querySelector('.advisory-delayed') ||
                    origDestCol.querySelector('.flight-table-orig-term')
                )
            );

            // Hide any span containing WIFI in the maintenance column (before setDeferredMarkers so margin check sees hidden state)
            const maintenanceCol = row.children[10];
            if (maintenanceCol) {
                maintenanceCol.querySelectorAll('span').forEach(span => {
                    if (span.textContent.toUpperCase().includes('WIFI')) {
                        span.style.setProperty('display', 'none', 'important');
                    }
                });
            }

            setDeferredMarkers(row, rowTokenMapFromDetails);

            // Make A/C (col 2), In/Gate (col 4), Out/Gate (col 7) inner containers display as rows
            // Gate columns (3, 6) also get abbreviations, swap, and blue coloring
            [1, 3, 6].forEach(colIdx => {
                const cell = row.children[colIdx];
                if (!cell) return;
                const flexCol = cell.querySelector('.flex-col');
                if (!flexCol) return;

                if (flexCol.style.flexDirection !== 'row') {
                    flexCol.style.flexDirection = 'row';
                    flexCol.style.alignItems = 'center';
                    flexCol.style.gap = colIdx === 1 ? (isLarge ? '14px' : '0') : '10px';
                }

                if (colIdx === 1) {
                    // padding handled by CSS
                }

                if (colIdx !== 1) {
                    // Abbreviate CHR→CH, PAD→PD, TBA→TB
                    Array.from(flexCol.children).forEach(el => {
                        const t = el.textContent.trim();
                        if (/^CHR$/i.test(t)) el.textContent = 'CH';
                        else if (/^PAD$/i.test(t)) el.textContent = 'PD';
                        else if (/^TBA$/i.test(t)) el.textContent = 'TB';
                    });

                    // Swap the two direct children and color the first one blue
                    const kids = Array.from(flexCol.children);
                    if (kids.length >= 2 && !flexCol.hasAttribute('data-gate-swapped')) {
                        flexCol.appendChild(kids[0]);
                        flexCol.setAttribute('data-gate-swapped', 'true');
                    }
                    const first = flexCol.children[0];
                    if (first) {
                        first.style.setProperty('color', isLarge ? '#66aaff' : '#3391ff', 'important');
                        first.style.setProperty('font-size', '1.07em', 'important');
                    }
                }
            });

            // Last col (index 11): buttons are inside a nested flex-col, set that inner div to row
            const lastCell = row.children[11];
            if (lastCell) {
                const innerDiv = lastCell.querySelector('.flex-col > div');
                if (innerDiv && innerDiv.style.flexDirection !== 'row') {
                    innerDiv.style.flexDirection = 'row';
                    innerDiv.style.alignItems = 'center';
                    innerDiv.style.gap = '4px';
                }
            }

            // Format GT time field: remove 'GT' prefix and leading zero, add GT superscript
            if (timeWithGTField && !timeWithGTField.hasAttribute('data-gt-formatted')) {
                const gtRaw = timeWithGTField.textContent.trim();
                const gtMatch = gtRaw.match(/(\d{1,2}):(\d{2})/);
                if (gtMatch) {
                    const cleanHour = parseInt(gtMatch[1], 10);
                    const cleanGT = `${cleanHour}:${gtMatch[2]} <div class="sup-sub-stack"><sup>GND</sup><sub>TIME</sub></div>`;
                    timeWithGTField.innerHTML = cleanGT;
                    timeWithGTField.setAttribute('data-gt-formatted', 'true');
                }
            }

            // Replace ETOPS pills in A/C column with "E" (must run before any early return)
            const acColumn = row.children[1];
            if (acColumn) {
                acColumn.querySelectorAll('*').forEach(el => {
                    if (el.children.length === 0 && el.textContent.includes('ETOPS')) {
                        el.textContent = 'E';
                    }
                });
            }

            if (!timeWithGTField || !timeWithoutGTField) {
                const timeOutElement = row.children[8].querySelector('[data-time-out]');
                if (timeOutElement) timeOutElement.remove();
                row.children[8].style.removeProperty('color');
                setMgColor(row, false);
                unsetOrigDestColors(row);
                setGateNumberGray(row, false);
                if (hasAmberText) applyAmberToAcColumn(row);
                return;
            }

            // Color a/c column amber if hasAmberText
            if (hasAmberText) applyAmberToAcColumn(row);

            setOrigDestColors(row);
            setGateNumberGray(row, true);

            const acLocationColumn = row.children[8];
            acLocationColumn.style.setProperty('color', '#888', 'important');
            const fullText = timeWithoutGTField.textContent.trim();
            const timeMatch = fullText.match(/\d{1,2}:\d{2}/);
            const hasAcLocationTime = Boolean(timeMatch);
            
            if (timeMatch) {
                const statusText = fullText.replace(timeMatch[0], '').trim();
                if (statusText) {
                    // Completely clear the element to avoid data-hidden-text interference
                    timeWithoutGTField.removeAttribute('data-hidden-text');
                    timeWithoutGTField.textContent = statusText;
                    timeWithoutGTField.style.all = 'unset';
                    timeWithoutGTField.style.visibility = 'visible';
                    timeWithoutGTField.style.display = 'inline';
                } else {
                    timeWithoutGTField.setAttribute('data-hidden-text', 'true');
                }
            }
            
            let timeOutElement = acLocationColumn.querySelector('[data-time-out]');
            if (!timeOutElement) {
                timeOutElement = document.createElement('div');
                timeOutElement.setAttribute('data-time-out', 'true');
                acLocationColumn.appendChild(timeOutElement);
            }
            
            const formattedTime = timeMatch ? timeMatch[0] : fullText;
            const timeMatchNoLeadZero = formattedTime.match(/(\d{1,2}):(\d{2})/);
            const cleanTime = timeMatchNoLeadZero ? `${parseInt(timeMatchNoLeadZero[1], 10)}:${timeMatchNoLeadZero[2]}` : formattedTime;
            timeOutElement.innerHTML = `${cleanTime}<div class="sup-sub-stack"><sup>TO</sup><sub>ARR</sub></div>`;
            
            // Trigger full rescan if we detect 00:00 (stale data indicator)
            if (cleanTime === '0:00') {
                setTimeout(() => processAllRows(), 500);
            }

            setMgColor(row, hasAcLocationTime);
        });
    }

    function moveHeaderTimeToMyAC() {
        const headerTimeSpan = document.querySelector('header div.flex.flex-col > p > span');
        if (!headerTimeSpan) return;

        const myACButton = Array.from(document.querySelectorAll('button')).find(btn =>
            btn.querySelector('[class*="flex"][class*="flex-col"]') &&
            btn.textContent.includes('MY A/C')
        );
        if (!myACButton) return;

        myACButton.style.display = 'none';

        const divider = myACButton.nextElementSibling;
        if (!divider) return;

        // Find or create timeContainer, then always ensure it sits right after divider.
        let timeContainer = document.querySelector('[data-time-display-container]');
        if (!timeContainer) {
            timeContainer = document.createElement('div');
            timeContainer.setAttribute('data-time-display-container', 'true');
            timeContainer.style.cssText = `display: flex; flex-direction: row; align-items: flex-start; font-size: ${isKiosk ? '2.2em' : '1.6em'}; font-weight: 400; margin-left: 8px;`;
        }
        if (divider.nextElementSibling !== timeContainer) {
            divider.after(timeContainer);
        }

        let timeText = headerTimeSpan.textContent.trim();
        timeText = timeText.substring(3); // Remove leading 3 characters (e.g. "LCL")
        if (timeText.length > 5) {
            const firstPart = timeText.substring(0, 5);
            const trailingPart = timeText.substring(5).replace(/\|\s*/, '|&nbsp;&nbsp;&nbsp;');
            timeContainer.innerHTML = firstPart + '<span style="color: var(--text-secondary-dark); margin-left: 28px; margin-right: 28px;"> ' + trailingPart + '</span>';
        } else {
            timeContainer.innerHTML = timeText;
        }

        // Find or create wipLabel, then always ensure it sits right after timeContainer.
        let wipLabel = document.querySelector('[data-wip-label]');
        if (!wipLabel) {
            wipLabel = document.createElement('span');
            wipLabel.setAttribute('data-wip-label', 'true');
            wipLabel.style.cssText = 'font-style: italic; font-size: 1.0em; font-weight: 300; color: var(--text-secondary-dark); align-self: center; margin-left: 20px;';
            wipLabel.textContent = 'work in progress \u2014 insulting feedback welcome';
        }
        wipLabel.style.display = isKiosk ? '' : 'none';
        if (timeContainer.nextElementSibling !== wipLabel) {
            timeContainer.after(wipLabel);
        }

        // Hide the element immediately following our WIP label.
        for (let i = 0; i < 1; i++) {
            const next = wipLabel.nextElementSibling;
            if (next) next.style.setProperty('display', 'none', 'important');
        }
    }

    const observer = new MutationObserver((records) => {
        // Restore synchronously — MutationObserver callbacks run within the microtask
        // checkpoint, before the browser paints. queueMicrotask delays until after the
        // current task, which races with React's multi-task scheduler (MessageChannel).
        const hasChildListMutation = records.some(r => r.type === 'childList');
        if (hasChildListMutation && expandedRowKeys.size > 0) {
            document.querySelectorAll('div.grid.gap-0:not(.sticky)[style*="grid-template-columns"]').forEach(row => {
                const key = getRowKey(row);
                if (!key || !expandedRowKeys.has(key)) return;
                if (!row.hasAttribute('data-trax-row-expanded')) row.setAttribute('data-trax-row-expanded', 'true');
                const detailPanel = row.nextElementSibling;
                if (detailPanel && detailPanel.classList.contains('border') &&
                    !detailPanel.hasAttribute('data-trax-expanded') &&
                    !detailPanel.hasAttribute('data-trax-collapsing')) {
                    detailPanel.setAttribute('data-trax-expanded', 'true');
                }
            });
        }
        clearTimeout(runTimeout);
        runTimeout = setTimeout(() => {
            processAllRows();
            moveHeaderTimeToMyAC();
        }, 100);
    });

    // Start observing the document for changes
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });

    // Auto-click the sort button (aria-label="Button" with the sort-descending SVG) once on load.
    function clickSortButton() {
        const btn = Array.from(document.querySelectorAll('button[aria-label="Button"]')).find(
            (b) => b.querySelector('svg[viewBox="0 0 20 14"]')
        );
        if (btn) {
            btn.click();
            return true;
        }
        return false;
    }

    // Retry until the button appears (React may render it late).
    if (!clickSortButton()) {
        const sortBtnObserver = new MutationObserver(() => {
            if (clickSortButton()) {
                sortBtnObserver.disconnect();
            }
        });
        sortBtnObserver.observe(document.body, { childList: true, subtree: true });
    }

    // ---------------------------------------------------------------------------
    // DEFERRED PILL HOVER — open popup on mouseenter, close on pointermove
    //
    // mouseleave on the pill is unreliable when the popup overlay renders on top:
    // browsers do not fire mouseleave on a covered element unless the pointer has
    // physically moved. Instead we check pointer coordinates on every move and
    // close the popup once the cursor leaves the pill's bounding rect.
    // ---------------------------------------------------------------------------
    let _traxOpenPopupDp = null;
    let _traxHoverPill = null;
    let _traxPillRect = null;

    document.addEventListener('mouseenter', (e) => {
        if (!e.target.hasAttribute('data-deferred-pill')) return;
        const pill = e.target;
        const row = pill.closest('div.grid.gap-0:not(.sticky)[style*="grid-template-columns"]');
        if (!row) return;
        const dp = row.nextElementSibling;
        if (!dp) return;
        const deferredCard = [...dp.querySelectorAll('div.cursor-pointer')].find(el => /\bDeferred/i.test(el.textContent));
        if (!deferredCard) return;
        // Snapshot rect before clicking — click triggers processAllRows which recreates the pill,
        // leaving _traxHoverPill pointing to a detached node with a zeroed getBoundingClientRect.
        _traxPillRect = pill.getBoundingClientRect();
        deferredCard.click();
        _traxOpenPopupDp = dp;
        _traxHoverPill = pill;
    }, true);

    document.addEventListener('pointermove', (e) => {
        if (!_traxHoverPill || !_traxOpenPopupDp || !_traxPillRect) return;
        const r = _traxPillRect;
        if (e.clientX >= r.left && e.clientX <= r.right &&
            e.clientY >= r.top  && e.clientY <= r.bottom) return; // still over pill
        _traxOpenPopupDp = null;
        _traxHoverPill = null;
        _traxPillRect = null;
        const closeBtn = document.querySelector('button svg[viewBox="0 0 14 14"]')?.closest('button');
        if (closeBtn) closeBtn.click();
    }, { capture: true, passive: true });


    // ---------------------------------------------------------------------------
    // DETAIL PANEL EXPAND / COLLAPSE — capture-phase interception
    //
    // React conditionally mounts/unmounts the detail panel when the chevron is clicked.
    // If we let React handle the click, the panel is removed from the DOM and:
    //   (a) our CSS can't re-show it, and
    //   (b) getDeferredTokenMapFromDetails() loses the token data → pills disappear.
    //
    // Fix: register a capture-phase listener on document. The capture phase fires BEFORE
    // the event reaches React's delegated handler at the root container. We intercept
    // chevron clicks, call stopPropagation() so React never sees them, and toggle
    // data-trax-expanded on the panel ourselves. The panel stays in the DOM forever
    // and our CSS controls its visibility.
    // ---------------------------------------------------------------------------
    document.addEventListener('click', (e) => {
        // Find the button that was clicked
        const btn = e.target.closest('button');
        if (!btn) return;
        // The chevron button contains a 24×24 SVG; the comment/worklog button uses 18×16
        if (!btn.querySelector('svg[viewBox="0 0 24 24"]')) return;
        // Must be inside a non-sticky grid row
        const row = btn.closest('div.grid.gap-0:not(.sticky)');
        if (!row) return;
        const detailPanel = row.nextElementSibling;
        if (!detailPanel || !detailPanel.classList.contains('border')) return;
        // Stop React from seeing this click — prevents unmounting the detail panel
        e.stopPropagation();
        const expanding = !detailPanel.hasAttribute('data-trax-expanded');
        const chevronSvg = btn.querySelector('svg[viewBox="0 0 24 24"]');
        // Cancel any in-progress animation on rapid clicks
        if (detailPanel._traxAnim) {
            detailPanel._traxAnim.cancel();
            detailPanel.style.overflow = '';
        }
        if (chevronSvg?._traxSvgAnim) chevronSvg._traxSvgAnim.cancel();
        if (expanding) {
            detailPanel.removeAttribute('data-trax-collapsing');
            detailPanel.setAttribute('data-trax-expanded', 'true');
            row.setAttribute('data-trax-row-expanded', 'true');
            const rowKey = getRowKey(row);
            if (rowKey) expandedRowKeys.add(rowKey);
            // Animate chevron via Web Animations API — CSS transitions on ancestor attribute
            // changes are unreliable in Chromium/Edge.
            if (chevronSvg) {
                chevronSvg._traxSvgAnim = chevronSvg.animate(
                    [{ transform: 'rotate(180deg)' }, { transform: 'rotate(0deg)' }],
                    { duration: 200, easing: 'ease', fill: 'forwards' }
                );
            }
            // Pin height:0 before reading scrollHeight — prevents Edge from painting the
            // element at full height before the animation's first keyframe takes effect.
            detailPanel.style.height = '0px';
            detailPanel.style.overflow = 'hidden';
            const targetHeight = detailPanel.scrollHeight;
            const anim = detailPanel.animate(
                [{ height: '0px' }, { height: targetHeight + 'px' }],
                { duration: 200, easing: 'ease-out' }
            );
            anim.onfinish = () => { detailPanel.style.height = ''; detailPanel.style.overflow = ''; detailPanel._traxAnim = null; };
            detailPanel._traxAnim = anim;
        } else {
            const currentHeight = detailPanel.offsetHeight;
            // Set collapsing BEFORE removing expanded so panel stays visible during animation
            detailPanel.setAttribute('data-trax-collapsing', 'true');
            detailPanel.removeAttribute('data-trax-expanded');
            row.removeAttribute('data-trax-row-expanded');
            const rowKey = getRowKey(row);
            if (rowKey) expandedRowKeys.delete(rowKey);
            if (chevronSvg) {
                chevronSvg._traxSvgAnim = chevronSvg.animate(
                    [{ transform: 'rotate(0deg)' }, { transform: 'rotate(180deg)' }],
                    { duration: 200, easing: 'ease', fill: 'forwards' }
                );
            }
            detailPanel.style.overflow = 'hidden';
            const anim = detailPanel.animate(
                [{ height: currentHeight + 'px' }, { height: '0px' }],
                { duration: 200, easing: 'ease-in', fill: 'forwards' }
            );
            anim.onfinish = () => {
                detailPanel.removeAttribute('data-trax-collapsing'); // CSS now hides panel (display:none)
                detailPanel.style.overflow = '';
                anim.cancel(); // Remove fill:forwards height:0 — safe now that panel is hidden; ensures scrollHeight is correct on next expand
                detailPanel._traxAnim = null;
            };
            detailPanel._traxAnim = anim;
        }
    }, true /* capture phase */);

    // Initial run
    processAllRows();
    moveHeaderTimeToMyAC();
})();

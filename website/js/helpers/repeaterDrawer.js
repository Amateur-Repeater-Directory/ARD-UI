/*
  Amateur Repeater Directory
  Copyright (c) 2025 Amateur Repeater Directory Contributors

  This source code is licensed under the Apache License, Version 2.0 (Apache-2.0).
  You may not use this file except in compliance with the License.
  You may obtain a copy of the License at:

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an 'AS IS' BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

  Data files included in the ARD-RepeaterList GitHub repository are
  licensed under the Creative Commons CC0 1.0 Universal (CC0-1.0) 
  Public Domain Dedication.

  To view a copy of this license, visit:

      https://creativecommons.org/publicdomain/zero/1.0/
*/

import { AppState } from '../appstate.js';
import { ChirpService } from '../services/chirpservice.js';

// ----- helpers -----
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const toFixed = (v, d) => Number.isFinite(Number(v)) ? Number(v).toFixed(d) : '';

// ----- DOM refs -----
const drawerEl = $('#repeaterDrawer');
const table = $('#repTable');
const thead = table.querySelector('thead');
const tbody = table.querySelector('tbody');
const search = $('#repSearch');
const btnExp = $('#btnExportChirp');
const countEl = $('#repCount');

// filter controls
const fFreqSub = $('#fFreqSub');  // string match for frequency
const fBand = $('#fBand');
const fDistMax = $('#fDistMax');
const fLocation = $('#fLocation');
const fToneMode = $('#fToneMode');
const fToneTx = $('#fToneTx');
const fDuplex = $('#fDuplex');
const fOffset = $('#fOffset');
const fMode = $('#fMode');

// ----- state -----
let DATA = [];
let sortState = { key: 'OutputFrequency', dir: 'asc' };

// ----- data access -----
function getRepeaters() {
    // default radius 30 miles per your request
    return AppState.services.geoMappingService.selectRepeatersWithinCircle(30) ?? [];
}

// ----- filters -----
function distinct(arr, key) {
    const set = new Set();
    for (const r of arr) { if (r[key]) set.add(r[key]); }
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }));
}

function populateFilterOptions(data) {
    fBand.innerHTML = '<option value="">All</option>' + distinct(data, "Band").map(v => `<option>${v}</option>`).join("");
    fToneMode.innerHTML = '<option value="">All</option>' + distinct(data, "_toneMode").map(v => `<option>${v}</option>`).join("");
    fMode.innerHTML = '<option value="">All</option>' + distinct(data, "Mode").map(v => `<option>${v}</option>`).join("");
}

function applyFilters(arr) {
    const q = search.value.trim().toLowerCase();

    const freqSub = fFreqSub.value.trim();                // NEW: substring on frequency
    const band = fBand.value;
    const distMax = fDistMax.value === '' ? null : Number(fDistMax.value);
    const locSub = fLocation.value.trim().toLowerCase();
    const toneMd = fToneMode.value;
    const toneTx = fToneTx.value === '' ? null : Number(fToneTx.value);
    const duplex = fDuplex.value;
    const offset = fOffset.value === '' ? null : Number(fOffset.value);
    const mode = fMode.value;
    const commentSub = $('#fComment')?.value.trim().toLowerCase() || '';

    return arr.filter(r => {
        // frequency substring match (e.g., '14' matches 147.090 etc.)
        if (freqSub) {
            const freqStr = String(r.OutputFrequency ?? '');
            if (!freqStr.includes(freqSub)) return false;
        }

        if (band && r.Band !== band) return false;
        if (mode && r.Mode !== mode) return false;
        if (toneMd && r._toneMode !== toneMd) return false;

        if (duplex && (r.OffsetSign || r._duplex) !== duplex) return false;

        if (offset !== null && Number(r.Offset) !== offset) return false;
        if (toneTx !== null && Number(r.CTCSSTx || 0) !== toneTx) return false;

        if (distMax !== null && r.Distance != null && Number(r.Distance) > distMax) return false;

        if (locSub) {
            const hay = (r.Location || '').toLowerCase();
            if (!hay.includes(locSub)) return false;
        }

        if (commentSub) {
            const hay = (r._comment || '').toLowerCase();
            if (!hay.includes(commentSub)) return false;
        }

        if (q) {
            const hay = [
                r.Callsign, r.NearestCity, r.County, r.State, r.Band, r.Mode,
                r._comment, (r.OffsetSign || r._duplex), r.OutputFrequency
            ].join(' ').toLowerCase();
            if (!hay.includes(q)) return false;
        }

        return true;
    });
}

// ----- sort & render -----
function compare(a, b, key) {
    const va = a[key], vb = b[key];
    if (typeof va === 'number' && typeof vb === 'number') return va - vb;
    return String(va ?? '').localeCompare(String(vb ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}

function sortData(arr) {
    const { key, dir } = sortState;
    const out = [...arr].sort((a, b) => compare(a, b, key));
    return dir === 'asc' ? out : out.reverse();
}

function updateSortIndicators() {
    $$('.sort', thead).forEach(el => el.textContent = '');
    const th = thead.querySelector(`th[data-key='${sortState.key}'] .sort`);
    if (th) th.textContent = sortState.dir === 'asc' ? '▲' : '▼';
}

function renderRows(arr) {
    tbody.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const r of arr) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td class='text-end fw-semibold cell-freq'>${toFixed(r.OutputFrequency, 6)}</td>
      <td class='text-end col-narrow'>${r.Band || ''}</td>
      <td class='col-narrow cell-distance'>${r.Distance != null ? toFixed(r.Distance, 2) : ''}</td>
      <td>${r.Location || ''}</td>
      <td class='col-narrow'>${r._toneMode}</td>
      <td class='text-end col-narrow'>${r.CTCSSTx ?? ''}</td>
      <td class='text-center col-narrow'>${r.OffsetSign || r._duplex}</td>
      <td class='text-end cell-offset'>${toFixed(r.Offset, 3)}</td>
      <td class='col-narrow'>${r.Mode || ''}</td>
      <td class='truncate' title='${r._comment}'>${r._comment}</td>
    `;
        frag.appendChild(tr);
    }
    tbody.appendChild(frag);
    countEl.textContent = String(arr.length);
}

function refresh() {
    const filtered = applyFilters(DATA);
    const sorted = sortData(filtered);
    renderRows(sorted);
    updateSortIndicators();
}

// ----- events -----
thead.addEventListener('click', (e) => {
    const th = e.target.closest('th[data-key]');
    if (!th) return;
    const key = th.getAttribute('data-key');
    if (sortState.key === key) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
    else { sortState.key = key; sortState.dir = 'asc'; }
    refresh();
});

search.addEventListener('input', refresh);
[
    fFreqSub, fBand, fDistMax, fLocation, fToneMode, fToneTx, fDuplex, fOffset, fMode, $('#fComment')
].forEach(el => el && el.addEventListener('input', refresh));

btnExp.addEventListener('click', () => {
    const filtered = applyFilters(DATA);
    const sorted = sortData(filtered);
    ChirpService.exportChirp(sorted); // export remains full-precision where needed
});

// ----- populate on open; inject Distance via your geo service -----
function populate() {
    const raw = getRepeaters();

    DATA = raw.map(r => {
        const norm = ChirpService.normalize(r);
        const mi = AppState.services.geoMappingService.distanceFromBaseInMiles(r);
        norm.Distance = Number(mi);
        return norm;
    });

    populateFilterOptions(DATA);
    refresh();
}

drawerEl.addEventListener('shown.bs.offcanvas', populate);
window.populateRepeaterDrawer = populate; // optional manual trigger

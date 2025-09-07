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

import { AppState } from "../appState.js";

export class RadioService {
    // -------- constants / config --------
    static EPS = 1e-6;

    // Immutable band table (deep-frozen). defaultOffset is a MAGNITUDE (MHz).
    // defaultSign is kept separate for storage/display: '+', '-', or null.
    static #BANDS = Object.freeze([
        Object.freeze({ band: '2,200m', start: 135.7, end: 137.8, defaultOffset: null, defaultSign: null }),
        Object.freeze({ band: '630m', start: 472.0, end: 479.0, defaultOffset: null, defaultSign: null }),
        Object.freeze({ band: '160m', start: 1.800, end: 2.000, defaultOffset: null, defaultSign: null }),
        Object.freeze({ band: '80m', start: 3.500, end: 4.000, defaultOffset: null, defaultSign: null }),
        Object.freeze({ band: '40m', start: 7.000, end: 7.300, defaultOffset: null, defaultSign: null }),
        Object.freeze({ band: '30m', start: 10.100, end: 10.150, defaultOffset: null, defaultSign: null }),
        Object.freeze({ band: '20m', start: 14.000, end: 14.350, defaultOffset: null, defaultSign: null }),
        Object.freeze({ band: '17m', start: 18.068, end: 18.168, defaultOffset: null, defaultSign: null }),
        Object.freeze({ band: '15m', start: 21.000, end: 21.450, defaultOffset: null, defaultSign: null }),
        Object.freeze({ band: '12m', start: 24.890, end: 24.990, defaultOffset: null, defaultSign: null }),
        Object.freeze({ band: '10m', start: 28.000, end: 29.700, defaultOffset: null, defaultSign: null }),
        Object.freeze({ band: '6m', start: 50.000, end: 54.000, defaultOffset: null, defaultSign: null }),
        Object.freeze({ band: '1.25m', start: 222.000, end: 225.000, defaultOffset: null, defaultSign: null }),
        Object.freeze({ band: '2m', start: 144.000, end: 148.000, defaultOffset: 0.6, defaultSign: null }),
        Object.freeze({ band: '70cm', start: 420.000, end: 450.000, defaultOffset: 5.0, defaultSign: '+' }),
        Object.freeze({ band: '33cm', start: 902.000, end: 928.000, defaultOffset: null, defaultSign: null }),
        Object.freeze({ band: '23cm', start: 1240.000, end: 1300.000, defaultOffset: null, defaultSign: null }),
    ]);

    // Expose as read-only (frozen) arrays
    static get bands() { return RadioService.#BANDS; }

    // CTCSS (first entry intentionally blank/undefined)
    static #CTCSS_LIST = Object.freeze([undefined, 67.0, 69.3, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8, 97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3, 131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 159.8, 162.2, 165.5, 167.9, 171.3, 173.8, 177.3, 179.9, 183.5, 186.2, 189.9, 192.8, 196.6, 199.5, 203.5, 206.5, 210.7, 218.1, 225.7, 229.1, 233.6, 241.8, 250.3, 254.1]);
    static get ctcssList() { return RadioService.#CTCSS_LIST; }

    // Duplex selector values (first entry intentionally blank/undefined)
    static #DUPLEX_LIST = Object.freeze([undefined, '-', '+', 'Split', 'Off']);
    static get duplexList() { return RadioService.#DUPLEX_LIST; }

    // -------- helpers --------
    static #toNumber(val) {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            const n = parseFloat(val.trim());
            return Number.isFinite(n) ? n : NaN;
        }
        return NaN;
    }

    // -------- band lookup --------

    /**
     * bandFromFrequency — returns the band label (e.g., '2m') or null.
     * Uses the class’s immutable band table.
     */
    static bandFromFrequency(frequency) {
        const f = RadioService.#toNumber(frequency); // <-- accept string or number
        if (!Number.isFinite(f)) return null;
        const b = RadioService.#BANDS.find(band =>
            f >= band.start - RadioService.EPS && f <= band.end + RadioService.EPS
        );
        return b ? b.band : null;
    }

    // Internal: get band object either by name or by containing output frequency
    static #findBand(outputMHz, bandName = null) {
        if (bandName) return RadioService.#BANDS.find(b => b.band === bandName) || null;
        const name = RadioService.bandFromFrequency(outputMHz);
        return name ? RadioService.#BANDS.find(b => b.band === name) : null;
    }

    static #inBand(freq, band) {
        return Number.isFinite(freq) &&
            freq >= band.start - RadioService.EPS &&
            freq <= band.end + RadioService.EPS;
    }

    // -------- generic choose logic (no regional rules) --------

    /**
     * chooseDefaultSign — '+' | '-' | null
     * - If only one sign keeps input in-band (using band.defaultOffset magnitude), return that sign.
     * - If neither works, return null.
     * - If both work, return band.defaultSign (can be null to indicate “no preference”).
     */
    static chooseDefaultSign(outputMHz, bandName = null) {
        const f = RadioService.#toNumber(outputMHz); // <-- accept string or number
        const band = RadioService.#findBand(f, bandName);
        if (!band || !Number.isFinite(band.defaultOffset)) return null;

        const split = Math.abs(band.defaultOffset);
        const plusOk = RadioService.#inBand(f + split, band);
        const minusOk = RadioService.#inBand(f - split, band);

        if (plusOk && !minusOk) return '+';
        if (!plusOk && minusOk) return '-';
        if (!plusOk && !minusOk) return null;

        // both valid → fall back to band.defaultSign (can be null)
        return band.defaultSign ?? null;
    }

    /**
     * chooseDefaultOffset — number | null (returns the standard split magnitude)
     * - Returns band.defaultOffset if at least one sign keeps input in-band.
     * - Returns null if neither sign keeps input in-band.
     */
    static chooseDefaultOffset(outputMHz, bandName = null) {
        const f = RadioService.#toNumber(outputMHz); // <-- accept string or number
        const band = RadioService.#findBand(f, bandName);
        if (!band || !Number.isFinite(band.defaultOffset)) return null;

        const split = Math.abs(band.defaultOffset);
        const plusOk = RadioService.#inBand(f + split, band);
        const minusOk = RadioService.#inBand(f - split, band);
        if (!plusOk && !minusOk) return null;
        return split;
    }
}

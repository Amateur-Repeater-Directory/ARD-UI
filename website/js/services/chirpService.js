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

export class ChirpService {
    // ---------- normalize ----------
    static normalize(r) {
        const num = (v, d = null) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

        const bandFromFreq = (mhz) => {
            if (mhz >= 50 && mhz <= 54) return "6m";
            if (mhz >= 144 && mhz <= 148) return "2m";
            if (mhz >= 222 && mhz <= 225) return "1.25m";
            if (mhz >= 420 && mhz <= 450) return "70cm";
            return "";
        };

        const toneMode = (tx, rx) => {
            const t = num(tx, 0), rr = num(rx, 0);
            if (t > 0 && rr > 0) return "TSQL";
            if (t > 0 && rr === 0) return "Tone";
            return "None";
        };

        const duplexFrom = (sign, off) => {
            if (sign && (sign === '+' || sign === '-' || sign === 'off')) return sign;
            const o = num(off, 0);
            return o === 0 ? "off" : o > 0 ? "+" : "-";
        };

        const outFreq = num(r.OutputFrequency ?? r.outputFrequency ?? r.frequency);
        const inFreq = num(r.InputFrequency ?? r.inputFrequency);
        let offset = num(r.Offset ?? r.offset, null);
        if (offset === null && Number.isFinite(inFreq) && Number.isFinite(outFreq)) {
            offset = +(inFreq - outFreq).toFixed(6);
        }

        const row = {
            ...r,
            OutputFrequency: outFreq,
            InputFrequency: inFreq,
            Offset: offset,
            OffsetSign: r.OffsetSign ?? r.offsetSign,
            Band: r.Band ?? bandFromFreq(outFreq),
            CTCSSTx: r.CTCSSTx ?? r.ctcssTx,
            CTCSSRx: r.CTCSSRx ?? r.ctcssRx,
            Mode: r.Mode ?? r.mode ?? "FM",
            Callsign: r.Callsign ?? r.callsign,
            NearestCity: r.NearestCity ?? r.nearestCity,
            County: r.County ?? r.county,
            State: r.State ?? r.state,
        };

        row._toneMode = r.ToneMode ?? r.toneMode ?? toneMode(row.CTCSSTx, row.CTCSSRx);
        row._duplex = duplexFrom(row.OffsetSign, row.Offset);
        row._comment = `${row.Callsign ?? ""} near ${row.NearestCity ?? ""}, ${row.County ? row.County + " County, " : ""}${row.State ?? ""}`.trim();
        row.Location = `${row.NearestCity ?? ""}, ${row.State ?? ""}`.replace(/^,\s*/, "");

        return row;
    }

    // ---------- CHIRP export (21 columns to match your C#) ----------
    static chirpHeader21() {
        return [
            "Location", "Name", "Frequency", "Duplex", "Offset", "Tone", "rToneFreq", "cToneFreq",
            "DtcsCode", "DtcsPolarity", "RxDtcsCode", "CrossMode", "Mode", "TStep", "Skip", "Power",
            "Comment", "URCALL", "RPT1CALL", "RPT2CALL", "DVCODE"
        ];
    }

    static chirpName(r) {
        const s = String(r.Callsign || r.NearestCity || "CH").toUpperCase().replace(/\s+/g, "");
        return s.slice(0, 9);
    }

    static chirpRowsFromVisible(visible) {
        const toFixed = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n.toFixed(d) : ""; };
        const num = (v, d = null) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
        let loc = 1;

        return visible.map(r => ([
            loc++,
            ChirpService.chirpName(r),
            toFixed(r.OutputFrequency, 6),
            (r.OffsetSign ?? r._duplex),
            Math.abs(num(r.Offset, 0)).toFixed(6),
            r._toneMode,
            (num(r.CTCSSTx, 0) !== 0 ? String(r.CTCSSTx) : "88.5"),
            (num(r.CTCSSRx, 0) !== 0 ? String(r.CTCSSRx) : "88.5"),
            "023", "NN", "023", "Tone->Tone", "FM", "5.00", "", "50W",
            r._comment, "", "", "", ""
        ]));
    }

    static downloadCSV(filename, headerArr, rows) {
        const header = headerArr.join(",");
        const body = rows.map(cols =>
            cols.map(v => {
                const s = String(v ?? "");
                return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            }).join(",")
        ).join("\n");
        const csv = header + "\n" + body;
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(a.href);
        a.remove();
    }

    static exportChirp(visible) {
        const rows = ChirpService.chirpRowsFromVisible(visible);
        ChirpService.downloadCSV("repeaters-chirp.csv", ChirpService.chirpHeader21(), rows);
    }
}

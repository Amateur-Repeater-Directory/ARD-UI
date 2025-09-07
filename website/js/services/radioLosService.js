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

export class RadioLosService {
    // --- Earth constants ---
    static R_EARTH_FT = 20925525; // mean Earth radius (ft) ≈ 6371000 m
    static FT_PER_MI = 5280;
    static KM_PER_MI = 1.609344;

    // --- Utility ---
    static _sqrtft(x) { return Math.sqrt(Math.max(0, x)); }
    static _toGHz(mhz) { return mhz / 1000; }
    static _miToFt(mi) { return mi * RadioLosService.FT_PER_MI; }
    static _miToKm(mi) { return mi * RadioLosService.KM_PER_MI; }

    // Horizon coefficient C for d(mi) ≈ C*(√h1 + √h2), h in feet.
    // C ≈ 1.06 (k=1), C ≈ 1.23 (k=4/3). If a custom k is passed, we derive C.
    static horizonCoefficient(k = 4 / 3) {
        if (k === 1) return 1.06;
        if (k === 4 / 3) return 1.23;
        // Derive C from geometry (fit against k=1 and k=4/3 anchors):
        // Linear interpolation in 1/√k space keeps it close; clamp sensible bounds.
        const c1 = 1.06, c43 = 1.23;
        const t = (1 / Math.sqrt(k) - 1) / (1 / Math.sqrt(4 / 3) - 1);
        return c1 + (c43 - c1) * Math.max(0, Math.min(1, t));
    }

    // Radio-horizon cap (miles) for heights (feet) and refraction k
    static horizonMiles(h1_ft, h2_ft, k = 4 / 3) {
        const C = RadioLosService.horizonCoefficient(k);
        return C * (RadioLosService._sqrtft(h1_ft) + RadioLosService._sqrtft(h2_ft));
    }

    // Earth bulge at midpoint (feet) for a chord distance in miles and refraction k
    // b = D^2 / (8 * R_eff), with D in feet and R_eff = k * R_earth
    static earthBulgeMid_ft(distance_mi, k = 4 / 3) {
        const D_ft = RadioLosService._miToFt(distance_mi);
        const R_eff_ft = k * RadioLosService.R_EARTH_FT;
        return (D_ft * D_ft) / (8 * R_eff_ft);
    }

    // First Fresnel radius at midpoint (meters): r1_mid = 8.66 * sqrt(D_km / f_GHz)
    static fresnelR1Mid_m(distance_mi, freq_MHz) {
        const D_km = RadioLosService._miToKm(distance_mi);
        const f_GHz = RadioLosService._toGHz(freq_MHz);
        if (f_GHz <= 0) return Infinity;
        return 8.66 * Math.sqrt(Math.max(0, D_km / f_GHz));
    }

    // Straight-line ray height at midpoint (feet), either AGL-only or ASL+AGL if provided
    static rayHeightMid_ft(h1_agl_ft, h2_agl_ft, H1_asl_ft = null, H2_asl_ft = null) {
        if (H1_asl_ft != null && H2_asl_ft != null) {
            return ((H1_asl_ft + h1_agl_ft) + (H2_asl_ft + h2_agl_ft)) / 2;
        }
        return (h1_agl_ft + h2_agl_ft) / 2;
    }

    // Stage 1: curvature-only screen
    // Returns { verdict: 'drop'|'maybe'|'keep', dStrict, dStd }
    static horizonScreen(h1_agl_ft, h2_agl_ft, distance_mi) {
        const dStrict = RadioLosService.horizonMiles(h1_agl_ft, h2_agl_ft, 1);      // k=1
        const dStd = RadioLosService.horizonMiles(h1_agl_ft, h2_agl_ft, 4 / 3);  // k=4/3

        let verdict;
        if (distance_mi > dStd) verdict = 'drop';
        else if (distance_mi <= dStrict) verdict = 'keep';
        else verdict = 'maybe';

        return { verdict, dStrict, dStd };
    }

    // Stage 2: mid-path Fresnel clearance screen (no terrain)
    // Returns { pass: boolean, clearance_ft, need_ft, r1_mid_m, bulge_ft }
    static fresnelMidScreen({
        distance_mi,
        freq_MHz,
        h1_agl_ft,
        h2_agl_ft,
        H1_asl_ft = null,
        H2_asl_ft = null,
        k = 4 / 3,
        fresnelFraction = 0.6 // require ≥60% first Fresnel clear at midpoint
    }) {
        const r1_mid_m = RadioLosService.fresnelR1Mid_m(distance_mi, freq_MHz);
        const need_m = fresnelFraction * r1_mid_m;
        const need_ft = need_m * 3.28084;

        const bulge_ft = RadioLosService.earthBulgeMid_ft(distance_mi, k);
        const rayMid_ft = RadioLosService.rayHeightMid_ft(h1_agl_ft, h2_agl_ft, H1_asl_ft, H2_asl_ft);
        const clearance_ft = rayMid_ft - bulge_ft;

        return {
            pass: clearance_ft >= need_ft,
            clearance_ft,
            need_ft,
            r1_mid_m,
            bulge_ft
        };
    }

    // One-shot classifier combining Stage 1 + Stage 2
    // Returns:
    // {
    //   verdict: 'drop'|'maybe'|'keep',
    //   reason: 'beyond_horizon'|'within_strict'|'mid_fresnel_fail'|'mid_fresnel_pass',
    //   dStrict, dStd, fresnel?: { ... }
    // }
    static classifyPath({
        distance_mi,
        freq_MHz,
        h1_agl_ft,
        h2_agl_ft,
        H1_asl_ft = null,
        H2_asl_ft = null,
        fresnelFraction = 0.6,
        kHorizonStrict = 1,
        kHorizonGenerous = 4 / 3,
        kFresnel = 4 / 3
    }) {
        const s1 = RadioLosService.horizonScreen(h1_agl_ft, h2_agl_ft, distance_mi);
        if (s1.verdict === 'drop') {
            return { verdict: 'drop', reason: 'beyond_horizon', dStrict: s1.dStrict, dStd: s1.dStd };
        }
        if (s1.verdict === 'keep') {
            // Optional: still run Fresnel to prune a few more; or skip and trust strict.
            const f = RadioLosService.fresnelMidScreen({
                distance_mi, freq_MHz, h1_agl_ft, h2_agl_ft, H1_asl_ft, H2_asl_ft,
                k: kFresnel, fresnelFraction
            });
            if (!f.pass) {
                return {
                    verdict: 'maybe', // not a hard drop—let terrain decide later if you prefer
                    reason: 'mid_fresnel_fail',
                    dStrict: s1.dStrict,
                    dStd: s1.dStd,
                    fresnel: f
                };
            }
            return {
                verdict: 'keep',
                reason: 'mid_fresnel_pass',
                dStrict: s1.dStrict,
                dStd: s1.dStd,
                fresnel: f
            };
        }
        // s1 === 'maybe' → run mid-Fresnel
        const f = RadioLosService.fresnelMidScreen({
            distance_mi, freq_MHz, h1_agl_ft, h2_agl_ft, H1_asl_ft, H2_asl_ft,
            k: kFresnel, fresnelFraction
        });
        if (!f.pass) {
            return {
                verdict: 'drop',
                reason: 'mid_fresnel_fail',
                dStrict: s1.dStrict,
                dStd: s1.dStd,
                fresnel: f
            };
        }
        return {
            verdict: 'maybe',
            reason: 'mid_fresnel_pass',
            dStrict: s1.dStrict,
            dStd: s1.dStd,
            fresnel: f
        };
    }
}

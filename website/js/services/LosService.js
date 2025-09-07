
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
import { AppState } from '../appState.js';
import { UnitsService } from './unitsService.js';

// Constants
const C_MPS = 299_792_458;
const R_EARTH_M = 6_371_000;
const M_PER_MI = 1609.344;
const FT_PER_M = 3.280839895;

// Utility: rating stars from min shortfall (ft)
function starsForMargin(m, _fresFrac) {
    let n;
    if (m >= 0.20) n = 5;
    else if (m >= -0.20) n = 4;
    else if (m >= -0.60) n = 3;
    else if (m >= -1.00) n = 2;
    else n = 1;
    const label = { 1: 'Rarely', 2: 'Sometimes', 3: 'Often', 4: 'Most of the time', 5: 'Always' };
    const stars = '★'.repeat(n) + '☆'.repeat(5 - n);
    return `${stars} (${label[n]})`;
}

// Compute symmetric curvature sag (relative to straight chord between endpoints)
function curvatureSagArray(distM, totalM, kFactor) {
    const Reff = (Number(kFactor) || (4 / 3)) * R_EARTH_M;
    return distM.map(x => (x * (totalM - x)) / (2 * Reff));
}

export class LosService {
    static async computeLos(home, repeater, opts = {}) {
        const stepMeters = opts.stepMeters ?? 200;
        const freqMHz = opts.freqMHz ?? 146;
        const kFactor = opts.kFactor ?? (4 / 3);
        const fresnelFraction = opts.fresnelFraction ?? 0.6;

        const payload = {
            home: {
                id: home.id,
                lat: Number(home.lat),
                lng: Number(home.lng),
                elevation: home?.elevation,
                agl: Number.isFinite(home?.agl) ? Number(home.agl) : 1.5
            },
            repeater: {
                id: repeater.id,
                lat: Number(repeater.lat),
                lng: Number(repeater.lng),
                elevation: repeater?.elevation,
                agl: Number.isFinite(repeater?.agl) ? Number(repeater.agl) : 15
            },
            options: { stepMeters, freqMHz, kFactor, fresnelFraction, includeProfile: true }
        };

        const dto = await AppState.api().elevation_computeLineOfSight(payload);
        return dto;
    }

    /**
     * Compute once, render two charts (View A + View B).
     * Returns { model, elevationChart, clearanceChart, destroy() }.
     */
    static async showLosChart(resultOrPoints, totalMiles, meta = {}) {
        // Helpers (local to preserve exact numeric behavior and units)
        const FT_PER_M_LOCAL = 3.280839895013123;
        const toFt = (m) => m * FT_PER_M_LOCAL;

        // ---- pure helpers
        function calculateBulge(distM, kFactor) {
            const Re = (kFactor ?? (4 / 3)) * 6_371_000;
            const D = distM[distM.length - 1] || 0;
            return distM.map(x => (x * (D - x)) / (2 * Re));
        }
        function warpSeriesMetersToFeet(seriesM, bulgeM) {
            return seriesM.map((h, i) => toFt(h + bulgeM[i]));
        }
        function computeChordFt(losM, bulgeM, distM) {
            const n = distM.length;
            const D = distM[n - 1] || 0;
            const y0M = (losM[0] ?? 0) + (bulgeM[0] ?? 0);
            const y1M = (losM[n - 1] ?? 0) + (bulgeM[n - 1] ?? 0);
            const chordM = distM.map(d => {
                const t = D > 0 ? d / D : 0;
                return y0M + (y1M - y0M) * t;
            });
            return chordM.map(toFt);
        }
        function computeFresnelEnvelopeFt(distM, freqMHz, fresFrac, losEffFt) {
            const c = 299_792_458;
            const fHz = (freqMHz ?? 146) * 1e6;
            const lambda = c / fHz;

            const n = distM.length;
            const D = distM[n - 1] || 0;
            const fresLowerFt = new Array(n);
            const fresUpperFt = new Array(n);

            for (let i = 0; i < n; i++) {
                const d1 = distM[i];
                const d2 = Math.max(0, D - d1);
                const rM = Math.sqrt((lambda * d1 * d2) / Math.max(D, 1e-9)) * (fresFrac ?? 0.6);
                const rFt = toFt(rM);
                const anchorFt = losEffFt[i];
                fresLowerFt[i] = anchorFt - rFt;
                fresUpperFt[i] = anchorFt + rFt;
            }
            // pin ends
            fresLowerFt[0] = losEffFt[0];
            fresUpperFt[0] = losEffFt[0];
            fresLowerFt[n - 1] = losEffFt[n - 1];
            fresUpperFt[n - 1] = losEffFt[n - 1];

            for (let i = 0; i < n; i++) {
                if (fresLowerFt[i] > fresUpperFt[i]) {
                    const t = fresLowerFt[i]; fresLowerFt[i] = fresUpperFt[i]; fresUpperFt[i] = t;
                }
            }
            return { fresLowerFt, fresUpperFt };
        }
        function computeClearanceFt(fresLowerFt, terrainFt) {
            return fresLowerFt.map((v, i) => v - terrainFt[i]);
        }
        function computeAxisLimits(earthGuideFt, terrainFt, losEffFt, fresLowerFt, fresUpperFt, clearanceFt, chordFt) {
            const yMinData = Math.min(0, ...earthGuideFt, ...terrainFt, ...losEffFt, ...fresLowerFt);
            const yMaxData = Math.max(...terrainFt, ...losEffFt, ...chordFt, ...fresUpperFt);
            const pad = Math.max(10, (yMaxData - yMinData) * 0.06);
            const yMin = yMinData - pad;
            const yMax = yMaxData + pad;

            const rMinData = Math.min(...clearanceFt);
            const rMaxData = Math.max(...clearanceFt);
            const rPad = Math.max(10, (rMaxData - rMinData) * 0.06);

            // Ensure the clearance axis always includes 0 so the dashed baseline is visible
            const yRMin = Math.min(0, rMinData - rPad);
            const yRMax = Math.max(0, rMaxData + rPad);

            return { yMin, yMax, yRMin, yRMax };
        }

        // ---- meta
        const kFactor = meta.kFactor ?? resultOrPoints?.summary?.kFactor ?? (4 / 3);
        const fresFrac = meta.fresnelFraction ?? resultOrPoints?.summary?.fresnelFraction ?? 0.6;
        const freqMHz = meta.freqMHz ?? resultOrPoints?.summary?.freqMHz;

        // ---- accept DTO or legacy points
        let distM = [], elevM = [], losM = [], summary = null;
        if (resultOrPoints?.profile?.distM && resultOrPoints?.profile?.elevM && resultOrPoints?.profile?.losM) {
            ({ summary } = resultOrPoints);
            distM = Array.from(resultOrPoints.profile.distM);
            elevM = Array.from(resultOrPoints.profile.elevM);
            losM = Array.from(resultOrPoints.profile.losM);
        } else {
            const pts = Array.isArray(resultOrPoints)
                ? resultOrPoints
                : (Array.isArray(resultOrPoints?.points) ? resultOrPoints.points : null);
            if (!pts) { console.error('LOS: unexpected input to showLosChart:', resultOrPoints); return; }
            distM = pts.map(p => Number(p.dFromA ?? p.distM ?? p.d ?? 0));
            elevM = pts.map(p => Number(p.ground ?? p.groundM ?? p.elevM ?? 0));
            losM = pts.map(p => Number(p.lineEff ?? p.losM ?? 0));

            const distanceM = distM.length ? distM[distM.length - 1] : (Number(totalMiles) * 1609.344);
            const minClrM = Math.min(...losM.map((v, i) => v - elevM[i]));
            summary = {
                los: minClrM >= 0,
                minClearanceM: minClrM,
                worstIndex: losM.findIndex((v, i) => (v - elevM[i]) === minClrM),
                distanceM,
                freqMHz, kFactor, fresnelFraction: fresFrac
            };
        }
        const n = distM.length; if (!n) return;

        // ---- compute once
        const bulgeM = calculateBulge(distM, kFactor);
        const earthGuideFt = bulgeM.map(b => toFt(b));
        const terrainFt = warpSeriesMetersToFeet(elevM, bulgeM);
        const losEffFt = warpSeriesMetersToFeet(losM, bulgeM);
        const chordFt = computeChordFt(losM, bulgeM, distM);
        const { fresLowerFt, fresUpperFt } = computeFresnelEnvelopeFt(distM, freqMHz, fresFrac, losEffFt);
        const clearanceFt = computeClearanceFt(fresLowerFt, terrainFt);

        // intrusion masks (fill only where terrain intrudes)
        const intrAmberFt = clearanceFt.map((clr, i) => (clr < 0 && clr >= -60 ? terrainFt[i] : null));
        const intrRedFt = clearanceFt.map((clr, i) => (clr < -60 ? terrainFt[i] : null));
        const zeroClearFt = clearanceFt.map(() => 0);

        // worst clearance index
        let minClrIdx = 0; for (let i = 1; i < n; i++) if (clearanceFt[i] < clearanceFt[minClrIdx]) minClrIdx = i;

        // header pieces
        const rTgtAtMin = Math.abs((fresUpperFt[minClrIdx] ?? 0) - (losEffFt[minClrIdx] ?? 0)); // = fresFrac*F1
        const rFullAtMin = (fresFrac > 0 ? (rTgtAtMin / fresFrac) : NaN);
        const r60AtMin = 0.6 * rFullAtMin;
        const marginAtMin = r60AtMin > 0 ? (clearanceFt[minClrIdx] / r60AtMin) : -Infinity;
        const starsText = starsForMargin(marginAtMin, fresFrac);

        const { yMin, yMax, yRMin, yRMax } =
            computeAxisLimits(earthGuideFt, terrainFt, losEffFt, fresLowerFt, fresUpperFt, clearanceFt, chordFt);

        // Use the same tick step on both elevation axes (left & right)
        function niceStep(range, desired) {
            const raw = range / Math.max(desired || 8, 2);
            const pow10 = Math.pow(10, Math.floor(Math.log10(raw)));
            const base = raw / pow10;
            const mult = base >= 5 ? 5 : base >= 2 ? 2 : 1; // 1–2–5 rule
            return mult * pow10;
        }
        const elevStep = niceStep(yMax - yMin, meta.tickCount || 8);
        const elevTicks = {
            stepSize: elevStep,
            callback: v => (v < 0 ? '' : Number(v).toFixed(0)) // same format both sides
        };

        const D = distM[n - 1];
        const milesTotal = Number(totalMiles) || (D / 1609.344);
        const labels = distM.map(d => (d / 1609.344).toFixed(2));

        const minClrFtHeader = (summary?.minClearanceM ?? 0) * FT_PER_M_LOCAL;
        const losYes = (summary?.los ?? (minClrFtHeader >= 0)) ? 'Yes' : 'No';

        const headerText =
            `${meta.callsign}, LOS: ${losYes} — Min Clearance: ${minClrFtHeader.toFixed(1)} ft — ${starsText} —  Distance: ${milesTotal.toFixed(2)} mi`;
        const subText = [
            `Home AGL: ${toFt(Number(meta.homeAglM ?? 0)).toFixed(2)} ft`,
            `Repeater AGL: ${toFt(Number(meta.rptAglM ?? 0)).toFixed(2)} ft`,
            `Freq=${Number(freqMHz ?? 0).toFixed(3)} MHz`,
            `k=${kFactor}`,
            `${Math.round(fresFrac * 100)}% Fresnel`
        ].join(' • ');

        // shared model
        const model = {
            labels, earthGuideFt, terrainFt, losEffFt, chordFt,
            fresLowerFt, fresUpperFt, clearanceFt, intrAmberFt, intrRedFt, zeroClearFt,
            minClrIdx, yMin, yMax, yRMin, yRMax,
            headerText, subText, losYes, milesTotal, minClrFtHeader,
            fresFrac, freqMHz, kFactor, meta
        };

        // ---- renderers
        function destroyOld(canvasId) {
            window._losCharts = window._losCharts || {};
            const key = canvasId === 'losCanvasA' ? 'A' : 'B';
            if (window._losCharts[key]) { try { window._losCharts[key].destroy(); } catch { } }
        }

        function renderElevation(m) {
            const canvas = document.getElementById('losCanvasA') || document.getElementById('losCanvas');
            if (!canvas) return null;
            destroyOld('losCanvasA');

            const ds = [
                {
                    id: 'earth_guide', label: 'Earth curvature (guide)', data: m.earthGuideFt,
                    borderColor: '#6c757d', borderDash: [4, 4], borderWidth: 2, pointRadius: 0, fill: false, tension: 0, order: 5
                },
                {
                    id: 'terrain', label: 'Elevation profile', data: m.terrainFt,
                    borderColor: '#0d6efd', backgroundColor: 'rgba(13,110,253,0.15)',
                    borderWidth: 3, pointRadius: 0, fill: { target: '-1' }, tension: 0.25, order: 10
                },
                {
                    id: 'los_chord', label: 'Line-of-Sight', data: m.chordFt,
                    borderColor: '#000', borderWidth: 2, pointRadius: 0, fill: false, tension: 0, order: 25
                },
                // intrusion fills (to fres_lower)
                {
                    id: 'intrusion_red', label: '', data: m.intrRedFt, hidden: true,
                    borderWidth: 0, pointRadius: 0, tension: 0, fill: '+1', 
                    backgroundColor: 'rgba(220,53,69,0.25)', clip: 0, order: 39
                },
                {
                    id: 'intrusion_amber', label: '', data: m.intrAmberFt, hidden: true, 
                    borderWidth: 0, pointRadius: 0, tension: 0, fill: '+1',
                    backgroundColor: 'rgba(240,173,78,0.25)', clip: 0, order: 39
                },
                {
                    id: 'fres_lower', label: 'Lower Fresnel', data: m.fresLowerFt,
                    borderColor: 'rgba(0,180,0,1)', borderWidth: 2, pointRadius: 0, tension: 0,
                    fill: '+1', backgroundColor: 'rgba(120,120,120,0.22)', clip: 0, order: 40
                },
                {
                    id: 'fres_upper', label: 'Upper Fresnel', data: m.fresUpperFt,
                    borderColor: 'rgba(0,90,255,1)', borderWidth: 2, pointRadius: 0, tension: 0,
                    fill: false, clip: 0, order: 41
                }
            ];

            // markers
            const homeX = m.labels[0], homeY = m.chordFt[0];
            ds.push({
                id: 'home_marker', type: 'scatter', label: 'Home',
                data: [{ x: homeX, y: homeY }], pointStyle: 'rectRounded', pointRotation: 90,
                pointRadius: 6, pointHoverRadius: 7, backgroundColor: '#0dcaf0', borderColor: '#000', borderWidth: 1,
                showLine: false, order: 2001
            });
            const rptX = m.labels[m.labels.length - 1], rptY = m.chordFt[m.chordFt.length - 1];
            ds.push({
                id: 'repeater_marker', type: 'scatter', label: `Repeater (${m.meta.callsign})`,
                data: [{ x: rptX, y: rptY }], pointStyle: 'rectRounded', pointRotation: -90,
                pointRadius: 6, pointHoverRadius: 7, backgroundColor: '#ffc107', borderColor: '#000', borderWidth: 1,
                showLine: false, order: 2002
            });
            const minX = m.labels[m.minClrIdx];
            ds.push({
                id: 'min_marker_path', type: 'scatter', label: '',
                data: [{ x: minX, y: m.terrainFt[m.minClrIdx] }], pointStyle: 'circle',
                pointRadius: 4, pointHoverRadius: 6, backgroundColor: '#dc3545', borderColor: '#fff', borderWidth: 1,
                showLine: false, order: 2004
            });

            const chart = new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: { labels: m.labels, datasets: ds },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    spanGaps: true,
                    elements: { point: { radius: 0, hitRadius: 12, hoverRadius: 4 } },
                    plugins: {
                        title: { display: true, text: m.headerText, font: { size: 18, weight: 'bold' }, padding: { bottom: 2 } },
                        subtitle: { display: true, text: m.subText, color: '#666', font: { size: 12 }, padding: { bottom: 4 } },
                        legend: {
                            display: true, position: 'top',
                            labels: {
                                usePointStyle: true,
                                boxWidth: 12,
                                padding: 12,
                                filter: (item) => {
                                    const id = ds[item.datasetIndex]?.id;
                                    // hide utility datasets from legend
                                    return id !== 'home_marker'
                                        && id !== 'repeater_marker'
                                        && id !== 'min_marker_path'
                                        && id !== 'intrusion_amber'
                                        && id !== 'intrusion_red'
                                        && id !== 'clr_zero';
                                }
                            },
                            onClick(e, legendItem, legend) {
                                const chart = legend.chart;
                                const dsIndex = legendItem.datasetIndex;
                                const clickedId = chart.data.datasets[dsIndex]?.id;

                                // Default behavior for everything except Terrain
                                if (clickedId !== 'terrain') {
                                    const def = Chart.defaults.plugins.legend.onClick;
                                    if (def) def.call(this, e, legendItem, legend);
                                    return;
                                }

                                // --- Custom two-phase toggle for Terrain to avoid slow triple fade ---

                                // What state do we want AFTER the click?
                                const nextVisible = !chart.isDatasetVisible(dsIndex);

                                // Phase 1: toggle Terrain instantly (no animation)
                                chart.getDatasetMeta(dsIndex).hidden = !nextVisible;
                                chart.update('none');             // <- instant, no fade

                                // Phase 2: toggle intrusions to the inverse (normal animation)
                                ['intrusion_red', 'intrusion_amber'].forEach(id => {
                                    const j = chart.data.datasets.findIndex(d => d.id === id);
                                    if (j >= 0) chart.getDatasetMeta(j).hidden = nextVisible; // if Terrain visible, hide intrusions
                                });

                                chart.update();                   // <- keep your normal animation for this part
                            }
                        },
                        tooltip: {
                            enabled: true,
                            callbacks: {
                                title: (items) => `Distance: ${m.labels[items[0].dataIndex]} mi`,
                                label: (ctx) => {
                                    if (ctx.dataset.id === 'min_marker_clearance') {
                                        return `Min clearance: ${clearanceFt[minClrIdx].toFixed(1)} ft @ ${labels[minClrIdx]} mi`;
                                    }
                                    const isClr = ctx.dataset.id === 'clearance';
                                    const y = ctx.parsed.y;
                                    if (isClr) {
                                        const sign = y > 0 ? '+' : '';
                                        return `Clearance: ${sign}${y.toFixed(1)} ft (to ${Math.round(fresFrac * 100)}%)`;
                                    }
                                    return `${ctx.dataset.label}: ${y.toFixed(1)} ft`;
                                },
                                afterBody(items) {
                                    const i = items[0].dataIndex;
                                    const clr = model.clearanceFt[i];
                                    const sign = clr > 0 ? '+' : '';
                                    const pct = Math.round((model.fresFrac ?? 0.6) * 100);
                                    return [`Clearance: ${sign}${clr.toFixed(1)} ft (to ${pct}%)`];
                                }
                            }
                        },
                        filler: { propagate: false }
                    },
                    scales: {
                        x: {
                            title: { display: true, text: 'Distance (mi)' },
                            ticks: {
                                autoSkip: true, maxRotation: 0, minRotation: 0,
                                callback: (val, idx) => Number(m.labels[idx]).toFixed(1)
                            }
                        },
                        y: {
                            title: { display: true, text: 'Elevation (ft) — baseline = Earth curvature' },
                            min: m.yMin,
                            max: m.yMax,
                            grace: 0,
                            ticks: elevTicks
                        },
                        yRightLabel: {
                            position: 'right',
                            min: m.yMin,
                            max: m.yMax,
                            grid: { drawOnChartArea: false },
                            ticks: elevTicks,
                            title: { display: true, text: 'Elevation (ft) — baseline = Earth curvature', font: { size: 12 }, color: '#666' }
                        }
                    }
                }
            });

            // size
            const container = canvas.parentElement; if (container) { container.style.height = '60vh'; container.height = Math.min(window.innerHeight - 200, 600); }
            window._losCharts.A = chart;
            return chart;
        }

        function renderClearance(m) {
            const canvas = document.getElementById('losCanvasB');
            if (!canvas) return null;
            destroyOld('losCanvasB');

            const ds = [
                {
                    id: 'clearance',
                    label: `Clearance to ${Math.round((m.fresFrac ?? 0.6) * 100)}% Fresnel (ft)`,
                    data: m.clearanceFt,
                    yAxisID: 'yR',
                    borderColor: '#198754',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.2,
                    fill: 'origin', // shade to y=0 on yR axis
                    backgroundColor: 'rgba(25,135,84,0.15)',
                    order: 10,
                    segment: {
                        borderColor: (ctx) => {
                            const y = ctx?.p1?.parsed?.y;
                            if (!Number.isFinite(y)) return 'rgba(25,135,84,1)';
                            if (y >= 0) return '#28a745';
                            if (y >= -60) return '#f0ad4e';
                            return '#dc3545';
                        }
                    }
                },
                {
                    id: 'clr_zero',
                    label: 'Fresnel boundary (0)',
                    data: m.zeroClearFt,
                    yAxisID: 'yR',
                    borderColor: '#111',      // darker
                    borderWidth: 2,           // thicker
                    borderDash: [6, 3],
                    pointRadius: 0,
                    fill: false,
                    tension: 0,
                    order: 9,                 // draw before the clearance line
                    hidden: false             // keep visible
                },
                {
                    id: 'min_marker_clearance',
                    type: 'scatter',
                    yAxisID: 'yR',
                    label: 'Min clearance',
                    data: [{ x: m.labels[m.minClrIdx], y: m.clearanceFt[m.minClrIdx] }],
                    pointStyle: 'circle',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    backgroundColor: '#dc3545',
                    borderColor: '#fff',
                    borderWidth: 1,
                    showLine: false,
                    order: 2001,
                    hidden: false 
                },
            ];

            const chart = new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: { labels: m.labels, datasets: ds },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    spanGaps: true,
                    elements: { point: { radius: 0, hitRadius: 12, hoverRadius: 4 } },
                    plugins: {
                        title: { display: true, text: m.headerText, font: { size: 18, weight: 'bold' }, padding: { bottom: 2 } },
                        subtitle: { display: true, text: m.subText, color: '#666', font: { size: 12 }, padding: { bottom: 4 } },
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                boxWidth: 12,
                                padding: 10,
                                filter: (item) => {
                                    const id = ds[item.datasetIndex]?.id;
                                    return id === 'clearance' || id === 'clr_zero';
                                }
                            }
                        },
                        tooltip: {
                            enabled: true,
                            callbacks: {
                                title: (items) => `Distance: ${m.labels[items[0].dataIndex]} mi`,
                                label: (ctx) => {
                                    // Min-clearance dot
                                    if (ctx.dataset.id === 'min_marker_clearance') {
                                        const i = m.minClrIdx;
                                        const y = m.clearanceFt[i];
                                        const sign = y > 0 ? '+' : '';
                                        return `Min clearance: ${sign}${y.toFixed(1)} ft @ ${m.labels[i]} mi`;
                                    }

                                    // <-- Add/keep this block for the dashed zero line
                                    if (ctx.dataset.id === 'clr_zero') {
                                        return 'Fresnel boundary (0 ft)';
                                    }

                                    // Default for the clearance trace
                                    const y = ctx.parsed.y;
                                    const sign = y > 0 ? '+' : '';
                                    const pct = Math.round((m.fresFrac ?? 0.6) * 100);
                                    return `Clearance: ${sign}${y.toFixed(1)} ft (to ${pct}%)`;
                                },
                                afterLabel: (ctx) => {
                                    const id = ctx.dataset.id;
                                    if (id === 'min_marker_clearance' || id === 'clr_zero') return ''; // quiet extras here

                                    const i = ctx.dataIndex;
                                    const rFull = Math.abs((m.fresUpperFt?.[i] ?? 0) - (m.losEffFt?.[i] ?? 0));
                                    const rTgt = (m.fresFrac ?? 0.6) * rFull;
                                    if (!isFinite(rTgt) || rTgt <= 0) return '';
                                    const clr = ctx.parsed.y;
                                    const margin = clr / rTgt;
                                    const sign = margin > 0 ? '+' : '';
                                    const pct = Math.round((m.fresFrac ?? 0.6) * 100);
                                    return `${pct}% radius: ${rTgt.toFixed(1)} ft • margin: ${sign}${margin.toFixed(2)}×`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: { display: true, text: 'Distance (mi)' },
                            ticks: {
                                autoSkip: true, maxRotation: 0, minRotation: 0,
                                callback: (val, idx) => Number(m.labels[idx]).toFixed(1)
                            }
                        },
                        y: {
                            position: 'left', min: m.yRMin, max: m.yRMax, grid: { drawOnChartArea: true }, ticks: { callback: v => Number(v).toFixed(0) }
                        },
                        yR: {
                            position: 'right', min: m.yRMin, max: m.yRMax, grid: { drawOnChartArea: false }, title: { display: true, text: 'Clearance to lower Fresnel (ft)' }
                        }
                    }
                }
            });

            const container = canvas.parentElement; if (container) { container.style.height = '60vh'; container.height = Math.min(window.innerHeight - 200, 600); }
            window._losCharts.B = chart;
            return chart;
        }

        // ---- make both charts
        const elevationChart = renderElevation(model);
        const clearanceChart = renderClearance(model);

        // Footer in your modal (unchanged)
        const footer = document.getElementById('losModalLegend');
        if (footer) footer.innerText =
            `LOS: ${losYes} — Min Clearance: ${minClrFtHeader.toFixed(1)} ft — Distance: ${milesTotal.toFixed(2)} mi`;

        const mEl = document.getElementById('losModal');
        if (mEl) new bootstrap.Modal(mEl).show();

        mEl.addEventListener('hidden.bs.modal', () => {
            try { elevationChart?.destroy(); } catch { }
            try { clearanceChart?.destroy(); } catch { }
        }, { once: true });

        return {
            model,
            elevationChart,
            clearanceChart,
            destroy() {
                try { elevationChart?.destroy(); } catch { }
                try { clearanceChart?.destroy(); } catch { }
            }
        };
    }
}

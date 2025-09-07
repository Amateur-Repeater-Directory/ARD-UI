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

export class UnitsService {
    static FT_PER_M = 3.28084;
    static MI_PER_M = 1 / 1609.344;

    // Elevation (meters -> '123 ft')
    static toImperialElevation(meters, decimals = 0) {
        const n = Number(meters);
        if (!Number.isFinite(n)) return 0;
        return (n * UnitsService.FT_PER_M).toFixed(decimals) + ' ft';
    }
    // Elevation numeric (meters -> 123.45 feet)
    static toImperialElevationValue(meters, decimals = 0) {
        const n = Number(meters);
        if (!Number.isFinite(n)) return 0;
        return (n * UnitsService.FT_PER_M).toFixed(decimals);
    }

    // Distance (meters -> '12.3 mi')
    static toImperialDistance(meters, decimals = 1) {
        const n = Number(meters);
        if (!Number.isFinite(n)) return '';
        return (n * UnitsService.MI_PER_M).toFixed(decimals) + ' mi';
    }
    // Distance numeric (meters -> 12.3 miles)
    static toImperialDistanceValue(meters) {
        const n = Number(meters);
        return Number.isFinite(n) ? n * UnitsService.MI_PER_M : NaN;
    }
     
    // Elevation (feet -> '123 m')
    static toMetricElevation(feet, decimals = 0) {
        const n = Number(feet);
        if (!Number.isFinite(n)) return 0;
        return (n / UnitsService.FT_PER_M).toFixed(decimals) + ' m';
    }
    // Elevation numeric (feet -> 123.45 meters)
    static toMetricElevationValue(feet, decimals = 0) {
        const n = Number(feet);
        if (!Number.isFinite(n)) return 0;
        return (n / UnitsService.FT_PER_M).toFixed(decimals);
    }

    // Distance (miles -> '123 m')
    // (Opposite of toImperialDistance; returns meters as a labeled string)
    static toMetricDistance(miles, decimals = 1) {
        const n = Number(miles);
        if (!Number.isFinite(n)) return '';
        // meters = miles / (miles per meter)
        return (n / UnitsService.MI_PER_M).toFixed(decimals) + ' km';
    }
    // Distance numeric (miles -> 12345.67 meters)
    static toMetricDistanceValue(miles) {
        const n = Number(miles);
        return Number.isFinite(n) ? n / UnitsService.MI_PER_M : NaN;
    }
}


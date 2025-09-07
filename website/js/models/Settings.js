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


export class Settings {
    constructor({
        id = 1,
        analogOnly = false,
        openOnly = false,
        stopClusteringAt = 9,
        zoomLevel = 8,
        locationId = 1,
        bands = '2m,70cm',
        modes = null,
        emergencyNets = null,
        centerLat = 28.3007533155579,
        centerLong = -81.6915893554688,
        showProperties = false,
        theme = 'light',
        mapStyle = 'light',
        showRxRange = false,
        showTxRange = false,
        showPingRange = false,
    } = {}) {
        this.id = id;
        this.analogOnly = !!analogOnly;
        this.openOnly = !!openOnly;
        this.stopClusteringAt = Number(stopClusteringAt);
        this.zoomLevel = Number(zoomLevel);
        this.locationId = Number(locationId);
        this.bands = bands;
        this.modes = modes;
        this.emergencyNets = emergencyNets;
        this.centerLat = Number(centerLat);
        this.centerLong = Number(centerLong);
        this.showProperties = !!showProperties;
        this.theme = theme || 'light';
        this.mapStyle = mapStyle || 'light';
        this.showRxRange = !!showRxRange;
        this.showTxRange = !!showTxRange;
        this.showPingRange = !!showPingRange;
    }

    static defaults() {
        return new Settings();
    }

    static fromJson(o = {}) {
        // accept either camelCase or PascalCase (just in case)
        return new Settings({
            id: o.id ?? o.Id,
            analogOnly: o.analogOnly ?? o.AnalogOnly,
            openOnly: o.openOnly ?? o.OpenOnly,
            stopClusteringAt: o.stopClusteringAt ?? o.StopClusteringAt,
            zoomLevel: o.zoomLevel ?? o.ZoomLevel,
            locationId: o.locationId ?? o.locationId ?? o.locationId,
            bands: o.bands ?? o.Bands,
            modes: o.modes ?? o.Modes,
            emergencyNets: o.emergencyNets ?? o.EmergencyNets,
            centerLat: o.centerLat ?? o.CenterLat,
            centerLong: o.centerLong ?? o.CenterLong,
            showProperties: o.showProperties ?? o.ShowProperties,
            theme: o.theme ?? o.Theme,
            mapStyle: o.mapStyle ?? o.MapStyle,
            showRxRange: o.showRxRange ?? o.ShowRxRange,
            showTxRange: o.showTxRange ?? o.ShowTxRange,
            showPingRange: o.showPingRange ?? o.ShowPingRange,
        });
    }

    toJson() {
        // use the lowercase shape everywhere in the app
        return {
            id: this.id,
            analogOnly: this.analogOnly,
            openOnly: this.openOnly,
            stopClusteringAt: this.stopClusteringAt,
            zoomLevel: this.zoomLevel,
            locationId: this.locationId,
            bands: this.bands,
            modes: this.modes,
            emergencyNets: this.emergencyNets,
            centerLat: this.centerLat,
            centerLong: this.centerLong,
            showProperties: this.showProperties,
            theme: this.theme,
            mapStyle: this.mapStyle,
            showRxRange: this.showRxRange,
            showTxRange: this.showTxRange,
            showPingRange: this.showPingRange,
        };
    }

    clone() {
        return new Settings(this.toJson());
    }
}

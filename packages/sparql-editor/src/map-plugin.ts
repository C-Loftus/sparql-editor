import Yasr from "@zazuko/yasr";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {Point} from "geojson";
import * as wellknown from "wellknown";

const WKT_DATATYPE_URI = "http://www.opengis.net/ont/geosparql#wktLiteral";

export default class MapPlugin implements Yasr.Plugin<never> {
  private yasr: Yasr;
  private container: HTMLDivElement;
  private map: L.Map | undefined;

  // A unique name for our plugin
  public name = "Map";
  // A priority for our plugin. YASR will try to render plugins with higher priorities first.
  public priority = 10;

  constructor(yasr: Yasr) {
    this.yasr = yasr;
    this.container = document.createElement("div");
    this.container.className = "map-plugin-container";
    this.container.style.height = "100%";
    this.container.style.width = "100%";
  }

  // This method is called by YASR to check if this plugin can handle the current results.
  canHandle(): boolean {
    const bindings = this.yasr.results?.getBindings();
    if (!bindings) return false;

    // Check if any of the results have a WKT literal
    return bindings.some(row => Object.values(row).some(value => value.datatype?.value === WKT_DATATYPE_URI));
  }

  // This method is called by YASR to draw the plugin's output.
  draw() {
    this.yasr.resultsEl.appendChild(this.container);

    // Initialize the map
    this.map = L.map(this.container).setView([0, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.map);

    const bindings = this.yasr.results?.getBindings();
    if (!bindings) return;

    const markers: L.Marker[] = [];

    // Find the WKT column
    let wktColumn = "";
    if (bindings.length > 0) {
      const firstRow = bindings[0];
      for (const key in firstRow) {
        if (firstRow[key].datatype?.value === WKT_DATATYPE_URI) {
          wktColumn = key;
          break;
        }
      }
    }

    if (!wktColumn) return;

    bindings.forEach(row => {
      const wktValue = row[wktColumn]?.value;
      if (wktValue) {
        try {
          const geojson = wellknown.parse(wktValue) as Point;
          if (geojson && geojson.type === "Point") {
            const [lng, lat] = geojson.coordinates;
            const marker = L.marker([lat, lng]);

            let popupContent = '<div style="max-height: 200px; overflow-y: auto;">';
            for (const [key, value] of Object.entries(row)) {
              if (key !== wktColumn) {
                popupContent += `<strong>${key}:</strong> ${value.value}<br>`;
              }
            }
            popupContent += "</div>";
            marker.bindPopup(popupContent);
            markers.push(marker);
          }
        } catch (e) {
          console.error("Error parsing WKT:", e);
        }
      }
    });

    if (markers.length > 0) {
      const featureGroup = L.featureGroup(markers).addTo(this.map);
      this.map.fitBounds(featureGroup.getBounds());
    }

    // Force map to redraw/resize
    setTimeout(() => {
      this.map?.invalidateSize();
    }, 100);
  }

  // Called when the plugin is being hidden
  hide() {
    this.container.remove();
  }

  // Called when the plugin is being shown
  show() {
    this.yasr.resultsEl.appendChild(this.container);
  }
}

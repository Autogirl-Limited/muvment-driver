import L from "leaflet";

/**
 * Top-down car marker for the navigation map. Points north in its own frame
 * and is rotated to the heading of travel. In dark mode the headlights are on:
 * two soft beams ahead of the car and glowing tail lights behind it.
 * Styles live in globals.css under `.car-marker`.
 */
export const CAR_ICON_SIZE = 96;

const ACCENT = "#0673FF";
const ACCENT_DARK = "#0A5BD1";
const ACCENT_LIGHT = "#5BA0FF";

const carSvg = (night: boolean) => `
<svg viewBox="0 0 96 96" width="${CAR_ICON_SIZE}" height="${CAR_ICON_SIZE}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="car-body" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${ACCENT_DARK}"/>
      <stop offset="0.5" stop-color="${ACCENT}"/>
      <stop offset="1" stop-color="${ACCENT_DARK}"/>
    </linearGradient>
    <linearGradient id="car-roof" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${ACCENT_LIGHT}"/>
      <stop offset="1" stop-color="${ACCENT}"/>
    </linearGradient>
    <linearGradient id="car-glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${night ? "#1B2A44" : "#EAF2FF"}"/>
      <stop offset="1" stop-color="${night ? "#0B1220" : "#B8D2FF"}"/>
    </linearGradient>
    <linearGradient id="car-beam" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#FFF4C2" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#FFF4C2" stop-opacity="0"/>
    </linearGradient>
    <filter id="car-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity="${night ? 0.55 : 0.28}"/>
    </filter>
    <filter id="car-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="2.2"/>
    </filter>
  </defs>

  ${
    night
      ? `<!-- headlight beams -->
  <g class="car-marker__beams">
    <path d="M36 30 L18 2 Q24 -2 30 1 L42 30 Z" fill="url(#car-beam)"/>
    <path d="M60 30 L78 2 Q72 -2 66 1 L54 30 Z" fill="url(#car-beam)"/>
  </g>`
      : ""
  }

  <!-- wheels -->
  <g fill="#0F172A" opacity="${night ? 0.95 : 0.9}">
    <rect x="28" y="33" width="7" height="13" rx="3"/>
    <rect x="61" y="33" width="7" height="13" rx="3"/>
    <rect x="28" y="63" width="7" height="13" rx="3"/>
    <rect x="61" y="63" width="7" height="13" rx="3"/>
  </g>

  <!-- body -->
  <g filter="url(#car-shadow)">
    <path d="M38 27 Q48 22 58 27 L62 36 Q64 48 62 72 L58 79 Q48 82 38 79 L34 72 Q32 48 34 36 Z"
          fill="url(#car-body)" stroke="${night ? "#1E3A5F" : "#FFFFFF"}" stroke-width="1.6"/>
  </g>

  <!-- windshield -->
  <path d="M38.5 38 Q48 35 57.5 38 L59 47 Q48 44.5 37 47 Z" fill="url(#car-glass)"/>
  <!-- roof -->
  <path d="M37.5 48.5 Q48 46.5 58.5 48.5 L58.5 63 Q48 65 37.5 63 Z" fill="url(#car-roof)"/>
  <!-- rear window -->
  <path d="M37.5 64.5 Q48 66.5 58.5 64.5 L58 72 Q48 74.5 38 72 Z" fill="url(#car-glass)"/>
  <!-- windshield reflection -->
  <path d="M40 39.5 Q47 37.5 54 39.2 L53 41.5 Q47 40 41 41.6 Z" fill="#FFFFFF" opacity="${night ? 0.18 : 0.6}"/>

  <!-- headlights -->
  ${
    night
      ? `<g filter="url(#car-glow)">
    <ellipse cx="40" cy="28.5" rx="3.6" ry="2.2" fill="#FFF7CC"/>
    <ellipse cx="56" cy="28.5" rx="3.6" ry="2.2" fill="#FFF7CC"/>
  </g>`
      : ""
  }
  <ellipse cx="40" cy="28.5" rx="2.6" ry="1.5" fill="${night ? "#FFFDF0" : "#F8FAFC"}"/>
  <ellipse cx="56" cy="28.5" rx="2.6" ry="1.5" fill="${night ? "#FFFDF0" : "#F8FAFC"}"/>

  <!-- tail lights -->
  ${
    night
      ? `<g filter="url(#car-glow)">
    <rect x="37" y="77" width="6" height="2.6" rx="1.3" fill="#FF3B30"/>
    <rect x="53" y="77" width="6" height="2.6" rx="1.3" fill="#FF3B30"/>
  </g>`
      : ""
  }
  <rect x="37.5" y="77.2" width="5" height="2" rx="1" fill="${night ? "#FF6259" : "#D92D20"}"/>
  <rect x="53.5" y="77.2" width="5" height="2" rx="1" fill="${night ? "#FF6259" : "#D92D20"}"/>
</svg>`;

export const createDriverCarIcon = ({ heading, night }: { heading: number; night: boolean }) =>
  L.divIcon({
    className: `car-marker ${night ? "car-marker--night" : ""}`,
    iconSize: [CAR_ICON_SIZE, CAR_ICON_SIZE],
    iconAnchor: [CAR_ICON_SIZE / 2, CAR_ICON_SIZE / 2],
    html: `<div class="car-marker__halo"></div>
<div class="car-marker__body" style="transform: rotate(${Math.round(heading)}deg)">${carSvg(night)}</div>`,
  });

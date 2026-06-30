// mapTheme.ts — dark theme with cyan accents for CareLink (Google Maps style)
const mapTheme = [
  { "elementType": "geometry", "stylers": [{ "color": "#071423" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#9fdcf0" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#071423" }] },
  { "featureType": "administrative", "elementType": "geometry.stroke", "stylers": [{ "color": "rgba(255,255,255,0.03)" }] },
  { "featureType": "poi", "elementType": "labels", "stylers": [{ "visibility": "off" }] },
  { "featureType": "poi.business", "stylers": [{ "visibility": "off" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#0b2a36" }] },
  { "featureType": "road.local", "elementType": "geometry", "stylers": [{ "color": "#071f2b" }] },
  { "featureType": "road.highway", "elementType": "geometry.fill", "stylers": [{ "color": "#16384a" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#80eaff" }] },
  { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#021826" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#88e6ff" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#022b2d" }] }
];

export default mapTheme;

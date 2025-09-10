// src/utils/googleMapsLoaderOptions.js
export const GOOGLE_MAPS_LOADER_OPTIONS = {
  id: "google-maps-script",
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,  // or process.env.REACT_APP_GOOGLE_MAPS_KEY
  libraries: ["places", "geometry", "visualization"],
};

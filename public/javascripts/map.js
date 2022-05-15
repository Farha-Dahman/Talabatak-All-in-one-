mapboxgl.accessToken =
  "pk.eyJ1IjoiZmFyaGEtZGFobWFuMTIiLCJhIjoiY2wyejI5djdjMDB3ZzNkbWZ4c2VkZ3cxbCJ9.kqvAEyNypVVbYAOQyFfYXg";
const lat = 48.8606;
const lng = 2.3376;

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v11",
  zoom: 8,
  center: [lng, lat],
});

const marker = new mapboxgl.Marker().setLngLat([lng, lat]).addTo(map);

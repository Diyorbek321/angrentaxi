# Self-contained OSRM routing server for Angren Taxi.
#
# Builds the routing graph AT IMAGE BUILD TIME, so a host with no volumes and
# no shell access (Railway) can run it from this directory alone:
#
#   railway up . --path-as-root --service osrm
#
# The graph covers a bounding box around Tashkent region rather than the whole
# country. Every ride starts in Angren and the longest realistic one ends in
# Tashkent, so the rest of Uzbekistan is RAM we would pay for and never route
# on. Widen ROUTE_BBOX when the service area grows (e.g. intercity routes).

ARG OSRM_IMAGE=ghcr.io/project-osrm/osrm-backend:v5.27.1

# ---- 1. Download the OSM extract and clip it to the service area ----
FROM debian:bookworm-slim AS extract
# min_lon,min_lat,max_lon,max_lat — Tashkent region incl. Angren, Olmaliq,
# Chirchiq and the city of Tashkent.
ARG ROUTE_BBOX=68.9,40.35,71.3,41.75
ARG REGION=asia/uzbekistan
RUN apt-get update \
 && apt-get install -y --no-install-recommends osmium-tool curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /data
RUN curl -fsSL "https://download.geofabrik.de/${REGION}-latest.osm.pbf" -o country.osm.pbf \
 && osmium extract --bbox "${ROUTE_BBOX}" --strategy complete_ways \
      country.osm.pbf -o area.osm.pbf \
 && rm country.osm.pbf

# ---- 2. Build the MLD graph (car profile) ----
# MLD rather than CH so edge weights can later be updated from our own
# drivers' speeds (osrm-customize) without re-extracting.
FROM ${OSRM_IMAGE} AS graph
COPY --from=extract /data/area.osm.pbf /data/area.osm.pbf
RUN osrm-extract -p /opt/car.lua /data/area.osm.pbf \
 && osrm-partition /data/area.osrm \
 && osrm-customize /data/area.osrm \
 && rm /data/area.osm.pbf

# ---- 3. Runtime ----
FROM ${OSRM_IMAGE}
COPY --from=graph /data /data
# Railway injects PORT; locally it defaults to 5000.
ENV PORT=5000
EXPOSE 5000
# --max-table-size: matching asks for one ETA column from up to ~50 drivers.
CMD ["sh", "-c", "exec osrm-routed --algorithm mld --max-table-size 1000 --port ${PORT} /data/area.osrm"]

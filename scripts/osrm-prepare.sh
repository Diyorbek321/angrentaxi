#!/usr/bin/env bash
#
# Builds the OSRM routing graph for Uzbekistan.
#
# Run once before `docker compose up osrm`, and again whenever you want fresher
# map data (Geofabrik rebuilds the extract daily). Takes ~5-15 minutes and needs
# a few GB of free disk; the Uzbekistan extract is small as OSM extracts go.
#
#   ./scripts/osrm-prepare.sh
#
# Why self-hosted at all: the app previously routed through
# router.project-osrm.org, OSRM's public demo server. It is rate-limited,
# carries no SLA and is explicitly not for production traffic — a single point
# of failure for both ETA-ranked dispatch and trip pricing.

set -euo pipefail

REGION="${OSRM_REGION:-asia/uzbekistan}"
NAME="${OSRM_NAME:-uzbekistan-latest}"
OSRM_IMAGE="ghcr.io/project-osrm/osrm-backend:v5.27.1"
DATA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/osrm/data"

mkdir -p "$DATA_DIR"

if [ ! -f "$DATA_DIR/$NAME.osm.pbf" ]; then
  echo "==> Downloading $REGION extract from Geofabrik"
  curl -fL --progress-bar \
    "https://download.geofabrik.de/$REGION-latest.osm.pbf" \
    -o "$DATA_DIR/$NAME.osm.pbf"
else
  echo "==> $NAME.osm.pbf already present — delete it to re-download"
fi

run_osrm() {
  docker run --rm -t -v "$DATA_DIR:/data" "$OSRM_IMAGE" "$@"
}

# MLD (multi-level Dijkstra), not CH: MLD lets you push updated edge weights —
# i.e. real traffic learned from your own drivers — without rebuilding the whole
# graph. That is the upgrade path to traffic-aware ETAs.
echo "==> Extracting (car profile)"
run_osrm osrm-extract -p /opt/car.lua "/data/$NAME.osm.pbf"

echo "==> Partitioning"
run_osrm osrm-partition "/data/$NAME.osrm"

echo "==> Customizing"
run_osrm osrm-customize "/data/$NAME.osrm"

echo
echo "==> Done. Graph ready in osrm/data/"
echo "    Start it with:  docker compose up -d osrm"
echo "    Smoke test:     curl 'http://localhost:5000/route/v1/driving/69.12,40.14;69.13,40.15'"
echo
echo "    Note: OSM coverage in Uzbekistan is incomplete (~24% of estimated"
echo "    total road length). Check Angren's streets on openstreetmap.org and"
echo "    fill gaps there — every fix lands in the next rebuild."

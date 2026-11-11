#!/usr/bin/env bash
#
# Builds a self-hosted vector basemap for Uzbekistan as a single .pmtiles file.
#
#   ./scripts/tiles-build.sh
#
# Why this exists: the app currently fetches tiles from MapTiler Cloud
# (assets/map/style_*.json -> api.maptiler.com). That works, but it is a
# per-request cost that grows exactly as the product grows, and it puts a
# third party in the path of every map frame the fleet renders.
#
# The migration is unusually cheap for us because of one fact: our style is
# written against the OpenMapTiles schema, and Planetiler ships that exact
# profile. Tiles generated here are a DROP-IN replacement — none of the 21
# style layers change. Only the source URL does.
#
# It also reuses the same Geofabrik extract that scripts/osrm-prepare.sh
# downloads for routing, so the data is already familiar to this repo.
#
# Cost after this: Cloudflare R2 gives 10 GB storage and — the part that
# matters — zero egress. PMTiles is a single file read with HTTP range
# requests, so there is no tile server to run and no per-tile charge.
#
# ⚠️ NOT AUTOMATED HERE (needs your accounts/credentials):
#   1. Uploading the .pmtiles to R2.
#   2. Generating and hosting the font glyph PBFs (the style's `glyphs` URL
#      still points at MapTiler). See the note at the end of this script.
# Until both are done, keep the MapTiler source — a half-migrated style
# renders an empty map.

set -euo pipefail

REGION="${TILES_REGION:-asia/uzbekistan}"
NAME="${TILES_NAME:-uzbekistan-latest}"
OUT_NAME="${TILES_OUT:-uzbekistan}"
PLANETILER_IMAGE="ghcr.io/onthegomap/planetiler:latest"
# Deliberately the SAME directory osrm-prepare.sh uses: one extract, two
# consumers. Re-downloading ~150 MB per tool is waste.
DATA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/osrm/data"
# Planetiler needs roughly 2x the extract size in scratch space.
JAVA_HEAP="${TILES_HEAP:-2g}"

mkdir -p "$DATA_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required (Planetiler runs as a container)" >&2
  exit 1
fi

if [ ! -f "$DATA_DIR/$NAME.osm.pbf" ]; then
  echo "==> Downloading $REGION extract from Geofabrik"
  curl -fL --progress-bar \
    "https://download.geofabrik.de/$REGION-latest.osm.pbf" \
    -o "$DATA_DIR/$NAME.osm.pbf"
else
  echo "==> $NAME.osm.pbf already present — delete it to re-download"
fi

echo "==> Building $OUT_NAME.pmtiles with Planetiler (OpenMapTiles profile)"
# --force so a re-run overwrites rather than refusing.
# The default profile IS OpenMapTiles; naming it explicitly documents the
# contract that makes our existing style work unchanged.
docker run --rm -t \
  -e JAVA_TOOL_OPTIONS="-Xmx$JAVA_HEAP" \
  -v "$DATA_DIR:/data" \
  "$PLANETILER_IMAGE" \
  --osm-path="/data/$NAME.osm.pbf" \
  --output="/data/$OUT_NAME.pmtiles" \
  --force

SIZE=$(du -h "$DATA_DIR/$OUT_NAME.pmtiles" | cut -f1)
echo
echo "==> Done: $DATA_DIR/$OUT_NAME.pmtiles ($SIZE)"
cat <<'NEXT'

Next steps (manual — they need your Cloudflare account):

  1. Create an R2 bucket and upload the file:
       wrangler r2 bucket create angren-tiles
       wrangler r2 object put angren-tiles/uzbekistan.pmtiles \
         --file osrm/data/uzbekistan.pmtiles

  2. Expose it over HTTPS (public bucket or a Worker) and allow CORS +
     HTTP Range requests. Range is not optional: PMTiles reads slices of
     the file, so a host that ignores Range serves the whole archive on
     every pan.

  3. Font glyphs. The style's `glyphs` URL still points at MapTiler, so
     labels would vanish the moment you switch only the tile source.
     Generate a glyph set once (e.g. with `font-maker` / fontnik from the
     Plus Jakarta Sans TTFs already used by the app), upload it beside the
     tiles, and point `glyphs` at it.

  4. Only then switch the app: set MAP_TILES_URL / MAP_GLYPHS_URL and
     rebuild. Verify on a real device before removing the MapTiler key.

NEXT

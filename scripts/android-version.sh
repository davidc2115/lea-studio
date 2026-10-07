#!/usr/bin/env bash
# Résout les métadonnées uniquement : ne compile et ne modifie aucun APK.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PROPERTIES="${2:-$ROOT/android/version.properties}"
VERSION_NAME=$(sed -n 's/^versionName=//p' "$PROPERTIES")
MIN_CODE=$(sed -n 's/^versionCode=//p' "$PROPERTIES")
VERSION_CODE="${1:-}"

if [[ ! "$VERSION_NAME" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  echo "versionName invalide dans $PROPERTIES (attendu : X.Y.Z)." >&2
  exit 1
fi
for CODE in "$MIN_CODE" "$VERSION_CODE"; do
  if [[ ! "$CODE" =~ ^[1-9][0-9]{0,9}$ ]] || (( CODE > 2100000000 )); then
    echo "versionCode invalide : entier Android positif requis." >&2
    exit 1
  fi
done
if (( MIN_CODE <= 666 || VERSION_CODE < MIN_CODE )); then
  echo "versionCode=$VERSION_CODE refusé : minimum $MIN_CODE, supérieur au dernier APK livré (666)." >&2
  exit 1
fi
printf 'VERSION_NAME=%s\nVERSION_CODE=%s\n' "$VERSION_NAME" "$VERSION_CODE"

#!/usr/bin/env bash
# Called by angren-failure@<unit>.service (OnFailure= in install-timers.sh):
# sends a Telegram alert that a systemd unit (e.g. the nightly backup)
# failed, with the tail of its log.
#
#   notify-failure.sh angren-backup.service
set -uo pipefail
. "$(dirname "$0")/lib.sh"
load_env

unit="${1:?unit name required}"
# The deploy user may lack journal access — the alert still goes out.
tail_log="$(journalctl -u "$unit" -n 12 --no-pager -o cat 2>/dev/null | tail -c 1500)"
[[ -n "$tail_log" ]] || tail_log="(log yo'q — serverda: journalctl -u $unit)"
telegram_notify "❌ Angren (${DOMAIN:-?}): $unit XATO bilan tugadi
Server: $(hostname), $(date '+%F %T')
${tail_log}"

#!/usr/bin/env bash
# Installs systemd timers (idempotent) for:
#   angren-backup.timer  — backup.sh nightly at 03:30 (server TZ Asia/Tashkent)
#   angren-health.timer  — healthcheck-alert.sh every minute
#   angren-failure@.service — Telegram alert when the backup unit FAILS
#                              (OnFailure=; a failed backup used to be
#                              visible only in the journal)
#
#   sudo deploy/oracle/install-timers.sh
# Logs: journalctl -u angren-backup -u angren-health
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "run with sudo" >&2; exit 1; }

ORACLE_DIR="$(cd "$(dirname "$0")" && pwd)"
RUN_AS="${RUN_AS:-deploy}"

cat > /etc/systemd/system/angren-backup.service <<UNIT
[Unit]
Description=Angren PostgreSQL backup (local + R2)
After=docker.service
Requires=docker.service
OnFailure=angren-failure@%n.service

[Service]
Type=oneshot
User=$RUN_AS
ExecStart=$ORACLE_DIR/backup.sh
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=7
UNIT

cat > /etc/systemd/system/angren-backup.timer <<'UNIT'
[Unit]
Description=Nightly Angren DB backup

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true
RandomizedDelaySec=5min

[Install]
WantedBy=timers.target
UNIT

cat > /etc/systemd/system/angren-failure@.service <<UNIT
[Unit]
Description=Angren failure alert for %i

[Service]
Type=oneshot
User=$RUN_AS
ExecStart=$ORACLE_DIR/notify-failure.sh %i
UNIT

cat > /etc/systemd/system/angren-health.service <<UNIT
[Unit]
Description=Angren health probe + Telegram alert
After=docker.service

[Service]
Type=oneshot
User=$RUN_AS
ExecStart=$ORACLE_DIR/healthcheck-alert.sh
# A failed probe is expected data, not a unit failure worth spamming about.
SuccessExitStatus=1
UNIT

cat > /etc/systemd/system/angren-health.timer <<'UNIT'
[Unit]
Description=Angren health probe every minute

[Timer]
OnBootSec=3min
OnUnitActiveSec=1min
AccuracySec=10s

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now angren-backup.timer angren-health.timer
systemctl list-timers 'angren-*' --no-pager

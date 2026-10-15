#!/usr/bin/env bash
# First-boot setup for a fresh Oracle Cloud Ubuntu 22.04/24.04 (aarch64) VM.
# Idempotent — safe to re-run. Run as the default `ubuntu` user with sudo:
#
#   sudo bash deploy/oracle/bootstrap.sh
#
# Does: apt upgrade, Docker Engine + compose plugin (official repo), a `deploy`
# user in the docker group, host firewall (iptables, Oracle's way), swap,
# unattended security upgrades, fail2ban for SSH, timezone Asia/Tashkent,
# rclone + gnupg for off-box backups.
#
# Firewall note: Oracle's Ubuntu images ship their own iptables rules
# (/etc/iptables/rules.v4) that REJECT everything except SSH. Oracle's docs
# advise AGAINST ufw on these images (it rewrites those rules and can make the
# instance unreachable/unbootable), so we insert ACCEPT rules for 80/443 into
# the existing INPUT chain and persist them with netfilter-persistent.
# The VCN Security List must ALSO allow TCP 80/443 — see README.md step 3.
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
SWAP_SIZE_GB="${SWAP_SIZE_GB:-4}"
TIMEZONE="${TIMEZONE:-Asia/Tashkent}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/angren}"

log() { printf '\n==> %s\n' "$*"; }

[[ $EUID -eq 0 ]] || { echo "run with sudo" >&2; exit 1; }
arch="$(dpkg --print-architecture)"
[[ "$arch" == "arm64" ]] || echo "WARNING: expected arm64 (Ampere A1), got $arch — continuing"

export DEBIAN_FRONTEND=noninteractive

log "apt update + upgrade"
apt-get update -y
apt-get -y -o Dpkg::Options::=--force-confold upgrade
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg git jq unzip openssl \
  iptables-persistent netfilter-persistent \
  fail2ban unattended-upgrades rclone cron

log "timezone -> $TIMEZONE"
timedatectl set-timezone "$TIMEZONE"

log "Docker Engine + compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  codename="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")"
  echo "deb [arch=$arch signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $codename stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
# Default log rotation for any container that does not set its own.
if [[ ! -f /etc/docker/daemon.json ]]; then
  cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "5" },
  "live-restore": true
}
JSON
  systemctl restart docker
fi
systemctl enable --now docker

log "deploy user: $DEPLOY_USER"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"
# Reuse the SSH key Oracle put on the default user, so you can `ssh deploy@VM`.
if [[ -f /home/ubuntu/.ssh/authorized_keys && ! -f /home/$DEPLOY_USER/.ssh/authorized_keys ]]; then
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
  install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" \
    /home/ubuntu/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/authorized_keys"
fi
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /opt/angren
install -d -m 750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$BACKUP_DIR"

log "host firewall: allow 80/443 (Oracle iptables rules)"
# Insert right before Oracle's catch-all REJECT. Its position differs between
# images (5 on Ubuntu 24.04 Minimal, 6 on some others) — a hard-coded index
# lands AFTER the REJECT and silently keeps 80/443 closed.
reject_pos() {
  iptables -L INPUT --line-numbers -n | awk '$2 == "REJECT" { print $1; exit }'
}
allow_input() {
  if ! iptables -C INPUT "$@" -j ACCEPT 2>/dev/null; then
    local pos
    pos="$(reject_pos)"
    if [[ -n "$pos" ]]; then
      iptables -I INPUT "$pos" "$@" -j ACCEPT
    else
      iptables -A INPUT "$@" -j ACCEPT
    fi
  fi
}
for port in 80 443; do
  allow_input -p tcp -m state --state NEW --dport "$port"
done
allow_input -p udp --dport 443   # HTTP/3, optional
netfilter-persistent save

log "swap ${SWAP_SIZE_GB}G"
if ! swapon --show | grep -q /swapfile; then
  if [[ ! -f /swapfile ]]; then
    fallocate -l "${SWAP_SIZE_GB}G" /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
echo 'vm.swappiness=10' > /etc/sysctl.d/99-angren.conf
sysctl --system >/dev/null

log "unattended security upgrades"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
CONF
# Reboot (only if a kernel update needs it) at a quiet hour, Tashkent time.
cat > /etc/apt/apt.conf.d/52angren-unattended <<'CONF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
CONF
systemctl enable --now unattended-upgrades

log "fail2ban (sshd)"
cat > /etc/fail2ban/jail.d/angren.local <<'CONF'
[sshd]
enabled  = true
maxretry = 5
findtime = 10m
bantime  = 1h
CONF
systemctl enable fail2ban
systemctl restart fail2ban

log "SSH: key-only login"
if grep -qE '^\s*PasswordAuthentication\s+yes' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null; then
  echo "PasswordAuthentication is enabled somewhere — disable it manually after confirming key login works."
fi

echo
echo "Bootstrap done. Next (as $DEPLOY_USER):"
echo "  sudo -iu $DEPLOY_USER"
echo "  git clone <repo-url> /opt/angren/app && cd /opt/angren/app"
echo "  cp deploy/oracle/.env.prod.example deploy/oracle/.env.prod && deploy/oracle/gen-secrets.sh"
echo "  deploy/oracle/deploy.sh main"
echo "  sudo deploy/oracle/install-timers.sh"

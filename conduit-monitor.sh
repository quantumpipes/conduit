#!/usr/bin/env bash
# conduit-monitor.sh
# Show server hardware stats: CPU, memory, disk, GPU, Docker containers.
#
# Usage:
#   conduit-monitor.sh
#   conduit-monitor.sh --server user@10.0.1.5
#
# Copyright 2026 Quantum Pipes Technologies, LLC
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/conduit-preflight.sh"

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
    cat <<EOF
Usage: conduit-monitor.sh [OPTIONS]

Show server hardware statistics: CPU, memory, disk usage, GPU
utilization, and Docker container stats.

Options:
  --server SSH_HOST     Monitor a remote server via SSH (e.g., user@10.0.1.5)
  -h, --help            Show this help

Examples:
  conduit-monitor.sh
  conduit-monitor.sh --server root@gpu-server.qp.local
EOF
    exit 0
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
SSH_HOST=""

for arg in "$@"; do
    case "$arg" in
        --server=*) SSH_HOST="${arg#*=}" ;;
        --help|-h) usage ;;
        *)
            log_error "Unknown option: $arg"
            usage
            ;;
    esac
done

# Validate SSH host if provided (prevent command injection)
if [[ -n "$SSH_HOST" ]]; then
    if ! [[ "$SSH_HOST" =~ ^[a-zA-Z0-9@._-]+$ ]]; then
        log_error "Invalid server address: $SSH_HOST"
        exit 1
    fi
fi

# ---------------------------------------------------------------------------
# Helper: run command locally or via SSH
# ---------------------------------------------------------------------------
_run() {
    if [[ -n "$SSH_HOST" ]]; then
        ssh -o ConnectTimeout=5 -o BatchMode=yes "$SSH_HOST" "$@" 2>/dev/null
    else
        "$@" 2>/dev/null
    fi
}

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
if [[ -n "$SSH_HOST" ]]; then
    echo "  QP Conduit Monitor (${SSH_HOST})"
else
    echo "  QP Conduit Monitor (localhost)"
fi
echo "========================================"
echo ""

# ---------------------------------------------------------------------------
# Hostname and uptime
# ---------------------------------------------------------------------------
hostname_val="$(_run hostname 2>/dev/null || echo "unknown")"
uptime_val="$(_run uptime 2>/dev/null || echo "unknown")"
echo "Host:   $hostname_val"
echo "Uptime: $uptime_val"
echo ""

# ---------------------------------------------------------------------------
# CPU
# ---------------------------------------------------------------------------
echo "--- CPU ---"
os_type="$(_run uname -s 2>/dev/null || echo "Unknown")"
if [[ "$os_type" == "Linux" ]]; then
    cpu_count="$(_run nproc 2>/dev/null || echo "?")"
    load_avg="$(_run cat /proc/loadavg 2>/dev/null | cut -d' ' -f1-3 || echo "?")"
    echo "Cores: $cpu_count"
    echo "Load:  $load_avg"
elif [[ "$os_type" == "Darwin" ]]; then
    cpu_count="$(_run sysctl -n hw.ncpu 2>/dev/null || echo "?")"
    load_avg="$(_run sysctl -n vm.loadavg 2>/dev/null || echo "?")"
    echo "Cores: $cpu_count"
    echo "Load:  $load_avg"
fi
echo ""

# ---------------------------------------------------------------------------
# Memory
# ---------------------------------------------------------------------------
echo "--- Memory ---"
if [[ "$os_type" == "Linux" ]]; then
    _run free -h 2>/dev/null || echo "(free command not available)"
elif [[ "$os_type" == "Darwin" ]]; then
    total_mem="$(_run sysctl -n hw.memsize 2>/dev/null || echo "0")"
    if [[ "$total_mem" != "0" ]]; then
        total_gb=$(( total_mem / 1073741824 ))
        echo "Total: ${total_gb}GB"
    fi
    _run vm_stat 2>/dev/null | head -5 || true
fi
echo ""

# ---------------------------------------------------------------------------
# Disk
# ---------------------------------------------------------------------------
echo "--- Disk ---"
_run df -h / 2>/dev/null || echo "(df command not available)"
echo ""

# ---------------------------------------------------------------------------
# GPU (nvidia-smi if available)
# ---------------------------------------------------------------------------
if _run command -v nvidia-smi >/dev/null 2>&1; then
    echo "--- GPU ---"
    _run nvidia-smi --query-gpu=name,temperature.gpu,utilization.gpu,utilization.memory,memory.used,memory.total --format=csv,noheader 2>/dev/null || echo "(nvidia-smi query failed)"
    echo ""
fi

# ---------------------------------------------------------------------------
# Docker containers (if available)
# ---------------------------------------------------------------------------
if _run command -v docker >/dev/null 2>&1; then
    echo "--- Docker Containers ---"
    _run docker stats --no-stream --format '"table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.PIDs}}"' 2>/dev/null || echo "(docker stats not available)"
    echo ""
fi

echo "--- End ---"

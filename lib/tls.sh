#!/usr/bin/env bash
# lib/tls.sh
# TLS certificate management via Caddy's internal CA for QP Conduit.
# Sourced by conduit-* scripts. Never executed directly.
#
# Copyright 2026 Quantum Pipes Technologies, LLC
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

# ---------------------------------------------------------------------------
# tls_ensure_ca
# Generates an internal CA using Caddy if one does not exist.
# Caddy auto-generates its internal CA on first use; this function
# verifies the CA root certificate is present.
# ---------------------------------------------------------------------------
tls_ensure_ca() {
    local certs_dir="${CONDUIT_CERTS_DIR:-$(ensure_config_dir)/certs}"
    local ca_cert="${certs_dir}/root.crt"
    local ca_key="${certs_dir}/root.key"

    if [[ -f "$ca_cert" && -f "$ca_key" ]]; then
        log_info "Internal CA already exists at $certs_dir"
        return 0
    fi

    require_cmd caddy

    mkdir -p "$certs_dir"
    chmod 700 "$certs_dir"

    # Use Caddy's built-in CA to generate a root certificate
    caddy trust 2>/dev/null || true

    # Extract CA from Caddy data directory
    local caddy_data="${CONDUIT_CADDY_DATA:-$(ensure_config_dir)/caddy-data}"
    local caddy_ca_root="${caddy_data}/caddy/pki/authorities/local/root.crt"
    local caddy_ca_key="${caddy_data}/caddy/pki/authorities/local/root.key"

    if [[ -f "$caddy_ca_root" ]]; then
        cp "$caddy_ca_root" "$ca_cert"
        cp "$caddy_ca_key" "$ca_key"
        chmod 600 "$ca_key"
        chmod 644 "$ca_cert"
        log_success "Internal CA initialized at $certs_dir"
    else
        log_warn "Caddy CA root not found at expected path. CA will be created on first request."
    fi
}

# ---------------------------------------------------------------------------
# tls_issue_cert SERVICE_NAME
# Issues a TLS certificate for SERVICE_NAME.CONDUIT_DOMAIN using the internal CA.
# ---------------------------------------------------------------------------
tls_issue_cert() {
    local name="${1:?service name required}"
    local domain="${name}.${CONDUIT_DOMAIN:-qp.local}"
    local certs_dir="${CONDUIT_CERTS_DIR:-$(ensure_config_dir)/certs}"
    local cert_dir="${certs_dir}/${name}"

    if ! validate_service_name "$name"; then
        return 1
    fi

    mkdir -p "$cert_dir"
    chmod 700 "$cert_dir"

    # Use openssl to generate a CSR and sign with the internal CA
    local ca_cert="${certs_dir}/root.crt"
    local ca_key="${certs_dir}/root.key"

    if [[ ! -f "$ca_cert" || ! -f "$ca_key" ]]; then
        log_error "Internal CA not found. Run conduit-setup.sh first."
        return 1
    fi

    # Generate private key
    openssl genpkey -algorithm ED25519 -out "${cert_dir}/key.pem" 2>/dev/null
    chmod 600 "${cert_dir}/key.pem"

    # Generate CSR
    openssl req -new -key "${cert_dir}/key.pem" \
        -out "${cert_dir}/csr.pem" \
        -subj "/CN=${domain}" 2>/dev/null

    # Sign with CA (valid for 365 days)
    openssl x509 -req -in "${cert_dir}/csr.pem" \
        -CA "$ca_cert" -CAkey "$ca_key" -CAcreateserial \
        -out "${cert_dir}/cert.pem" -days 365 \
        -extfile <(printf "subjectAltName=DNS:%s" "$domain") 2>/dev/null

    rm -f "${cert_dir}/csr.pem"
    log_success "TLS certificate issued for $domain"
}

# ---------------------------------------------------------------------------
# tls_revoke_cert SERVICE_NAME
# Archives the certificate for a service (moves to .revoked directory).
# ---------------------------------------------------------------------------
tls_revoke_cert() {
    local name="${1:?service name required}"
    local certs_dir="${CONDUIT_CERTS_DIR:-$(ensure_config_dir)/certs}"
    local cert_dir="${certs_dir}/${name}"
    local archive_dir
    archive_dir="${certs_dir}/.revoked/${name}.$(date +%s)"

    if [[ ! -d "$cert_dir" ]]; then
        log_warn "No certificate directory found for service '$name'"
        return 0
    fi

    mkdir -p "${certs_dir}/.revoked"
    mv "$cert_dir" "$archive_dir"
    log_info "Certificate for '$name' archived to $archive_dir"
}

# ---------------------------------------------------------------------------
# tls_list_certs
# Lists all active TLS certificates with expiry dates.
# ---------------------------------------------------------------------------
tls_list_certs() {
    local certs_dir="${CONDUIT_CERTS_DIR:-$(ensure_config_dir)/certs}"

    if [[ ! -d "$certs_dir" ]]; then
        echo "(no certificates)"
        return 0
    fi

    printf '%-30s %-20s %s\n' "SERVICE" "EXPIRES" "DOMAIN"
    printf '%-30s %-20s %s\n' "-------" "-------" "------"

    for cert_dir in "$certs_dir"/*/; do
        local cert_file="${cert_dir}cert.pem"
        if [[ ! -f "$cert_file" ]]; then
            continue
        fi
        local svc_name
        svc_name="$(basename "$cert_dir")"
        local expiry
        expiry="$(openssl x509 -enddate -noout -in "$cert_file" 2>/dev/null | cut -d= -f2 || echo "unknown")"
        local cn
        cn="$(openssl x509 -subject -noout -in "$cert_file" 2>/dev/null | sed 's/.*CN *= *//' || echo "unknown")"
        printf '%-30s %-20s %s\n' "$svc_name" "$expiry" "$cn"
    done
}

# ---------------------------------------------------------------------------
# tls_trust_ca
# Installs the internal CA certificate into the system trust store.
# ---------------------------------------------------------------------------
tls_trust_ca() {
    local certs_dir="${CONDUIT_CERTS_DIR:-$(ensure_config_dir)/certs}"
    local ca_cert="${certs_dir}/root.crt"

    if [[ ! -f "$ca_cert" ]]; then
        log_error "CA certificate not found at $ca_cert"
        return 1
    fi

    local os_type
    os_type="$(uname -s)"

    case "$os_type" in
        Darwin)
            sudo security add-trusted-cert -d -r trustRoot \
                -k /Library/Keychains/System.keychain "$ca_cert"
            log_success "CA certificate trusted (macOS Keychain)"
            ;;
        Linux)
            if [[ -d /usr/local/share/ca-certificates ]]; then
                sudo cp "$ca_cert" /usr/local/share/ca-certificates/qp-conduit-ca.crt
                sudo update-ca-certificates
                log_success "CA certificate trusted (update-ca-certificates)"
            elif [[ -d /etc/pki/ca-trust/source/anchors ]]; then
                sudo cp "$ca_cert" /etc/pki/ca-trust/source/anchors/qp-conduit-ca.crt
                sudo update-ca-trust
                log_success "CA certificate trusted (update-ca-trust)"
            else
                log_error "Unsupported Linux distribution for CA trust installation"
                return 1
            fi
            ;;
        *)
            log_error "Unsupported OS: $os_type"
            return 1
            ;;
    esac
}

# ---------------------------------------------------------------------------
# tls_cert_expiry SERVICE_NAME
# Returns the expiry date of a service certificate, or exits 1 if not found.
# ---------------------------------------------------------------------------
tls_cert_expiry() {
    local name="${1:?service name required}"
    local certs_dir="${CONDUIT_CERTS_DIR:-$(ensure_config_dir)/certs}"
    local cert_file="${certs_dir}/${name}/cert.pem"

    if [[ ! -f "$cert_file" ]]; then
        log_error "No certificate found for service '$name'"
        return 1
    fi

    openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2
}

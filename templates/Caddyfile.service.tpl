# QP Conduit: per-service Caddyfile template
# Variables: {{SERVICE_DOMAIN}}, {{TLS_CERT}}, {{TLS_KEY}}, {{UPSTREAM}}, {{LOG_DIR}}, {{SERVICE_NAME}}
#
# Copyright 2026 Quantum Pipes Technologies, LLC
# SPDX-License-Identifier: Apache-2.0

{{SERVICE_DOMAIN}} {
    tls {{TLS_CERT}} {{TLS_KEY}}

    reverse_proxy {{UPSTREAM}} {
        header_up X-Forwarded-Proto {scheme}
        header_up X-Real-IP {remote_host}
        header_up X-Conduit-Service {{SERVICE_NAME}}
        health_uri /healthz
        health_interval 30s
        health_timeout 5s
    }

    log {
        output file {{LOG_DIR}}/{{SERVICE_NAME}}.access.log
        format json
    }
}

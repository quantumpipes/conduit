---
name: Service Type Request
about: Request support for a new service type or monitoring backend
title: "[Service Type] "
labels: enhancement, service-type
assignees: ''
---

## Service Type Name

Name of the service type or monitoring backend (e.g., Prometheus, Grafana, StatsD, custom health checker).

## Service Category

- [ ] Monitoring backend (metrics collection and alerting)
- [ ] Health check provider (service availability verification)
- [ ] Log aggregator (centralized log collection)
- [ ] Container orchestrator (Docker/Podman/Kubernetes integration)
- [ ] Other (describe below)

## Why This Service Type Matters

Explain the use case. Who benefits from this service type and why?

## API Documentation

Links to the service's API docs, CLI reference, or integration guides.

## Are You Willing to Implement It?

- [ ] Yes, I can submit a PR
- [ ] I can help test but not implement
- [ ] No, just requesting

## Security Considerations

- Does the service type require storing API keys or credentials?
- Does it introduce any external network dependencies?
- How does it handle authentication and key rotation?

## Additional Context

Any other context, diagrams, or examples about the service type request.

## Checklist

- [ ] I have searched existing issues to ensure this is not a duplicate
- [ ] I have verified the service type has public documentation
- [ ] I have considered the security implications

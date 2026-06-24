# Security Notes

v0.4 removes the built-in access token by request and assumes local single-user operation.

Do not expose this directly to the public internet unless you add authentication in front of it.

## Why the AI console is sensitive

The AI development console can run Antigravity CLI through a PTY. That means the connected user can interact with a development agent that may read project files, edit files, and request command execution depending on its own configuration.

Recommended exposure model:

```text
localhost only
home LAN only
VPN only
SSH tunnel only
reverse proxy with Basic Auth/OAuth/IP allowlist
```

Avoid mounting secrets into this container unless you are sure the UI is only reachable by you.

## Docker socket

Do not mount `/var/run/docker.sock` into this container.

## Workspace

The Compose file mounts the project root `./` to `/workspace` so the AI console can edit this repository. Avoid placing unrelated secrets in the project directory when the agent console is enabled.

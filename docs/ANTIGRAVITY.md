# Antigravity CLI Console

The AI Development tab connects to `/ws/agent` and starts a PTY-backed command.

Default command:

```env
AGENT_COMMAND=agy
```

The Node server launches the command through:

```text
python3 server/pty_bridge.py /bin/sh -lc "$AGENT_COMMAND"
```

The Python script creates a pseudo-terminal, then execs the requested command inside it.

## Configuration

```env
ENABLE_AGENT=1
INSTALL_AGY=0
AGENT_COMMAND=agy
AGENT_WORKDIR=/workspace
AGENT_MAX_SESSIONS=1
```

`INSTALL_AGY=1` installs Antigravity CLI during Docker build. Keep it `0` if you want to install `agy` later with `make agent-install` or keep Docker builds offline.

## First run

Antigravity CLI can ask for login, theme/config choices, and workspace trust confirmation. Use the AI tab's command input plus Ctrl-C / Ctrl-D buttons for interactive screens.

#!/usr/bin/env python3
"""Small stdio-to-PTY bridge for browser WebSocket terminal sessions.

Node talks to this script over ordinary pipes. The script creates a real pseudo
terminal for the requested command, which lets TUI programs such as `agy` see a
TTY instead of a plain pipe.
"""

import errno
import fcntl
import os
import pty
import select
import signal
import sys
import time


def set_nonblocking(fd: int) -> None:
    flags = fcntl.fcntl(fd, fcntl.F_GETFL)
    fcntl.fcntl(fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)


def write_all(fd: int, data: bytes) -> None:
    view = memoryview(data)
    while view:
        try:
            written = os.write(fd, view)
            view = view[written:]
        except BlockingIOError:
            time.sleep(0.01)
        except OSError as exc:
            if exc.errno in (errno.EPIPE, errno.EIO):
                return
            raise


def main() -> int:
    command = sys.argv[1:] or ["agy"]

    pid, master_fd = pty.fork()
    if pid == 0:
        os.environ.setdefault("TERM", "xterm-256color")
        os.environ.setdefault("COLORTERM", "truecolor")
        try:
            os.execvp(command[0], command)
        except FileNotFoundError:
            print(f"[agent] command not found: {command[0]}", file=sys.stderr, flush=True)
            os._exit(127)
        except Exception as exc:  # noqa: BLE001 - must survive startup errors
            print(f"[agent] failed to exec {command[0]}: {exc}", file=sys.stderr, flush=True)
            os._exit(126)

    set_nonblocking(0)
    set_nonblocking(master_fd)

    exit_status = 0
    stdin_open = True

    try:
        while True:
            read_fds = [master_fd]
            if stdin_open:
                read_fds.append(0)

            try:
                readable, _, _ = select.select(read_fds, [], [], 0.2)
            except InterruptedError:
                continue

            if master_fd in readable:
                try:
                    data = os.read(master_fd, 8192)
                except OSError as exc:
                    if exc.errno == errno.EIO:
                        break
                    raise

                if not data:
                    break
                write_all(1, data)

            if stdin_open and 0 in readable:
                try:
                    data = os.read(0, 8192)
                except BlockingIOError:
                    data = b""
                except OSError as exc:
                    if exc.errno in (errno.EIO, errno.EBADF):
                        stdin_open = False
                        data = b""
                    else:
                        raise

                if data:
                    try:
                        os.write(master_fd, data)
                    except OSError as exc:
                        if exc.errno != errno.EIO:
                            raise
                        break
                else:
                    stdin_open = False
                    try:
                        os.kill(pid, signal.SIGHUP)
                    except ProcessLookupError:
                        pass

            try:
                waited_pid, status = os.waitpid(pid, os.WNOHANG)
            except ChildProcessError:
                break
            if waited_pid == pid:
                if os.WIFEXITED(status):
                    exit_status = os.WEXITSTATUS(status)
                elif os.WIFSIGNALED(status):
                    exit_status = 128 + os.WTERMSIG(status)
                break
    finally:
        try:
            os.close(master_fd)
        except OSError:
            pass
        try:
            os.kill(pid, signal.SIGHUP)
        except ProcessLookupError:
            pass
        except OSError:
            pass

    return exit_status


if __name__ == "__main__":
    raise SystemExit(main())

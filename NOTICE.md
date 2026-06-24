# Notice

This repository contains a web gateway, Docker packaging, diagnostics scripts, and documentation for running the MUHAN legacy MUD server in a browser.

It does **not** vendor or relicense the MUHAN game source or data by default. The Docker build fetches the upstream restoration repository from:

- https://github.com/comfuture/muhan

For restricted environments, `vendor/muhan` can contain a local checkout of the upstream repository. Before hosting a public server or committing vendored upstream code, review the upstream project's copyright and license terms, including any non-commercial-use restrictions inherited from the original MUHAN source distribution.

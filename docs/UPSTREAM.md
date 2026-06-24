# Upstream MUHAN Source

Default upstream:

```text
https://github.com/comfuture/muhan
```

The Dockerfile fetches the upstream repository at build time using:

```dockerfile
ARG MUHAN_REPO=https://github.com/comfuture/muhan.git
ARG MUHAN_REF=master
```

This wrapper intentionally avoids vendoring the MUHAN source tree. That keeps the
web gateway small and makes upstream license/copyright boundaries clearer.

For production, pin `MUHAN_REF` to a commit SHA after testing.

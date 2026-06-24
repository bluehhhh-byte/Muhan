# Upstream

Default upstream:

```text
https://github.com/comfuture/muhan.git
```

Configured by:

```env
MUHAN_REPO=https://github.com/comfuture/muhan.git
MUHAN_REF=master
```

For reproducible deployments, pin `MUHAN_REF` to a commit SHA instead of a branch.

## Vendoring

`vendor/muhan` is optional. It exists for environments where Docker cannot reach GitHub during build.

```bash
make fetch-upstream
```

Before committing vendored upstream code to a public repository, review the upstream rights and license terms. This wrapper repository does not relicense MUHAN itself.

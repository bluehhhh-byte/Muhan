# Upstream

The MUHAN game source is fetched from:

```text
https://github.com/comfuture/muhan.git
```

Default ref:

```text
master
```

For reproducible deployment, pin `MUHAN_REF` to a commit SHA instead of a branch name.

```env
MUHAN_REF=<commit-sha>
```

If Docker cannot access GitHub during build, put a checkout in `vendor/muhan`:

```bash
make fetch-upstream
docker compose up --build
```

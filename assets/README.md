# Host art

Put the host's image here on the server (for example `sae.webp`) and name it in
`config.yml` → `host.art` as `/assets/sae.webp`. This folder is mounted read-only
into the container. Nothing but this file is committed: the repository is public,
so game art never goes into git.

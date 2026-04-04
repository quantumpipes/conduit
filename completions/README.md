# Shell Completions for QP Conduit

Tab-completion for all `conduit-*.sh` commands, including dynamic service name lookups.

## What Gets Completed

| Command | Completions |
|---|---|
| `conduit-register.sh` | `--name=`, `--host=`, `--port=`, `--health=`, `--protocol=`, `--no-tls` |
| `conduit-register.sh --protocol=` | `http`, `https` |
| `conduit-register.sh --health=` | `/healthz`, `/health`, `/api/health`, `/api/tags`, `/status` |
| `conduit-deregister.sh --name=` | Active service names from `services.json` |
| `conduit-certs.sh` | `--rotate=`, `--inspect=`, `--trust` |
| `conduit-certs.sh --rotate=` | Active service names from `services.json` |
| `conduit-dns.sh` | `--flush`, `--resolve=` |
| `conduit-dns.sh --resolve=` | Active service names from `services.json` |
| `conduit-monitor.sh` | `--server=` |
| `make` | All Conduit Makefile targets with descriptions (zsh) |

## Prerequisites

Dynamic completions require `jq` to parse config files. Install it if you haven't:

```bash
# macOS
brew install jq

# Debian/Ubuntu
sudo apt install jq
```

## Bash Installation

### Option A: Source in your profile

Add this line to `~/.bashrc` or `~/.bash_profile`:

```bash
source /path/to/conduit/completions/conduit.bash
```

### Option B: System-wide (Linux)

```bash
sudo cp completions/conduit.bash /etc/bash_completion.d/conduit
```

### Option C: Homebrew-managed (macOS)

```bash
cp completions/conduit.bash "$(brew --prefix)/etc/bash_completion.d/conduit"
```

### Verify

Open a new shell and type:

```bash
conduit-register.sh --pr<TAB>
# Should complete to --protocol=

conduit-register.sh --protocol=<TAB>
# Should show: http  https
```

## Zsh Installation

### Option A: User-local (recommended)

```bash
mkdir -p ~/.zsh/completions
cp completions/conduit.zsh ~/.zsh/completions/_conduit
```

Add to `~/.zshrc` (before `compinit`):

```zsh
fpath=(~/.zsh/completions $fpath)
autoload -Uz compinit && compinit
```

### Option B: System-wide (Linux)

```bash
sudo cp completions/conduit.zsh /usr/local/share/zsh/site-functions/_conduit
```

### Option C: Homebrew-managed (macOS)

```bash
cp completions/conduit.zsh "$(brew --prefix)/share/zsh/site-functions/_conduit"
```

### Verify

Open a new shell and type:

```zsh
conduit-certs.sh --<TAB>
# Should show all options with descriptions

conduit-deregister.sh --name=<TAB>
# Should show active service names
```

## Configuration

The completions read config files from `$CONDUIT_CONFIG_DIR`. If that variable is not set, they default to `$HOME/.config/$CONDUIT_APP_NAME` (which itself defaults to `qp-conduit`).

Override these in your shell profile if your Conduit uses a custom config path:

```bash
export CONDUIT_CONFIG_DIR="$HOME/.config/my-conduit"
```

## Troubleshooting

**Completions not loading:** Make sure your shell is sourcing the file (bash) or that the file is in your `$fpath` (zsh). Run `complete -p conduit-register.sh` (bash) or `whence -v _conduit-register.sh` (zsh) to verify registration.

**Service names not completing:** Check that `jq` is installed and that the config files exist:

```bash
ls "$(_conduit_config_dir)/services.json"
```

**Stale completions after zsh update:** Delete the compiled cache and restart:

```zsh
rm -f ~/.zcompdump
exec zsh
```

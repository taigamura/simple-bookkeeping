#!/bin/sh
# Temporary (#47 verification): chrome-headless-shell needs libasound.so.2,
# which this WSL2 box doesn't have and can't apt-install without sudo. Audio
# is muted in headless anyway, so an every-symbol-returns-error stub is enough
# to let the dynamic linker load the binary. Deleted after the verify run.
set -e
BIN="$HOME/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell"
OUT_DIR="$PWD/.alsa-stub"
mkdir -p "$OUT_DIR"
SYMS=$(nm -D --undefined-only "$BIN" | grep ' snd_' | awk '{print $NF}' | sort -u)
COUNT=$(echo "$SYMS" | wc -l)
echo "stubbing $COUNT snd_* symbols"
{
  for s in $SYMS; do
    echo "long $s(void) { return -1; }"
  done
} > "$OUT_DIR/stub.c"
gcc -shared -fPIC -o "$OUT_DIR/libasound.so.2" "$OUT_DIR/stub.c"
echo "built $OUT_DIR/libasound.so.2"

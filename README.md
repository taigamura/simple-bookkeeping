# simple-bookkeeping

## Development

### Troubleshooting: React Native DevTools fails in WSL2 (`libnspr4.so`)

Launching the standalone React Native DevTools (`@react-native/debugger-shell`) inside
a WSL2 environment can fail with:

```
An unknown error occurred while installing React Native DevTools. Details:
.../node_modules/@react-native/debugger-shell/bin/react-native-devtools: error while loading shared libraries: libnspr4.so: cannot open shared object file: No such file or directory
```

The DevTools binary is Chromium-based and needs the NSS/NSPR shared libraries
(`libnspr4`, `libnss3`), which aren't installed on this WSL2 distro by default. This
doesn't block the app itself — web and native bundles run fine — only the standalone
debugger launcher. Fix on Debian/Ubuntu-based WSL2 distros:

```bash
sudo apt-get install -y libnspr4 libnss3
```

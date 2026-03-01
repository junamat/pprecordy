# pprecordy
you need node.js to use this: https://nodejs.org/en

`npm install`; then, `node index` to start

`node config` to change settings

## Logging

By default output goes to the console only. To also log messages to a file, add a `logging` section to your `config.json`:

```json
"logging": {
  "enabled": true,
  "file": "pprecordy.log"       // path where log entries are appended
}
```

All internal progress messages will be written both to stdout and the specified file when enabled.

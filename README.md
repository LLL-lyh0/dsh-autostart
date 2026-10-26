# dsh-autostart

开机自启动插件 for [DeepSeek Harness](https://harness.deepseek.com) (dsh) on Windows.

启用本插件后，dsh 会把自身注册到当前用户的 Windows 登录自启动项；禁用后自动移除。

When the plugin is enabled, it registers the DeepSeek Harness executable in the current user's Windows logon autostart entry; disabling the plugin removes it again.

## What it does

| Action | Effect |
|---|---|
| 启用 Enable | Writes `DeepSeekHarnessAutoStart` into `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` pointing at the running `process.execPath` (correctly quoted for paths with spaces). |
| 禁用 / 卸载 Disable / uninstall | Removes that registry value. |
| Non-Windows platforms | No-op — the plugin logs that autostart is only supported on Windows. |

Only the current user's hive (`HKCU`) is touched, so **no administrator privileges are required**, and everything is undone on disable.

## Requirements

- Windows (the plugin is inert elsewhere)
- A DeepSeek Harness profile with plugin/bundle support

## Install

> The npm name `dsh-autostart` is already taken by a different project, so install from this repository (Option A or B). See [Prior art](#prior-art) below.

### Option A — Plugin Manager / dshmarket

If your dsh plugin market can install bundles from a Git repository, point it at this repo, then enable the `dsh-autostart` row.

### Option B — Clone and link the checkout

```bash
# 1. Clone somewhere stable
git clone https://github.com/LLL-lyh0/dsh-autostart.git

# 2. Add to your profile's package.json
#    "dependencies":         { "dsh-autostart": "link:D:/path/to/dsh-autostart" }
#    "dsh.profile.bundles":  [ ... , "dsh-autostart" ]

# 3. Link the package into the profile's node_modules
mklink /J "%USERPROFILE%\.dsh\profiles\<profile>\node_modules\dsh-autostart" "D:\path\to\dsh-autostart"
```

Then restart dsh.

## Verify

```bat
reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v DeepSeekHarnessAutoStart
```

Expected (quotes are required — the install path contains spaces):

```
DeepSeekHarnessAutoStart    REG_SZ    "C:\...\DeepSeek Harness\DeepSeek Harness.exe"
```

Note: the autostart entry launches dsh at **Windows logon**, not at dsh restart. To test, sign out and back in (or reboot).

## How it works

`index.js` is a Cordis host plugin (`export function apply(ctx, config)`):

- On activation it runs `reg add` via `execFileSync` (no shell, so the quoting around the spaced path survives).
- Cleanup is registered with `ctx.effect`. Cordis runs the `ctx.effect` callback **immediately** and treats its **return value** as the disposer — so the delete lives in the returned function and only fires on real disable/unload.

## Uninstall

Disable the plugin (or `remove_bundle`), which deletes the registry value. Nothing else is written.

## Prior art

[`dsh-autostart` on npm](https://www.npmjs.com/package/dsh-autostart) ([Ghost011118/dsh-autostart](https://github.com/Ghost011118/dsh-autostart)) is a separate project that solves an adjacent problem: it autostarts **`dsh web`** with a hidden window and a crash-restart supervisor. This plugin instead registers the **desktop app** itself through the standard Windows logon Run key, driven by dsh's own plugin enable/disable, and writes nothing beyond a single `HKCU` value.

## License

MIT

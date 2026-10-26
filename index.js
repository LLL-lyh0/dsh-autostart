import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// 当前用户登录自启动注册表项（HKCU 不需要管理员权限）。
const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const VALUE_NAME = 'DeepSeekHarnessAutoStart';

function getLogger(ctx) {
  try {
    if (ctx && ctx.logger) {
      if (typeof ctx.logger === 'function') return ctx.logger('dsh-autostart');
      if (typeof ctx.logger.info === 'function') return ctx.logger;
    }
  } catch {
    /* 回退到 console */
  }
  return console;
}

// 运行 reg.exe；PATH 中找不到时回退到 System32 绝对路径。返回 {ok, stderr}。
function runReg(args) {
  const opts = { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] };
  try {
    execFileSync('reg', args, opts);
    return { ok: true, stderr: '' };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      try {
        execFileSync('C:\\Windows\\System32\\reg.exe', args, opts);
        return { ok: true, stderr: '' };
      } catch (fallback) {
        return { ok: false, stderr: fallback && fallback.stderr ? fallback.stderr.toString() : String(fallback) };
      }
    }
    return { ok: false, stderr: error && error.stderr ? error.stderr.toString() : String(error) };
  }
}

function autostartPresent() {
  return runReg(['query', REG_KEY, '/v', VALUE_NAME]).ok;
}

function enableAutoStart(ctx) {
  const exe = process.execPath;
  if (!exe || !existsSync(exe)) {
    getLogger(ctx).warn(`[dsh-autostart] 无法定位 DeepSeek Harness 可执行文件（process.execPath=${exe}），跳过开机自启动注册。`);
    return false;
  }
  const result = runReg(['add', REG_KEY, '/v', VALUE_NAME, '/t', 'REG_SZ', '/d', `"${exe}"`, '/f']);
  if (!result.ok) {
    getLogger(ctx).warn(`[dsh-autostart] 注册开机自启动失败：${result.stderr}`);
    return false;
  }
  return true;
}

function disableAutoStart(ctx) {
  if (!autostartPresent()) return;
  const result = runReg(['delete', REG_KEY, '/v', VALUE_NAME, '/f']);
  if (!result.ok) {
    getLogger(ctx).warn(`[dsh-autostart] 移除开机自启动失败：${result.stderr}`);
  }
}

// Cordis 插件入口：启用时注册，返回的 effect 在停用/卸载时清理。
export function apply(ctx, config) {
  const logger = getLogger(ctx);
  if (process.platform !== 'win32') {
    logger.info('[dsh-autostart] 当前平台不是 Windows，开机自启动插件不生效（仅 Windows 支持）。');
    return;
  }
  if (enableAutoStart(ctx)) {
    logger.info('[dsh-autostart] 已启用开机自启动：Windows 登录时将自动启动 DeepSeek Harness。');
  }
  // 关键：ctx.effect(fn) 会「立即」执行 fn，并把 fn 的返回值当作清理函数，
  // 在插件被禁用/卸载（Cordis dispose）时才调用。所以这里返回真正的清理函数，
  // 不能在 fn 体内直接执行删除，否则会在启用时立刻删掉刚写入的注册表项。
  ctx.effect(() => {
    return () => {
      disableAutoStart(ctx);
      getLogger(ctx).info('[dsh-autostart] 已关闭开机自启动：已移除 Windows 登录自启动注册表项。');
    };
  });
}

// paths.mjs — one containment rule for every write in this skill.
//
// A write target is allowed only if, after resolving symlinks, it sits inside
// an allowed root. "Resolve" has to work for paths that don't exist yet (a new
// DESIGN.md), so we resolve the nearest existing ancestor and re-append the
// remainder — otherwise realpath() throws ENOENT and people disable the check.

import fs from 'node:fs';
import path from 'node:path';

/**
 * Resolve a possibly-nonexistent path to its canonical absolute form.
 * @param {string} p
 * @returns {string}
 */
export function canonical(p) {
  let abs = path.resolve(p);
  const tail = [];
  // Walk up until we find something that exists, canonicalise that, re-append.
  for (;;) {
    if (fs.existsSync(abs)) {
      const real = fs.realpathSync.native
        ? fs.realpathSync.native(abs)
        : fs.realpathSync(abs);
      return tail.length ? path.join(real, ...tail.reverse()) : real;
    }
    const parent = path.dirname(abs);
    if (parent === abs) break;          // reached the filesystem root
    tail.push(path.basename(abs));
    abs = parent;
  }
  return path.resolve(p);
}

/**
 * Is `target` inside `root` (or equal to it)?
 * @param {string} target
 * @param {string} root
 */
export function isInside(target, root) {
  const t = canonical(target);
  const r = canonical(root);
  if (t === r) return true;
  // Compare case-insensitively on Windows; path.relative handles the separator.
  const rel = path.relative(r, t);
  if (rel === '') return true;
  if (rel.startsWith('..')) return false;
  if (path.isAbsolute(rel)) return false;
  return true;
}

export class PathViolation extends Error {
  constructor(target, root, reason) {
    super(`拒绝写入 ${target}：${reason}（允许的根：${root}）`);
    this.name = 'PathViolation';
    this.code = 'EPATH';
    this.target = target;
    this.root = root;
  }
}

/**
 * Throws PathViolation unless `target` is inside `root`.
 * Also rejects a NUL byte and any non-expected extension when given.
 */
export function assertInside(target, root, { ext } = {}) {
  if (typeof target !== 'string' || target.includes('\0')) {
    throw new PathViolation(String(target), root, '路径含非法字符');
  }
  if (ext && !ext.includes(path.extname(target).toLowerCase())) {
    throw new PathViolation(target, root, `扩展名必须是 ${ext.join(' / ')}`);
  }
  if (!isInside(target, root)) {
    throw new PathViolation(target, root, '越出允许的根目录');
  }
  return canonical(target);
}

/** Atomic write: temp file in the same dir, then rename. Keeps a .bak. */
export function atomicWrite(file, data, { backup = true, mkdirp = true } = {}) {
  const dir = path.dirname(file);
  if (mkdirp) fs.mkdirSync(dir, { recursive: true });
  if (backup && fs.existsSync(file)) {
    fs.copyFileSync(file, `${file}.bak`);
  }
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, String(data).replace(/\r\n/g, '\n'), 'utf8');
  try {
    fs.renameSync(tmp, file);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* best effort */ }
    throw e;
  }
}

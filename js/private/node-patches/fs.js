// Generated by //js/private/node-patches:compile
"use strict";
/**
 * @license
 * Copyright 2019 The Bazel Authors. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 *
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeFunction = exports.isSubPath = exports.patcher = void 0;
const path = require("path");
const util = require("util");
// using require here on purpose so we can override methods with any
// also even though imports are mutable in typescript the cognitive dissonance is too high because
// es modules
const _fs = require('fs');
const isWindows = process.platform === 'win32';
const patcher = (fs = _fs, roots) => {
    fs = fs || _fs;
    roots = roots || [];
    roots = roots.filter((root) => fs.existsSync(root));
    if (!roots.length) {
        if (process.env.VERBOSE_LOGS) {
            console.error('fs patcher called without any valid root paths ' + __filename);
        }
        return;
    }
    const origLstat = fs.lstat.bind(fs);
    const origLstatSync = fs.lstatSync.bind(fs);
    const origReaddir = fs.readdir.bind(fs);
    const origReaddirSync = fs.readdirSync.bind(fs);
    const origReadlink = fs.readlink.bind(fs);
    const origReadlinkSync = fs.readlinkSync.bind(fs);
    const origRealpath = fs.realpath.bind(fs);
    const origRealpathNative = fs.realpath.native;
    const origRealpathSync = fs.realpathSync.bind(fs);
    const origRealpathSyncNative = fs.realpathSync.native;
    const isEscape = (0, exports.escapeFunction)(roots);
    const logged = {};
    // =========================================================================
    // fs.lstat
    // =========================================================================
    fs.lstat = (...args) => {
        const ekey = new Error('').stack || '';
        if (!logged[ekey]) {
            logged[ekey] = true;
        }
        let cb = args.length > 1 ? args[args.length - 1] : undefined;
        // preserve error when calling function without required callback.
        if (cb) {
            cb = once(cb);
            args[args.length - 1] = (err, stats) => {
                if (err)
                    return cb(err);
                if (!stats.isSymbolicLink()) {
                    // the file is not a symbolic link so there is nothing more to do
                    return cb(null, stats);
                }
                // the file is a symbolic link; lets do a readlink and check where it points to
                const linkPath = path.resolve(args[0]);
                return origReadlink(linkPath, (err, str) => {
                    if (err) {
                        if (err.code === 'ENOENT') {
                            return cb(null, stats);
                        }
                        else {
                            // some other file system related error.
                            return cb(err);
                        }
                    }
                    const linkTarget = path.resolve(path.dirname(linkPath), str);
                    if (isEscape(linkPath, linkTarget)) {
                        // if the linkTarget is an escape, then return the lstat of the
                        // target instead
                        return origLstat(linkTarget, (err, linkTargetStats) => {
                            if (err) {
                                if (err.code === 'ENOENT') {
                                    return cb(null, stats);
                                }
                                else {
                                    // some other file system related error.
                                    return cb(err);
                                }
                            }
                            // return the lstat of the linkTarget
                            cb(null, linkTargetStats);
                        });
                    }
                    // its a symlink and its inside of the root.
                    cb(null, stats);
                });
            };
        }
        origLstat(...args);
    };
    fs.lstatSync = (...args) => {
        const stats = origLstatSync(...args);
        if (!stats.isSymbolicLink()) {
            // the file is not a symbolic link so there is nothing more to do
            return stats;
        }
        const linkPath = path.resolve(args[0]);
        let linkTarget;
        try {
            linkTarget = path.resolve(path.dirname(args[0]), origReadlinkSync(linkPath));
        }
        catch (e) {
            if (e.code === 'ENOENT') {
                return stats;
            }
            throw e;
        }
        if (isEscape(linkPath, linkTarget)) {
            // if the linkTarget is an escape, then return the lstat of the
            // target instead
            try {
                return origLstatSync(linkTarget, ...args.slice(1));
            }
            catch (e) {
                if (e.code === 'ENOENT') {
                    return stats;
                }
                throw e;
            }
        }
        return stats;
    };
    // =========================================================================
    // fs.realpath
    // =========================================================================
    fs.realpath = (...args) => {
        let cb = args.length > 1 ? args[args.length - 1] : undefined;
        if (cb) {
            cb = once(cb);
            args[args.length - 1] = (err, str) => {
                if (err)
                    return cb(err);
                const escapedRoot = isEscape(args[0], str);
                if (escapedRoot) {
                    // we've escaped a root; lets the file we've resolved is a symlink and see if our
                    // realpath can be mapped back to the root
                    let linkTarget;
                    try {
                        linkTarget = path.resolve(path.dirname(args[0]), origReadlinkSync(args[0]));
                    }
                    catch (e) {
                        if (e.code === 'EINVAL') {
                            // the path was not a symlink; just return the resolved path in that case
                            return cb(null, str);
                        }
                        if (isWindows) {
                            // windows has a harder time with readlink if the path is
                            // through a junction; just return the realpath in this case
                            return cb(null, str);
                        }
                        throw e;
                    }
                    const realPathRoot = path.resolve(args[0], path.relative(linkTarget, str));
                    if (!isEscape(args[0], realPathRoot, [escapedRoot])) {
                        // this realpath can be mapped back to a relative equivalent in the escaped root; return that instead
                        return cb(null, realPathRoot);
                    }
                    else {
                        // the realpath has no relative equivalent within the root; return the actual realpath
                        return cb(null, str);
                    }
                }
                else {
                    return cb(null, str);
                }
            };
        }
        origRealpath(...args);
    };
    fs.realpath.native = (...args) => {
        let cb = args.length > 1 ? args[args.length - 1] : undefined;
        if (cb) {
            cb = once(cb);
            args[args.length - 1] = (err, str) => {
                if (err)
                    return cb(err);
                const escapedRoot = isEscape(args[0], str);
                if (escapedRoot) {
                    // we've escaped a root; lets the file we've resolved is a symlink and see if our
                    // realpath can be mapped back to the root
                    let linkTarget;
                    try {
                        linkTarget = path.resolve(path.dirname(args[0]), origReadlinkSync(args[0]));
                    }
                    catch (e) {
                        if (e.code === 'EINVAL') {
                            // the path was not a symlink; just return the resolved path in that case
                            return cb(null, str);
                        }
                        if (isWindows) {
                            // windows has a harder time with readlink if the path is
                            // through a junction; just return the realpath in this case
                            return cb(null, str);
                        }
                        throw e;
                    }
                    const realPathRoot = path.resolve(args[0], path.relative(linkTarget, str));
                    if (!isEscape(args[0], realPathRoot, [escapedRoot])) {
                        // this realpath can be mapped back to a relative equivalent in the escaped root; return that instead
                        return cb(null, realPathRoot);
                    }
                    else {
                        // the realpath has no relative equivalent within the root; return the actual realpath
                        return cb(null, str);
                    }
                }
                else {
                    return cb(null, str);
                }
            };
        }
        origRealpathNative(...args);
    };
    fs.realpathSync = (...args) => {
        const str = origRealpathSync(...args);
        const escapedRoot = isEscape(args[0], str);
        if (escapedRoot) {
            // we've escaped a root; lets the file we've resolved is a symlink and see if our
            // realpath can be mapped back to the root
            let linkTarget;
            try {
                linkTarget = path.resolve(path.dirname(args[0]), origReadlinkSync(args[0]));
            }
            catch (e) {
                if (e.code === 'EINVAL') {
                    // the path was not a symlink; just return the resolved path in that case
                    return str;
                }
                if (isWindows) {
                    // windows has a harder time with readlink if the path is
                    // through a junction; just return the realpath in this case
                    return str;
                }
                throw e;
            }
            const realPathRoot = path.resolve(args[0], path.relative(linkTarget, str));
            if (!isEscape(args[0], realPathRoot, [escapedRoot])) {
                // this realpath can be mapped back to a relative equivalent in the escaped root; return that instead
                return realPathRoot;
            }
            else {
                // the realpath has no relative equivalent within the root; return the actual realpath
                return str;
            }
        }
        return str;
    };
    fs.realpathSync.native = (...args) => {
        const str = origRealpathSyncNative(...args);
        const escapedRoot = isEscape(args[0], str);
        if (escapedRoot) {
            // we've escaped a root; lets the file we've resolved is a symlink and see if our
            // realpath can be mapped back to the root
            let linkTarget;
            try {
                linkTarget = path.resolve(path.dirname(args[0]), origReadlinkSync(args[0]));
            }
            catch (e) {
                if (e.code === 'EINVAL') {
                    // the path was not a symlink; just return the resolved path in that case
                    return str;
                }
                if (isWindows) {
                    // windows has a harder time with readlink if the path is
                    // through a junction; just return the realpath in this case
                    return str;
                }
                throw e;
            }
            const realPathRoot = path.resolve(args[0], path.relative(linkTarget, str));
            if (!isEscape(args[0], realPathRoot, [escapedRoot])) {
                // this realpath can be mapped back to a relative equivalent in the escaped root; return that instead
                return realPathRoot;
            }
            else {
                // the realpath has no relative equivalent within the root; return the actual realpath
                return str;
            }
        }
        return str;
    };
    // =========================================================================
    // fs.readlink
    // =========================================================================
    fs.readlink = (...args) => {
        let cb = args.length > 1 ? args[args.length - 1] : undefined;
        if (cb) {
            cb = once(cb);
            args[args.length - 1] = (err, str) => {
                args[0] = path.resolve(args[0]);
                if (str)
                    str = path.resolve(path.dirname(args[0]), str);
                if (err)
                    return cb(err);
                if (isEscape(args[0], str)) {
                    // if we've escaped then call readlink on the escaped file
                    return origReadlink(str, ...args.slice(1));
                }
                cb(null, str);
            };
        }
        origReadlink(...args);
    };
    fs.readlinkSync = (...args) => {
        args[0] = path.resolve(args[0]);
        const str = path.resolve(path.dirname(args[0]), origReadlinkSync(...args));
        if (isEscape(args[0], str)) {
            // if we've escaped then call readlink on the escaped file
            return origReadlinkSync(str, ...args.slice(1));
        }
        return str;
    };
    // =========================================================================
    // fs.readdir
    // =========================================================================
    fs.readdir = (...args) => {
        const p = path.resolve(args[0]);
        let cb = args[args.length - 1];
        if (typeof cb !== 'function') {
            // this will likely throw callback required error.
            return origReaddir(...args);
        }
        cb = once(cb);
        args[args.length - 1] = (err, result) => {
            if (err)
                return cb(err);
            // user requested withFileTypes
            if (result[0] && result[0].isSymbolicLink) {
                Promise.all(result.map((v) => handleDirent(p, v)))
                    .then(() => {
                    cb(null, result);
                })
                    .catch((err) => {
                    cb(err);
                });
            }
            else {
                // string array return for readdir.
                cb(null, result);
            }
        };
        origReaddir(...args);
    };
    fs.readdirSync = (...args) => {
        const res = origReaddirSync(...args);
        const p = path.resolve(args[0]);
        res.forEach((v) => {
            handleDirentSync(p, v);
        });
        return res;
    };
    // =========================================================================
    // fs.opendir
    // =========================================================================
    if (fs.opendir) {
        const origOpendir = fs.opendir.bind(fs);
        fs.opendir = (...args) => {
            let cb = args[args.length - 1];
            // if this is not a function opendir should throw an error.
            // we call it so we don't have to throw a mock
            if (typeof cb === 'function') {
                cb = once(cb);
                args[args.length - 1] = async (err, dir) => {
                    try {
                        cb(null, await handleDir(dir));
                    }
                    catch (e) {
                        cb(e);
                    }
                };
                origOpendir(...args);
            }
            else {
                return origOpendir(...args).then((dir) => {
                    return handleDir(dir);
                });
            }
        };
    }
    // =========================================================================
    // fs.promises
    // =========================================================================
    /**
     * patch fs.promises here.
     *
     * this requires a light touch because if we trigger the getter on older nodejs versions
     * it will log an experimental warning to stderr
     *
     * `(node:62945) ExperimentalWarning: The fs.promises API is experimental`
     *
     * this api is available as experimental without a flag so users can access it at any time.
     */
    const promisePropertyDescriptor = Object.getOwnPropertyDescriptor(fs, 'promises');
    if (promisePropertyDescriptor) {
        const promises = {};
        promises.lstat = util.promisify(fs.lstat);
        // NOTE: node core uses the newer realpath function fs.promises.native instead of fs.realPath
        promises.realpath = util.promisify(fs.realpath.native);
        promises.readlink = util.promisify(fs.readlink);
        promises.readdir = util.promisify(fs.readdir);
        if (fs.opendir)
            promises.opendir = util.promisify(fs.opendir);
        // handle experimental api warnings.
        // only applies to version of node where promises is a getter property.
        if (promisePropertyDescriptor.get) {
            const oldGetter = promisePropertyDescriptor.get.bind(fs);
            const cachedPromises = {};
            promisePropertyDescriptor.get = () => {
                const _promises = oldGetter();
                Object.assign(cachedPromises, _promises, promises);
                return cachedPromises;
            };
            Object.defineProperty(fs, 'promises', promisePropertyDescriptor);
        }
        else {
            // api can be patched directly
            Object.assign(fs.promises, promises);
        }
    }
    // =========================================================================
    // helper functions for dirs
    // =========================================================================
    async function handleDir(dir) {
        const p = path.resolve(dir.path);
        const origIterator = dir[Symbol.asyncIterator].bind(dir);
        const origRead = dir.read.bind(dir);
        dir[Symbol.asyncIterator] = function () {
            return __asyncGenerator(this, arguments, function* () {
                var e_1, _a;
                try {
                    for (var _b = __asyncValues(origIterator()), _c; _c = yield __await(_b.next()), !_c.done;) {
                        const entry = _c.value;
                        yield __await(handleDirent(p, entry));
                        yield yield __await(entry);
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) yield __await(_a.call(_b));
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            });
        };
        dir.read = async (...args) => {
            if (typeof args[args.length - 1] === 'function') {
                const cb = args[args.length - 1];
                args[args.length - 1] = async (err, entry) => {
                    cb(err, entry ? await handleDirent(p, entry) : null);
                };
                origRead(...args);
            }
            else {
                const entry = await origRead(...args);
                if (entry) {
                    await handleDirent(p, entry);
                }
                return entry;
            }
        };
        const origReadSync = dir.readSync.bind(dir);
        dir.readSync = () => {
            return handleDirentSync(p, origReadSync());
        };
        return dir;
    }
    function handleDirent(p, v) {
        return new Promise((resolve, reject) => {
            if (!v.isSymbolicLink()) {
                return resolve(v);
            }
            const linkPath = path.join(p, v.name);
            origReadlink(linkPath, (err, target) => {
                if (err) {
                    return reject(err);
                }
                if (!isEscape(linkPath, path.resolve(target))) {
                    return resolve(v);
                }
                fs.stat(target, (err, stat) => {
                    if (err) {
                        if (err.code === 'ENOENT') {
                            // this is a broken symlink
                            // even though this broken symlink points outside of the root
                            // we'll return it.
                            // the alternative choice here is to omit it from the directory listing altogether
                            // this would add complexity because readdir output would be different than readdir
                            // withFileTypes unless readdir was changed to match. if readdir was changed to match
                            // it's performance would be greatly impacted because we would always have to use the
                            // withFileTypes version which is slower.
                            return resolve(v);
                        }
                        // transient fs related error. busy etc.
                        return reject(err);
                    }
                    // add all stat is methods to Dirent instances with their result.
                    v.isSymbolicLink = () => origLstatSync(target).isSymbolicLink;
                    patchDirent(v, stat);
                    resolve(v);
                });
            });
        });
    }
    function handleDirentSync(p, v) {
        if (v && v.isSymbolicLink) {
            if (v.isSymbolicLink()) {
                // any errors thrown here are valid. things like transient fs errors
                const target = path.resolve(p, origReadlinkSync(path.join(p, v.name)));
                if (isEscape(path.join(p, v.name), target)) {
                    // Dirent exposes file type so if we want to hide that this is a link
                    // we need to find out if it's a file or directory.
                    v.isSymbolicLink = () => origLstatSync(target).isSymbolicLink;
                    const stat = fs.statSync(target);
                    // add all stat is methods to Dirent instances with their result.
                    patchDirent(v, stat);
                }
            }
        }
    }
};
exports.patcher = patcher;
// =========================================================================
// generic helper functions
// =========================================================================
function isSubPath(parent, child) {
    return !path.relative(parent, child).startsWith('..');
}
exports.isSubPath = isSubPath;
const escapeFunction = (_roots) => {
    // ensure roots are always absolute
    _roots = _roots.map((root) => path.resolve(root));
    function _isEscape(linkPath, linkTarget, roots = _roots) {
        // linkPath is the path of the symlink file itself
        // linkTarget is a path that the symlink points to one or more hops away
        if (!path.isAbsolute(linkPath)) {
            linkPath = path.resolve(linkPath);
        }
        if (!path.isAbsolute(linkTarget)) {
            linkTarget = path.resolve(linkTarget);
        }
        let escapedRoot = undefined;
        for (const root of roots) {
            // If the link is in the root check if the realPath has escaped
            if (isSubPath(root, linkPath) || linkPath == root) {
                if (!isSubPath(root, linkTarget) && linkTarget != root) {
                    if (!escapedRoot || escapedRoot.length < root.length) {
                        // if escaping multiple roots then choose the longest one
                        escapedRoot = root;
                    }
                }
            }
        }
        if (escapedRoot) {
            return escapedRoot;
        }
        return false;
    }
    return _isEscape;
};
exports.escapeFunction = escapeFunction;
function once(fn) {
    let called = false;
    return (...args) => {
        if (called)
            return;
        called = true;
        let err = false;
        try {
            fn(...args);
        }
        catch (_e) {
            err = _e;
        }
        // blow the stack to make sure this doesn't fall into any unresolved promise contexts
        if (err) {
            setImmediate(() => {
                throw err;
            });
        }
    };
}
function patchDirent(dirent, stat) {
    // add all stat is methods to Dirent instances with their result.
    for (const i in stat) {
        if (i.indexOf('is') === 0 && typeof stat[i] === 'function') {
            //
            const result = stat[i]();
            if (result)
                dirent[i] = () => true;
            else
                dirent[i] = () => false;
        }
    }
}

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
const assert = require('assert')
const fs = require('fs')
const withFixtures = require('inline-fixtures').withFixtures
const path = require('path')
const util = require('util')

const patcher = require('../../node-patches/src/fs').patcher

// We don't want to bring jest into this repo so we just fake the describe and it functions here
async function describe(_, fn) {
    await fn()
}
async function it(_, fn) {
    await fn()
}

describe('testing realpath', async () => {
    await it('can resolve symlink in root', async () => {
        await withFixtures(
            {
                a: {},
                b: { file: 'contents' },
            },
            async (fixturesDir) => {
                // on mac, inside of bazel, the fixtures dir returned here is not realpath-ed.
                fixturesDir = fs.realpathSync(fixturesDir)

                // create symlink from a to b
                fs.symlinkSync(
                    path.join(fixturesDir, 'b', 'file'),
                    path.join(fixturesDir, 'a', 'link')
                )

                const patchedFs = Object.assign({}, fs)
                patchedFs.promises = Object.assign({}, fs.promises)

                patcher(patchedFs, [path.join(fixturesDir)])
                const linkPath = path.join(
                    fs.realpathSync(fixturesDir),
                    'a',
                    'link'
                )

                assert.deepStrictEqual(
                    patchedFs.realpathSync(linkPath),
                    path.join(fixturesDir, 'b', 'file'),
                    'SYNC: should resolve the symlink the same because its within root'
                )

                assert.deepStrictEqual(
                    patchedFs.realpathSync.native(linkPath),
                    path.join(fixturesDir, 'b', 'file'),
                    'SYNC.native: should resolve the symlink the same because its within root'
                )

                assert.deepStrictEqual(
                    await util.promisify(patchedFs.realpath)(linkPath),
                    path.join(fixturesDir, 'b', 'file'),
                    'CB: should resolve the symlink the same because its within root'
                )

                assert.deepStrictEqual(
                    await util.promisify(patchedFs.realpath.native)(linkPath),
                    path.join(fixturesDir, 'b', 'file'),
                    'CB: should resolve the symlink the same because its within root'
                )

                assert.deepStrictEqual(
                    await patchedFs.promises.realpath(linkPath),
                    path.join(fixturesDir, 'b', 'file'),
                    'Promise: should resolve the symlink the same because its within root'
                )
            }
        )
    })

    await it("doesn't resolve as symlink outside of root", async () => {
        await withFixtures(
            {
                a: {},
                b: { file: 'contents' },
            },
            async (fixturesDir) => {
                // ensure realpath.
                fixturesDir = fs.realpathSync(fixturesDir)

                // create symlink from a to b
                fs.symlinkSync(
                    path.join(fixturesDir, 'b', 'file'),
                    path.join(fixturesDir, 'a', 'link')
                )

                const patchedFs = Object.assign({}, fs)
                patchedFs.promises = Object.assign({}, fs.promises)

                patcher(patchedFs, [path.join(fixturesDir, 'a')])
                const linkPath = path.join(
                    fs.realpathSync(fixturesDir),
                    'a',
                    'link'
                )

                assert.deepStrictEqual(
                    patchedFs.realpathSync(linkPath),
                    path.join(fixturesDir, 'a', 'link'),
                    'should pretend symlink is in the root'
                )

                assert.deepStrictEqual(
                    await util.promisify(patchedFs.realpath)(linkPath),
                    path.join(fixturesDir, 'a', 'link'),
                    'should pretend symlink is in the root'
                )

                assert.deepStrictEqual(
                    await patchedFs.promises.realpath(linkPath),
                    path.join(fixturesDir, 'a', 'link'),
                    'should pretend symlink is in the root'
                )
            }
        )
    })

    await it('can resolve symlink to a symlink in the sandbox if it has a corresponding location', async () => {
        await withFixtures(
            {
                sandbox: {},
                execroot: { file: 'contents' },
            },
            async (fixturesDir) => {
                fixturesDir = fs.realpathSync(fixturesDir)

                // create symlink from execroot/link2 to execroot/file
                fs.symlinkSync(
                    path.join(fixturesDir, 'execroot', 'file'),
                    path.join(fixturesDir, 'execroot', 'link2')
                )
                // create symlink from execroot/link to execroot/link2
                fs.symlinkSync(
                    path.join(fixturesDir, 'execroot', 'link2'),
                    path.join(fixturesDir, 'execroot', 'link')
                )

                // create sandbox
                fs.symlinkSync(
                    path.join(fixturesDir, 'execroot', 'file'),
                    path.join(fixturesDir, 'sandbox', 'file')
                )
                fs.symlinkSync(
                    path.join(fixturesDir, 'execroot', 'link'),
                    path.join(fixturesDir, 'sandbox', 'link')
                )
                fs.symlinkSync(
                    path.join(fixturesDir, 'execroot', 'link2'),
                    path.join(fixturesDir, 'sandbox', 'link2')
                )

                const patchedFs = Object.assign({}, fs)
                patchedFs.promises = Object.assign({}, fs.promises)

                patcher(patchedFs, [path.join(fixturesDir, 'sandbox')])
                const linkPath = path.join(fixturesDir, 'sandbox', 'link')
                const filePath = path.join(fixturesDir, 'sandbox', 'file')

                assert.deepStrictEqual(
                    patchedFs.realpathSync(linkPath),
                    filePath,
                    'SYNC: should resolve the symlink the same because its within root'
                )

                assert.deepStrictEqual(
                    patchedFs.realpathSync.native(linkPath),
                    filePath,
                    'SYNC.native: should resolve the symlink the same because its within root'
                )

                assert.deepStrictEqual(
                    await util.promisify(patchedFs.realpath)(linkPath),
                    filePath,
                    'CB: should resolve the symlink the same because its within root'
                )

                assert.deepStrictEqual(
                    await util.promisify(patchedFs.realpath.native)(linkPath),
                    filePath,
                    'CB: should resolve the symlink the same because its within root'
                )

                assert.deepStrictEqual(
                    await patchedFs.promises.realpath(linkPath),
                    filePath,
                    'Promise: should resolve the symlink the same because its within root'
                )
            }
        )
    })

    await it('realpath will stop resolving at the last hop with a corresponding path in the sandbox', async () => {
        await withFixtures(
            {
                sandbox: {},
                execroot: {},
                otherroot: { file: 'contents' },
            },
            async (fixturesDir) => {
                fixturesDir = fs.realpathSync(fixturesDir)

                // create symlink from execroot/link2 to otherroot/file
                fs.symlinkSync(
                    path.join(fixturesDir, 'otherroot', 'file'),
                    path.join(fixturesDir, 'execroot', 'link2')
                )
                // create symlink from execroot/link to execroot/link2
                fs.symlinkSync(
                    path.join(fixturesDir, 'execroot', 'link2'),
                    path.join(fixturesDir, 'execroot', 'link')
                )

                // create sandbox
                fs.symlinkSync(
                    path.join(fixturesDir, 'execroot', 'link'),
                    path.join(fixturesDir, 'sandbox', 'link')
                )
                fs.symlinkSync(
                    path.join(fixturesDir, 'execroot', 'link2'),
                    path.join(fixturesDir, 'sandbox', 'link2')
                )

                const patchedFs = Object.assign({}, fs)
                patchedFs.promises = Object.assign({}, fs.promises)

                patcher(patchedFs, [path.join(fixturesDir, 'sandbox')])
                const linkPath = path.join(fixturesDir, 'sandbox', 'link')
                const link2Path = path.join(fixturesDir, 'sandbox', 'link2')

                assert.deepStrictEqual(
                    patchedFs.realpathSync(linkPath),
                    link2Path,
                    'SYNC: should resolve the symlink the same because its within root'
                )

                assert.deepStrictEqual(
                    patchedFs.realpathSync.native(linkPath),
                    link2Path,
                    'SYNC.native: should resolve the symlink the same because its within root'
                )

                assert.deepStrictEqual(
                    await util.promisify(patchedFs.realpath)(linkPath),
                    link2Path,
                    'CB: should resolve the symlink the same because its within root'
                )

                assert.deepStrictEqual(
                    await util.promisify(patchedFs.realpath.native)(linkPath),
                    link2Path,
                    'CB: should resolve the symlink the same because its within root'
                )

                assert.deepStrictEqual(
                    await patchedFs.promises.realpath(linkPath),
                    link2Path,
                    'Promise: should resolve the symlink the same because its within root'
                )
            }
        )
    })

    await it('cant resolve symlink to a symlink in the sandbox if it has no corresponding location', async () => {
        await withFixtures(
            {
                sandbox: {},
                execroot: {},
                otherroot: { file: 'contents' },
            },
            async (fixturesDir) => {
                fixturesDir = fs.realpathSync(fixturesDir)

                // create symlink from execroot/link to otherroot/file
                fs.symlinkSync(
                    path.join(fixturesDir, 'otherroot', 'file'),
                    path.join(fixturesDir, 'execroot', 'link')
                )

                // create sandbox
                fs.symlinkSync(
                    path.join(fixturesDir, 'execroot', 'link'),
                    path.join(fixturesDir, 'sandbox', 'link')
                )

                const patchedFs = Object.assign({}, fs)
                patchedFs.promises = Object.assign({}, fs.promises)

                patcher(patchedFs, [path.join(fixturesDir, 'sandbox')])
                const linkPath = path.join(fixturesDir, 'sandbox', 'link')
                const filePath = path.join(fixturesDir, 'sandbox', 'file')

                assert.throws(() => {
                    patchedFs.realpathSync(linkPath)
                }, "should throw because it's not a resolvable link")

                assert.throws(() => {
                    patchedFs.realpathSync.native(linkPath)
                }, "should throw because it's not a resolvable link")

                let thrown
                try {
                    await util.promisify(patchedFs.realpath)(linkPath)
                } catch (e) {
                    thrown = e
                } finally {
                    if (!thrown) assert.fail('must throw einval error')
                }

                thrown = undefined
                try {
                    await util.promisify(patchedFs.realpath.native)(linkPath)
                } catch (e) {
                    thrown = e
                } finally {
                    if (!thrown) assert.fail('must throw einval error')
                }

                thrown = undefined
                try {
                    await patchedFs.promises.realpath(linkPath)
                } catch (e) {
                    thrown = e
                } finally {
                    if (!thrown) assert.fail('must throw einval error')
                }
            }
        )
    })
})

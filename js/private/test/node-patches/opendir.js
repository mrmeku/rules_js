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

describe('testing opendir', async () => {
    await it('can opendir dirent in root', async () => {
        await withFixtures(
            {
                a: { apples: 'contents' },
                b: { file: 'contents' },
            },
            async (fixturesDir) => {
                fixturesDir = fs.realpathSync(fixturesDir)
                // create symlink from a to b
                fs.symlinkSync(
                    path.join(fixturesDir, 'b', 'file'),
                    path.join(fixturesDir, 'a', 'link')
                )

                const patchedFs = Object.assign({}, fs)
                patchedFs.promises = Object.assign({}, fs.promises)
                patcher(patchedFs, [fixturesDir])

                let dir
                dir = await util.promisify(patchedFs.opendir)(
                    path.join(fixturesDir, 'a')
                )
                const entry1 = await dir.read()
                const entry2 = await util.promisify(dir.read.bind(dir))()
                const empty = await dir.read()

                let names = [entry1.name, entry2.name]
                names.sort()
                assert.deepStrictEqual(names, ['apples', 'link'])

                let maybeLink = entry1.name === 'link' ? entry1 : entry2
                assert.ok(maybeLink.isSymbolicLink())

                assert.ok(!empty, 'last read should be falsey')
            }
        )
    })

    await it('can opendir dirent link out of root', async () => {
        await withFixtures(
            {
                a: { apples: 'contents' },
                b: { file: 'contents' },
            },
            async (fixturesDir) => {
                fixturesDir = fs.realpathSync(fixturesDir)
                // create symlink from a to b
                fs.symlinkSync(
                    path.join(fixturesDir, 'b', 'file'),
                    path.join(fixturesDir, 'a', 'link')
                )

                const patchedFs = Object.assign({}, fs)
                patchedFs.promises = Object.assign({}, fs.promises)
                patcher(patchedFs, [path.join(fixturesDir, 'a')])

                let dir
                dir = await util.promisify(patchedFs.opendir)(
                    path.join(fixturesDir, 'a')
                )
                const entry1 = await dir.read()
                const entry2 = await util.promisify(dir.read.bind(dir))()
                const empty = await dir.read()

                let names = [entry1.name, entry2.name]
                names.sort()

                assert.ok(!empty)
                assert.deepStrictEqual(names, ['apples', 'link'])

                let maybeLink = entry1.name === 'link' ? entry1 : entry2

                console.error(entry1, entry2)
                assert.ok(!maybeLink.isSymbolicLink())
            }
        )
    })

    await it('can async iterate opendir', async () => {
        await withFixtures(
            {
                a: { apples: 'contents' },
                b: { file: 'contents' },
            },
            async (fixturesDir) => {
                fixturesDir = fs.realpathSync(fixturesDir)
                // create symlink from a to b
                fs.symlinkSync(
                    path.join(fixturesDir, 'b', 'file'),
                    path.join(fixturesDir, 'a', 'link')
                )

                const patchedFs = Object.assign({}, fs)
                patchedFs.promises = Object.assign({}, fs.promises)
                patcher(patchedFs, [path.join(fixturesDir)])

                const dir = await util.promisify(patchedFs.opendir)(
                    path.join(fixturesDir, 'a')
                )
                const names = []
                for await (const entry of dir) {
                    names.push(entry.name)
                    if (entry.name === 'link') {
                        assert.ok(entry.isSymbolicLink())
                    } else if (entry.name === 'apples') {
                        assert.ok(entry.isFile())
                    }
                }
                names.sort()
                assert.deepStrictEqual(names, ['apples', 'link'])
            }
        )
    })

    await it('can async iterate opendir link out of root', async () => {
        await withFixtures(
            {
                a: { apples: 'contents' },
                b: { file: 'contents' },
            },
            async (fixturesDir) => {
                fixturesDir = fs.realpathSync(fixturesDir)
                // create symlink from a to b
                fs.symlinkSync(
                    path.join(fixturesDir, 'b', 'file'),
                    path.join(fixturesDir, 'a', 'link')
                )

                const patchedFs = Object.assign({}, fs)
                patchedFs.promises = Object.assign({}, fs.promises)
                patcher(patchedFs, [path.join(fixturesDir, 'a')])

                const dir = await util.promisify(patchedFs.opendir)(
                    path.join(fixturesDir, 'a')
                )
                const names = []
                for await (const entry of dir) {
                    names.push(entry.name)
                    if (entry.name === 'link') {
                        assert.ok(!entry.isSymbolicLink())
                        assert.ok(entry.isFile())
                    } else if (entry.name === 'apples') {
                        assert.ok(entry.isFile())
                    }
                }
                names.sort()
                assert.deepStrictEqual(names, ['apples', 'link'])
            }
        )
    })
})

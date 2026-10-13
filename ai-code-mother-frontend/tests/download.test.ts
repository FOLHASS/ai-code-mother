import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getDownloadFileName } from '../src/utils/download.ts'

test('优先使用 Content-Disposition 中的 UTF-8 名称', () => {
  assert.equal(
    getDownloadFileName("attachment; filename=\"app.zip\"; filename*=UTF-8''%E4%B8%AA%E4%BA%BA%E5%8D%9A%E5%AE%A2.zip", '备用.zip'),
    '个人博客.zip',
  )
})

test('兼容普通 filename，未携带文件名时回退到应用名', () => {
  assert.equal(getDownloadFileName('attachment; filename="todo.zip"', '备用.zip'), 'todo.zip')
  assert.equal(getDownloadFileName(undefined, '备用.zip'), '备用.zip')
  assert.equal(getDownloadFileName('attachment; filename="../../private.zip"', '备用.zip'), 'private.zip')
})

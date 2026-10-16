import test from 'node:test'
import assert from 'node:assert/strict'

import { getAppAccessPolicy } from '../src/modules/app-management/services/appPermissionPolicy.ts'

test('owner can interact and read history', () => {
  assert.deepEqual(
    getAppAccessPolicy({ id: '90071992547409931', role: 'user' }, { ownerId: '90071992547409931' }),
    {
      isAuthenticated: true,
      isOwner: true,
      isAdmin: false,
      canReadHistory: true,
      canInteract: true,
    },
  )
})

test('admin can read history but cannot interact with another owner app', () => {
  assert.deepEqual(getAppAccessPolicy({ id: '42', role: 'admin' }, { ownerId: '99' }), {
    isAuthenticated: true,
    isOwner: false,
    isAdmin: true,
    canReadHistory: true,
    canInteract: false,
  })
})

test('anonymous and missing owner IDs have no privileged access', () => {
  assert.deepEqual(getAppAccessPolicy(undefined, { ownerId: '42' }), {
    isAuthenticated: false,
    isOwner: false,
    isAdmin: false,
    canReadHistory: false,
    canInteract: false,
  })
  assert.deepEqual(getAppAccessPolicy({ id: '' }, { ownerId: '' }), {
    isAuthenticated: false,
    isOwner: false,
    isAdmin: false,
    canReadHistory: false,
    canInteract: false,
  })
})


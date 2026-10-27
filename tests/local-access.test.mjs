import test from 'node:test';
import assert from 'node:assert/strict';
import { localAccessEnabled, isLoopbackRequest, allowedLocalDataPath } from '../src/lib/local-access.ts';

test('local access needs explicit development opt-in and is always off in production', () => {
  assert.equal(localAccessEnabled('development', 'true'), true);
  for (const mode of ['production','test']) assert.equal(localAccessEnabled(mode, 'true'), false);
  for (const flag of ['false','',undefined]) assert.equal(localAccessEnabled('development', flag), false);
});
test('only loopback hosts with same origin can use local access', () => {
  for (const host of ['localhost:3001','127.0.0.1:3001','[::1]:3001']) {
    assert.equal(isLoopbackRequest(new Headers({host,origin:`http://${host}`})), true);
  }
  for (const host of ['evil.test','localhost.evil.test','192.168.1.2:3001','localhost:3001@evil.test']) {
    assert.equal(isLoopbackRequest(new Headers({host})), false);
  }
  assert.equal(isLoopbackRequest(new Headers({host:'localhost:3001',origin:'https://evil.test'})),false);
  assert.equal(isLoopbackRequest(new Headers({host:'localhost:3001','sec-fetch-site':'cross-site'})),false);
});
test('local proxy allowlist excludes auth, RPC, other storage and traversal', () => {
  assert.equal(allowedLocalDataPath(['rest','v1','pacientes']),true);
  assert.equal(allowedLocalDataPath(['storage','v1','object','firmas','test.png']),true);
  for (const path of [ ['auth','v1','admin','users'],['rest','v1','rpc','sql'],['storage','v1','object','unrelated','photo'],['rest','v1','pacientes/other'],['rest','v1','..'] ]) {
    assert.equal(allowedLocalDataPath(path),false);
  }
});

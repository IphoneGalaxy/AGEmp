// @vitest-environment node
/**
 * Smoke de rules contra o emulador Firestore (precisa FIRESTORE_EMULATOR_HOST).
 *
 * Rode:
 * `npx firebase emulators:exec --only firestore "npx vitest run src/firebase/__tests__/loanRequestsCreate.rules.test.js"`
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = join(__dirname, '../../../firestore.rules');

const supplierId = '47S6o9FCZDgJbpNbrpXGsCxYluD3';
const clientId = '094eofxr6dc670ouDmpo8GbH0ET2';
const linkId = `${supplierId}__${clientId}`;

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Rules: loanRequests create (emulator)', () => {
  /** @type {Awaited<ReturnType<typeof initializeTestEnvironment>>} */
  let testEnv;

  beforeAll(async () => {
    const rules = readFileSync(RULES_PATH, 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-loan-request-rules',
      firestore: { rules },
    });
  }, 60_000);

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    const ts = firebase.firestore.Timestamp.fromMillis(Date.now());

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const adb = ctx.firestore();
      await Promise.all([
        adb.collection('users').doc(clientId).set({
          displayName: 'Mello',
          createdAt: ts,
          updatedAt: ts,
          role: 'client',
          roleSetAt: ts,
          accountRoles: ['client'],
        }),
        adb.collection('users').doc(supplierId).set({
          displayName: 'Guilherme',
          createdAt: ts,
          updatedAt: ts,
          role: 'supplier',
          roleSetAt: ts,
          accountRoles: ['supplier'],
        }),
        adb.collection('links').doc(linkId).set({
          supplierId,
          clientId,
          requestedBy: 'client',
          status: 'approved',
          createdAt: ts,
          updatedAt: ts,
        }),
      ]);
    });
  });

  it('permite addDoc quando auth.uid é o cliente e perfis/vínculo batem', async () => {
    const clientDb = testEnv.authenticatedContext(clientId).firestore();
    const committedAt = firebase.firestore.FieldValue.serverTimestamp();
    await assertSucceeds(
      clientDb.collection('loanRequests').add({
        supplierId,
        clientId,
        linkId,
        requestedAmount: 20000,
        clientNote: '',
        status: 'pending',
        createdAt: committedAt,
        updatedAt: committedAt,
      }),
    );
  });

  it('nega quando auth.uid não é clientId mesmo com dados coerentes', async () => {
    const supplierDb = testEnv.authenticatedContext(supplierId).firestore();
    const committedAt = firebase.firestore.FieldValue.serverTimestamp();
    await assertFails(
      supplierDb.collection('loanRequests').add({
        supplierId,
        clientId,
        linkId,
        requestedAmount: 20000,
        clientNote: '',
        status: 'pending',
        createdAt: committedAt,
        updatedAt: committedAt,
      }),
    );
  });

  it('nega quando linkId existe mas vínculo não está approved no doc', async () => {
    await testEnv.clearFirestore();
    const ts = firebase.firestore.Timestamp.fromMillis(Date.now());
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const adb = ctx.firestore();
      await Promise.all([
        adb.collection('users').doc(clientId).set({
          displayName: 'Mello',
          createdAt: ts,
          updatedAt: ts,
          role: 'client',
          roleSetAt: ts,
          accountRoles: ['client'],
        }),
        adb.collection('users').doc(supplierId).set({
          displayName: 'Guilherme',
          createdAt: ts,
          updatedAt: ts,
          role: 'supplier',
          roleSetAt: ts,
          accountRoles: ['supplier'],
        }),
        adb.collection('links').doc(linkId).set({
          supplierId,
          clientId,
          requestedBy: 'client',
          status: 'pending',
          createdAt: ts,
          updatedAt: ts,
        }),
      ]);
    });

    const clientDb = testEnv.authenticatedContext(clientId).firestore();
    const committedAt = firebase.firestore.FieldValue.serverTimestamp();
    await assertFails(
      clientDb.collection('loanRequests').add({
        supplierId,
        clientId,
        linkId,
        requestedAmount: 20000,
        clientNote: '',
        status: 'pending',
        createdAt: committedAt,
        updatedAt: committedAt,
      }),
    );
  });
});

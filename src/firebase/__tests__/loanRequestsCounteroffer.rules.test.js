// @vitest-environment node
/**
 * Regras: transição de contraproposta do fornecedor (emulator + @firebase/rules-unit-testing).
 *
 * Rode via `npm run test:rules:loanRequests`.
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

const supplierId = 'supplier-cn-rules-aa';
const clientId = 'client-cn-rules-bb';
const linkId = `${supplierId}__${clientId}`;

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  'Rules: loanRequests supplier counteroffer (emulator)',
  () => {
    /** @type {Awaited<ReturnType<typeof initializeTestEnvironment>>} */
    let testEnv;

    beforeAll(async () => {
      const rules = readFileSync(RULES_PATH, 'utf8');
      testEnv = await initializeTestEnvironment({
        projectId: 'demo-loan-request-counteroffer-rules',
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
            displayName: 'Cliente CN',
            createdAt: ts,
            updatedAt: ts,
            role: 'client',
            roleSetAt: ts,
            accountRoles: ['client'],
          }),
          adb.collection('users').doc(supplierId).set({
            displayName: 'Fornecedor CN',
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
          adb.collection('loanRequests').doc('lr-cn-ok').set({
            supplierId,
            clientId,
            linkId,
            requestedAmount: 10000,
            clientNote: '',
            status: 'under_review',
            createdAt: ts,
            updatedAt: ts,
          }),
          adb.collection('loanRequests').doc('lr-cn-null-slot').set({
            supplierId,
            clientId,
            linkId,
            requestedAmount: 10000,
            clientNote: '',
            status: 'under_review',
            createdAt: ts,
            updatedAt: ts,
            counterofferAmount: null,
          }),
        ]);
      });
    });

    it('supplier autenticado envia contraproposta válida → assertSucceeds', async () => {
      const supplierDb = testEnv.authenticatedContext(supplierId).firestore();
      const committedAt = firebase.firestore.FieldValue.serverTimestamp();
      await assertSucceeds(
        supplierDb.collection('loanRequests').doc('lr-cn-ok').update({
          status: 'counteroffer',
          counterofferAmount: 12000,
          counterofferedAt: committedAt,
          updatedAt: committedAt,
        }),
      );
    });

    it('nega quando counterofferAmount é igual ao requestedAmount → assertFails', async () => {
      const supplierDb = testEnv.authenticatedContext(supplierId).firestore();
      const committedAt = firebase.firestore.FieldValue.serverTimestamp();
      await assertFails(
        supplierDb.collection('loanRequests').doc('lr-cn-ok').update({
          status: 'counteroffer',
          counterofferAmount: 10000,
          counterofferedAt: committedAt,
          updatedAt: committedAt,
        }),
      );
    });

    it('permite primeira contraproposta mesmo com campo counterofferAmount=null legado na chave → assertSucceeds', async () => {
      const supplierDb = testEnv.authenticatedContext(supplierId).firestore();
      const committedAt = firebase.firestore.FieldValue.serverTimestamp();
      await assertSucceeds(
        supplierDb.collection('loanRequests').doc('lr-cn-null-slot').update({
          status: 'counteroffer',
          counterofferAmount: 9000,
          counterofferedAt: committedAt,
          updatedAt: committedAt,
        }),
      );
    });
  },
);

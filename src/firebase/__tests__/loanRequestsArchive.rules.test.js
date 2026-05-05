// @vitest-environment node
/**
 * Regras: arquivamento por lado A2b/A2c (`archivedByClientAt` / `archivedBySupplierAt`).
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

const supplierId = 'supplier-arch-rules-aa';
const clientId = 'client-arch-rules-bb';
const linkId = `${supplierId}__${clientId}`;

/** Pedido terminal mínimo para testes de arquivo */
function approvedLoanRequestSeed(ts, overrides = {}) {
  return {
    supplierId,
    clientId,
    linkId,
    requestedAmount: 5000,
    clientNote: '',
    status: 'approved',
    createdAt: ts,
    updatedAt: ts,
    respondedAt: ts,
    approvedAmount: 5000,
    ...overrides,
  };
}

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  'Rules: loanRequests archive per side (emulator)',
  () => {
    /** @type {Awaited<ReturnType<typeof initializeTestEnvironment>>} */
    let testEnv;

    beforeAll(async () => {
      const rules = readFileSync(RULES_PATH, 'utf8');
      testEnv = await initializeTestEnvironment({
        projectId: 'demo-loan-request-archive-rules',
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
            displayName: 'Cliente Arch',
            createdAt: ts,
            updatedAt: ts,
            role: 'client',
            roleSetAt: ts,
            accountRoles: ['client'],
          }),
          adb.collection('users').doc(supplierId).set({
            displayName: 'Fornecedor Arch',
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
          adb
            .collection('loanRequests')
            .doc('lr-approved')
            .set(approvedLoanRequestSeed(ts)),
          adb
            .collection('loanRequests')
            .doc('lr-pending')
            .set({
              supplierId,
              clientId,
              linkId,
              requestedAmount: 3000,
              clientNote: '',
              status: 'pending',
              createdAt: ts,
              updatedAt: ts,
            }),
        ]);
      });
    });

    it('cliente arquiva pedido terminal com archivedByClientAt → assertSucceeds', async () => {
      const clientDb = testEnv.authenticatedContext(clientId).firestore();
      const archivedAt = firebase.firestore.FieldValue.serverTimestamp();
      await assertSucceeds(
        clientDb.collection('loanRequests').doc('lr-approved').update({
          archivedByClientAt: archivedAt,
        }),
      );
    });

    it('cliente desarquiva removendo archivedByClientAt → assertSucceeds', async () => {
      const ts = firebase.firestore.Timestamp.fromMillis(Date.now());
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx
          .firestore()
          .collection('loanRequests')
          .doc('lr-approved')
          .update({
            archivedByClientAt: ts,
          });
      });

      const clientDb = testEnv.authenticatedContext(clientId).firestore();
      await assertSucceeds(
        clientDb.collection('loanRequests').doc('lr-approved').update({
          archivedByClientAt: firebase.firestore.FieldValue.delete(),
        }),
      );
    });

    it('fornecedor arquiva pedido terminal com archivedBySupplierAt → assertSucceeds', async () => {
      const supplierDb = testEnv.authenticatedContext(supplierId).firestore();
      const archivedAt = firebase.firestore.FieldValue.serverTimestamp();
      await assertSucceeds(
        supplierDb.collection('loanRequests').doc('lr-approved').update({
          archivedBySupplierAt: archivedAt,
        }),
      );
    });

    it('ambos os lados podem arquivar independentemente → assertSucceeds', async () => {
      const tsMarker = firebase.firestore.FieldValue.serverTimestamp();
      const clientDb = testEnv.authenticatedContext(clientId).firestore();
      const supplierDb = testEnv.authenticatedContext(supplierId).firestore();
      await assertSucceeds(
        clientDb.collection('loanRequests').doc('lr-approved').update({
          archivedByClientAt: tsMarker,
        }),
      );
      await assertSucceeds(
        supplierDb.collection('loanRequests').doc('lr-approved').update({
          archivedBySupplierAt: tsMarker,
        }),
      );
    });

    it('fornecedor não pode gravar archivedByClientAt → assertFails', async () => {
      const supplierDb = testEnv.authenticatedContext(supplierId).firestore();
      await assertFails(
        supplierDb.collection('loanRequests').doc('lr-approved').update({
          archivedByClientAt: firebase.firestore.FieldValue.serverTimestamp(),
        }),
      );
    });

    it('cliente não pode gravar archivedBySupplierAt → assertFails', async () => {
      const clientDb = testEnv.authenticatedContext(clientId).firestore();
      await assertFails(
        clientDb.collection('loanRequests').doc('lr-approved').update({
          archivedBySupplierAt: firebase.firestore.FieldValue.serverTimestamp(),
        }),
      );
    });

    it('não permite arquivar pedido pendente → assertFails', async () => {
      const clientDb = testEnv.authenticatedContext(clientId).firestore();
      await assertFails(
        clientDb.collection('loanRequests').doc('lr-pending').update({
          archivedByClientAt: firebase.firestore.FieldValue.serverTimestamp(),
        }),
      );
    });

    it('arquivamento não pode alterar updatedAt → assertFails', async () => {
      const clientDb = testEnv.authenticatedContext(clientId).firestore();
      await assertFails(
        clientDb.collection('loanRequests').doc('lr-approved').update({
          archivedByClientAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }),
      );
    });
  },
);

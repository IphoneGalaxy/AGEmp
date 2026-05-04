// @vitest-environment node
/**
 * Regras: snapshots de nome em loanRequests (emulador).
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

const supplierId = 'supplier-lr-snap-rules-a';
const clientId = 'client-lr-snap-rules-b';
const linkId = `${supplierId}__${clientId}`;

const name80 = 'n'.repeat(80);

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  'Rules: loanRequests display name snapshots (emulator)',
  () => {
    /** @type {Awaited<ReturnType<typeof initializeTestEnvironment>>} */
    let testEnv;

    beforeAll(async () => {
      const rules = readFileSync(RULES_PATH, 'utf8');
      testEnv = await initializeTestEnvironment({
        projectId: 'demo-loanreq-snapshot-rules',
        firestore: { rules },
      });
    }, 60_000);

    afterAll(async () => {
      if (testEnv) {
        await testEnv.cleanup();
      }
    });

    async function seedUsersAndApprovedLink() {
      const ts = firebase.firestore.Timestamp.fromMillis(Date.now());
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const adb = ctx.firestore();
        await Promise.all([
          adb.collection('users').doc(clientId).set({
            displayName: 'Cliente LR',
            createdAt: ts,
            updatedAt: ts,
            role: 'client',
            roleSetAt: ts,
            accountRoles: ['client'],
          }),
          adb.collection('users').doc(supplierId).set({
            displayName: 'Fornecedor LR',
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
    }

    beforeEach(async () => {
      await testEnv.clearFirestore();
      await seedUsersAndApprovedLink();
    });

    function baseLoanRequestPayload() {
      const committedAt = firebase.firestore.FieldValue.serverTimestamp();
      return {
        supplierId,
        clientId,
        linkId,
        requestedAmount: 50000,
        clientNote: '',
        status: 'pending',
        createdAt: committedAt,
        updatedAt: committedAt,
      };
    }

    it('criação com client e supplier snapshots válidos → assertSucceeds', async () => {
      const clientDb = testEnv.authenticatedContext(clientId).firestore();
      await assertSucceeds(
        clientDb.collection('loanRequests').add({
          ...baseLoanRequestPayload(),
          clientDisplayNameSnapshot: 'Cliente A',
          supplierDisplayNameSnapshot: 'Fornecedor B',
        }),
      );
    });

    it('criação com snapshots null → assertSucceeds', async () => {
      const clientDb = testEnv.authenticatedContext(clientId).firestore();
      await assertSucceeds(
        clientDb.collection('loanRequests').add({
          ...baseLoanRequestPayload(),
          clientDisplayNameSnapshot: null,
          supplierDisplayNameSnapshot: null,
        }),
      );
    });

    it('criação sem chaves de snapshot → assertSucceeds', async () => {
      const clientDb = testEnv.authenticatedContext(clientId).firestore();
      await assertSucceeds(
        clientDb.collection('loanRequests').add({
          ...baseLoanRequestPayload(),
        }),
      );
    });

    it('criação com snapshot inválido (string vazia) → assertFails', async () => {
      const clientDb = testEnv.authenticatedContext(clientId).firestore();
      await assertFails(
        clientDb.collection('loanRequests').add({
          ...baseLoanRequestPayload(),
          clientDisplayNameSnapshot: '',
        }),
      );
    });

    it('criação com snapshot inválido (>80 caracteres) → assertFails', async () => {
      const clientDb = testEnv.authenticatedContext(clientId).firestore();
      await assertFails(
        clientDb.collection('loanRequests').add({
          ...baseLoanRequestPayload(),
          supplierDisplayNameSnapshot: `${name80}x`,
        }),
      );
    });

    it('update tentando alterar supplierDisplayNameSnapshot → assertFails', async () => {
      const ts = firebase.firestore.Timestamp.fromMillis(Date.now());
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection('loanRequests').doc('lr-snap-1').set({
          supplierId,
          clientId,
          linkId,
          requestedAmount: 30000,
          clientNote: '',
          status: 'pending',
          createdAt: ts,
          updatedAt: ts,
          clientDisplayNameSnapshot: 'C',
          supplierDisplayNameSnapshot: 'S',
        });
      });

      const supplierDb = testEnv.authenticatedContext(supplierId).firestore();
      const committedAt = firebase.firestore.FieldValue.serverTimestamp();
      await assertFails(
        supplierDb.collection('loanRequests').doc('lr-snap-1').update({
          status: 'under_review',
          updatedAt: committedAt,
          supplierDisplayNameSnapshot: 'Outro nome',
        }),
      );
    });

    it('transição existente under_review sem snapshots permanece válida', async () => {
      const ts = firebase.firestore.Timestamp.fromMillis(Date.now());
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection('loanRequests').doc('lr-snap-flow').set({
          supplierId,
          clientId,
          linkId,
          requestedAmount: 40000,
          clientNote: '',
          status: 'under_review',
          createdAt: ts,
          updatedAt: ts,
        });
      });

      const supplierDb = testEnv.authenticatedContext(supplierId).firestore();
      const committedAt = firebase.firestore.FieldValue.serverTimestamp();
      await assertSucceeds(
        supplierDb.collection('loanRequests').doc('lr-snap-flow').update({
          status: 'approved',
          approvedAmount: 40000,
          respondedAt: committedAt,
          updatedAt: committedAt,
        }),
      );
    });
  },
);

// @vitest-environment node
/**
 * Regras: snapshots de nome em links (emulador + @firebase/rules-unit-testing).
 * Rode via `npm run test:rules:loanRequests` (script inclui este ficheiro).
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

const supplierId = 'supplier-link-snap-rules-a';
const clientId = 'client-link-snap-rules-b';
const linkId = `${supplierId}__${clientId}`;

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  'Rules: links display name snapshots (emulator)',
  () => {
    /** @type {Awaited<ReturnType<typeof initializeTestEnvironment>>} */
    let testEnv;

    beforeAll(async () => {
      const rules = readFileSync(RULES_PATH, 'utf8');
      testEnv = await initializeTestEnvironment({
        projectId: 'demo-links-snapshot-rules',
        firestore: { rules },
      });
    }, 60_000);

    afterAll(async () => {
      if (testEnv) {
        await testEnv.cleanup();
      }
    });

    async function seedUsers() {
      const ts = firebase.firestore.Timestamp.fromMillis(Date.now());
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const adb = ctx.firestore();
        await Promise.all([
          adb.collection('users').doc(clientId).set({
            displayName: 'Cliente L',
            createdAt: ts,
            updatedAt: ts,
            role: 'client',
            roleSetAt: ts,
            accountRoles: ['client'],
          }),
          adb.collection('users').doc(supplierId).set({
            displayName: 'Fornecedor L',
            createdAt: ts,
            updatedAt: ts,
            role: 'supplier',
            roleSetAt: ts,
            accountRoles: ['supplier'],
          }),
        ]);
      });
    }

    beforeEach(async () => {
      await testEnv.clearFirestore();
      await seedUsers();
    });

    it('criação pelo cliente com clientDisplayNameSnapshot válido → assertSucceeds', async () => {
      const clientDb = testEnv.authenticatedContext(clientId).firestore();
      const committedAt = firebase.firestore.FieldValue.serverTimestamp();
      await assertSucceeds(
        clientDb.collection('links').doc(linkId).set({
          supplierId,
          clientId,
          status: 'pending',
          requestedBy: 'client',
          createdAt: committedAt,
          updatedAt: committedAt,
          clientDisplayNameSnapshot: 'Nome amigável',
        }),
      );
    });

    it('criação com supplierDisplayNameSnapshot → assertFails', async () => {
      const clientDb = testEnv.authenticatedContext(clientId).firestore();
      const committedAt = firebase.firestore.FieldValue.serverTimestamp();
      await assertFails(
        clientDb.collection('links').doc(linkId).set({
          supplierId,
          clientId,
          status: 'pending',
          requestedBy: 'client',
          createdAt: committedAt,
          updatedAt: committedAt,
          supplierDisplayNameSnapshot: 'Fornecedor X',
        }),
      );
    });

    it('criação com snapshot inválido (string vazia) → assertFails', async () => {
      const clientDb = testEnv.authenticatedContext(clientId).firestore();
      const committedAt = firebase.firestore.FieldValue.serverTimestamp();
      await assertFails(
        clientDb.collection('links').doc(linkId).set({
          supplierId,
          clientId,
          status: 'pending',
          requestedBy: 'client',
          createdAt: committedAt,
          updatedAt: committedAt,
          clientDisplayNameSnapshot: '',
        }),
      );
    });

    it('criação com snapshot inválido (>80 caracteres) → assertFails', async () => {
      const clientDb = testEnv.authenticatedContext(clientId).firestore();
      const committedAt = firebase.firestore.FieldValue.serverTimestamp();
      await assertFails(
        clientDb.collection('links').doc(linkId).set({
          supplierId,
          clientId,
          status: 'pending',
          requestedBy: 'client',
          createdAt: committedAt,
          updatedAt: committedAt,
          clientDisplayNameSnapshot: 'x'.repeat(81),
        }),
      );
    });

    it('aprovação pelo fornecedor com supplierDisplayNameSnapshot válido → assertSucceeds', async () => {
      const ts = firebase.firestore.Timestamp.fromMillis(Date.now());
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection('links').doc(linkId).set({
          supplierId,
          clientId,
          status: 'pending',
          requestedBy: 'client',
          createdAt: ts,
          updatedAt: ts,
          clientDisplayNameSnapshot: 'Cliente Fixo',
        });
      });

      const supplierDb = testEnv.authenticatedContext(supplierId).firestore();
      const committedAt = firebase.firestore.FieldValue.serverTimestamp();
      await assertSucceeds(
        supplierDb.collection('links').doc(linkId).update({
          status: 'approved',
          updatedAt: committedAt,
          supplierDisplayNameSnapshot: 'Loja Conf',
        }),
      );
    });

    it('aprovação tentando alterar clientDisplayNameSnapshot → assertFails', async () => {
      const ts = firebase.firestore.Timestamp.fromMillis(Date.now());
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection('links').doc(linkId).set({
          supplierId,
          clientId,
          status: 'pending',
          requestedBy: 'client',
          createdAt: ts,
          updatedAt: ts,
          clientDisplayNameSnapshot: 'Original',
        });
      });

      const supplierDb = testEnv.authenticatedContext(supplierId).firestore();
      const committedAt = firebase.firestore.FieldValue.serverTimestamp();
      await assertFails(
        supplierDb.collection('links').doc(linkId).update({
          status: 'approved',
          updatedAt: committedAt,
          clientDisplayNameSnapshot: 'Alterado',
          supplierDisplayNameSnapshot: 'Forn OK',
        }),
      );
    });
  },
);

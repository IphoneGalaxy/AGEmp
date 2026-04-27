import React, { useState, useEffect, useMemo } from 'react';
import { formatMoney, formatDate, formatDateTime, formatRate } from '../utils/format';
import { formatLocalVinculoLineFromContext } from '../utils/localLinkContextOrganize';
import {
  canInheritLinkContextToLoan,
  buildLoanWithOptionalLinkContext,
} from '../utils/loanLinkContextInherit';
import {
  LOAN_LINK_LIST_FILTER,
  filterLoansByLinkContextPresence,
  countLoansWithLinkContext,
  countLoansWithoutLinkContext,
  shouldShowLoanLinkContextFilter,
} from '../utils/loanLinkContextFilter';
import {
  annotateLoanFromClientContext,
  getLoanLinkContextActionState,
  removeLoanLinkContext,
} from '../utils/loanLinkContextManage';
import { generateId } from '../utils/ids';
import { buildLocalLinkContext } from '../utils/linkContext';
import {
  getLink,
  getLinkId,
  listUserLinks,
  LINK_STATUSES,
} from '../firebase/links';
import { IconEdit, IconDelete, IconBack } from './Icons';

/**
 * Componente Visão do Cliente (overlay).
 *
 * Exibe detalhes do cliente, contratos, pagamentos, edição/exclusão.
 * Suporta taxa de juros individual por contrato.
 *
 * @param {Object} props
 * @param {Object}   props.clientData - Dados processados do cliente.
 * @param {number}   props.availableMoney - Saldo disponível em caixa.
 * @param {Function} props.onUpdateClients - Callback updater de clientes.
 * @param {Function} props.onClose - Callback para fechar a visão.
 * @param {Function} props.showToast - Callback para exibir toast.
 * @param {Function} props.displayMoney - Função para formatar/ocultar valores monetários.
 * @param {Object}   [props.user] - Usuário autenticado (Firebase); ausente no modo sem conta.
 */
const ClientView = ({
  clientData,
  availableMoney,
  onUpdateClients,
  onClose,
  showToast,
  displayMoney,
  settings,
  user,
}) => {
  // --- Estado local de formulários ---
  const [showNewLoanForm, setShowNewLoanForm] = useState(false);
  const [newLoanAmount, setNewLoanAmount] = useState('');
  const [newLoanDate, setNewLoanDate] = useState(new Date().toISOString().split('T')[0]);
  const [newLoanRate, setNewLoanRate] = useState(
    settings.defaultInterestRate !== '' ? settings.defaultInterestRate : 10
  );
  const [inheritLinkContextOnNewLoan, setInheritLinkContextOnNewLoan] = useState(
    canInheritLinkContextToLoan(clientData.linkContext)
  );

  const [payingLoanId, setPayingLoanId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // --- Estado local de confirmações e edições ---
  const [confirmDeleteClient, setConfirmDeleteClient] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);
  const [confirmDeleteLoanId, setConfirmDeleteLoanId] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [confirmDeletePaymentId, setConfirmDeletePaymentId] = useState(null);

  const [platformLinks, setPlatformLinks] = useState([]);
  const [platformLinksLoading, setPlatformLinksLoading] = useState(false);
  const [platformLinksError, setPlatformLinksError] = useState(null);
  const [pendingLinkId, setPendingLinkId] = useState('');
  const [linkContextBusy, setLinkContextBusy] = useState(false);
  const [loanLinkFilter, setLoanLinkFilter] = useState(LOAN_LINK_LIST_FILTER.ALL);
  const [confirmRemoveLoanLinkContextId, setConfirmRemoveLoanLinkContextId] = useState(null);

  const allLoans = clientData.loans || [];
  const linkedLoanCount = countLoansWithLinkContext(allLoans);
  const unlinkedLoanCount = countLoansWithoutLinkContext(allLoans);
  const showLoanLinkFilter = shouldShowLoanLinkContextFilter(allLoans);
  const visibleLoans = useMemo(
    () => filterLoansByLinkContextPresence(clientData.loans || [], loanLinkFilter),
    [clientData.loans, loanLinkFilter]
  );

  const loanFilterButtonClass = (active) =>
    `inline-flex min-h-[40px] flex-1 items-center justify-center rounded-design-md px-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring sm:text-sm ${
      active
        ? 'bg-surface text-info shadow-design-sm ring-1 ring-inset ring-info/35'
        : 'bg-transparent text-content-muted hover:bg-surface/80'
    }`;

  useEffect(() => {
    setLoanLinkFilter(LOAN_LINK_LIST_FILTER.ALL);
    setConfirmRemoveLoanLinkContextId(null);
  }, [clientData.id]);

  useEffect(() => {
    if (!editingLoan) return;
    const visible = filterLoansByLinkContextPresence(clientData.loans || [], loanLinkFilter);
    if (!visible.some((l) => l.id === editingLoan.id)) {
      setEditingLoan(null);
    }
  }, [clientData.loans, loanLinkFilter, editingLoan?.id]);

  useEffect(() => {
    if (!confirmRemoveLoanLinkContextId) return;
    const visible = filterLoansByLinkContextPresence(clientData.loans || [], loanLinkFilter);
    if (!visible.some((l) => l.id === confirmRemoveLoanLinkContextId)) {
      setConfirmRemoveLoanLinkContextId(null);
    }
  }, [clientData.loans, loanLinkFilter, confirmRemoveLoanLinkContextId]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.uid) {
      setPlatformLinks([]);
      setPlatformLinksError(null);
      setPlatformLinksLoading(false);
      return;
    }
    setPlatformLinksLoading(true);
    setPlatformLinksError(null);
    listUserLinks(user.uid)
      .then((all) => {
        if (cancelled) return;
        const approved = (all || []).filter(
          (l) =>
            l &&
            l.status === LINK_STATUSES.APPROVED &&
            (l.supplierId === user.uid || l.clientId === user.uid)
        );
        setPlatformLinks(approved);
      })
      .catch(() => {
        if (cancelled) return;
        setPlatformLinksError('Não foi possível carregar os vínculos agora.');
        setPlatformLinks([]);
      })
      .finally(() => {
        if (!cancelled) setPlatformLinksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    setInheritLinkContextOnNewLoan(canInheritLinkContextToLoan(clientData.linkContext));
  }, [clientData.linkContext]);

  // ==================== HANDLERS ====================

  const handleDeleteClientClick = () => {
    if (settings.confirmDeleteClient) {
      setConfirmDeleteClient(true);
    } else {
      executeDeleteClient();
    }
  };

  const executeDeleteClient = () => {
    onUpdateClients((clients) => clients.filter((c) => c.id !== clientData.id));
    onClose();
    showToast('🗑️ Cliente deletado.');
  };

  const handleAddLoan = (e) => {
    e.preventDefault();
    const amountToLend = Number(newLoanAmount);
    if (!amountToLend || amountToLend <= 0) return;

    const rate = Number(newLoanRate);
    if (isNaN(rate) || rate < 0) {
      showToast('❌ Taxa de juros inválida!');
      return;
    }

    if (amountToLend > availableMoney) {
      showToast('❌ Saldo insuficiente para este empréstimo!');
      return;
    }

    const includeLoanLinkContext =
      inheritLinkContextOnNewLoan && canInheritLinkContextToLoan(clientData.linkContext);

    onUpdateClients((clients) =>
      clients.map((c) => {
        if (c.id === clientData.id) {
          const newLoan = buildLoanWithOptionalLinkContext({
            loan: {
              id: generateId(),
              date: newLoanDate,
              amount: amountToLend,
              interestRate: rate,
              payments: [],
            },
            clientLinkContext: c.linkContext,
            includeLinkContext: includeLoanLinkContext,
          });

          return {
            ...c,
            loans: [
              newLoan,
              ...c.loans,
            ],
          };
        }
        return c;
      })
    );
    setNewLoanAmount('');
    setNewLoanRate(settings.defaultInterestRate !== '' ? settings.defaultInterestRate : 10);
    setInheritLinkContextOnNewLoan(canInheritLinkContextToLoan(clientData.linkContext));
    setShowNewLoanForm(false);
    showToast(
      includeLoanLinkContext
        ? '💸 Empréstimo registrado com anotação local de vínculo.'
        : '💸 Empréstimo registrado!'
    );
  };

  const handleDeleteLoanClick = (loanId) => {
    setConfirmRemoveLoanLinkContextId(null);
    if (settings.confirmDeleteLoan) {
      setConfirmDeleteLoanId(loanId);
    } else {
      executeDeleteLoan(loanId);
    }
  };

  const executeDeleteLoan = (loanId) => {
    onUpdateClients((clients) =>
      clients.map((c) =>
        c.id === clientData.id ? { ...c, loans: c.loans.filter((l) => l.id !== loanId) } : c
      )
    );
    setConfirmDeleteLoanId(null);
    showToast('🗑️ Contrato apagado.');
  };

  const handleSaveEditLoan = (e) => {
    e.preventDefault();
    const newAmount = Number(editingLoan.amount);
    if (!newAmount || newAmount <= 0) return;

    const newRate = Number(editingLoan.interestRate);
    if (isNaN(newRate) || newRate < 0) {
      showToast('❌ Taxa de juros inválida!');
      return;
    }

    const originalLoan = clientData.loans.find((l) => l.id === editingLoan.id);
    const diff = newAmount - originalLoan.amount;
    if (diff > 0 && diff > availableMoney) {
      showToast('❌ Saldo insuficiente para aumentar o empréstimo!');
      return;
    }

    onUpdateClients((clients) =>
      clients.map((c) => {
        if (c.id === clientData.id) {
          return {
            ...c,
            loans: c.loans.map((l) =>
              l.id === editingLoan.id
                ? { ...l, date: editingLoan.date, amount: newAmount, interestRate: newRate }
                : l
            ),
          };
        }
        return c;
      })
    );
    setEditingLoan(null);
    showToast('✅ Contrato editado!');
  };

  const handleAnnotateLoanWithClientContext = (loanId) => {
    onUpdateClients((clients) =>
      clients.map((c) => {
        if (c.id !== clientData.id) return c;
        return {
          ...c,
          loans: c.loans.map((l) =>
            l.id === loanId ? annotateLoanFromClientContext(l, c.linkContext) : l
          ),
        };
      })
    );
    showToast('✅ Anotação local adicionada ao contrato.');
  };

  const executeRemoveLoanLinkContext = (loanId) => {
    onUpdateClients((clients) =>
      clients.map((c) => {
        if (c.id !== clientData.id) return c;
        return {
          ...c,
          loans: c.loans.map((l) => (l.id === loanId ? removeLoanLinkContext(l) : l)),
        };
      })
    );
    setConfirmRemoveLoanLinkContextId(null);
    showToast('✅ Anotação local removida do contrato.');
  };

  const handleAddPayment = (e) => {
    e.preventDefault();
    if (!paymentAmount) return;

    onUpdateClients((clients) =>
      clients.map((c) => {
        if (c.id === clientData.id) {
          return {
            ...c,
            loans: c.loans.map((l) =>
              l.id === payingLoanId
                ? {
                    ...l,
                    payments: [
                      ...l.payments,
                      { id: generateId(), date: paymentDate, amount: Number(paymentAmount) },
                    ],
                  }
                : l
            ),
          };
        }
        return c;
      })
    );
    setPaymentAmount('');
    setPayingLoanId(null);
    showToast('✅ Pagamento registrado!');
  };

  const handleDeletePaymentClick = (loanId, paymentId) => {
    if (settings.confirmDeletePayment) {
      setConfirmDeletePaymentId({ loanId, id: paymentId });
    } else {
      // Executa direto sem confirmação
      onUpdateClients((clients) =>
        clients.map((c) => {
          if (c.id === clientData.id) {
            return {
              ...c,
              loans: c.loans.map((l) =>
                l.id === loanId ? { ...l, payments: l.payments.filter((p) => p.id !== paymentId) } : l
              ),
            };
          }
          return c;
        })
      );
      showToast('🗑️ Pagamento apagado.');
    }
  };

  const executeDeletePayment = () => {
    if (!confirmDeletePaymentId) return;
    const { loanId, id } = confirmDeletePaymentId;

    onUpdateClients((clients) =>
      clients.map((c) => {
        if (c.id === clientData.id) {
          return {
            ...c,
            loans: c.loans.map((l) =>
              l.id === loanId ? { ...l, payments: l.payments.filter((p) => p.id !== id) } : l
            ),
          };
        }
        return c;
      })
    );
    setConfirmDeletePaymentId(null);
    showToast('🗑️ Pagamento apagado.');
  };

  const handleSaveEditPayment = (e) => {
    e.preventDefault();
    if (!editingPayment.amount) return;

    onUpdateClients((clients) =>
      clients.map((c) => {
        if (c.id === clientData.id) {
          return {
            ...c,
            loans: c.loans.map((l) =>
              l.id === editingPayment.loanId
                ? {
                    ...l,
                    payments: l.payments.map((p) =>
                      p.id === editingPayment.id
                        ? { ...p, date: editingPayment.date, amount: Number(editingPayment.amount) }
                        : p
                    ),
                  }
                : l
            ),
          };
        }
        return c;
      })
    );
    setEditingPayment(null);
    showToast('✅ Pagamento editado!');
  };

  // Extrato usa formatMoney (não displayMoney) — dados copiados devem ser legíveis
  const generateStatement = () => {
    let text = `*Extrato de Empréstimos - ${clientData.name}*\n`;
    text += `Gerado em: ${formatDate(new Date().toISOString().split('T')[0])}\n\n`;

    if (clientData.loans.length === 0) text += `Nenhum contrato ativo.\n`;

    clientData.loans.forEach((loan) => {
      const rateStr = formatRate(loan.interestRate != null ? loan.interestRate : 10);
      text += `📌 *Empréstimo: ${formatMoney(loan.amount)} (${formatDate(loan.date)}) — Taxa: ${rateStr}*\n`;
      if (loan.isPaidOff) {
        text += `   ✅ Contrato Quitado!\n\n`;
      } else {
        if (loan.processedPayments.length > 0) {
          loan.processedPayments.forEach((p) => {
            text += `   🟢 ${formatDate(p.date)}: Pagou ${formatMoney(p.amount)}\n`;
            text += `      (Juros: ${formatMoney(p.interestPaid)} | Abateu: ${formatMoney(p.amortized)})\n`;
          });
        } else {
          text += `   ▪️ Nenhum pagamento registrado.\n`;
        }
        text += `   *Saldo Devedor Deste:* ${formatMoney(loan.currentPrincipal)}\n`;
        text += `   *(Próx. Juros ${rateStr}: ${formatMoney(loan.baseInterest)})*\n`;
        text += `   *🎯 QUITAÇÃO DESTE: ${formatMoney(loan.currentPrincipal + loan.baseInterest)}*\n\n`;
      }
    });

    text += `------------------------\n`;
    text += `*TOTAL DEVEDOR (PRINCIPAL): ${formatMoney(clientData.currentDebt)}*\n`;
    text += `*🎯 TOTAL PARA QUITAR TUDO: ${formatMoney(clientData.currentDebt + clientData.dashExpected)}*\n`;

    // Copia para o clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showToast('📋 Extrato copiado com sucesso!'),
        () => fallbackCopy(text)
      );
    } else {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast('📋 Extrato copiado com sucesso!');
    } catch (err) {
      showToast('❌ Erro ao copiar.');
    }
    document.body.removeChild(textArea);
  };

  const handleRemoveLocalLinkContext = () => {
    onUpdateClients((clients) =>
      clients.map((c) => {
        if (c.id !== clientData.id) return c;
        const next = { ...c };
        delete next.linkContext;
        return next;
      })
    );
    setPendingLinkId('');
    showToast('Anotação local de vínculo removida.');
  };

  const handleAssociateLocalLinkContext = async () => {
    if (!user?.uid || !pendingLinkId) return;
    const link = platformLinks.find((l) => l.id === pendingLinkId);
    if (!link) return;
    setLinkContextBusy(true);
    try {
      const fresh = await getLink(link.supplierId, link.clientId);
      if (!fresh || fresh.status !== LINK_STATUSES.APPROVED) {
        showToast('❌ O vínculo não está mais aprovado. Veja em Conta e tente de novo.');
        return;
      }
      if (fresh.supplierId !== user.uid && fresh.clientId !== user.uid) {
        showToast('❌ Sua conta não participa deste vínculo.');
        return;
      }
      if (getLinkId(fresh.supplierId, fresh.clientId) !== link.id) {
        showToast('❌ Dados do vínculo não conferem.');
        return;
      }
      const nextCtx = buildLocalLinkContext(fresh.supplierId, fresh.clientId);
      onUpdateClients((clients) =>
        clients.map((c) => (c.id === clientData.id ? { ...c, linkContext: nextCtx } : c))
      );
      setPendingLinkId('');
      showToast('Vínculo anotado neste cliente (só neste aparelho; não envia financeiro).');
    } catch {
      showToast('❌ Não foi possível confirmar o vínculo. Tente de novo.');
    } finally {
      setLinkContextBusy(false);
    }
  };

  const localLink = clientData.linkContext;
  const vinculoLineLocal = localLink ? formatLocalVinculoLineFromContext(localLink) : '';
  const canInheritLoanLinkContext = canInheritLinkContextToLoan(localLink);
  const anotadoEmLine =
    localLink?.associatedAt && typeof localLink.associatedAt === 'string'
      ? `Anotado em ${formatDateTime(localLink.associatedAt)}`
      : null;

  // ==================== RENDERIZAÇÃO ====================

  return (
    <div className="absolute left-0 top-0 z-10 flex h-screen w-full flex-col overflow-y-auto bg-base p-4 pb-24 sm:px-5">
      {/* Cabeçalho */}
      <header className="mb-6 flex items-start gap-3 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border border-edge bg-surface text-content-muted shadow-design-sm transition-colors hover:bg-surface-muted active:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          aria-label="Voltar"
        >
          <IconBack />
        </button>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="truncate text-2xl font-semibold tracking-tight text-content">
            {clientData.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={handleDeleteClientClick}
          className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border border-transparent text-content-muted transition-colors hover:border-danger-soft hover:bg-danger-soft hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          aria-label="Excluir cliente"
        >
          <IconDelete />
        </button>
      </header>

      {/* Confirmação de exclusão do cliente */}
      {confirmDeleteClient && (
        <div className="mb-6 animate-fade-in rounded-design-lg border border-edge bg-danger-soft p-4 text-center shadow-design-sm sm:p-5">
          <p className="mb-4 text-sm font-semibold leading-snug text-danger">
            Apagar cliente e todo o histórico?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmDeleteClient(false)}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-sm font-semibold text-content transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={executeDeleteClient}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-design-md bg-danger px-3 text-sm font-semibold text-content-inverse shadow-design-sm transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
            >
              Sim, Apagar
            </button>
          </div>
        </div>
      )}

      {/* Resumo de dívida */}
      <div className="mb-6 rounded-design-lg border border-edge bg-surface p-5 shadow-design-sm">
        <div className="text-left">
          <p className="mb-1 text-sm font-medium text-content-muted">
            Dívida Principal (Todos contratos)
          </p>
          <p className="text-3xl font-bold tabular-nums tracking-tight text-content">
            {displayMoney(clientData.currentDebt)}
          </p>

          <div className="mt-3 rounded-design-md border border-edge bg-surface-muted px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
              Quitação Total de Tudo
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-content-soft">
              {displayMoney(clientData.currentDebt + clientData.dashExpected)}
            </p>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setShowNewLoanForm(!showNewLoanForm)}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-design-md bg-primary px-3 text-sm font-semibold text-content-inverse shadow-design-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
            >
              + Empréstimo
            </button>
            <button
              type="button"
              onClick={generateStatement}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-sm font-semibold text-content transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
            >
              Copiar Extrato
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-design-lg border border-edge bg-surface p-4 shadow-design-sm sm:p-5">
        <h3 className="mb-1 text-base font-semibold text-content">Vínculo na plataforma (opcional)</h3>
        <p className="mb-4 text-xs leading-relaxed text-content-muted">
          Só neste aparelho: anotar qual vínculo aprovado na sua conta corresponde a este cliente. Não envia
          empréstimos, caixa ou dashboard para a nuvem.
        </p>

        {!user?.uid && !localLink && (
          <p className="text-sm text-content-muted">
            Com conta, em Config., você pode fazer essa anotação. O financeiro continua local neste aparelho.
          </p>
        )}

        {user?.uid && !localLink && platformLinksLoading && (
          <p className="text-sm text-content-muted">Carregando vínculos…</p>
        )}

        {user?.uid && !localLink && !platformLinksLoading && platformLinksError && (
          <p className="text-sm text-danger" role="alert">
            {platformLinksError}
          </p>
        )}

        {user?.uid && !localLink && !platformLinksLoading && !platformLinksError && platformLinks.length === 0 && (
          <p className="text-sm text-content-muted">
            Não há vínculos aprovados na sua conta. Acompanhe pedidos e aprovações em Conta.
          </p>
        )}

        {user?.uid && localLink && (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-content-muted">
              Este cliente está anotado, só neste aparelho, a um par de contas (vínculo) da plataforma. Não
              envia dívida nem extrato.
            </p>
            {vinculoLineLocal && (
              <p className="break-words text-sm font-medium text-content">{vinculoLineLocal}</p>
            )}
            {anotadoEmLine && (
              <p className="text-xs text-content-muted">{anotadoEmLine}</p>
            )}
            <button
              type="button"
              onClick={handleRemoveLocalLinkContext}
              disabled={linkContextBusy}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
            >
              Remover anotação
            </button>
            {platformLinks.length > 0 && (
              <p className="text-xs text-content-muted">Para trocar, remova a anotação e escolha de novo.</p>
            )}
          </div>
        )}

        {user?.uid && !localLink && !platformLinksLoading && !platformLinksError && platformLinks.length > 0 && (
          <div className="space-y-3">
            <div>
              <label htmlFor="link-context-select" className="mb-1.5 block text-xs font-medium text-content-muted">
                Vínculo aprovado
              </label>
              <select
                id="link-context-select"
                value={pendingLinkId}
                onChange={(e) => setPendingLinkId(e.target.value)}
                className="w-full min-h-[44px] rounded-design-md border border-edge bg-surface-muted px-3 text-sm text-content shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
              >
                <option value="">Escolher…</option>
                {platformLinks.map((l) => {
                  const other = l.supplierId === user.uid ? l.clientId : l.supplierId;
                  return (
                    <option key={l.id} value={l.id}>
                      {other}
                    </option>
                  );
                })}
              </select>
            </div>
            <button
              type="button"
              onClick={handleAssociateLocalLinkContext}
              disabled={linkContextBusy || !pendingLinkId}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md bg-primary px-3 text-sm font-semibold text-content-inverse shadow-design-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
            >
              {linkContextBusy ? 'Verificando…' : 'Anotar neste cliente'}
            </button>
          </div>
        )}

        {!user?.uid && localLink && (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-content-muted">
              Anotação local neste aparelho (sem login não dá trocar pelo menu de vínculos).
            </p>
            {vinculoLineLocal && (
              <p className="break-words text-sm font-medium text-content">{vinculoLineLocal}</p>
            )}
            {anotadoEmLine && <p className="text-xs text-content-muted">{anotadoEmLine}</p>}
            <button
              type="button"
              onClick={handleRemoveLocalLinkContext}
              disabled={linkContextBusy}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-sm font-semibold text-content-soft transition-colors hover:bg-surface-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring disabled:opacity-60"
            >
              Remover anotação
            </button>
          </div>
        )}
      </div>

      {/* Formulário de novo empréstimo */}
      {showNewLoanForm && (
        <form
          onSubmit={handleAddLoan}
          className="mb-6 animate-fade-in rounded-design-lg border border-edge bg-surface p-4 shadow-design-sm sm:p-5"
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-content">Novo Empréstimo</h3>
            <span className="inline-flex w-fit max-w-full items-center rounded-design-sm border border-edge bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
              Caixa: {displayMoney(availableMoney)}
            </span>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-content-muted">Data do contrato</p>
              <input
                type="date"
                value={newLoanDate}
                onChange={(e) => setNewLoanDate(e.target.value)}
                required
                className="w-full min-h-[44px] rounded-design-md border border-edge bg-surface-muted px-4 py-2 text-content shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-content-muted">Valor (R$)</p>
              <input
                type="number"
                step="0.01"
                value={newLoanAmount}
                onChange={(e) => setNewLoanAmount(e.target.value)}
                placeholder="Valor (R$)"
                required
                className="w-full min-h-[44px] rounded-design-md border border-edge bg-surface-muted px-4 py-2 text-content placeholder:text-content-muted shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-content-muted">Taxa de juros (%)</p>
              <div className="flex max-w-[8.5rem] items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={newLoanRate}
                  onChange={(e) => setNewLoanRate(e.target.value)}
                  required
                  className="min-h-[44px] w-full rounded-design-md border border-edge bg-surface-muted px-3 py-2 text-center text-sm font-semibold text-content tabular-nums shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                />
                <span className="text-sm font-medium text-content-muted">%</span>
              </div>
            </div>
            {canInheritLoanLinkContext && (
              <label
                htmlFor="inherit-link-context-on-loan"
                className="flex cursor-pointer items-start gap-3 rounded-design-md border border-info/30 bg-info-soft/30 px-3 py-2.5"
              >
                <input
                  id="inherit-link-context-on-loan"
                  type="checkbox"
                  checked={inheritLinkContextOnNewLoan}
                  onChange={(e) => setInheritLinkContextOnNewLoan(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-edge text-info focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                />
                <span className="text-xs leading-relaxed text-content-soft">
                  Herdar anotação de vínculo deste cliente neste contrato (só neste aparelho; não
                  envia financeiro nem cria vínculo novo na plataforma).
                </span>
              </label>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setShowNewLoanForm(false)}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-design-md border border-edge bg-surface px-3 text-sm font-semibold text-content transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-design-md bg-primary px-3 text-sm font-semibold text-content-inverse shadow-design-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
            >
              Salvar
            </button>
          </div>
        </form>
      )}

      <h3 className="mb-3 text-lg font-semibold text-content">Contratos em Aberto</h3>

      {showLoanLinkFilter && (
        <div className="mb-3 rounded-design-lg border border-edge bg-surface-muted/40 p-3 shadow-design-sm">
          <p className="mb-2 text-xs leading-relaxed text-content-muted">
            Filtro visual dos contratos; totais e dívida acima consideram o cliente inteiro.
          </p>
          <div
            className="flex flex-col gap-2 sm:flex-row sm:gap-1"
            role="group"
            aria-label="Filtro por anotação no contrato"
          >
            <button
              type="button"
              onClick={() => setLoanLinkFilter(LOAN_LINK_LIST_FILTER.ALL)}
              className={loanFilterButtonClass(loanLinkFilter === LOAN_LINK_LIST_FILTER.ALL)}
            >
              Todos ({allLoans.length})
            </button>
            <button
              type="button"
              onClick={() => setLoanLinkFilter(LOAN_LINK_LIST_FILTER.LINKED)}
              className={loanFilterButtonClass(loanLinkFilter === LOAN_LINK_LIST_FILTER.LINKED)}
            >
              Com anotação ({linkedLoanCount})
            </button>
            <button
              type="button"
              onClick={() => setLoanLinkFilter(LOAN_LINK_LIST_FILTER.UNLINKED)}
              className={loanFilterButtonClass(loanLinkFilter === LOAN_LINK_LIST_FILTER.UNLINKED)}
            >
              Sem anotação ({unlinkedLoanCount})
            </button>
          </div>
        </div>
      )}

      {/* Lista de contratos (filtrada só na tela) */}
      <div className="space-y-4">
        {allLoans.length > 0 &&
        visibleLoans.length === 0 &&
        loanLinkFilter !== LOAN_LINK_LIST_FILTER.ALL ? (
          <div
            className="rounded-design-lg border border-dashed border-edge bg-surface-muted/30 p-6 text-center"
            role="status"
          >
            <p className="text-sm text-content-muted">
              Nenhum contrato corresponde a este filtro.
            </p>
            <button
              type="button"
              onClick={() => setLoanLinkFilter(LOAN_LINK_LIST_FILTER.ALL)}
              className="mt-3 min-h-10 cursor-pointer text-sm font-semibold text-info underline decoration-info/30 underline-offset-2 transition-colors hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
            >
              Ver todos os contratos
            </button>
          </div>
        ) : (
          visibleLoans.map((loan) => {
            const loanRateDisplay = formatRate(loan.interestRate != null ? loan.interestRate : 10);

            return (
              <div
                key={loan.id}
                className={`overflow-hidden rounded-design-lg border bg-surface shadow-design-sm ${
                  loan.isPaidOff ? 'border-success/40 opacity-80' : 'border-edge'
                }`}
              >
              {/* Cabeçalho: edição / exclusão / normal */}
              {editingLoan && editingLoan.id === loan.id ? (
                <form
                  onSubmit={handleSaveEditLoan}
                  className="animate-fade-in border-b border-edge bg-surface-muted p-4"
                >
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">
                    Editando contrato
                  </p>

                  <div className="mb-3 space-y-2">
                    <div className="flex gap-2">
                      <div className="min-w-0 w-[38%] space-y-1">
                        <p className="text-xs font-medium text-content-muted">Data</p>
                        <input
                          type="date"
                          required
                          value={editingLoan.date}
                          onChange={(e) => setEditingLoan({ ...editingLoan, date: e.target.value })}
                          className="min-h-10 w-full rounded-design-md border border-edge bg-surface px-2 py-2 text-sm text-content shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-xs font-medium text-content-muted">Valor (R$)</p>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={editingLoan.amount}
                          onChange={(e) => setEditingLoan({ ...editingLoan, amount: e.target.value })}
                          className="min-h-10 w-full rounded-design-md border border-edge bg-surface px-3 py-2 text-sm tabular-nums text-content shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-content-muted">Taxa (%)</p>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        required
                        value={editingLoan.interestRate}
                        onChange={(e) =>
                          setEditingLoan({ ...editingLoan, interestRate: e.target.value })
                        }
                        className="min-h-10 w-16 rounded-design-md border border-edge bg-surface px-2 py-2 text-center text-sm font-semibold tabular-nums text-content shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingLoan(null)}
                      className="flex min-h-10 flex-1 items-center justify-center rounded-design-md border border-edge bg-surface px-2 text-xs font-semibold text-content transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex min-h-10 flex-1 items-center justify-center rounded-design-md bg-primary px-2 text-xs font-semibold text-content-inverse shadow-design-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                    >
                      Salvar
                    </button>
                  </div>
                </form>
              ) : confirmDeleteLoanId === loan.id ? (
                <div className="animate-fade-in border-b border-edge bg-danger-soft p-4 text-center">
                  <p className="mb-3 text-sm font-semibold leading-snug text-danger">
                    Apagar contrato inteiro?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteLoanId(null)}
                      className="flex min-h-[44px] flex-1 items-center justify-center rounded-design-md border border-edge bg-surface px-2 text-sm font-semibold text-content transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => executeDeleteLoan(loan.id)}
                      className="flex min-h-[44px] flex-1 items-center justify-center rounded-design-md bg-danger px-2 text-sm font-semibold text-content-inverse shadow-design-sm transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                    >
                      Sim, Apagar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3 border-b border-edge bg-surface-muted p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-content-muted">{formatDate(loan.date)}</p>
                    <p className="text-lg font-semibold tabular-nums tracking-tight text-content">
                      {displayMoney(loan.amount)}
                    </p>
                    <p className="mt-0.5 text-xs text-content-muted">Taxa {loanRateDisplay}</p>
                    {loan.linkContext && (
                      <p
                        className="mt-1.5 line-clamp-2 text-xs text-info"
                        title="Anotação local do contrato; não indica situação de pagamento"
                      >
                        Contrato anotado: {formatLocalVinculoLineFromContext(loan.linkContext)}
                      </p>
                    )}
                    {!loan.isPaidOff && (
                      <div className="mt-2">
                        {loan.isLoanOK ? (
                          <span className="inline-flex max-w-full items-center rounded-design-sm bg-success-soft px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-success">
                            OK ({loan.loanDisplayMonthStr}) ✅
                          </span>
                        ) : (
                          <span className="inline-flex max-w-full items-center rounded-design-sm bg-danger-soft px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-danger">
                            FALTA {loan.loanDisplayMonthStr}
                          </span>
                        )}
                      </div>
                    )}

                    {(() => {
                      const { canAdd, canRemove } = getLoanLinkContextActionState(
                        loan,
                        clientData.linkContext
                      );
                      const showBlock =
                        canAdd || canRemove || confirmRemoveLoanLinkContextId === loan.id;
                      if (!showBlock) return null;

                      if (confirmRemoveLoanLinkContextId === loan.id) {
                        return (
                          <div className="mt-2 rounded-design-md border border-edge bg-surface/90 p-2.5">
                            <p className="text-xs leading-relaxed text-content-muted">
                              Remover a anotação local deste contrato? Valores, saldo e pagamentos não
                              mudam; a alteração fica neste aparelho.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setConfirmRemoveLoanLinkContextId(null)}
                                className="min-h-10 min-w-[5rem] rounded-design-md border border-edge bg-surface px-2 text-xs font-semibold text-content transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => executeRemoveLoanLinkContext(loan.id)}
                                className="min-h-10 min-w-[5rem] rounded-design-md border border-info/30 bg-info-soft/40 px-2 text-xs font-semibold text-content transition-colors hover:bg-info-soft/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
                          {canAdd && (
                            <button
                              type="button"
                              onClick={() => handleAnnotateLoanWithClientContext(loan.id)}
                              className="min-h-10 w-full text-left text-xs font-semibold text-info underline decoration-info/30 underline-offset-2 transition-colors hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring sm:min-w-0 sm:w-auto"
                            >
                              Anotar com o vínculo atual do cliente
                            </button>
                          )}
                          {canRemove && (
                            <button
                              type="button"
                              onClick={() => setConfirmRemoveLoanLinkContextId(loan.id)}
                              className="min-h-10 w-full text-left text-xs font-semibold text-content-muted underline decoration-content-muted/40 underline-offset-2 transition-colors hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring sm:min-w-0 sm:w-auto"
                            >
                              Remover anotação
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex shrink-0 gap-2 text-content-muted">
                    <button
                      type="button"
                      aria-label="Editar contrato"
                      onClick={() => {
                        setConfirmRemoveLoanLinkContextId(null);
                        setEditingLoan({
                          id: loan.id,
                          date: loan.date,
                          amount: loan.amount,
                          interestRate: loan.interestRate != null ? loan.interestRate : 10,
                        });
                      }}
                      className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-design-md text-content-muted transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                    >
                      <IconEdit />
                    </button>
                    <button
                      type="button"
                      aria-label="Excluir contrato"
                      onClick={() => handleDeleteLoanClick(loan.id)}
                      className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-design-md text-content-muted transition-colors hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                    >
                      <IconDelete />
                    </button>
                  </div>
                </div>
              )}

              {/* Corpo do contrato */}
              <div className="p-4">
                {loan.isPaidOff ? (
                  <div className="rounded-design-md border border-success/40 bg-success-soft py-2 text-center text-sm font-semibold text-success">
                    ✅ Contrato Quitado!
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-content-muted">
                          Saldo Devedor (Principal):
                        </p>
                        <p className="text-xl font-bold tabular-nums text-danger">
                          {displayMoney(loan.currentPrincipal)}
                        </p>
                      </div>
                    <button
                      type="button"
                      onClick={() => setPayingLoanId(loan.id)}
                      className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-design-md border border-edge bg-success-soft px-4 text-sm font-semibold text-success shadow-design-sm transition-opacity hover:opacity-90 active:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                    >
                      + Pagar Este
                    </button>
                    </div>

                    <div className="mb-4 flex items-center justify-between gap-3 rounded-design-md border border-edge bg-warning-soft px-3 py-2">
                      <div>
                        <p className="text-xs text-content-muted">Juros ({loanRateDisplay})</p>
                        <p className="text-sm font-semibold tabular-nums text-content">
                          {displayMoney(loan.baseInterest)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-content-muted">Quitação</p>
                        <p className="text-sm font-semibold tabular-nums text-content">
                          {displayMoney(loan.currentPrincipal + loan.baseInterest)}
                        </p>
                      </div>
                    </div>

                    {/* Formulário de pagamento */}
                    {payingLoanId === loan.id && (
                      <form
                        onSubmit={handleAddPayment}
                        className="relative z-10 mb-4 animate-fade-in rounded-design-lg border border-edge bg-surface p-4 shadow-design-sm"
                      >
                        <p className="mb-3 text-sm font-semibold text-content">Novo Pagamento</p>
                        <div className="mb-3 flex gap-2">
                          <div className="w-[38%] min-w-0 space-y-1">
                            <p className="text-xs font-medium text-content-muted">Data</p>
                            <input
                              type="date"
                              value={paymentDate}
                              onChange={(e) => setPaymentDate(e.target.value)}
                              required
                              className="min-h-10 w-full rounded-design-md border border-edge bg-surface-muted px-2 py-2 text-sm text-content shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                            />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-xs font-medium text-content-muted">Valor (R$)</p>
                            <input
                              type="number"
                              step="0.01"
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              placeholder="Valor (R$)"
                              required
                              className="min-h-10 w-full rounded-design-md border border-edge bg-surface-muted px-3 py-2 text-sm tabular-nums text-content placeholder:text-content-muted shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setPayingLoanId(null)}
                            className="flex min-h-10 flex-1 items-center justify-center rounded-design-md border border-edge bg-surface px-2 text-sm font-semibold text-content transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            className="flex min-h-10 flex-1 items-center justify-center rounded-design-md bg-success px-2 text-sm font-semibold text-content-inverse shadow-design-sm transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                          >
                            Confirmar
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}

                {/* Lista de pagamentos */}
                {loan.processedPayments.length > 0 && (
                  <div className="mt-4 border-t border-edge pt-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-content-muted">
                      Pagamentos:
                    </p>
                    <div className="space-y-2">
                      {[...loan.processedPayments].reverse().map((p) => (
                        <div
                          key={p.id}
                          className="rounded-design-md border border-edge bg-surface-muted p-3 shadow-design-sm"
                        >
                          {editingPayment && editingPayment.id === p.id ? (
                            <form
                              onSubmit={handleSaveEditPayment}
                              className="animate-fade-in rounded-design-md border border-edge bg-surface p-3 shadow-design-sm"
                            >
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                                Editar pagamento
                              </p>
                              <div className="mb-3 flex gap-2">
                                <div className="w-[38%] min-w-0 space-y-1">
                                  <p className="text-xs font-medium text-content-muted">Data</p>
                                  <input
                                    type="date"
                                    required
                                    value={editingPayment.date}
                                    onChange={(e) =>
                                      setEditingPayment({ ...editingPayment, date: e.target.value })
                                    }
                                    className="min-h-10 w-full rounded-design-md border border-edge bg-surface-muted px-2 py-2 text-sm text-content shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                                  />
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                  <p className="text-xs font-medium text-content-muted">Valor (R$)</p>
                                  <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={editingPayment.amount}
                                    onChange={(e) =>
                                      setEditingPayment({ ...editingPayment, amount: e.target.value })
                                    }
                                    className="min-h-10 w-full rounded-design-md border border-edge bg-surface-muted px-2 py-2 text-sm tabular-nums text-content shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingPayment(null)}
                                  className="flex min-h-10 flex-1 items-center justify-center rounded-design-md border border-edge bg-surface px-2 text-xs font-semibold text-content transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="submit"
                                  className="flex min-h-10 flex-1 items-center justify-center rounded-design-md bg-primary px-2 text-xs font-semibold text-content-inverse shadow-design-sm transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                                >
                                  Salvar
                                </button>
                              </div>
                            </form>
                          ) : confirmDeletePaymentId?.id === p.id ? (
                            <div className="animate-fade-in flex flex-col gap-3 rounded-design-md border border-edge bg-danger-soft p-3">
                              <p className="text-center text-sm font-semibold leading-snug text-danger">
                                Apagar pagamento?
                              </p>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePaymentId(null)}
                                  className="flex min-h-[44px] flex-1 items-center justify-center rounded-design-md border border-edge bg-surface px-2 text-sm font-semibold text-content transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={executeDeletePayment}
                                  className="flex min-h-[44px] flex-1 items-center justify-center rounded-design-md bg-danger px-2 text-sm font-semibold text-content-inverse shadow-design-sm transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                                >
                                  Apagar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                  <span className="inline-flex items-center gap-1.5">
                                    <span
                                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-success"
                                      aria-hidden
                                    />
                                    <span className="text-sm font-semibold tabular-nums text-content">
                                      {displayMoney(p.amount)}
                                    </span>
                                  </span>
                                  <span className="text-xs text-content-muted">
                                    {formatDate(p.date)}
                                  </span>
                                </div>
                                <p className="text-xs leading-relaxed text-content-muted">
                                  Juros: {displayMoney(p.interestPaid)} | Abateu:{' '}
                                  {displayMoney(p.amortized)}
                                </p>
                              </div>
                              <div className="flex shrink-0 gap-1">
                                <button
                                  type="button"
                                  aria-label="Editar pagamento"
                                  onClick={() =>
                                    setEditingPayment({
                                      loanId: loan.id,
                                      id: p.id,
                                      date: p.date,
                                      amount: p.amount,
                                    })
                                  }
                                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-design-md text-content-muted transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                                >
                                  <IconEdit />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Excluir pagamento"
                                  onClick={() => handleDeletePaymentClick(loan.id, p.id)}
                                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-design-md text-content-muted transition-colors hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                                >
                                  <IconDelete />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
        )}
        {allLoans.length === 0 && (
          <p className="py-10 text-center text-sm text-content-muted">Nenhum contrato ativo.</p>
        )}
      </div>
    </div>
  );
};

export default ClientView;

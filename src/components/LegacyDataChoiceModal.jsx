import React from 'react';

/**
 * Decisão explícita: dados locais anônimos vs conta (sem sync remoto do financeiro).
 */
function LegacyDataChoiceModal({ email, onAssociate, onKeepOnDevice }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legacy-modal-title"
    >
      <div
        className="max-w-md w-full rounded-design-lg border border-edge bg-surface p-5 shadow-design-md sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="legacy-modal-title" className="text-lg font-semibold text-content">
          Dados locais sem conta
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-content-muted">
          Há empréstimos e caixa salvos <strong>neste aparelho</strong> no modo sem conta, antes de
          você entrar como <span className="text-content font-medium tabular-nums">{email}</span>.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-content-muted">
          Esses dados financeiros não serão enviados para a internet. Escolha como eles devem ficar
          neste aparelho.
        </p>
        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={onAssociate}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-design-md bg-primary text-sm font-semibold text-content-inverse shadow-design-sm transition-colors active:opacity-90"
          >
            Associar a esta conta neste aparelho
          </button>
          <button
            type="button"
            onClick={onKeepOnDevice}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-design-md border border-edge bg-surface-muted text-sm font-semibold text-content-soft transition-colors active:bg-surface"
          >
            Manter no modo sem conta
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-content-muted">Essa definição será mantida neste aparelho.</p>
      </div>
    </div>
  );
}

export default LegacyDataChoiceModal;

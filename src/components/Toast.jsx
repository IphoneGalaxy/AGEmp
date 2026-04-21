import React from 'react';

/**
 * Componente de notificação toast.
 * Exibe uma mensagem temporária na parte inferior da tela.
 *
 * @param {{ message: string }} props
 */
const Toast = ({ message }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-10 left-1/2 z-50 -translate-x-1/2 transform whitespace-nowrap rounded-design-pill bg-content px-5 py-3 font-medium text-sm text-content-inverse shadow-design-lg toast-anim">
      {message}
    </div>
  );
};

export default Toast;

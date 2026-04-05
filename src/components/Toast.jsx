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
    <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-full shadow-2xl z-50 font-medium text-sm toast-anim whitespace-nowrap">
      {message}
    </div>
  );
};

export default Toast;

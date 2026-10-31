import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * Diálogo modal nativo. Usa `showModal()` en vez de `<dialog open>`: solo así
 * el navegador lo promueve a la capa superior y aporta backdrop, trampa de
 * foco y cierre con Escape. Con `open` declarativo el diálogo queda en el
 * flujo del documento y puede renderizarse fuera de la pantalla.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // `showModal()` lanza si el diálogo ya está abierto, cosa que ocurre con el
    // doble montaje de StrictMode.
    if (!dialog.open) dialog.showModal();

    // `close` no burbujea, así que el sistema de eventos de React no lo entrega.
    const handleClose = () => {
      onCloseRef.current();
    };
    dialog.addEventListener('close', handleClose);

    // No se llama a `close()` al limpiar: el evento que genera se entrega de
    // forma asíncrona y llegaría al oyente del siguiente montaje, cerrando el
    // diálogo recién abierto. Al desmontar de verdad, React quita el nodo y el
    // navegador lo saca de la capa superior por su cuenta.
    return () => {
      dialog.removeEventListener('close', handleClose);
    };
  }, []);

  const requestClose = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      onClick={(event) => {
        // El clic en el backdrop tiene como target el propio dialog.
        if (event.target === ref.current) requestClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          type="button"
          className="iconbutton"
          aria-label="Cerrar"
          title="Cerrar"
          onClick={requestClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from './Icon';

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="ROKAI, inicio">
      <img src="/assets/logo.webp" alt="ROKAI · Patinetas eléctricas" width={151} height={50} />
    </Link>
  );
}

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 761px)').matches,
  );
  const header = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const links = header.current?.querySelector('.navlinks');
      if (links?.contains(target) || menuButton.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && header.current?.querySelector('.navlinks.open')) {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    const media = window.matchMedia('(min-width: 761px)');
    const syncWidth = () => {
      setWide(media.matches);
      if (media.matches) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    media.addEventListener('change', syncWidth);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      media.removeEventListener('change', syncWidth);
    };
  }, []);

  function closeMenu() {
    setOpen(false);
    menuButton.current?.focus();
  }

  return (
    <header className="topbar glass-public-nav" ref={header}>
      <div className="container nav">
        <Brand />
        <a className="skip-link" href="#main">
          Saltar al contenido
        </a>
        <nav
          className={`navlinks${open ? ' open' : ''}`}
          id="public-nav-links"
          aria-label="Principal"
          aria-hidden={!wide && !open}
        >
          <a href="/#como-funciona" tabIndex={wide || open ? 0 : -1} onClick={closeMenu}>
            Cómo funciona
          </a>
          <a href="/#tarifas" tabIndex={wide || open ? 0 : -1} onClick={closeMenu}>
            Tarifas
          </a>
          <a href="/#experiencia" tabIndex={wide || open ? 0 : -1} onClick={closeMenu}>
            La experiencia
          </a>
          <a href="/#preguntas" tabIndex={wide || open ? 0 : -1} onClick={closeMenu}>
            Preguntas frecuentes
          </a>
        </nav>
        <div className="nav-actions">
          <Link className="button dark" to="/gestion">
            <Icon name="lock" />
            Acceso al equipo
          </Link>
          <button
            ref={menuButton}
            className="iconbutton mobile-menu"
            type="button"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            title={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            aria-controls="public-nav-links"
            onClick={() => {
              setOpen((v) => !v);
            }}
          >
            <Icon name={open ? 'close' : 'menu'} />
          </button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <Brand />
          <div className="footer-links">
            <Link to="/terminos">Términos y condiciones</Link>
            <Link to="/privacidad">Privacidad</Link>
            <Link to="/cookies">Cookies</Link>
            <Link to="/gestion">Acceso al equipo</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} ROKAI · Arboletes, Antioquia</span>
          <span>Movimiento que conecta con el mar.</span>
        </div>
      </div>
    </footer>
  );
}

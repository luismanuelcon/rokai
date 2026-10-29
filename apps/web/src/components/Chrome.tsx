import { useState } from 'react';
import { Link } from 'react-router';
import { Icon } from './Icon';

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="ROKAI, inicio">
      <img src="/assets/logo.png" alt="ROKAI · Patinetas eléctricas" width={151} height={50} />
    </Link>
  );
}

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="topbar">
      <div className="container nav">
        <Brand />
        <nav className={`navlinks${open ? ' open' : ''}`} aria-label="Principal">
          <a href="/#como-funciona">Cómo funciona</a>
          <a href="/#tarifas">Tarifas</a>
          <a href="/#experiencia">La experiencia</a>
          <a href="/#preguntas">Preguntas frecuentes</a>
        </nav>
        <div className="nav-actions">
          <Link className="button dark" to="/gestion">
            <Icon name="lock" />
            Acceso al equipo
          </Link>
          <button
            className="iconbutton mobile-menu"
            aria-label="Abrir menú"
            aria-expanded={open}
            onClick={() => {
              setOpen((v) => !v);
            }}
          >
            <Icon name="menu" />
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

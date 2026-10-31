import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Brand } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { useSession } from '../lib/session';

export function LoginPage() {
  const { login } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => {
      const value = form.get(key);
      return typeof value === 'string' ? value : '';
    };
    setBusy(true);
    setError('');
    try {
      await login(text('email'), text('password'));
      void navigate('/gestion');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos iniciar sesión.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="container nav">
          <Brand />
        </div>
      </header>
      <main id="main" className="auth-layout">
        <div className="auth-photo">
          <img src="/assets/scooter-coast.webp" alt="Patineta frente al mar" />
          <div className="auth-caption">
            <span className="eyebrow">El equipo detrás de cada paseo</span>
            <h2>
              Hagamos que
              <br />
              la aventura ruede.
            </h2>
            <p>Portal de gestión · ROKAI Arboletes</p>
          </div>
        </div>
        <div className="auth-main">
          <div className="auth-card">
            <div className="icon-box auth-lock">
              <span>
                <Icon name="lock" />
              </span>
            </div>
            <h1>Hola de nuevo.</h1>
            <p>Inicia sesión para registrar alquileres y gestionar los equipos de la estación.</p>
            <form onSubmit={(e) => void onSubmit(e)}>
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
              <div className="field">
                <label htmlFor="email">Correo electrónico</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="tu@correo.com"
                  required
                  maxLength={254}
                />
              </div>
              <div className="field">
                <label htmlFor="password">Contraseña</label>
                <div className="password-wrap">
                  <input
                    id="password"
                    name="password"
                    type={reveal ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Tu contraseña"
                    required
                    maxLength={256}
                  />
                  <button
                    type="button"
                    className="iconbutton"
                    aria-label={reveal ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    title={reveal ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => {
                      setReveal((v) => !v);
                    }}
                  >
                    <Icon name="eye" />
                  </button>
                </div>
              </div>
              <button className="button dark" type="submit" disabled={busy}>
                {busy ? 'Entrando…' : 'Iniciar sesión'} <Icon name="arrow" />
              </button>
            </form>
            <p className="auth-footer">
              Acceso exclusivo para personal autorizado.
              <br />
              Solicita tu cuenta al administrador de ROKAI.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

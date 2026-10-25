# ROKAI — primera versión

Aplicación web responsive con portal público y gestión privada, implementada a partir de `docs/PRD.md`, los dos documentos de diseño, logos, paleta, tabla de precios y mockup proporcionados. El PRD tiene prioridad sobre reglas no confirmadas del mockup.

## Ejecutar

Requiere **Node.js 24 o superior** con `node:sqlite`. No necesita instalar dependencias.

```sh
npm start
```

Abre http://127.0.0.1:3000. `npm run dev` reinicia el servidor al editar archivos; recarga el navegador para los cambios de interfaz.

La base SQLite se crea en `data/rokai.sqlite` y conserva usuarios, sesiones, alquileres, equipos, tarifas y trazabilidad. La carpeta está excluida de Git. Los recursos visuales y la tipografía se sirven localmente.

## Acceso

No existen cuentas públicas ni contraseñas predeterminadas en el código. Se creó una cuenta local para la entrega, cuyas credenciales se compartieron en el chat. Para crear otras desde consola:

```sh
read -s 'ROKAI_PASSWORD?Contraseña (12 caracteres como mínimo): '
export ROKAI_PASSWORD
npm run create-user -- admin@tu-dominio.com "Administrador" admin
unset ROKAI_PASSWORD
```

El comando `read` anterior corresponde a zsh. Roles admitidos: `admin`, `worker` y `operator`. El administrador también puede crear y desactivar usuarios desde la interfaz. No hay recuperación por correo ni cambio de contraseña en esta versión.

## Funciones

- Portal público: planes individuales y para parejas, preguntas frecuentes, documentos legales, contacto, horario y preferencias de cookies.
- Instagram: **@roaki_patinetas**. Correo: **rokai.pat@gmail.com**. Ambos editables desde Administración.
- WhatsApp: **+57 310 681 7317**. Horario: **8:00 a. m. a 10:00 p. m.**
- Login obligatorio para registrar alquileres; no existe autoservicio de clientes.
- Roles y autorización en servidor. Sesiones de ocho horas con cookies HttpOnly, SameSite y protección CSRF; contraseñas con scrypt y salt aleatorio; límite de intentos.
- Registro con nombre, documento, teléfono opcional, tarifa vigente, patinetas, cascos y novedades.
- Tarifas y tiempos calculados por el servidor; no se aceptan precios enviados por el cliente.
- Exclusión transaccional de equipos en uso y de mantenimiento. Reintentos de registro idempotentes.
- Borrador privado en servidor, guardado con 600 ms de espera tras cambios. Recuperable desde «Registrar alquiler» al recargar. No se guarda información del cliente en localStorage. Reintento al recuperar conexión; sin conexión hay que mantener abierta la página. El cierre de sesión elimina el borrador.
- Devolución con fecha, responsable y novedades. Valor final igual al contratado; no se inventan recargos.
- Historial sin opción de borrado, trazabilidad y reportes de valores contratados/finalizados (no de pagos cobrados).
- Administración de precios, fechas de vigencia, publicación de FAQ, personal, estado de equipos, información y textos legales.
- Cookies: aceptar, rechazar y configurar; preferencias locales persistentes. No se cargan rastreadores analíticos o publicitarios.

## Decisiones y pendientes de negocio

- Los importes iniciales son los de la tabla de precios suministrada. Los períodos se seleccionan explícitamente; no se ha inventado un calendario de festivos ni una tarifa para los lunes.
- Se incluyen cuatro patinetas y cuatro cascos iniciales como inventario configurable, siguiendo las cuatro unidades del mockup. Verificar los códigos físicos antes de operar.
- Nombre/documento obligatorios y teléfono opcional son una elección provisional; el PRD no fija el conjunto definitivo de datos.
- No se implementaron reservas, pagos en línea, telemetría ficticia, firma contractual, depósitos o recargos. El PRD los excluye o deja pendientes.
- Las páginas legales están disponibles, pero los términos y privacidad iniciales **no son documentos legales finales**: muestran el estado pendiente y se pueden reemplazar desde Administración. Definir responsable de datos, canales y retención, edad mínima, daños, lluvia, pagos, garantías y tiempo adicional antes de operar con clientes reales.
- El mapa es una ilustración orientativa con enlace a Google Maps, no una ubicación GPS validada. La fotografía se reutiliza del mockup; resolución original 512 × 286.

## Pruebas

```sh
npm test
```

Diez pruebas de integración con base temporal aislada: acceso público/privado, autenticación, CSRF/origen, roles, borradores aislados, ciclo de alquiler, concurrencia de asignación, idempotencia, precio histórico, vigencia de tarifas, parejas, mantenimiento, publicación de FAQ, revocación de sesiones y persistencia. La suite abre un puerto local temporal.

## Configuración y despliegue

| Variable | Predeterminado | Uso |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `HOST` | `127.0.0.1` | Interfaz de escucha |
| `DB_PATH` | `data/rokai.sqlite` | Ruta de SQLite |
| `APP_ORIGIN` | Origen HTTP del host recibido | Origen externo exacto, por ejemplo `https://rokai.example` |
| `COOKIE_SECURE` | desactivado para localhost | Usar `1` detrás de HTTPS |

La entrega funciona **localmente**, sin publicación en Internet. Para desplegar, usar un proceso supervisado detrás de un proxy HTTPS, `APP_ORIGIN` exacto y `COOKIE_SECURE=1`, almacenamiento persistente privado y copias de seguridad de SQLite. El servidor HTTP nativo es suficiente para revisar y validar el MVP local; infraestructura, monitoreo y políticas de datos deben prepararse para producción. Esta versión usa una base única en una sola instancia; no configura escalado distribuido.

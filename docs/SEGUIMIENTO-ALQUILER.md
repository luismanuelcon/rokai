# Seguimiento público del alquiler

Cada alquiler nuevo recibe un token aleatorio de 256 bits en la misma transacción. Los reintentos del mismo requestId reutilizan alquiler y enlace, incluso en concurrencia. Los alquileres anteriores reciben enlace al solicitar «Compartir seguimiento».

## Base de datos

Aplicar `npm run db:migrate` con la conexión del entorno antes de arrancar la nueva versión. La migración `0006_futuristic_corsair.sql` crea rental_tracking, con un registro por alquiler, token único y revocación. No modifica datos de clientes ni firmas. No se ha aplicado a producción desde esta tarea.

## Rutas

- Página pública: `/alquiler/seguimiento/:token`.
- Consulta anónima: `GET /api/v1/tracking/:token`.
- Recuperar enlace, con sesión: `GET /api/v1/rentals/:id/tracking`.
- Revocar, solo administrador con CSRF: `POST /api/v1/admin/rentals/:id/tracking/revoke`.

El enlace permanece disponible al cerrar el alquiler, mostrando 00:00. No caduca automáticamente. Revocarlo devuelve el mismo mensaje que un enlace inexistente y no genera uno nuevo. Eliminar el alquiler elimina su enlace por cascada.

## Privacidad y reloj

El contrato público enumera exclusivamente estado, horas, duración, segundos restantes, cantidad de patinetas y WhatsApp comercial. No incluye nombres, teléfono del cliente, documentos, pagos, firma ni IDs internos. El endpoint tiene límite de 60 consultas/minuto por IP, no-store y noindex. Los logs de la aplicación redactan los tokens; configurar también la redacción de estas rutas en cualquier proxy o servicio externo de observabilidad.

El contador usa la hora del servidor y performance.now, se actualiza cada segundo y consulta cambios cada 15 segundos o al volver a la pestaña. Muestra horas de Colombia. La aplicación actual no ofrece ampliación o cancelación de alquileres; si cambia dueAt en el servidor, el siguiente refresco lo refleja. El cierre existente sí está integrado.

## Verificación

Pruebas unitarias de tokens, reloj y redacción; integración con autenticación real y PostgreSQL aislado mediante PGlite: creación concurrente/idempotente, privacidad, modificación de vencimiento, cierre, permisos y revocación. La suite de integración principal requiere su propia base PostgreSQL de pruebas, nunca producción. Revisión en Chrome a 375, 768 y 1440 px, sin desbordamiento; consulta anónima y cuenta regresiva con Date.now del dispositivo alterado.

## Preparación configurable

Administración → Configuración del negocio → Minutos de preparación. Valor predeterminado: 1; rango 0–30 minutos enteros, 0 desactiva. Se fija al crear cada alquiler y los cambios de configuración no alteran los ya registrados. La migración 0007 agrega preparation_minutes con valor 0 para alquileres anteriores. startedAt conserva la entrega real y dueAt incluye preparación más duración contratada. El cliente ve un aviso y cuenta regresiva de preparación; el contador total incluye la cortesía. El cierre durante la preparación sigue permitido y las notificaciones y recargos respetan el nuevo vencimiento.

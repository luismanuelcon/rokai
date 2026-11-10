# Reservas y alquileres de 1 a 4 patinetas

Implementación sobre la aplicación V2: React (`apps/web`), Fastify (`apps/api`), contratos Zod compartidos y PostgreSQL/Drizzle. El servidor SQLite y los recursos de la versión legacy no son el flujo de reservas actual y no se modificaron.

## Comportamiento

- Cantidades enteras de 1 a 4. Una patineta y un casco identificados por persona; hasta ocho equipos en alquileres y borradores.
- Las tarifas configuradas siguen siendo individuales y de pareja. `quoteGroupRate` calcula `floor(cantidad / 2) × pareja + (cantidad % 2) × individual`. No inserta tarifas ni cambia valores del catálogo.
- Reservas: se seleccionan tarifas activas vigentes en la fecha y categoría correspondiente, incluidos festivos. Administración conserva la selección explícita de categoría existente y filtra por vigencia actual. Cada componente comercial comparte duración y categoría.
- Si falta la tarifa individual necesaria para tres personas, ese plan no se publica y el servidor rechaza el alta. Cuatro personas solo requieren la tarifa de pareja.
- El servidor calcula el importe. Un grupo produce una reserva y un alquiler, nunca registros separados por cada pareja.
- La reserva guarda cantidad, duración, categoría, importe y etiqueta descriptiva. WhatsApp incluye código, cantidad, desglose, fecha, horario y total. El alta sigue pendiente de WhatsApp y se conserva el pago en estación.
- La conversión conserva el snapshot aunque la tarifa cambie o se desactive, así como idempotencia, firma, preparación, cronómetros, seguimiento, devolución y recargos existentes.
- Reservas históricas sin referencia de tarifa pueden elegir una vigente compatible de igual duración/categoría, conservando el importe original. Si no existe, se muestra un error y no se registra. Para evitar nuevas referencias huérfanas, una tarifa utilizada por una reserva solo puede desactivarse.

## Disponibilidad y concurrencia

Se reutiliza el pico de ocupación durante todo el intervalo y la capacidad mínima entre patinetas y cascos habilitados. Las reservas pendientes/confirmadas ocupan cupo; las reservas en alquiler se cuentan mediante el alquiler vinculado.

Altas públicas, altas de alquiler y confirmaciones usan el mismo bloqueo transaccional PostgreSQL `reservations:capacity`. Los cambios de estado del equipo y el borrado de tarifas también se coordinan con ese bloqueo. La asignación física mantiene sus bloqueos de fila y vuelve a comprobar estado y uso del equipo.

Al confirmar o convertir se excluye únicamente la reserva propia. El intervalo del alquiler incluye su preparación. La confirmación vuelve a validar el cupo: por ejemplo, si después de reservar un equipo entra en mantenimiento, no confirma una operación sin capacidad.

No se introduce una nueva política de vencimiento: el sistema existente no tenía TTL de WhatsApp; las reservas pendientes mantienen su intervalo bloqueado hasta el cambio de estado y dejan de afectar horarios no solapados.

## Interfaz ejecutada por Lucho (UX Pro Max)

- Selectores de 1–4 accesibles mediante radios nativos, foco visible y teclado.
- Total y desglose en formulario público, confirmación, creación de alquiler, reservas administrativas y detalle de alquiler.
- Limpieza de cotizaciones obsoletas durante consultas y bloqueo de envío mientras se actualiza disponibilidad. Se conserva la duración preferida cuando cambia el identificador de tarifa.
- Selección/asignación ajustada a la cantidad, persistencia de borradores y mensajes de falta de tarifa o equipos.
- Dos columnas de selección, textos adaptables y total separado del selector administrativo para evitar recortes móviles.

No existe edición de cantidad/plan de un alquiler iniciado en V2: se conserva esa restricción. Se adaptaron el borrador editable, el alta, el detalle y la devolución existentes. Los reportes, historial y exportación ya usan importes guardados y listas completas de equipos; no requieren dividir ni recalcular registros.

## Archivos principales

- `packages/contracts/src/pricing.ts`: cotización y desglose compartidos.
- `packages/contracts/src/{rentals,reservations,index}.ts`: cantidades, equipos, borrador y exportaciones.
- `apps/api/src/services/{rentals,reservations}.ts`: cotización, snapshots, ocupación y exclusión propia.
- `apps/api/src/routes/{reservations,admin}.ts`: confirmación, coordinación de equipos y protección de tarifas referenciadas.
- `packages/db/src/schema.ts` y migración `0011_true_justin_hammer.sql` con sus metadatos.
- `apps/web/src/pages/ReservationPage.tsx`, `pages/management/{NewRental,Reservations,RentalTable}.tsx` y `styles/reservations.css`.
- `apps/api/src/domain/pricing.test.ts`, `apps/api/src/app.test.ts` y `apps/api/package.json`.
- Artefactos `dist` regenerados siguiendo el repositorio, que los mantiene versionados.

## Migración y despliegue

`0011_true_justin_hammer.sql` sustituye exclusivamente la restricción `reservations_quantity_chk` de 1–2 por 1–4. El catálogo sigue limitado a tarifas de 1–2. No actualiza filas, precios ni operaciones históricas.

Aplicar con `npm run db:migrate` sobre la base del entorno antes de activar la nueva versión. Esta entrega no se desplegó ni migró una base del negocio.

## Verificación

- `npm run build`, `npm run typecheck` y `npm run lint`.
- `DATABASE_URL=<PostgreSQL de pruebas> npm test`: 44 pruebas unitarias e integración. Se corrigió el patrón de archivos para incluir `app.test.js` en el comando estándar, antes omitido por expansión del shell.
- Cobertura nueva: cantidades 1–4, duraciones/categorías, parejas no equivalentes a dos individuales, tarifas faltantes, validación, equipos duplicados/ocupados, concurrencia en reservas y alquileres, reservas durante el intervalo de un alquiler, confirmación con mantenimiento, snapshot con tarifa modificada/desactivada, conversión histórica sin referencia e idempotencia.
- Se actualizaron tres expectativas/fixtures antiguos: el vencimiento incluye preparación y las comprobaciones de permisos utilizan una sesión de colaborador vigente.
- PostgreSQL temporal aislado: migraciones desde cero y prueba incremental de 0010 a 0011 con filas históricas idénticas antes/después y altas de 3/4 aceptadas. La base de esta verificación incremental fue eliminada al terminar.
- Revisión visual de Lucho con Chrome: móvil 375/390 px, tablet 768 px y escritorio 1440 px; sin desbordamiento horizontal y navegación de radios con teclado. Usó fixtures temporales retiradas al finalizar; la integración real se verificó por HTTP/Fastify contra PostgreSQL. No se enviaron mensajes reales de WhatsApp.

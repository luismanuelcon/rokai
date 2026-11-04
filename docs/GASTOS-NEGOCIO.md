# Gastos del negocio

En Reportes, el registro unificado muestra gastos adicionales y gastos capturados en cierres. Los gastos del cierre se consultan directamente desde sus partidas JSON: no se duplican ni migran a otra tabla. Corregirlos se hace en el cierre original.

## Balance

Por intervalo de fechas (inclusivo, fecha comercial de Colombia):

- Ingresos = efectivo + transferencias declarados en los cierres.
- Gastos = partidas de cierres + gastos adicionales no anulados.
- Saldo = ingresos - gastos; puede ser negativo.

Los filtros de categoría, medio de pago y estado solo limitan el historial. El balance y las gráficas siempre incluyen todos los movimientos vigentes del intervalo de fechas, no solamente la página visible. Los cierres previos no se reescriben al agregar, editar o anular gastos adicionales. Los alquileres no cerrados no son ingresos confirmados del balance.

Los gastos antiguos de cierres aparecen con categoría «Gasto del cierre» y medio de pago desconocido: no se infiere efectivo/transferencia a partir del ingreso del día. Se pueden registrar gastos adicionales sin que exista cierre en esa fecha. No volver a registrar como adicional una partida ya incluida en un cierre.

## Seguridad y persistencia

Todas las rutas exigen administrador; las escrituras mantienen la protección CSRF existente. Creación con requestId UUID e idempotencia transaccional; edición y anulación con versión y bloqueo de fila. La anulación requiere motivo de 10–1000 caracteres y no permite editar después. Auditoría de creación, edición y anulación con actor, fecha y datos anteriores/posteriores. No existe borrado físico de gastos.

Los importes se guardan en centavos enteros, con valores positivos de pesos completos y máximo 10.000.000 COP por gasto. El formulario aplica puntos de miles automáticamente. Beneficiario y enlace HTTPS del comprobante son opcionales; esta versión no almacena archivos adjuntos.

Migración: `0008_amused_wasp.sql` crea business_expenses. Aplicar `npm run db:migrate` antes de ejecutar la nueva API. Los registros previos de cierres permanecen intactos.

## API

- GET `/api/v1/admin/business-expenses`: from, to, category, paymentMethod, status, page. Paginación SQL de 25 filas; balance y agregados calculados sobre todos los resultados del período, con una instantánea consistente de la base.
- POST en la misma ruta: registra un gasto adicional.
- PUT `/:id`: edita un gasto vigente con version.
- POST `/:id/void`: anula con version y reason.

## Pruebas

Integración aislada con PostgreSQL/PGlite y autenticación real: permisos, idempotencia concurrente, validación COP, totales combinados sin duplicar cierres, filtros, paginación, corrección del cierre, conflicto de edición, anulación auditada y saldo negativo en día sin actividad. El escenario principal también queda en apps/api/src/app.test.ts para la base PostgreSQL de pruebas.

## Vista resumida e historial

Reportes muestra por defecto los cinco gastos y cinco cierres más recientes, sin filtros ni paginación. El botón con ojo abre el historial de cada sección con filtros, navegación y gráficas. Volver a la vista resumida limpia los filtros y vuelve a la primera página. Los totales acumulados no se limitan a los cinco registros visibles.

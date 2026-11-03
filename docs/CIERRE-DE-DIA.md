# Cierre de día

En Reportes, solo administradores pueden crear, consultar y editar cierres. Cada fecha tiene un único registro, garantizado por un índice único en PostgreSQL. No hay plazo de vigencia ni obligación de registrar días sin operación.

Se declaran efectivo y transferencias recibidas, horario local del negocio (America/Bogota), gastos con descripción e importe y notas opcionales. Los importes se guardan en centavos; el formulario usa COP. El neto es efectivo + transferencias − gastos, no un saldo contable de caja. No se modifica ni se deduce automáticamente el valor de los alquileres.

Si la jornada termina después de medianoche, marcar «Cierra al día siguiente». La fecha identifica el día de apertura y no cambia al editar; el horario admite jornadas de hasta 24 horas. Los ingresos pueden ser cero, los gastos son opcionales, y el neto puede ser negativo.

Cada edición incrementa una versión y queda en auditoría con valores anteriores y posteriores. Una edición desactualizada se rechaza para impedir sobrescrituras. La auditoría registra al administrador; no se ofrece eliminación de cierres.

## API y despliegue

- GET /api/v1/admin/day-closings
- POST /api/v1/admin/day-closings
- PUT /api/v1/admin/day-closings/:date (requiere version)

Aplicar la migración 0005_thin_wendell_vaughn antes de servir el código actualizado. El contenedor existente ejecuta el migrador al arrancar. No ejecutar seed/reset manualmente sobre datos de producción para habilitar esta función.

Pruebas: contrato en apps/api/src/domain/dayClosings.test.ts y permisos/unicidad/edición/auditoría en apps/api/src/app.test.ts. La suite de integración existente necesita PostgreSQL de pruebas y reinicia su esquema; nunca usar una conexión de producción.

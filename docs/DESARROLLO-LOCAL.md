# Entorno de desarrollo local

El proyecto usa PostgreSQL local para que las mejoras se puedan probar con datos persistentes sin tocar producción.

## Preparar el entorno

1. Inicia PostgreSQL: `./scripts/pg.ps1 start`.
2. Ejecuta `npm run db:demo`.
3. Inicia la aplicación con `npm run dev` y abre `http://127.0.0.1:3000`.

El comando aplica migraciones y carga el catálogo si aún no existe. Luego crea o actualiza estas cuentas de demostración:

- Administrador: `admin@rokai.test`
- Operador: `operador@rokai.test`
- Contraseña para ambas: `RokaiLocal-2026!`

También deja un alquiler ficticio activo y vencido hace cinco minutos, con una patineta y un casco. Si se cierra, al volver a ejecutar `npm run db:demo` se crea otro alquiler de muestra. El recargo permanece en cero por defecto; se puede cambiar desde Administración para probar la vista previa y el cálculo.

El seeder está limitado a `NODE_ENV=development`, loopback y la base llamada `rokai_dev`; falla si detecta otro destino. No borra la base ni los datos existentes. Cada ejecución restablece la contraseña de las dos cuentas de demostración.

La base de pruebas automatizadas es `rokai_test`, separada de `rokai_dev`; `npm test` reconstruye esa base antes de ejecutar la suite.

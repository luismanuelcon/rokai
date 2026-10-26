import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase, createPool, migrationsFolder } from './index.js';
const url = process.env.DATABASE_URL;
if (!url) {
    console.error('DATABASE_URL no está definida. Copia .env.example a .env en la raíz.');
    process.exit(1);
}
const pool = createPool(url);
try {
    await migrate(createDatabase(pool), { migrationsFolder });
    console.log('Migraciones aplicadas.');
}
finally {
    await pool.end();
}
//# sourceMappingURL=migrate.js.map
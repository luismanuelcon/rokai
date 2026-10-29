import { createDatabase, createPool } from '@rokai/db';
export function connect(connectionString) {
    const pool = createPool(connectionString);
    return { db: createDatabase(pool), pool };
}
//# sourceMappingURL=db.js.map
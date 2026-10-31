import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '**/dist/**',
      '**/drizzle/**',
      // MVP heredado: se retira en la fase de corte, no se somete a las reglas nuevas.
      'server.mjs',
      'public/**',
      'tests/**',
      'mockups/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // Los archivos de configuración viven fuera del rootDir de compilación.
        projectService: {
          allowDefaultProject: ['packages/db/drizzle.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Los hooks y decoradores de Fastify deben devolver una promesa aunque no
    // tengan await: uno síncrono que no llama a `done` cuelga la petición.
    files: ['apps/api/src/plugins/**/*.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    // Las reglas de tipos no aplican a los archivos de configuración en JS.
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // Utilidades de línea de comandos: corren en Node, no en el navegador.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly' } },
  },
  {
    // Las pruebas inspeccionan respuestas HTTP sin tipar: verifican el contrato
    // observable, no las estructuras internas.
    files: ['**/*.test.ts'],
    rules: {
      // node:test devuelve promesas que no se esperan a nivel de módulo.
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
);

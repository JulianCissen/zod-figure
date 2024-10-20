import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'], // Adjust the input file path as needed
    format: ['cjs', 'esm'], // Output both CommonJS and ES Module formats
    dts: true, // Generate .d.ts files
    outDir: 'dist', // Output directory
    splitting: false, // Disable code splitting
    sourcemap: true, // Generate source maps
    clean: true, // Clean the output directory before each build
});

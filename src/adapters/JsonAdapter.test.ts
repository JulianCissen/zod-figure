import { describe, expect, it } from '@jest/globals';
import { AdapterError } from '../errors';
import { JsonAdapter } from './JsonAdapter';
import path from 'path';
import { readFile } from 'fs/promises';

describe('JsonAdapter', () => {
    it('should load a JSON file async', async () => {
        const testFilePath = path.resolve(
            __dirname,
            '../../tests/fixtures/test-config.json',
        );
        const adapter = new JsonAdapter();
        const result = await adapter.load(testFilePath);
        const file = await readFile(testFilePath, 'utf-8');
        expect(result).toEqual(JSON.parse(file));
    });
    it('should load a JSON file sync', async () => {
        const testFilePath = path.resolve(
            __dirname,
            '../../tests/fixtures/test-config.json',
        );
        const adapter = new JsonAdapter();
        const result = adapter.loadSync(testFilePath);
        const file = await readFile(testFilePath, 'utf-8');
        expect(result).toEqual(JSON.parse(file));
    });

    it('should throw an AdapterError when loading a non-string', async () => {
        const adapter = new JsonAdapter();
        await expect(adapter.load({} as string)).rejects.toThrow(AdapterError);
    });
    it('should throw an AdapterError when loading a non-string sync', () => {
        const adapter = new JsonAdapter();
        expect(() => adapter.loadSync({} as string)).toThrow(AdapterError);
    });

    it('should throw a ReadError when loading a non-existent file', async () => {
        const adapter = new JsonAdapter();
        await expect(adapter.load('nonexistent.json')).rejects.toThrow();
    });
    it('should throw a ReadError when loading a non-existent file sync', () => {
        const adapter = new JsonAdapter();
        expect(() => adapter.loadSync('nonexistent.json')).toThrow();
    });
});

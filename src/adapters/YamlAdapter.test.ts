import { describe, expect, it, jest } from '@jest/globals';
import { ParseError } from '../errors';
import YAML from 'yaml';
import { YamlAdapter } from './YamlAdapter';
import path from 'path';
import { readFile } from 'fs/promises';

describe('YamlAdapter', () => {
    it('should load a YAML file async', async () => {
        const testFilePath = path.resolve(
            __dirname,
            '../../tests/fixtures/test-config.yaml',
        );
        const adapter = new YamlAdapter();
        const result = await adapter.load(testFilePath);
        const file = await readFile(testFilePath, 'utf-8');
        expect(result).toEqual(YAML.parse(file));
    });
    it('should load a YAML file sync', async () => {
        const testFilePath = path.resolve(
            __dirname,
            '../../tests/fixtures/test-config.yaml',
        );
        const adapter = new YamlAdapter();
        const result = adapter.loadSync(testFilePath);
        const file = await readFile(testFilePath, 'utf-8');
        expect(result).toEqual(YAML.parse(file));
    });

    it('should throw a ParseError when loading an invalid YAML file', async () => {
        const mockedYamlParse = jest
            .spyOn(YAML, 'parse')
            .mockImplementation(() => {
                throw new Error();
            });
        const testFilePath = path.resolve(
            __dirname,
            '../../tests/fixtures/test-config.yaml',
        );
        const adapter = new YamlAdapter();
        await expect(adapter.load(testFilePath)).rejects.toThrow(ParseError);
        mockedYamlParse.mockRestore();
    });
});

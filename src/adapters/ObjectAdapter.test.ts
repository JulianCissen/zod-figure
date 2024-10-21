import { describe, expect, it } from '@jest/globals';
import { ObjectAdapter } from './ObjectAdapter';

describe('ObjectAdapter', () => {
    it('should load a JSON object', async () => {
        const adapter = new ObjectAdapter();
        const object = { key: 'value' };
        const result = await adapter.load(object);
        expect(result).toEqual(object);
    });

    it('should throw an AdapterError when loading a non-object', async () => {
        const adapter = new ObjectAdapter();
        await expect(
            adapter.load('string' as unknown as Record<string, unknown>),
        ).rejects.toThrow();
    });
});

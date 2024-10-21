import { describe, expect, it } from '@jest/globals';
import { FileAdapter } from './FileAdapter';

describe('FileAdapter', () => {
    it('should use utf-8 encoding by default', () => {
        // @ts-expect-error FileAdapter is abstract
        const adapter = new FileAdapter({});
        expect(adapter.encoding).toBe('utf-8');
    });
});

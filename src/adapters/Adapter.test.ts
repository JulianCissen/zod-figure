import { describe, expect, it } from '@jest/globals';
import { Adapter } from './Adapter';
import { Logger } from '../Logger';

describe('Adapter', () => {
    it('should set custom logger', () => {
        // @ts-expect-error Adapter is abstract
        const adapter = new Adapter({
            logger: new Logger({ logLevelMap: { get: 'silent' } }),
        });
        expect(adapter.logger.logLevelMap.get).toBe('silent');
    });
});

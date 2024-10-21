import { AdapterError, NotLoadedError, ParseError, ReadError } from './errors';
import { describe, expect, it } from '@jest/globals';

describe('Errors', () => {
    it('should construct an AdapterError', () => {
        const error = new AdapterError();
        expect(error).toBeInstanceOf(AdapterError);
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Adapter cannot handle this input type.');
        expect(error.name).toBe('AdapterError');
    });
    it('should construct an AdapterError with custom message', () => {
        const error = new AdapterError('Custom message');
        expect(error.message).toBe('Custom message');
    });

    it('should construct a NotLoadedError', () => {
        const error = new NotLoadedError();
        expect(error).toBeInstanceOf(NotLoadedError);
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Config not loaded.');
        expect(error.name).toBe('NotLoadedError');
    });
    it('should construct a NotLoadedError with custom message', () => {
        const error = new NotLoadedError('Custom message');
        expect(error.message).toBe('Custom message');
    });

    it('should construct a ParseError', () => {
        const error = new ParseError();
        expect(error).toBeInstanceOf(ParseError);
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Could not parse configuration.');
        expect(error.name).toBe('ParseError');
    });
    it('should construct a ParseError with custom message', () => {
        const error = new ParseError('Custom message');
        expect(error.message).toBe('Custom message');
    });

    it('should construct a ReadError', () => {
        const error = new ReadError();
        expect(error).toBeInstanceOf(ReadError);
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Could not read file.');
        expect(error.name).toBe('ReadError');
    });
    it('should construct a ReadError with custom message', () => {
        const error = new ReadError('Custom message');
        expect(error.message).toBe('Custom message');
    });
});

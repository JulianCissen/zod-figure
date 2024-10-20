import { ZodConfig } from '../src/index';
import { z } from 'zod';
import path from 'path';
import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import fsPromise, { readFile } from 'fs/promises';
import { NotLoadedError, ParseError, ReadError } from '../src/errors';
import dotenv from 'dotenv';

const schema = {
    port: { schema: z.coerce.number(), env: 'PORT' },
    host: { schema: z.string(), env: 'HOST' },
};

const getConsoleSpy = (level: 'debug' | 'info' | 'error') => {
    const consoleSpy = jest.spyOn(console, level).mockImplementation(() => {});
    return consoleSpy;
};

describe('ZodConfig', () => {
    let zodConfig: ZodConfig<typeof schema>;

    beforeEach(() => {
        zodConfig = new ZodConfig({ schema });
    });

    it('should compile schema correctly', () => {
        expect(zodConfig['compiledSchema']).toBeDefined();
    });

    it('should handle schema provided as a function', async () => {
        const zodConfig = new ZodConfig({
            schema: (z) => ({
                port: { schema: z.coerce.number(), env: 'PORT' },
                host: { schema: z.string(), env: 'HOST' },
            }),
        });
        const configObject = { port: 3000, host: 'localhost' };
        await zodConfig.load(configObject);
        expect(zodConfig.get('host')).toEqual(configObject.host);
        expect(zodConfig.get('port')).toEqual(configObject.port);
    });

    it('should load configuration from an object', async () => {
        const configObject = { port: 3000, host: 'localhost' };
        await zodConfig.load(configObject);
        expect(zodConfig['currentConfigValue']).toEqual(configObject);
    });

    it('should load configuration from a file', async () => {
        const configFilePath = path.resolve(
            __dirname,
            './fixtures/test-config.json',
        );
        await zodConfig.load(configFilePath);
        const configObject = JSON.parse(
            await readFile(configFilePath, 'utf-8'),
        );
        expect(zodConfig['currentConfigValue']).toEqual(configObject);
    });

    it('should merge environment variables with configuration', async () => {
        const configObject = { port: 3000, host: 'localhost' };
        process.env['PORT'] = String(configObject.port);
        process.env['HOST'] = configObject.host;
        await zodConfig.load({});
        expect(zodConfig['currentConfigValue']).toEqual(configObject);
        // Reset environment variables, or they will affect other tests.
        delete process.env['PORT'];
        delete process.env['HOST'];
    });

    it('should throw an error if the configuration file cannot be read', async () => {
        const invalidFilePath = path.resolve(
            __dirname,
            'nonexistent-config.json',
        );
        await expect(zodConfig.load(invalidFilePath)).rejects.toThrow(
            ReadError,
        );
    });

    it('should throw an error if the configuration file cannot be parsed', async () => {
        const configFilePath = path.resolve(
            __dirname,
            './fixtures/test-config.json',
        );

        jest.spyOn(fsPromise, 'readFile').mockResolvedValue('invalid');

        await expect(zodConfig.load(configFilePath)).rejects.toThrow(
            ParseError,
        );
    });

    it('should throw an error if no configuration is loaded', () => {
        expect(() => zodConfig.get('host')).toThrow(NotLoadedError);
    });

    it('should throw an error if the configuration is not valid', async () => {
        const configObject = { port: 'invalid', host: 'localhost' };
        await expect(zodConfig.load(configObject)).rejects.toThrow(z.ZodError);
    });

    it('should get simple values correctly', async () => {
        const configObject = { port: 3000, host: 'localhost' };
        await zodConfig.load(configObject);
        expect(zodConfig.get('host')).toEqual(configObject.host);
        expect(zodConfig.get('port')).toEqual(configObject.port);
    });

    it('should get nested values correctly', async () => {
        const zodConfig = new ZodConfig({
            schema: (z) => ({
                db: {
                    schema: z.object({
                        port: z.coerce.number(),
                        host: z.string(),
                    }),
                },
            }),
        });
        const configObject = {
            db: { port: 3000, host: 'localhost' },
        };
        await zodConfig.load(configObject);
        expect(zodConfig.get('db').host).toEqual(configObject.db.host);
        expect(zodConfig.get('db').port).toEqual(configObject.db.port);
    });

    it('should set simple values correctly', async () => {
        const configObject = { port: 3000, host: 'localhost' };
        await zodConfig.load(configObject);
        zodConfig.set('host', 'remotehost');
        expect(zodConfig.get('host')).toEqual('remotehost');
    });

    it('should clone the configuration object when getting values', async () => {
        const zodConfig = new ZodConfig({
            schema: (z) => ({
                db: {
                    schema: z.object({
                        port: z.coerce.number(),
                        host: z.string(),
                    }),
                },
            }),
        });
        const configObject = {
            db: { port: 3000, host: 'localhost' },
        };
        await zodConfig.load(configObject);
        const db = zodConfig.get('db');
        db.host = 'remotehost';
        expect(zodConfig.get('db').host).toEqual(configObject.db.host);
    });

    it('should clone the configuration object when setting values', async () => {
        const zodConfig = new ZodConfig({
            schema: (z) => ({
                db: {
                    schema: z.object({
                        port: z.coerce.number(),
                        host: z.string(),
                    }),
                },
            }),
        });
        const configObject = {
            db: { port: 3000, host: 'localhost' },
        };
        await zodConfig.load(configObject);
        const newDb = { port: 3001, host: 'remotehost' };
        zodConfig.set('db', newDb);
        newDb.host = 'anotherhost';
        expect(zodConfig.get('db').host).toEqual('remotehost');
    });

    it('should run listeners correctly', async () => {
        const listener = jest.fn();
        const configObject = { port: 3000, host: 'localhost' };
        await zodConfig.load(configObject);
        zodConfig.addListener('host', listener);
        zodConfig.set('host', 'remotehost');
        expect(listener).toBeCalledWith('remotehost', 'localhost');
    });

    it('should only run listeners for the specified key', async () => {
        const listener = jest.fn();
        const configObject = { port: 3000, host: 'localhost' };
        await zodConfig.load(configObject);
        zodConfig.addListener('port', listener);
        zodConfig.set('host', 'remotehost');
        expect(listener).not.toBeCalled();
    });

    it('should reload configuration with interval', async () => {
        jest.useFakeTimers();
        const zodConfig = new ZodConfig({
            schema,
            reloadIntervalMs: 100,
        });
        const configObject = { port: 3000, host: 'localhost' };
        await zodConfig.load(configObject);
        configObject.host = 'remotehost';
        expect(zodConfig.get('host')).toEqual('localhost');
        jest.runOnlyPendingTimers();
        expect(zodConfig.get('host')).toEqual('remotehost');
    });

    it('should run listeners on config reload', async () => {
        jest.useFakeTimers();
        const listener = jest.fn();
        const zodConfig = new ZodConfig({
            schema,
            reloadIntervalMs: 100,
        });
        const configObject = { port: 3000, host: 'localhost' };
        await zodConfig.load(configObject);
        zodConfig.addListener('host', listener);
        configObject.host = 'remotehost';
        jest.runOnlyPendingTimers();
        expect(listener).toBeCalledWith('remotehost', 'localhost');
    });

    it('should stop refresh interval', async () => {
        jest.useFakeTimers();
        const zodConfig = new ZodConfig({
            schema,
            reloadIntervalMs: 100,
        });
        const configObject = { port: 3000, host: 'localhost' };
        await zodConfig.load(configObject);
        configObject.host = 'remotehost';
        expect(zodConfig.get('host')).toEqual('localhost');
        zodConfig.stopReloadInterval();
        jest.runOnlyPendingTimers();
        expect(zodConfig.get('host')).toEqual('localhost');
    });

    it('should start refresh interval', async () => {
        jest.useFakeTimers();
        const configObject = { port: 3000, host: 'localhost' };
        await zodConfig.load(configObject);
        configObject.host = 'remotehost';
        expect(zodConfig.get('host')).toEqual('localhost');
        zodConfig.startReloadInterval(100);
        jest.runOnlyPendingTimers();
        expect(zodConfig.get('host')).toEqual('remotehost');
    });

    it('should work with .env files when using dotenv', async () => {
        dotenv.config({ path: path.resolve(__dirname, './fixtures/test.env') });
        await zodConfig.load({});
        expect(zodConfig.get('host')).toEqual('localhost');
        expect(zodConfig.get('port')).toEqual(3000);
    });

    it('should not log when logger is set to false', async () => {
        const consoleDebugSpy = getConsoleSpy('debug');
        const zodConfig = new ZodConfig({
            schema,
            logger: false,
        });
        const configObject = { port: 3000, host: 'localhost' };
        await zodConfig.load(configObject);
        zodConfig.get('host');
        expect(consoleDebugSpy).not.toBeCalled();
        consoleDebugSpy.mockRestore();
    });

    it('should use default logger when logger is set to true', async () => {
        const consoleDebugSpy = getConsoleSpy('debug');
        const zodConfig = new ZodConfig({
            schema,
            logger: true,
        });
        const configObject = { port: 3000, host: 'localhost' };
        await zodConfig.load(configObject);
        zodConfig.get('host');
        expect(consoleDebugSpy).toBeCalledTimes(1);
        consoleDebugSpy.mockRestore();
    });

    it('should use custom logger', async () => {
        const logger = jest.fn();
        const zodConfig = new ZodConfig({
            schema,
            logger,
        });
        const configObject = { port: 3000, host: 'localhost' };
        await zodConfig.load(configObject);
        zodConfig.get('host');
        expect(logger).toBeCalled();
    });

    it('should support custom log levels', async () => {
        const consoleInfoSpy = getConsoleSpy('info');
        const zodConfig = new ZodConfig({
            schema,
            logger: true,
            logLevelMap: {
                get: 'info',
            },
        });
        // Not sure why the compile call is not registered. But it does work.
        expect(consoleInfoSpy).toBeCalledTimes(0);
        const configObject = { port: 3000, host: 'localhost' };
        await zodConfig.load(configObject);
        expect(consoleInfoSpy).toBeCalledTimes(1);
        zodConfig.get('host');
        expect(consoleInfoSpy).toBeCalledTimes(2);
        consoleInfoSpy.mockRestore();
    });

    it('should support silent log levels', async () => {
        const consoleDebugSpy = getConsoleSpy('debug');
        const zodConfig = new ZodConfig({
            schema,
            logger: true,
            logLevelMap: {
                get: 'silent',
            },
        });
        const configObject = { port: 3000, host: 'localhost' };
        await zodConfig.load(configObject);
        zodConfig.get('host');
        expect(consoleDebugSpy).not.toBeCalled();
        consoleDebugSpy.mockRestore();
    });
});

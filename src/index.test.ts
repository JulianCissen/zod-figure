import {
    Adapter,
    AdapterError,
    JsonAdapter,
    NotLoadedError,
    ObjectAdapter,
    ParseError,
    ReadError,
    YamlAdapter,
    ZodConfig,
} from './';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import fsPromise, { readFile } from 'fs/promises';
import { CustomAdapter } from '../tests/fixtures/customAdapter';
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

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

    it('should export all necessary classes and functions', () => {
        expect(Adapter).toBeDefined();
        expect(AdapterError).toBeDefined();
        expect(JsonAdapter).toBeDefined();
        expect(NotLoadedError).toBeDefined();
        expect(ObjectAdapter).toBeDefined();
        expect(ParseError).toBeDefined();
        expect(ReadError).toBeDefined();
        expect(YamlAdapter).toBeDefined();
        expect(ZodConfig).toBeDefined();
    });

    it('should compile schema correctly', () => {
        expect(zodConfig['compiledSchema']).toBeDefined();
    });

    it('should handle schema provided as a function', () => {
        const zodConfig = new ZodConfig({
            schema: (z) => ({
                port: { schema: z.coerce.number(), env: 'PORT' },
                host: { schema: z.string(), env: 'HOST' },
            }),
        });
        const configObject = { port: 3000, host: 'localhost' };
        zodConfig.loadSync(configObject);
        expect(zodConfig.get('host')).toEqual(configObject.host);
        expect(zodConfig.get('port')).toEqual(configObject.port);
    });

    it('should load configuration from an object', () => {
        const configObject = { port: 3000, host: 'localhost' };
        zodConfig.loadSync(configObject);
        expect(zodConfig['currentConfigValue']).toEqual(configObject);
    });

    it('should load configuration from a file', async () => {
        const configFilePath = path.resolve(
            __dirname,
            '../tests/fixtures/test-config.json',
        );
        await zodConfig.load(configFilePath);
        const configObject = JSON.parse(
            await readFile(configFilePath, 'utf-8'),
        );
        expect(zodConfig['currentConfigValue']).toEqual(configObject);
    });

    it('should merge environment variables with configuration', () => {
        const configObject = { port: 3000, host: 'localhost' };
        process.env['PORT'] = String(configObject.port);
        process.env['HOST'] = configObject.host;
        zodConfig.loadSync({});
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

        const mockedReadFile = jest
            .spyOn(fsPromise, 'readFile')
            .mockResolvedValue('invalid');
        await expect(zodConfig.load(configFilePath)).rejects.toThrow(
            ParseError,
        );
        mockedReadFile.mockRestore();
    });

    it('should throw an error if no configuration is loaded', () => {
        expect(() => zodConfig.get('host')).toThrow(NotLoadedError);
    });

    it('should throw an error if the configuration is not valid', () => {
        const configObject = { port: 'invalid', host: 'localhost' };
        expect(() => zodConfig.loadSync(configObject)).toThrow(z.ZodError);
    });

    it('should get simple values correctly', () => {
        const configObject = { port: 3000, host: 'localhost' };
        zodConfig.loadSync(configObject);
        expect(zodConfig.get('host')).toEqual(configObject.host);
        expect(zodConfig.get('port')).toEqual(configObject.port);
    });

    it('should get nested values correctly', () => {
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
        zodConfig.loadSync(configObject);
        expect(zodConfig.get('db').host).toEqual(configObject.db.host);
        expect(zodConfig.get('db').port).toEqual(configObject.db.port);
    });

    it('should set simple values correctly', () => {
        const configObject = { port: 3000, host: 'localhost' };
        zodConfig.loadSync(configObject);
        zodConfig.set('host', 'remotehost');
        expect(zodConfig.get('host')).toEqual('remotehost');
    });

    it('should clone the configuration object when getting values', () => {
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
        zodConfig.loadSync(configObject);
        const db = zodConfig.get('db');
        db.host = 'remotehost';
        expect(zodConfig.get('db').host).toEqual(configObject.db.host);
    });

    it('should clone the configuration object when setting values', () => {
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
        zodConfig.loadSync(configObject);
        const newDb = { port: 3001, host: 'remotehost' };
        zodConfig.set('db', newDb);
        newDb.host = 'anotherhost';
        expect(zodConfig.get('db').host).toEqual('remotehost');
    });

    it('should run listeners correctly', () => {
        const listener = jest.fn();
        const configObject = { port: 3000, host: 'localhost' };
        zodConfig.loadSync(configObject);
        zodConfig.addListener('host', listener);
        zodConfig.set('host', 'remotehost');
        expect(listener).toBeCalledWith('remotehost', 'localhost');
    });

    it('should only run listeners for the specified key', () => {
        const listener = jest.fn();
        const configObject = { port: 3000, host: 'localhost' };
        zodConfig.loadSync(configObject);
        zodConfig.addListener('port', listener);
        zodConfig.set('host', 'remotehost');
        expect(listener).not.toBeCalled();
    });

    it('should reload configuration with interval', () => {
        jest.useFakeTimers();
        const zodConfig = new ZodConfig({
            schema,
            reloadIntervalMs: 100,
        });
        const configObject = { port: 3000, host: 'localhost' };
        zodConfig.loadSync(configObject);
        configObject.host = 'remotehost';
        expect(zodConfig.get('host')).toEqual('localhost');
        jest.runOnlyPendingTimers();
        expect(zodConfig.get('host')).toEqual('remotehost');
    });

    it('should run listeners on config reload', () => {
        jest.useFakeTimers();
        const listener = jest.fn();
        const zodConfig = new ZodConfig({
            schema,
            reloadIntervalMs: 100,
        });
        const configObject = { port: 3000, host: 'localhost' };
        zodConfig.loadSync(configObject);
        zodConfig.addListener('host', listener);
        configObject.host = 'remotehost';
        jest.runOnlyPendingTimers();
        expect(listener).toBeCalledWith('remotehost', 'localhost');
    });

    it('should stop refresh interval', () => {
        jest.useFakeTimers();
        const zodConfig = new ZodConfig({
            schema,
            reloadIntervalMs: 100,
        });
        const configObject = { port: 3000, host: 'localhost' };
        zodConfig.loadSync(configObject);
        configObject.host = 'remotehost';
        expect(zodConfig.get('host')).toEqual('localhost');
        zodConfig.stopReloadInterval();
        jest.runOnlyPendingTimers();
        expect(zodConfig.get('host')).toEqual('localhost');
    });

    it('should start refresh interval', () => {
        jest.useFakeTimers();
        const configObject = { port: 3000, host: 'localhost' };
        zodConfig.loadSync(configObject);
        configObject.host = 'remotehost';
        expect(zodConfig.get('host')).toEqual('localhost');
        zodConfig.startReloadInterval(100);
        jest.runOnlyPendingTimers();
        expect(zodConfig.get('host')).toEqual('remotehost');
    });

    it('should work with .env files when using dotenv', () => {
        dotenv.config({
            path: path.resolve(__dirname, '../tests/fixtures/test.env'),
        });
        zodConfig.loadSync({});
        expect(zodConfig.get('host')).toEqual('localhost');
        expect(zodConfig.get('port')).toEqual(3000);
    });

    it('should not log when logger is set to false', () => {
        const consoleDebugSpy = getConsoleSpy('debug');
        const zodConfig = new ZodConfig({
            schema,
            logger: false,
        });
        const configObject = { port: 3000, host: 'localhost' };
        zodConfig.loadSync(configObject);
        zodConfig.get('host');
        expect(consoleDebugSpy).not.toBeCalled();
        consoleDebugSpy.mockRestore();
    });

    it('should use default logger when logger is set to true', () => {
        const consoleDebugSpy = getConsoleSpy('debug');
        const zodConfig = new ZodConfig({
            schema,
            logger: true,
        });
        const configObject = { port: 3000, host: 'localhost' };
        zodConfig.loadSync(configObject);
        zodConfig.get('host');
        expect(consoleDebugSpy).toBeCalledTimes(1);
        consoleDebugSpy.mockRestore();
    });

    it('should use custom logger', () => {
        const logger = jest.fn();
        const zodConfig = new ZodConfig({
            schema,
            logger,
        });
        const configObject = { port: 3000, host: 'localhost' };
        zodConfig.loadSync(configObject);
        zodConfig.get('host');
        expect(logger).toBeCalled();
    });

    it('should support custom log levels', () => {
        const consoleInfoSpy = getConsoleSpy('info');
        const zodConfig = new ZodConfig({
            schema,
            logger: true,
            logLevelMap: {
                get: 'info',
            },
        });
        const configObject = { port: 3000, host: 'localhost' };
        zodConfig.loadSync(configObject);
        zodConfig.get('host');
        // compiledSchema
        // adapterSet
        // load
        // get
        expect(consoleInfoSpy).toBeCalledTimes(4);
        consoleInfoSpy.mockRestore();
    });

    it('should support silent log levels', () => {
        const consoleDebugSpy = getConsoleSpy('debug');
        const zodConfig = new ZodConfig({
            schema,
            logger: true,
            logLevelMap: {
                get: 'silent',
            },
        });
        const configObject = { port: 3000, host: 'localhost' };
        zodConfig.loadSync(configObject);
        zodConfig.get('host');
        expect(consoleDebugSpy).not.toBeCalled();
        consoleDebugSpy.mockRestore();
    });

    it('should load configuration from a file synchronously', async () => {
        const configFilePath = path.resolve(
            __dirname,
            '../tests/fixtures/test-config.json',
        );
        zodConfig.loadSync(configFilePath);
        const configObject = JSON.parse(
            await readFile(configFilePath, 'utf-8'),
        );
        expect(zodConfig['currentConfigValue']).toEqual(configObject);
    });

    it('should use custom adapter', async () => {
        const adapter = new CustomAdapter();
        const spyLoadSync = jest.spyOn(adapter, 'loadSync');
        const zodConfig = new ZodConfig({
            schema,
            customAdapter: adapter,
        });
        const configObject = { port: 4000, host: 'remoteHost' };
        zodConfig.loadSync(configObject);
        expect(spyLoadSync).toBeCalledTimes(1);
        // Expect the values to be loaded from the custom adapter.
        expect(zodConfig.get('host')).toEqual('localhost');
        expect(zodConfig.get('port')).toEqual(3000);
    });

    it('should parse yaml files', async () => {
        const configFilePath = path.resolve(
            __dirname,
            '../tests/fixtures/test-config.yaml',
        );
        await zodConfig.load(configFilePath);
        const configObject = {
            port: 3000,
            host: 'localhost',
        };
        expect(zodConfig['currentConfigValue']).toEqual(configObject);
    });

    it('should throw an AdapterError if adapter is retrieved but not set', () => {
        expect(() => zodConfig['adapter']).toThrow(AdapterError);
    });

    it('should throw a NotLoadedError when trying to get objectOrFileRef before loading', () => {
        expect(() => zodConfig['objectOrFileRef']).toThrow(NotLoadedError);
    });

    it('should throw a NotLoadedError when trying to get loadMethod before loading', () => {
        expect(() => zodConfig['loadMethod']).toThrow(NotLoadedError);
    });

    it('should allow setting an adapter after ZodConfig initialization', () => {
        zodConfig.setAdapter(new ObjectAdapter());
        expect(zodConfig['adapter']).toBeInstanceOf(ObjectAdapter);
        zodConfig.loadSync({ port: 3000, host: 'localhost' });
        expect(zodConfig.get('host')).toEqual('localhost');
    });
});

import path from 'path';
import { z } from 'zod';
import { jsonParser } from './parseJson';
import { readFile } from 'fs/promises';
import { NotLoadedError, ParseError, ReadError } from './errors';
import isEqual from 'lodash.isequal';
import { readFileSync } from 'fs';

type ZodConfigSchemaMap = {
    [key: string]: ZodConfigProperty;
};
interface ZodConfigProperty<T extends z.ZodSchema = z.ZodSchema> {
    schema: T;
    env?: string | undefined | null;
}

type ObjectKeys<T> = T extends object ? keyof T : never;
type KeyValue<T, K extends ObjectKeys<T>> = K extends keyof T ? T[K] : never;

type ListenerFunction<T> = (newValue: T, oldValue: T) => void;
type ListenerMap<T> = {
    [K in ObjectKeys<T>]?: ListenerFunction<T[K]>[];
};

type LogLevels = 'silent' | 'debug' | 'info' | 'error';
type LogMethod = (message: string, level: LogLevels) => void;
type LogEvents =
    | 'get'
    | 'set'
    | 'load'
    | 'reload'
    | 'compiledSchema'
    | 'startReloadInterval'
    | 'stopReloadInterval'
    | 'error'
    | 'runListeners'
    | 'registeredListener';
type LogLevelsMap = Record<LogEvents, LogLevels>;
const defaultLogLevels: LogLevelsMap = {
    // debug
    get: 'debug',
    runListeners: 'debug',
    set: 'debug',
    startReloadInterval: 'debug',
    stopReloadInterval: 'debug',
    registeredListener: 'debug',
    // info
    compiledSchema: 'info',
    load: 'info',
    reload: 'info',
    // error
    error: 'error',
};

export class ZodConfig<T extends ZodConfigSchemaMap> {
    private schema: T;
    private compiledSchema!: z.ZodObject<{ [K in keyof T]: T[K]['schema'] }>;

    private _objectOrFileRef?: Record<string, unknown> | string;
    private get objectOrFileRef(): Record<string, unknown> | string {
        if (!this._objectOrFileRef) {
            this.logger('Config not loaded.', this.getLogLevel('error'));
            throw new NotLoadedError();
        }
        return structuredClone(this._objectOrFileRef);
    }
    private set objectOrFileRef(value: Record<string, unknown> | string) {
        this._objectOrFileRef = value;
    }

    // A possibly undefined current configuration value.
    private _currentConfigValue?: z.infer<typeof this.compiledSchema>;
    // Returns the current config value, and throws an error if it is not loaded.
    private get currentConfigValue(): z.infer<typeof this.compiledSchema> {
        if (!this._currentConfigValue) {
            this.logger('Config not loaded.', this.getLogLevel('error'));
            throw new NotLoadedError();
        }
        return this._currentConfigValue;
    }

    private listenerMap: ListenerMap<z.infer<typeof this.compiledSchema>> = {};

    private intervalCallback: NodeJS.Timeout | null = null;
    private reloadIntervalMs?: number;

    private logMethod?: LogMethod;
    private logger: LogMethod = (message, level) => {
        if (this.logMethod) this.logMethod(message, level);
    };
    private logLevelMap = defaultLogLevels;
    private getLogLevel(event: LogEvents): LogLevels {
        return this.logLevelMap[event];
    }

    constructor({
        schema,
        reloadIntervalMs,
        logger,
        logLevelMap,
    }: {
        schema: T | ((zod: typeof z) => T);
        reloadIntervalMs?: number;
        logger?: LogMethod | boolean;
        logLevelMap?: Partial<LogLevelsMap>;
    }) {
        if (typeof schema === 'function') {
            this.schema = schema(z);
        } else {
            this.schema = schema;
        }
        this.compileSchema();

        if (reloadIntervalMs) this.reloadIntervalMs = reloadIntervalMs;
        if (logger) {
            if (logger === true) {
                this.logMethod = (message, level) => {
                    if (level === 'silent') return;
                    console[level](message);
                };
            } else this.logMethod = logger;
        }
        if (logLevelMap)
            this.logLevelMap = { ...defaultLogLevels, ...logLevelMap };
    }

    /**
     * Retrieves a value from the configuration object based on the provided path.
     * @param key A string key representing the value to be returned.
     * @returns The value at the specified path.
     */
    public get<K extends ObjectKeys<typeof this.currentConfigValue>>(
        key: K,
    ): KeyValue<typeof this.currentConfigValue, K> {
        const value = structuredClone(this.currentConfigValue[key]);

        this.logger(
            `Retrieved configuration value for key: ${String(key)}`,
            this.getLogLevel('get'),
        );

        return value;
    }

    /**
     * Sets a value in the configuration object based on the provided path.
     * @param key A string key representing the value to be changed.
     * @param value The new value to set at the specified path.
     */
    public set<K extends ObjectKeys<typeof this.currentConfigValue>>(
        key: K,
        value: KeyValue<typeof this.currentConfigValue, K>,
    ): void {
        const oldValue = structuredClone(this.currentConfigValue[key]);
        this.currentConfigValue[key] = structuredClone(value);

        this.logger(
            `Set configuration value for key: ${String(key)}`,
            this.getLogLevel('set'),
        );

        this.runListeners(key, structuredClone(value), oldValue);
    }

    /**
     * Adds a listener to a specific key in the configuration object.
     * @param key The key to listen to.
     * @param listener The listener function to be called when the key changes.
     */
    public addListener<K extends ObjectKeys<typeof this.currentConfigValue>>(
        key: K,
        listener: ListenerFunction<(typeof this.currentConfigValue)[K]>,
    ): void {
        if (!this.listenerMap[key]) {
            this.listenerMap[key] = [];
        }
        this.listenerMap[key]?.push(listener);

        this.logger(
            `Registered listener for key: ${String(key)}`,
            this.getLogLevel('registeredListener'),
        );
    }

    /**
     * Runs all listeners for a specific key with the new and old values.
     * @param key The key to run listeners for.
     * @param newValue The new value.
     * @param oldValue The old value.
     */
    private runListeners<K extends ObjectKeys<typeof this.currentConfigValue>>(
        key: K,
        newValue: KeyValue<typeof this.currentConfigValue, K>,
        oldValue: KeyValue<typeof this.currentConfigValue, K>,
    ): void {
        this.logger(
            `Running listeners for key: ${String(key)}`,
            this.getLogLevel('runListeners'),
        );

        this.listenerMap[key]?.forEach((listener) =>
            listener(newValue, oldValue),
        );
    }

    /**
     * Compiles the schema by transforming the `this.schema` object into a Zod schema.
     * It maps each key-value pair in `this.schema` to a new object where each value is replaced by its `schema` property.
     * The resulting object is then used to create a Zod object schema, which is assigned to `this.compiledSchema`.
     */
    private compileSchema() {
        const schemaDef = Object.fromEntries(
            Object.entries(this.schema).map(([key, value]) => [
                key,
                value.schema,
            ]),
        ) as { [K in keyof T]: T[K]['schema'] };
        this.compiledSchema = z.object(schemaDef);

        this.logger(
            'Compiled schema successfully.',
            this.getLogLevel('compiledSchema'),
        );
    }

    /**
     * Loads configuration from a given object or file reference.
     * If a file path is provided, the configuration will be loaded from the file.
     * If an object is provided, it will be used directly as the configuration.
     * The loaded configuration is then merged with environment values and parsed.
     * @param objectOrFileRef A configuration object or a file path to load the configuration from.
     */
    public async load(
        objectOrFileRef: Record<string, unknown> | string,
    ): Promise<void> {
        // Store the object or file reference for later use.
        this.objectOrFileRef = objectOrFileRef;

        this.loadValues(
            typeof this.objectOrFileRef === 'string'
                ? await this.loadFile(this.objectOrFileRef)
                : this.objectOrFileRef,
        );
    }

    /**
     * Loads configuration from a given object or file reference synchronously.
     * If a file path is provided, the configuration will be loaded from the file.
     * If an object is provided, it will be used directly as the configuration.
     * The loaded configuration is then merged with environment values and parsed.
     * @param objectOrFileRef A configuration object or a file path to load the configuration from.
     */
    public loadSync(objectOrFileRef: Record<string, unknown> | string): void {
        // Store the object or file reference for later use.
        this.objectOrFileRef = objectOrFileRef;

        this.loadValues(
            typeof this.objectOrFileRef === 'string'
                ? this.loadFileSync(this.objectOrFileRef)
                : this.objectOrFileRef,
        );
    }

    /**
     * Loads configuration values from a given object.
     * @param values The object to load the configuration values from.
     */
    private loadValues(values: Record<string, unknown>): void {
        const envValues = this.getEnvValues();
        this.parseValues({ ...values, ...envValues });

        // Start the reload interval if it is not already running.
        if (!this.intervalCallback && this.reloadIntervalMs)
            this.startReloadInterval(this.reloadIntervalMs);

        this.logger(
            'Loaded configuration successfully.',
            this.getLogLevel('load'),
        );
    }

    /**
     * Stops the reload interval if it is currently running.
     */
    public stopReloadInterval(): void {
        if (this.intervalCallback) {
            clearInterval(this.intervalCallback);
            this.intervalCallback = null;
        }

        this.logger(
            'Stopped reload interval.',
            this.getLogLevel('stopReloadInterval'),
        );
    }

    /**
     * Starts a reload interval that reloads the configuration from the object or file reference at the specified interval.
     * @param intervalMs The interval in milliseconds at which to reload the configuration.
     */
    public startReloadInterval(intervalMs: number): void {
        this.intervalCallback = this.createReloadIntervalCallback(intervalMs);

        this.logger(
            'Started reload interval.',
            this.getLogLevel('startReloadInterval'),
        );
    }

    /**
     * Returns an interval callback that reloads the configuration from the object or file reference.
     * @param intervalMs The interval in milliseconds at which to reload the configuration.
     * @returns A callback that reloads the configuration at the specified interval.
     */
    private createReloadIntervalCallback(intervalMs: number): NodeJS.Timeout {
        return setInterval(() => {
            this.load(this.objectOrFileRef);
            this.logger(
                'Reloaded configuration successfully.',
                this.getLogLevel('reload'),
            );
        }, intervalMs);
    }

    /**
     * Parses the given object using the compiled schema and assigns the result to the `currentConfigValue` property.
     * @param object The object to be parsed, represented as a record with string keys and unknown values.
     */
    private parseValues(object: Record<string, unknown>): void {
        const oldConfig = this._currentConfigValue;

        this._currentConfigValue = this.compiledSchema.parse(object);

        if (oldConfig) {
            const changedKeys = this.getChangedKeys(
                oldConfig,
                this.currentConfigValue,
            );
            for (const changedKey of changedKeys) {
                this.runListeners(
                    changedKey,
                    this.currentConfigValue[changedKey],
                    oldConfig[changedKey],
                );
            }
        }
    }

    /**
     * Returns an array of keys that have changed between the old and new configuration objects.
     * @param oldConfig The old configuration object.
     * @param newConfig The new configuration object.
     * @returns The keys that have changed between the old and new configuration objects.
     */
    private getChangedKeys(
        oldConfig: typeof this.currentConfigValue,
        newConfig: typeof this.currentConfigValue,
    ): ObjectKeys<typeof this.currentConfigValue>[] {
        const changedKeys: ObjectKeys<typeof this.currentConfigValue>[] = [];
        const configKeys = Object.keys(oldConfig) as ObjectKeys<
            typeof this.currentConfigValue
        >[];

        for (const key of configKeys) {
            if (!isEqual(oldConfig[key], newConfig[key])) {
                changedKeys.push(key);
            }
        }
        return changedKeys;
    }

    /**
     * Loads and parses a configuration file asynchronous.
     * @param fileRef The path reference to the configuration file.
     * @returns A promise that resolves to a record containing the parsed configuration data.
     */
    private async loadFile(fileRef: string): Promise<Record<string, unknown>> {
        const pathToConfig = path.resolve(fileRef);
        const config = await this.readFile(pathToConfig);
        return this.parseConfig(config);
    }

    /**
     * Loads and parses a configuration file.
     * @param fileRef The path reference to the configuration file.
     * @returns A record containing the parsed configuration data.
     */
    private loadFileSync(fileRef: string): Record<string, unknown> {
        const pathToConfig = path.resolve(fileRef);
        const config = this.readFileSync(pathToConfig);
        return this.parseConfig(config);
    }

    /**
     * Reads the content of a file at the specified file path asynchronous.
     * @param filePath The path to the file to be read.
     * @returns A promise that resolves to the utf-8 encoded content of the file as a string.
     * @throws A ReadError if the file cannot be read.
     */
    private async readFile(filePath: string): Promise<string> {
        try {
            return await readFile(filePath, { encoding: 'utf-8' });
        } catch {
            this.logger(
                `Could not read file at ${filePath}.`,
                this.getLogLevel('error'),
            );
            throw new ReadError(`Could not read file at ${filePath}.`);
        }
    }

    /**
     * Reads the content of a file at the specified file path.
     * @param filePath The path to the file to be read.
     * @returns The utf-8 encoded content of the file as a string.
     * @throws A ReadError if the file cannot be read.
     */
    private readFileSync(filePath: string): string {
        try {
            return readFileSync(filePath, { encoding: 'utf-8' });
        } catch {
            this.logger(
                `Could not read file at ${filePath}.`,
                this.getLogLevel('error'),
            );
            throw new ReadError(`Could not read file at ${filePath}.`);
        }
    }

    /**
     * Parses a JSON configuration string and returns it as a record.
     * @param config The JSON configuration string to parse.
     * @returns A record containing the parsed configuration data.
     * @throws A ParseError if the configuration string cannot be parsed.
     */
    private parseConfig(config: string): Record<string, unknown> {
        const parsedConfig = jsonParser.safeParse(config);
        if (!parsedConfig.success) {
            this.logger(
                'Could not parse configuration.',
                this.getLogLevel('error'),
            );
            throw new ParseError();
        }
        return parsedConfig.data;
    }

    /**
     * Retrieves environment variable values based on the schema.
     * This method iterates over the schema and checks if each key has an associated environment variable defined.
     * If an environment variable is found, its value is added to the returned record.
     * @returns An object containing the environment variable values mapped to their corresponding schema keys.
     */
    private getEnvValues(): Record<string, string> {
        const envValues: Record<string, string> = {};
        for (const key in this.schema) {
            if (this.schema[key]?.env) {
                const envKey = this.schema[key].env;
                const envValue = process.env[envKey];
                if (envValue) {
                    envValues[key] = envValue;
                }
            }
        }
        return envValues;
    }
}

import { AdapterError, NotLoadedError } from './errors';
import { type LogFunction, type LogLevelsMap, Logger } from './Logger';
import type { Adapter } from './adapters/Adapter';
import { JsonAdapter } from './adapters/JsonAdapter';
import { ObjectAdapter } from './adapters/ObjectAdapter';
import { YamlAdapter } from './adapters/YamlAdapter';
import isEqual from 'lodash.isequal';
import { z } from 'zod';

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

type CompiledSchema<T extends ZodConfigSchemaMap> = z.ZodObject<{
    [K in keyof T]: T[K]['schema'];
}>;
type SchemaValue<T extends ZodConfigSchemaMap> = z.infer<CompiledSchema<T>>;

export class ZodConfig<T extends ZodConfigSchemaMap> {
    private logger: Logger;
    // Schema
    private _schema: T;
    // Define a public getter, so the type can be inferred in a compiled context, but the value can't be changed.
    public get schema(): T {
        return this._schema;
    }
    private compiledSchema!: CompiledSchema<T>;
    // Config loading
    private _adapter: Adapter | null = null;
    private get adapter(): Adapter {
        if (!this._adapter) {
            this.logger.log('Adapter not set.', 'error');
            throw new AdapterError('Adapter not set.');
        }
        return this._adapter;
    }
    private set adapter(adapter: Adapter) {
        this._adapter = adapter;
        this.adapter['logger'] = this.logger;
        this.logger.log('Adapter set.', 'adapterSet');
    }
    private _objectOrFileRef?: Record<string, unknown> | string;
    private get objectOrFileRef(): Record<string, unknown> | string {
        if (!this._objectOrFileRef) {
            this.logger.log('Config not loaded.', 'error');
            throw new NotLoadedError();
        }
        return structuredClone(this._objectOrFileRef);
    }
    private set objectOrFileRef(value: Record<string, unknown> | string) {
        this._objectOrFileRef = value;
    }
    private _currentConfigValue?: SchemaValue<T>;
    private get currentConfigValue(): SchemaValue<T> {
        if (!this._currentConfigValue) {
            this.logger.log('Config not loaded.', 'error');
            throw new NotLoadedError();
        }
        return this._currentConfigValue;
    }
    // Listeners
    private listenerMap: ListenerMap<SchemaValue<T>> = {};
    // Reloading
    private intervalCallback: NodeJS.Timeout | null = null;
    private reloadIntervalMs?: number;
    private _loadMethod: typeof this.load | typeof this.loadSync | null = null;
    private get loadMethod(): typeof this.load | typeof this.loadSync {
        if (!this._loadMethod) {
            this.logger.log('Config not loaded.', 'error');
            throw new NotLoadedError();
        }
        return this._loadMethod;
    }

    constructor({
        schema,
        reloadIntervalMs,
        logger,
        logLevelMap,
        customAdapter,
    }: {
        schema: T | ((zod: typeof z) => T);
        reloadIntervalMs?: number;
        logger?: LogFunction | boolean;
        logLevelMap?: Partial<LogLevelsMap>;
        customAdapter?: Adapter;
    }) {
        this.logger = new Logger({ logger, logLevelMap });
        if (customAdapter) this.adapter = customAdapter;

        if (typeof schema === 'function') {
            this._schema = schema(z);
        } else {
            this._schema = schema;
        }
        this.compileSchema();

        if (reloadIntervalMs) this.reloadIntervalMs = reloadIntervalMs;
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
        this.preLoad(objectOrFileRef);
        const rawConfig = await this.adapter.load(objectOrFileRef);
        this.postLoad(rawConfig);
    }
    /**
     * Loads configuration from a given object or file reference synchronously.
     * If a file path is provided, the configuration will be loaded from the file.
     * If an object is provided, it will be used directly as the configuration.
     * The loaded configuration is then merged with environment values and parsed.
     * @param objectOrFileRef A configuration object or a file path to load the configuration from.
     */
    public loadSync(objectOrFileRef: Record<string, unknown> | string): void {
        this.preLoad(objectOrFileRef);
        const rawConfig = this.adapter.loadSync(objectOrFileRef);
        this.postLoad(rawConfig);
    }

    /**
     * Retrieves a value from the configuration object based on the provided path.
     * @param key A string key representing the value to be returned.
     * @returns The value at the specified path.
     */
    public get<K extends ObjectKeys<SchemaValue<T>>>(
        key: K,
    ): KeyValue<SchemaValue<T>, K> {
        const value = structuredClone(this.currentConfigValue[key]);

        this.logger.log(
            `Retrieved configuration value for key: ${String(key)}`,
            'get',
        );

        return value;
    }

    /**
     * Sets a value in the configuration object based on the provided path.
     * @param key A string key representing the value to be changed.
     * @param value The new value to set at the specified path.
     */
    public set<K extends ObjectKeys<SchemaValue<T>>>(
        key: K,
        value: KeyValue<SchemaValue<T>, K>,
    ): void {
        const oldValue = structuredClone(this.currentConfigValue[key]);
        this.currentConfigValue[key] = structuredClone(value);

        this.logger.log(
            `Set configuration value for key: ${String(key)}`,
            'set',
        );

        this.runListener(key, structuredClone(value), oldValue);
    }

    /**
     * Adds a listener to a specific key in the configuration object.
     * @param key The key to listen to.
     * @param listener The listener function to be called when the key changes.
     */
    public addListener<K extends ObjectKeys<SchemaValue<T>>>(
        key: K,
        listener: ListenerFunction<SchemaValue<T>>,
    ): void {
        if (!this.listenerMap[key]) {
            this.listenerMap[key] = [];
        }
        this.listenerMap[key]?.push(listener);

        this.logger.log(
            `Registered listener for key: ${String(key)}`,
            'registeredListener',
        );
    }

    /**
     * Starts a reload interval that reloads the configuration from the object or file reference at the specified interval.
     * @param intervalMs The interval in milliseconds at which to reload the configuration.
     */
    public startReloadInterval(intervalMs?: number): void {
        if (!this.intervalCallback) {
            if (intervalMs)
                this.intervalCallback =
                    this.createReloadIntervalCallback(intervalMs);
            else if (this.reloadIntervalMs)
                this.intervalCallback = this.createReloadIntervalCallback(
                    this.reloadIntervalMs,
                );

            if (this.intervalCallback)
                this.logger.log(
                    'Started reload interval.',
                    'startReloadInterval',
                );
        }
    }

    /**
     * Stops the reload interval if it is currently running.
     */
    public stopReloadInterval(): void {
        if (this.intervalCallback) {
            clearInterval(this.intervalCallback);
            this.intervalCallback = null;
        }

        this.logger.log('Stopped reload interval.', 'stopReloadInterval');
    }

    /**
     * Sets the adapter to be used for loading configuration.
     * @param adapter The adapter to be used for loading configuration.
     */
    public setAdapter(adapter?: Adapter): void {
        if (adapter) this.adapter = adapter;
        if (this._adapter) return;
        if (typeof this.objectOrFileRef === 'string') {
            if (this.objectOrFileRef.endsWith('.json')) {
                this.adapter = new JsonAdapter();
            }
            if (
                this.objectOrFileRef.endsWith('.yaml') ||
                this.objectOrFileRef.endsWith('.yml')
            ) {
                this.adapter = new YamlAdapter();
            }
        } else {
            this.adapter = new ObjectAdapter();
        }
    }

    private compileSchema() {
        const schemaDef = Object.fromEntries(
            Object.entries(this.schema).map(([key, value]) => [
                key,
                value.schema,
            ]),
        ) as { [K in keyof T]: T[K]['schema'] };
        this.compiledSchema = z.object(schemaDef);

        this.logger.log('Compiled schema successfully.', 'compiledSchema');
    }

    private preLoad(objectOrFileRef: Record<string, unknown> | string): void {
        this.objectOrFileRef = objectOrFileRef;
        this._loadMethod = this.loadSync;
        this.setAdapter();
    }

    private postLoad(rawConfig: Record<string, unknown>): void {
        const oldValues = structuredClone(this._currentConfigValue);
        this._currentConfigValue = this.mergeAndParseValues(rawConfig);
        this.runListeners(this._currentConfigValue, oldValues);
        this.startReloadInterval();
        this.logger.log('Loaded configuration successfully.', 'load');
    }

    private mergeAndParseValues(
        values: Record<string, unknown>,
    ): SchemaValue<T> {
        const envValues = this.getEnvValues();
        return this.compiledSchema.parse({ ...values, ...envValues });
    }

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

    private runListeners(
        newValues: SchemaValue<T>,
        oldValues?: SchemaValue<T>,
    ): void {
        if (oldValues) {
            const changedKeys = this.getChangedKeys(oldValues, newValues);
            for (const changedKey of changedKeys) {
                this.runListener(
                    changedKey,
                    newValues[changedKey],
                    oldValues[changedKey],
                );
            }
        }
    }

    private getChangedKeys(
        oldConfig: SchemaValue<T>,
        newConfig: SchemaValue<T>,
    ): ObjectKeys<SchemaValue<T>>[] {
        const changedKeys: ObjectKeys<SchemaValue<T>>[] = [];
        const configKeys = Object.keys(oldConfig) as ObjectKeys<
            SchemaValue<T>
        >[];

        for (const key of configKeys) {
            if (!isEqual(oldConfig[key], newConfig[key])) {
                changedKeys.push(key);
            }
        }
        return changedKeys;
    }

    private runListener<K extends ObjectKeys<SchemaValue<T>>>(
        key: K,
        newValue: KeyValue<SchemaValue<T>, K>,
        oldValue: KeyValue<SchemaValue<T>, K>,
    ): void {
        this.logger.log(
            `Running listeners for key: ${String(key)}`,
            'runListeners',
        );

        this.listenerMap[key]?.forEach((listener) =>
            listener(newValue, oldValue),
        );
    }

    private createReloadIntervalCallback(intervalMs: number): NodeJS.Timeout {
        return setInterval(async () => {
            await this.loadMethod(this.objectOrFileRef);
            this.logger.log('Reloaded configuration successfully.', 'reload');
        }, intervalMs);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InferConfigValue<T extends ZodConfig<any>> = z.infer<
    CompiledSchema<T['schema']>
>;

export { Adapter } from './adapters/Adapter';
export { JsonAdapter } from './adapters/JsonAdapter';
export { ObjectAdapter } from './adapters/ObjectAdapter';
export { YamlAdapter } from './adapters/YamlAdapter';
export * from './errors';

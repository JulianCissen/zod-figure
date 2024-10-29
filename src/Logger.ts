type LogLevels = 'silent' | 'debug' | 'info' | 'error';
export type LogFunction = (message: string, level: LogLevels) => void;
type InternalLogMethod = (message: string, event: LogEvents) => void;
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
    | 'registeredListener'
    | 'adapterSet'
    | 'compiledEnvSchema';
export type LogLevelsMap = Record<LogEvents, LogLevels>;
const defaultLogLevels: LogLevelsMap = {
    // debug
    get: 'debug',
    runListeners: 'debug',
    set: 'debug',
    startReloadInterval: 'debug',
    stopReloadInterval: 'debug',
    registeredListener: 'debug',
    compiledEnvSchema: 'debug',
    // info
    compiledSchema: 'info',
    load: 'info',
    reload: 'info',
    adapterSet: 'info',
    // error
    error: 'error',
};

export class Logger {
    private logMethod?: LogFunction;
    private logLevelMap = defaultLogLevels;
    private getLogLevel(event: LogEvents): LogLevels {
        return this.logLevelMap[event];
    }

    constructor({
        logger,
        logLevelMap,
    }: {
        logger?: LogFunction | boolean | undefined;
        logLevelMap?: Partial<LogLevelsMap> | undefined;
    }) {
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
     * Log a message with the appropriate log level.
     * @param message The message to log.
     * @param event The event that triggered the log.
     */
    public log: InternalLogMethod = (message, event) => {
        const logLevel = this.getLogLevel(event);
        if (this.logMethod) this.logMethod(message, logLevel);
    };
}

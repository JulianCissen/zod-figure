import { Logger } from '../Logger';

export type ObjectOrFileRef = Record<string, unknown> | string;

export abstract class Adapter {
    protected logger: Logger;

    constructor({ logger }: { logger?: Logger | undefined } = {}) {
        if (logger) {
            this.logger = logger;
        } else {
            // Initialize with a default Logger. This will be overridden by the ZodConfig logger when assigned to an instance.
            this.logger = new Logger({});
        }
    }

    abstract load(
        objectOrFileRef: ObjectOrFileRef,
    ): Promise<Record<string, unknown>>;
    abstract loadSync(
        objectOrFileRef: ObjectOrFileRef,
    ): Record<string, unknown>;
}

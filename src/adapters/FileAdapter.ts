import { Adapter, type ObjectOrFileRef } from './Adapter';
import { AdapterError, ReadError } from '../errors';
import type { Logger } from '../Logger';
import { readFile } from 'fs/promises';
import { readFileSync } from 'fs';

export abstract class FileAdapter extends Adapter {
    private encoding: BufferEncoding;

    constructor({
        encoding = 'utf-8',
        logger,
    }: {
        encoding: BufferEncoding;
        logger?: Logger | undefined;
    }) {
        super({ logger });
        this.encoding = encoding;
    }

    protected abstract parseFile(fileContent: string): Record<string, unknown>;

    public async load(path: ObjectOrFileRef): Promise<Record<string, unknown>> {
        if (typeof path !== 'string') {
            this.logger.log('Adapter cannot handle this input type.', 'error');
            throw new AdapterError();
        }
        return this.parseFile(await this.readFile(path));
    }
    public loadSync(path: ObjectOrFileRef): Record<string, unknown> {
        if (typeof path !== 'string') {
            this.logger.log('Adapter cannot handle this input type.', 'error');
            throw new AdapterError();
        }
        return this.parseFile(this.readFileSync(path));
    }

    private async readFile(path: string): Promise<string> {
        try {
            return await readFile(path, { encoding: this.encoding });
        } catch {
            this.logger.log(`Could not read file at ${path}.`, 'error');
            throw new ReadError(`Could not read file at ${path}.`);
        }
    }
    private readFileSync(path: string): string {
        try {
            return readFileSync(path, { encoding: this.encoding });
        } catch {
            this.logger.log(`Could not read file at ${path}.`, 'error');
            throw new ReadError(`Could not read file at ${path}.`);
        }
    }
}

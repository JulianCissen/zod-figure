import { FileAdapter } from './FileAdapter';
import type { Logger } from '../Logger';
import { ParseError } from '../errors';
import { jsonParser } from '../parseJson';

export class JsonAdapter extends FileAdapter {
    constructor({
        encoding = 'utf-8',
        logger,
    }: {
        encoding?: BufferEncoding;
        logger?: Logger;
    } = {}) {
        super({ encoding, logger });
    }

    protected parseFile(fileContent: string): Record<string, unknown> {
        const parsedContent = jsonParser.safeParse(fileContent);
        if (!parsedContent.success) {
            this.logger.log('Could not parse JSON.', 'error');
            throw new ParseError('Could not parse JSON file.');
        }
        return parsedContent.data;
    }
}

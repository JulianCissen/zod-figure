import { FileAdapter } from './FileAdapter';
import type { Logger } from '../Logger';
import { ParseError } from '../errors';
import YAML from 'yaml';

export class YamlAdapter extends FileAdapter {
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
        try {
            return YAML.parse(fileContent);
        } catch {
            this.logger.log('Could not parse YAML.', 'error');
            throw new ParseError('Could not parse YAML file.');
        }
    }
}

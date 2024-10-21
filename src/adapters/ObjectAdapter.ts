import { Adapter, type ObjectOrFileRef } from './Adapter';
import { AdapterError } from '../errors';

export class ObjectAdapter extends Adapter {
    public async load(
        objectOrFileRef: ObjectOrFileRef,
    ): Promise<Record<string, unknown>> {
        return await Promise.resolve(this.loadSync(objectOrFileRef));
    }
    public loadSync(objectOrFileRef: ObjectOrFileRef): Record<string, unknown> {
        if (typeof objectOrFileRef !== 'object') {
            this.logger.log('Adapter cannot handle this input type.', 'error');
            throw new AdapterError();
        }
        return objectOrFileRef;
    }
}

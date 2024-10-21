import { Adapter } from '../../src';

export class CustomAdapter extends Adapter {
    public load(): Promise<Record<string, unknown>> {
        return Promise.resolve(this.loadSync());
    }
    public loadSync(): Record<string, unknown> {
        return { host: 'localhost', port: 3000 };
    }
}

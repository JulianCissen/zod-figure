export class AdapterError extends Error {
    constructor(message: string = 'Adapter cannot handle this input type.') {
        super(message);
        this.name = 'AdapterError';
    }
}

export class NotLoadedError extends Error {
    constructor(message: string = 'Config not loaded.') {
        super(message);
        this.name = 'NotLoadedError';
    }
}

export class ParseError extends Error {
    constructor(message: string = 'Could not parse configuration.') {
        super(message);
        this.name = 'ParseError';
    }
}

export class ReadError extends Error {
    constructor(message: string = 'Could not read file.') {
        super(message);
        this.name = 'ReadError';
    }
}

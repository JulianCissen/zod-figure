
## Table of Contents
- [Installation](#installation)
- [Basic usage](#basic-usage)
- [new ZodConfig](#new-zodconfig)
- [config.load](#configload)
- [config.loadSync](#configloadsync)
- [config.get](#configget)
- [config.set](#configset)
- [config.addListener](#configaddlistener)
- [config.startReloadInterval](#configstartreloadinterval)
- [config.stopReloadInterval](#configstopreloadinterval)


## Installation
```sh
npm install zod-figure
```

## Basic usage
Import ZodConfig:
```ts
import { ZodConfig } from 'zod-figure';
```

Create a new ZodConfig instance. You can provide a schema directly, or define a callback function that uses the exposed zod variable to create a new config:
```ts
// Define your own schema from scratch:
import z from 'zod';
const config = new ZodConfig({
    schema: {
        host: { schema: z.string(), env: 'HOST' },
        port: { schema: z.coerce.number(), env: 'PORT' },
    },
});

// Define a schema using the provided zod variable:
const config = new ZodConfig({
    schema: (z) => ({
        host: { schema: z.string(), env: 'HOST' },
        port: { schema: z.coerce.number(), env: 'PORT' },
    }),
});
```

Then load your config. Most likely you'll want to provide a relative path to your config json file:
```ts
await config.load('./config.prod.json');
```

When this is done, your config variables will be exposed and can be retrieved as such:
```ts
config.get('host');
config.get('port');
```

## new ZodConfig
Initialize a new configuration instance. The constructor must include a schema. A schema is an object containing keys, with as value an object containing:
- A `schema` property, containing the `zod` schema used to parse the variable.
- An optional `env` property. When set, the config will evaluate all environment variables when loading a new config, and apply the values to the config values. Environment variables override values supplied by a regular adapter.

The `schema` property supplied to the constructor can either be a plain schema, or a callback function that exposes the installed `zod` instance to create a new schema. This enables you to reduce the imports in your component.

```ts
// Define your own schema from scratch:
import z from 'zod';
const config = new ZodConfig({
    schema: {
        host: { schema: z.string(), env: 'HOST' },
        port: { schema: z.coerce.number(), env: 'PORT' },
    },
});

// Define a schema using the provided zod variable:
const config = new ZodConfig({
    schema: (z) => ({
        host: { schema: z.string(), env: 'HOST' },
        port: { schema: z.coerce.number(), env: 'PORT' },
    }),
});
```
The ZodConfig constructor supports the following optional properties:
- `customAdapter`, allows a custom Adapter instance used to load config values. When undefined ZodConfig will attempt to automatically determine what standard adapter to use. Supported standard adapters are:
    - `JsonAdapter`
    - `ObjectAdapter`
    - `YamlAdapter`
- `logger`, a custom logging function to use to log events. When undefined, no logs will be output. When set to true, the default logger (`console`) will be used.
- `logLevelMap`, a custom logLevelMap used. This maps config events to a config level.
- `reloadIntervalMs`, when set to a number, the config will reload every `value` milliseconds. This enables hot reloading of configuration variables.

```ts
import CustomAdapter from './CustomAdapter.ts';

const config = new ZodConfig({
    schema: (z) => ({
        host: { schema: z.string(), env: 'HOST' },
        port: { schema: z.coerce.number(), env: 'PORT' },
    }),
    customAdapter: new CustomAdapter(),
    logger: (message, level) =>
        level !== 'silent' ? console[level](message) : undefined,
    logLevelMap: {
        get: 'debug',
    },
    reloadIntervalMs: 1000 * 60 * 30,
});
```

## config.load
Load a configuration asynchronously (default). The supplied argument can either be:
- An object.
- A string.

When the supplied argument is an object, the object will be parsed and used as config. It will use the default ObjectAdapter for this. This is the simplest way to use ZodConfig, but probably not the way you want to use it.

When the supplied argument is a string, it will be interpreted as a file location. ZodConfig will attempt to load the file at the location. Based on whether the extension is `json`, `.yml` or `.yaml`, the default `JsonAdapter` or the default `YamlAdapter` will be used to parse the config file. If the supplied string does not resolve to a path a `ReadError` will be thrown.

```ts
import path from 'path';
config.load(path.resolve(__dirname, './config.prod.json'));
```

## config.loadSync
Loads a configuration object sychronously. This blocks IO. Be very careful using this in combination with the reload functionality (even moreso on a short timer), as this will block your application until the config is loaded.

This is mostly meant to be used in conjunction with configuration files in non ESM modules.
```ts
import path from 'path';
config.loadSync(path.resolve(__dirname, './config.prod.json'));
```

## config.get
Get first level variables by supplying the key to the get method:
```ts
config.get('host');
```
This returns a structured clone of the variable. This means that any changes made to the returned value are not persisted to the config.

## config.set
To change a config variable, you can use config.set:
```ts
config.set('host', 'remotehost');
```
This sets the indicated variable to the new value. The value is cloned, so any changes done later to the variable are not persisted to the config.

## config.addListener
Register a listener on a specific variable key. Whenever the variable is mutated (either through (re)load or calling the `set` method), all registered listeners will be called. You can use this to 'watch' config variables to be automatically updated when a config file gets swapped out.
```ts
config.addListener('host', (newValue, oldValue) => {
    console.log(`Host was set to ${newValue}!`);
});
```

## config.startReloadInterval
Will start automatic reload functionality if it was not yet running. Will reload config values every `value` milliseconds.
```ts
// Reload every 30 minutes.
config.startReloadInterval(1000 * 60 * 30);
```

## config.stopReloadInterval
Stops automatic reload functionality if it is running.
```ts
config.stopReloadInterval();
```

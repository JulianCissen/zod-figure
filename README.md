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

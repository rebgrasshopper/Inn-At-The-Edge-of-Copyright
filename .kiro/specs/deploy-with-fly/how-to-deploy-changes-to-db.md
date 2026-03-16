For first deploy, deploy, then SSH in to run migrations:

```sh
fly deploy
```

After it's deployed:

```sh
fly ssh console
```

Then in the container:

```sh
node dist/db/migrate.js
node dist/db/seed.js
exit
```

For second deploy, re-deploy and then migrate but don't seed.

```sh
fly deploy
```

Visit the URL to start the machine

```
fly ssh console
node dist/db/migrate.js
exit
```

## Running Fix Scripts

When schema changes need to be applied to production without losing data, use the fix script:

```sh
fly deploy
```

Visit the URL to start the machine, then:

```sh
fly ssh console
node dist/db/fix-production.js
exit
```

The fix script handles adding new columns and updating existing data. After running successfully, the fixes can be removed from the script.

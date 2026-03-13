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

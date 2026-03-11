Now redeploy, then SSH in to run migrations:

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

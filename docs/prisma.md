# Prisma

## Set up

```sh
cd functions
npm install prisma --D
npm install @prisma/client -S

npx prisma init --datasource-provider postgresql
npx prisma generate
npx prisma migrate reset

npx prisma migrate dev --name init
npx prisma migrate deploy # use this in dev/uat to prevent from new migration files
```

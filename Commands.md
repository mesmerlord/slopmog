Server: 152.53.39.233
ssh root@152.53.39.233

deploy production.yml slopmog_frontend slopmog_prisma_studio slopmog_queue && \
 docker compose -f production.yml run --rm slopmog_prisma_studio env $(cat .env.production | grep -v "#" | xargs) npm run db:deploy

docker compose -f production.yml run --rm slopmog_prisma_studio env $(cat .env.production | grep -v "#" | xargs) npx prisma db reset

```
docker compose -f production.yml run --rm prisma_studio env $(cat .env.production | grep -v "#" | xargs) npm run stripe:products
```

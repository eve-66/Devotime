# Devotime

研究室の作業時間をシンプルに記録できるタイムカードアプリです。

## Docker でまとめて起動

1. `.env.example` を `.env` にコピーします
2. 必要なら `NEXTAUTH_SECRET` をローカル用の値に変更します
3. `docker compose up` を実行します
4. [http://localhost:3000](http://localhost:3000) を開きます

`web` コンテナは起動時に以下を自動で行います。

- Prisma Client の生成
- `prisma migrate deploy`
- Next.js 開発サーバーの起動

以降はソースコードの変更が bind mount 経由で反映されます。依存関係や Dockerfile を変更したときだけ `docker compose up --build` を再実行してください。

完全に作り直したいときは次を実行します。

```bash
docker compose down -v
```

## ローカルで web だけ動かす

DB だけ Docker で起動し、web はホストで実行することもできます。

```bash
docker compose up -d postgres
npm install
npm run dev
```

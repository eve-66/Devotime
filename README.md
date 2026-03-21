# Devotime

日々の作業時間をシンプルに記録できるタイムカードアプリです。

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

## 本番デプロイのメモ

本番では `Vercel + Supabase(Postgres)` の構成を想定しています。

- Vercel では `npm run build` 時に `prisma generate` が自動で走ります
- Prisma のマイグレーションは自動実行せず、`npm run prisma:migrate:deploy` を明示的に実行してください
- `DATABASE_URL` はアプリ実行用の pooled 接続、`DIRECT_URL` は Prisma CLI 用の direct 接続に分ける想定です
- Vercel Functions のリージョンは Supabase と近い場所に合わせてください。日本向けなら Tokyo 近辺を推奨します

### Vercel に設定する環境変数

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

`NEXTAUTH_URL` は本番ドメインを設定してください。Vercel の System Environment Variables を有効にしている場合は自動解決もできますが、固定で入れておくとわかりやすいです。

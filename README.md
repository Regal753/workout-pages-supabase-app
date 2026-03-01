# Workout Pages App (verified)

これは **GitHub Pages に置く公開用フロント**です。  
ログ本体はこの repo には保存せず、**Supabase に保存**します。

## このフォルダに含まれるもの
- `index.html`
- `app.js`
- `styles.css`
- `config.js`
- `manifest.webmanifest`
- `sw.js`
- `icons/icon-192.png`
- `icons/icon-512.png`
- `supabase.sql`

## セットアップ
1. Supabase project を作成
2. `supabase.sql` を SQL Editor で実行
3. Auth > Users で自分用ユーザーを1件作成
4. `config.js` の `SUPABASE_URL` / `SUPABASE_ANON_KEY` を差し替え
5. このフォルダ一式を **そのまま** Pages repo に置く
6. GitHub Pages を `main / (root)` で公開
7. スマホで開いてログイン

## 注意
- このアプリは **保存ボタンを押したときだけクラウド保存**します。
- GitHub / Obsidian への自動蓄積は **別 repo (`workout-vault-sync-verified`)** の workflow で行います。

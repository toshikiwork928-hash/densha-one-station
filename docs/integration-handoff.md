# Claude Code の山岳編との統合

## 作業の分離

Codexの変更は専用ブランチ `codex/densha-shiokaze-audio`、専用worktreeで作成した。

- Codex: 管理worktree `densha-shiokaze-audio`、ブランチ `codex/densha-shiokaze-audio`
- Claude Codeの元作業: worktree `brave-franklin-8b86f6`、ブランチ `claude/densha-local-migration-727b81`
- 共通の参照点: `af42387`（公開mainにある山岳編の内容を開発repoに保存したsnapshot）

`af42387` は今回の汐風線・音の改修ではなく、公開済み山岳編を土台にするための保存点。
Claude Code側の未commit変更・作業フォルダは編集していない。山岳線の専用データや時刻表も本改修では変更しない。
共有モジュールへの変更はあるため、山岳線を含めた動作確認は必要。

## 今回の変更

- 汐風線: 10駅、駅間合計10.6km、高架7駅・地上3駅。
- 3駅の2面4線高架駅、羽根町の支線ホーム、海浜公園の片側副線と旧駅舎風外観。
- 道路跨線2か所、路面電車跨線、鋼トラス橋、描画専用支線。
- 往復の終着進入速度照査、これを含む時刻表・自動運転計画。
- VVVFの起動・高域・音量変化を改良。従来音へ切替可能。実車録音は使わない。

駅間距離は公式営業キロを使用するが、曲率・構造物位置と寸法・9mの高架高さはゲーム向けの概形。
終着進入照査もゲーム用設定で、実路線のATS配置・照査値の再現ではない。
参照先と年代差は [shiokaze-reference.md](./shiokaze-reference.md) に記載。

## 合流方法

1. Claude Code側の山岳編修正を確認し、元ブランチでcommitする。未保存の編集が残ったまま合流しない。
2. Codexブランチの `af42387` より後にある本改修commitを確認する。
3. 必要なcommitをClaude側の作業ブランチへ古い順にcherry-pickする。ブランチ全体を無条件で上書きコピーしない。
4. 同じ箇所を両者が変更していれば競合を解決する。山岳編の修正と汐風線・音の変更の両方を残す。
5. 検証後、統合したアプリを公開repoのmainへ反映し、Pagesの成功を確認する。

同じGit repoのworktreeなので、Codex側で作成したcommitは元作業フォルダからも参照できる。
改修commitの確認例:

```bash
git log --reverse --oneline af42387..codex/densha-shiokaze-audio -- apps/densha-one-station
```

対象commitを確認した後、元ブランチ側で実行する:

```bash
git cherry-pick <改修commitのSHA>
```

`af42387` 自体を追加する必要があるかは統合先の状態による。Claudeの元作業が既に同じ山岳編を含むなら、snapshotを重ねて取り込む必要はない。
cherry-pickは競合が発生しないことを保証する仕組みではない。特に路線の型・逆方向生成・駅描画・信号/ATS・音・UIの共有部分は差分を確認する。

## 統合後の確認

```bash
cd apps/densha-one-station
npm run typecheck
npm run build
npm run verify:routes
npm run timetable -- --shiokaze-only
```

- 汐風線の普通・急行・特急、往復、4/6/8両の停止位置と時刻表。
- 終着1kmからの速度表示、照査超過での非常制動、停止後の復帰。
- 地上3駅と高架7駅、道路・路面電車の跨線、鉄橋、支線の左右と高さ。
- 霧峰線の往復、2300系2/4両、交換駅、急勾配での運転、Claude側の追加修正。
- サウンドタブの改良/従来切替、設定保存、消音、スマホの操作ボタン。

通常の `npm run timetable` は山岳線の時刻表も再生成する。汐風線のみの調整には `--shiokaze-only` を使う。

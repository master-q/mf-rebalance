# mf-rebalance

マネーフォワードに登録しているポートフォリオから積立投資を提案します。
実際に資産を売買するには証券会社に手動で注文する必要があります。

このスクリプトは[mf-all-updater](https://github.com/tekiomo/mf-all-updater)を元にしています。

## 使い方

```sh
$ git clone git@github.com:master-q/mf-rebalance.git
$ cd mf-rebalance
$ yarn
$ vi run.sh
#!/bin/sh

export EMAIL="foo@example.com" # マネーフォワードに登録したメールアドレス
export PASSWORD="foobarbaz" # マネーフォワードのパスワード
export RATE="0.6" # 株式比率
export KEEP="300 * 10000" # 現金保有(円)
export TIME_BOND="2" # 債券の積立回数
export DAY="10 + 2 * 23" # 積立期間(日)

(cd $HOME/src/mf-rebalance && yarn fetch)
$ ./run.sh
yarn run v1.21.1
$ node index.js
現金(円): ---円
現金(ドル): ---円
株式: ---円
債券: ---円
満期まで保有する債券: ---円
現在の株式比率: 60.32%
資産総額: ---円

### 以下で積立 ###
* eMAXIS Slim米国株式: ---円 x 56回
* VOO: ---円 x 9.74回
* V{C,G}{I,L}T: ---円 x 2回
Done in 16.75s.
```

## 注意

資産の種別を分類が非常にいいかげんです。皆様の資産の種類に合わせて以下を修正する必要があるかもしれません。

```javascript
$ git grep -C 4 "/\.test"
index.js-  }));
index.js-  let money_yen = 0;
index.js-  let money_usd = 0;
index.js-  result_m.forEach(function(item, index, array) {
index.js:    if (/ドル/.test(item[0])) {
index.js-      money_usd += getnum(item[1]);
index.js-    } else {
index.js-      money_yen += getnum(item[1]);
index.js-    }
--
index.js-  }));
index.js-  let equity = 0;
index.js-  let bond = 0;
index.js-  result_eq.forEach(function(item, index, array) {
index.js:    if (/債/.test(item[1])) {
index.js-      bond += getnum(item[5]);
index.js-    } else {
index.js-      equity += getnum(item[5]);
index.js-    }
--
index.js-    const tds = [...tr.getElementsByTagName('td')];
index.js-    return tds.map(td => td.textContent);
index.js-  }));
index.js-  result_mf.forEach(function(item, index, array) {
index.js:    if (/ノムラ・グローバル・セレクト・トラスト/.test(item[0])) {
index.js-      money_usd += getnum(item[4]);
index.js-    } else {
index.js-      equity += getnum(item[4]);
index.js-    }
--
index.js-    const tds = [...tr.getElementsByTagName('td')];
index.js-    return tds.map(td => td.textContent);
index.js-  }));
index.js-  result_pns.forEach(function(item, index, array) {
index.js:    if (/株式/.test(item[0])) {
index.js-      equity += getnum(item[2]);
index.js-    } else {
index.js-      bond += getnum(item[5]);
index.js-    }
```

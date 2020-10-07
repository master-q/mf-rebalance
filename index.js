const puppeteer = require('puppeteer');

if (!process.env.EMAIL || !process.env.PASSWORD) {
  throw new Error('環境変数にEMAILまたはPASSWORDが指定されていません')
}

function getnum(str) {
  return Number(str.replace(/[^\-0-9\.]/g,''));
}

function round(num) {
  return Math.round(num * 100) / 100
}

function safeEval(val) {
  return Function('"use strict";return ('+val+')')();
}

function showResult(money_yen, money_usd, equity, bond, total, exchange) {
  // 環境変数から設定を読み込む
  const rate = safeEval(process.env.RATE);
  const keep = safeEval(process.env.KEEP);
  const time_to_keep = safeEval(process.env.TIME_TO_KEEP);
  const time_bond = safeEval(process.env.TIME_BOND);
  const day = safeEval(process.env.DAY);
  const month = day / 23

  // 検算
  if (Math.abs(money_yen + money_usd + equity + bond - total) > 10) {
    throw new Error("検算の結果、資産総額が一致しません " + (money_yen + money_usd + equity + bond) + " != " + total);
  }

  // 資産の現状を表示
  console.log("現金(円): " + money_yen + "円");
  console.log("現金(ドル): " + money_usd + "円(" + round(money_usd / exchange) + "ドル)");
  console.log("為替: " + exchange + "円/ドル");
  console.log("株式: " + equity + "円");
  console.log("債券: " + bond + "円");
  console.log("現在の株式比率: " + round(equity / (equity + bond) * 100) + "%");
  console.log("現在の現金保有比率: " + round((money_yen + money_usd) / total * 100) + "%");
  console.log("資産総額: "+ total + "円");

  // 積立方針を決定
  equity_take_d = (total - keep) * rate - equity;
  equity_take_y = money_yen - keep;
  bond_take = (total - keep) * (1 - rate) - bond;

  if (equity_take_y < 0) {
    voo = equity_take_d / (4 * month);
  } else{
    voo = (equity_take_d - equity_take_y) / (4 * month);
  }
  vcgilt = bond_take / time_bond;

  console.log("\n### 以下で積立 ###");
  if (equity_take_y < 0) {
    console.log("* ドル=>円: " + Math.abs(round(equity_take_y / exchange / time_to_keep)) + "ドル x " + time_to_keep + "回");
  } else {
    console.log("* 株式投資信託: " + round(equity_take_y / day) + "円 x " + day + "回");
  }
  console.log("* 株式ETF: " + round(voo / exchange) + "ドル x " + round(4 * month) + "回");
  console.log("* 債券ETF: " + round(vcgilt / exchange) + "ドル x " + time_bond + "回");
}

let error = null
const main = async () => {
  const goToOpt = {waitUntil: ['load', 'networkidle0']}

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36');

  // 為替レート取得
  await page.goto('https://info.finance.yahoo.co.jp/fx/convert/?a=1&s=USD&t=JPY', goToOpt);
  const result_ex = await page.evaluate(() => {
    return document.querySelector('.price').textContent;
  });
  const exchange = getnum(result_ex);

  try {
    // id.moneyforward.com で直接ログインすると、 moneyforward.com にはログインできない
    // moneyforward.com からログインページに移動すること
    await page.goto('https://moneyforward.com/', goToOpt);
    await page.click('a[href="/sign_in"]')
    // XXX click しただけではページが真っ白なまま
    // goto で移動し直す
    await page.goto(page.url(), goToOpt);
    // メールアドレスによる認証ページへ移動
    // click だと input[type="email"] が見つからない場合がある
    const signinUrl = await page.evaluate(
        () => Array.from(
          document.querySelectorAll('.buttonWrapper a:nth-child(1)'),
          a => a.getAttribute('href')
        )
      );
    await page.goto(`https://id.moneyforward.com${signinUrl[0]}`, goToOpt);

    await page.type('input[type="email"]', process.env.EMAIL);
    await page.click('input[type="submit"]')

    await page.type('input[type="password"]', process.env.PASSWORD);
    await page.click('input[type="submit"]')

    // 資産を分類してリバランスを提案する
    await page.goto('https://moneyforward.com/bs/portfolio', goToOpt);

    // 資産総額
    const result_t = await page.evaluate(() => {
      return document.querySelector('.heading-radius-box').textContent;
    });
    const total = getnum(result_t);

    // 預金・現金・仮想通貨
    const result_m = await page.$$eval('.table-depo > tbody:nth-child(2) > tr', trs => trs.map(tr => {
      const tds = [...tr.getElementsByTagName('td')];
      return tds.map(td => td.textContent);
    }));
    let money_yen = 0;
    let money_usd = 0;
    result_m.forEach(function(item, index, array) {
      if (/ドル/.test(item[0])) {
        money_usd += getnum(item[1]);
      } else {
        money_yen += getnum(item[1]);
      }
    });

    // 株式（現物）
    const result_eq = await page.$$eval('.table-eq > tbody:nth-child(2) > tr', trs => trs.map(tr => {
      const tds = [...tr.getElementsByTagName('td')];
      return tds.map(td => td.textContent);
    }));
    let equity = 0;
    let bond = 0;
    result_eq.forEach(function(item, index, array) {
      if (/債/.test(item[1])) {
        bond += getnum(item[5]);
      } else {
        equity += getnum(item[5]);
      }
    });

    // 投資信託
    const result_mf = await page.$$eval('.table-mf > tbody:nth-child(2) > tr', trs => trs.map(tr => {
      const tds = [...tr.getElementsByTagName('td')];
      return tds.map(td => td.textContent);
    }));
    result_mf.forEach(function(item, index, array) {
      if (/ノムラ・グローバル・セレクト・トラスト/.test(item[0])) {
        money_usd += getnum(item[4]);
      } else {
        equity += getnum(item[4]);
      }
    });

    // 債券
    const result_bd = await page.$$eval('.table-bd > tbody:nth-child(2) > tr', trs => trs.map(tr => {
      const tds = [...tr.getElementsByTagName('td')];
      return tds.map(td => td.textContent);
    }));
    result_bd.forEach(function(item, index, array) {
      money_usd += getnum(item[1]); // 生の債券はドル現金に計上して使いきる
    });

    // 年金
    const result_pns = await page.$$eval('.table-pns > tbody:nth-child(2) > tr', trs => trs.map(tr => {
      const tds = [...tr.getElementsByTagName('td')];
      return tds.map(td => td.textContent);
    }));
    result_pns.forEach(function(item, index, array) {
      if (/株式/.test(item[0])) {
        equity += getnum(item[2]);
      } else {
        bond += getnum(item[5]);
      }
    });

    showResult(money_yen, money_usd, equity, bond, total, exchange);

    return true
  } catch (e) {
    console.log(e.message);
    error = e
    return false
  } finally {
    await browser.close()
  }
}

(async () => {
  let retries = 0
  let ok = false
  while (retries++ < 10) {
    ok = await main()
    if (ok) {
      break;
    }
  }
  if (!ok) {
    throw error
  }
})()

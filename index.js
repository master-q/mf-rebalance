const puppeteer = require('puppeteer');

if (!process.env.EMAIL || !process.env.PASSWORD) {
  throw new Error('環境変数にEMAILまたはPASSWORDが指定されていません')
}

function getnum(str) {
  return Number(str.replace(/[^0-9]/g,''));
}

(async () => {
  const goToOpt = {waitUntil: ['load', 'networkidle0']}

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // id.moneyforward.com で直接ログインすると、 moneyforward.com にはログインできない
  // moneyforward.com からログインページに移動すること
  await page.goto('https://moneyforward.com/', goToOpt);
  await page.click('a[href="/users/sign_in"]')
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
  let bond_keep = 0;
  result_bd.forEach(function(item, index, array) {
    bond_keep += getnum(item[1]);
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

  // 検算
  if (Math.abs(money_yen + money_usd + equity + bond + bond_keep - total) > 10) {
    throw new Error("検算の結果、資産総額が一致しません");
  }

  console.log("現金(円): " + money_yen);
  console.log("現金(ドル): " + money_usd);
  console.log("株式: " + equity);
  console.log("債券: " + bond);
  console.log("満期まで保有する債券: " + bond_keep);
  console.log("資産総額: "+ total);

  // xxx TODO

  await browser.close()
})();

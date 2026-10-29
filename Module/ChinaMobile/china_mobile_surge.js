/*
 * 中国移动去广告 - Surge iOS port (2026-10-29)
 * Original: ccyykk666/Loon-Plugin/plugins/china-mobile/remove_ads.js
 * Source: https://github.com/ccyykk666/Loon-Plugin
 * Adaptation: Loon $crypto (synchronous) -> WebCrypto AES-CBC (async); Loon object
 * arguments -> Surge query-string arguments; retains original filtering semantics.
 * Requires Surge iOS WebView JavaScript engine (engine=webview).
 */
(async function () {
  'use strict';
  const url = (typeof $request !== 'undefined' && $request.url) || '';
  const original = (typeof $response !== 'undefined' && $response.body) || '';
  const path = (() => { try { return new URL(url).pathname; } catch (_) { return '[unknown-path]'; } })();
  const status = typeof $response === 'object' && $response ? Number($response.status) : 0;

  const DEFAULTS = {
    HideTopFamily: false, HideTopAge: false, HideTopPhone: false,
    HideTopNearby: false, HideTopAI: false, HideTopEnterprise: false,
    BottomClean: true, MineClean: true, Diagnostic: false
  };
  const ARGS = Object.assign({}, DEFAULTS);
  if (typeof $argument === 'string') {
    $argument.split('&').forEach(pair => {
      const i = pair.indexOf('=');
      if (i > 0) {
        const key = decodeURIComponent(pair.slice(0, i));
        const value = decodeURIComponent(pair.slice(i + 1));
        if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) ARGS[key] = value;
      }
    });
  } else if (typeof $argument === 'object' && $argument !== null) {
    Object.assign(ARGS, $argument);
  }
  const enabled = k => ARGS[k] === true || ARGS[k] === 'true' || ARGS[k] === 1 || ARGS[k] === '1';
  // Diagnostics never print encrypted bodies, cookies, tokens, or URL query values.
  const diag = (code) => {
    if (enabled('Diagnostic')) console.log('[ChinaMobile/diag] ' + path + ' ' + code);
  };
  diag('started status=' + status);
  if (!url || status !== 200 || !original) {
    diag('passthrough: status-not-200-or-empty-body');
    return $done({});
  }
  const topKeys = ['HideTopFamily', 'HideTopAge', 'HideTopPhone', 'HideTopNearby', 'HideTopAI', 'HideTopEnterprise'];
  const hasTopChanges = topKeys.some(enabled);
  const isNavigation = /\/DN\/init\/getNavigation(?:\?|$)/i.test(url);
  const isBottom = /\/DN\/bottomNavigationService\/getNavigationInfo(?:\?|$)/i.test(url);
  const isMine = /\/DN\/myPageNew\/getMyPageNew(?:\?|$)/i.test(url);
  if ((isNavigation && !hasTopChanges && !enabled('BottomClean')) ||
      (isBottom && !enabled('BottomClean')) ||
      (isMine && !enabled('MineClean'))) {
    diag('passthrough: feature-disabled');
    return $done({});
  }

  const getHeader = (headers, key) => {
    const actual = Object.keys(headers || {}).find(k => k.toLowerCase() === key.toLowerCase());
    return actual === undefined ? undefined : headers[actual];
  };
  const removeHeader = (headers, key) => {
    Object.keys(headers).forEach(k => { if (k.toLowerCase() === key) delete headers[k]; });
  };
  const rewritePlain = (change) => {
    const json = JSON.parse(original);
    if (!change(json)) { diag('passthrough: unchanged-json'); return $done({}); }
    diag('modified: plain-json');
    return $done({body: JSON.stringify(json)});
  };

  try {
    // Plain JSON, formerly Loon [Rewrite] response.json.replace / response.json.jq.
    if (/^https:\/\/touch\.10086\.cn\/i\/v1\/pay\/popWindowQry\/[^?]+(?:\?.*)?$/i.test(url)) {
      return rewritePlain(obj => { if (obj.data === null) return false; obj.data = null; return true; });
    }
    if (/^https:\/\/ad\.mcloud\.139\.com\/advertapi\/adv-filter\/adv-filter\/AdInfoFilter\/getAdInfos(?:\?.*)?$/i.test(url)) {
      if (!enabled('MineClean')) return $done({});
      return rewritePlain(obj => { if (Array.isArray(obj.body) && !obj.body.length) return false; obj.body = []; return true; });
    }

    const recharge = /\/i\/v1\/cust\/(?:aiMainQry|iopBatchQry)\//i.test(url);
    const h5 = /\/(?:DH\/(?:message_query\/message\/query\/list|myCardVoucher\/getBannerList)|DA\/commonBoard\/getCommonBoard)(?:\?|$)/i.test(url);
    const xPen = String(getHeader($response.headers, 'x-pen'));
    if ((!recharge && h5 && xPen !== '1') || (!recharge && !h5 && xPen !== '14')) {
      diag('passthrough: unexpected-x-pen=' + (/^(1|14)$/.test(xPen) ? xPen : 'other-or-missing'));
      return $done({});
    }

    const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', {fatal: true});
    const enc = t => encoder.encode(t), dec = bytes => decoder.decode(bytes);
    const b64dec = t => Uint8Array.from(atob(String(t).replace(/\s+/g, '')), c => c.charCodeAt(0));
    const b64enc = bytes => {
      let out = '';
      const block = 8192;
      for (let i = 0; i < bytes.length; i += block) {
        out += String.fromCharCode.apply(null, bytes.subarray(i, i + block));
      }
      return btoa(out);
    };
    const AES_KEY = 'RYV0hCV1lV25KYVJ', AES_IV = 'VjFSQ1ZtVkQxRTlQ';
    const H5_KEY = 'UVic06tpXgMNiApm', H5_IV = '9791027341711819';
    const RECHARGE_KEY = '043AOQGK6ykklyZA';
    const importedKeys = new Map();
    async function keyOf(key) {
      if (!importedKeys.has(key)) importedKeys.set(key, crypto.subtle.importKey('raw', enc(key), 'AES-CBC', false, ['encrypt', 'decrypt']));
      return importedKeys.get(key);
    }
    async function decryptJson(text, key, iv) {
      const payload = await crypto.subtle.decrypt({name: 'AES-CBC', iv: enc(iv)}, await keyOf(key), b64dec(text));
      return JSON.parse(dec(new Uint8Array(payload)));
    }
    async function encryptJson(json, key, iv) {
      const payload = await crypto.subtle.encrypt({name: 'AES-CBC', iv: enc(iv)}, await keyOf(key), enc(JSON.stringify(json)));
      return b64enc(new Uint8Array(payload));
    }
    function md5(input) {
      const bytes = Array.from(enc(input));
      const length = bytes.length * 8;
      bytes.push(0x80);
      while (bytes.length % 64 !== 56) bytes.push(0);
      for (let i = 0; i < 8; i++) bytes.push((Math.floor(length / Math.pow(2, 8 * i))) & 255);
      const rot = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
                   5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
                   4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
                   6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
      const K = Array.from({length:64}, (_,i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0);
      let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
      for (let off = 0; off < bytes.length; off += 64) {
        const M = Array.from({length:16}, (_,i) => {
          const j = off + i*4;
          return (bytes[j] | bytes[j+1]<<8 | bytes[j+2]<<16 | bytes[j+3]<<24) >>> 0;
        });
        let a=a0,b=b0,c=c0,d=d0;
        for (let i=0;i<64;i++) {
          let f,g;
          if (i<16) { f=(b&c)|(~b&d); g=i; }
          else if(i<32) { f=(d&b)|(~d&c); g=(5*i+1)%16; }
          else if(i<48) { f=b^c^d; g=(3*i+5)%16; }
          else { f=c^(b|~d); g=(7*i)%16; }
          const oldD=d;
          d=c; c=b;
          const sum=(a+(f>>>0)+K[i]+M[g])>>>0;
          b=(b+((sum<<rot[i])|(sum>>>(32-rot[i]))))>>>0;
          a=oldD;
        }
        a0=(a0+a)>>>0; b0=(b0+b)>>>0; c0=(c0+c)>>>0; d0=(d0+d)>>>0;
      }
      return [a0,b0,c0,d0].map(v => Array.from({length:4},(_,i)=>('0'+((v>>>(8*i))&255).toString(16)).slice(-2)).join('')).join('');
    }
    function signedResult(body) {
      const nonce = getHeader($request.headers, 'x-nonce');
      if (nonce === undefined || nonce === null || nonce === '') throw Error('missing x-nonce');
      const headers = Object.assign({}, $response.headers || {});
      Object.keys(headers).forEach(k => { if (k.toLowerCase() === 'r-token') headers[k] = md5(String(nonce) + '+' + body); });
      if (!Object.keys(headers).some(k=>k.toLowerCase()==='r-token')) headers['r-token'] = md5(String(nonce) + '+' + body);
      removeHeader(headers, 'content-length');
      return {body, headers};
    }

    const str = x => String(x == null ? '' : x);
    const areaBody = p => p && p.rspBody;
    const removeAreaIds = (areas, ids) => areas.filter(a => !ids.includes(str(a && a.areaId)));
    const removeAdsBy = (modules, predicate) => {
      let changed = false;
      modules.forEach(m => {
        if (!Array.isArray(m && m.adverList)) return;
        const before = m.adverList.length;
        m.adverList = m.adverList.filter(a => !predicate(a));
        if (m.adverList.length !== before) changed = true;
      });
      return changed;
    };
    const isWaterfall = area => str(area && area.waterfall)==='1' ||
      (Array.isArray(area && area.additionInfo) && area.additionInfo.some(i=>str(i&&i.name).toLowerCase()==='waterfall' && str(i&&i.value)==='1')) ||
      str(area && area.additionInfoMap && area.additionInfoMap.waterfall)==='1';

    function filterHomePage(payload) {
      const b=areaBody(payload); if(!Array.isArray(b&&b.areaList)) return false;
      const removed=['20250923002','20260529002','20260508002','20241010002','20250609002','20250929002','20241115002','20241213006','20241115004','20241119002'];
      const old=b.areaList.length;
      b.areaList=b.areaList.filter(a=>!removed.includes(str(a&&a.areaId))&&!isWaterfall(a));
      let changed=old!==b.areaList.length;
      const pn=Number(b.lastPageNo);
      if((pn===1||(b.areaList.length===0&&pn>1))&&b.lastPage!==true){b.lastPage=true;changed=true;}
      b.areaList.forEach(a=>{
        if(!Array.isArray(a&&a.moduleList))return;
        const id=str(a.areaId);
        if(id==='20250829002'){
          const len=a.moduleList.length;
          a.moduleList=a.moduleList.filter(m=>str(m&&m.moduleId)!=='XBYYW01');
          if(len!==a.moduleList.length)changed=true;
          const topId={1:'HideTopFamily',2:'HideTopAge',3:'HideTopPhone',4:'HideTopNearby',5:'HideTopAI',6:'HideTopEnterprise'};
          a.moduleList.forEach(m=>{
            if(str(m&&m.moduleId)!=='XBTB01'||!Array.isArray(m.codeTableList))return;
            const before=m.codeTableList.length;
            m.codeTableList=m.codeTableList.filter(t=>!enabled(topId[str(t&&t.tabId)]));
            if(before!==m.codeTableList.length)changed=true;
          });
        }
        if(id==='20250829004'){
          a.moduleList.forEach(m=>{
            if(str(m&&m.moduleId)!=='XBAN01'||!Array.isArray(m.adverList))return;
            const before=m.adverList.length;
            m.adverList=m.adverList.filter(ad=>!JSON.stringify(ad).includes('签到'));
            if(before!==m.adverList.length)changed=true;
          });
        }
        if(id==='20250829008'){
          a.moduleList.forEach(m=>{
            if(str(m&&m.moduleId)!=='XBZB01'||!Array.isArray(m.adverList))return;
            m.adverList.forEach(ad=>{
              if(str(ad&&ad.cornerIsShow)!=='1'&&str(ad&&ad.vCornerMarkShow)!=='1'&&!str(ad&&ad.vCornerMark))return;
              ad.cornerIsShow='0';ad.vCornerMarkShow='0';ad.vCornerMark='';changed=true;
            });
          });
        }
      });return changed;
    }
    function filterNavigation(payload) {
      const b=areaBody(payload);if(!b)return false;let changed=false;
      const map={P00000063396:'HideTopFamily',P00000063397:'HideTopAge',P00000090722:'HideTopPhone',P00000090723:'HideTopNearby',P00000091556:'HideTopEnterprise'};
      const tabs=b.labelList&&b.labelList.topTabList;
      if(Array.isArray(tabs)){
        b.labelList.topTabList=tabs.filter(t=>!enabled(map[str(t&&t.channelId)]));
        if(tabs.length!==b.labelList.topTabList.length)changed=true;
      }
      const disableLingxi=config=>{
        let done=false;
        if(Array.isArray(config&&config.navigationList))config.navigationList.forEach(tab=>{
          if(str(tab&&tab.navigationId)==='qw2305190519'&&str(tab.iconType)==='6'&&str(tab.lingxiFlag)==='1'){
            tab.lingxiFlag='0';done=true;
          }
        });return done;
      };
      if(enabled('BottomClean')){
        if(disableLingxi(b.bnavigationService))changed=true;
        if(Array.isArray(b.configProvinceList))b.configProvinceList.forEach(v=>{if(disableLingxi(v))changed=true;});
      }
      return changed;
    }
    function filterMyPage(payload) {
      if(!enabled('MineClean'))return false;
      const b=areaBody(payload);if(!Array.isArray(b&&b.areaList))return false;
      const ids=['20260610006','20230721008','20230721012','20251024002','20230721020','20251230002','20240624002','20250219002','20230721040','20230928004','20240708002','20230721034'];
      const before=b.areaList.length;b.areaList=removeAreaIds(b.areaList,ids);return before!==b.areaList.length;
    }
    function filterServicePages(payload) {
      const b=areaBody(payload);if(!Array.isArray(b&&b.areaList))return false;
      const isRemaining=str(b.pageCode)==='00028';
      const waterfallAreas=['20260320004','20260320008','20260320012','20260320016','20260320020'];
      const waterfallFloors=['20260320006','20260320010','20260320014','20260320018','20260320022'];
      const clearWaterfall=(b.waterfall&&waterfallFloors.includes(str(b.waterfall.floorCode)))||b.areaList.some(a=>waterfallAreas.includes(str(a&&a.areaId)));
      const removed=['20230515006','20230609002','20230515007','20230621006','20230621022','20230621026','20230621030','20230515017','20230515018','20230719002','20240513002','20230719004',...waterfallAreas];
      if(enabled('MineClean'))removed.push('20230621010','20230621014');
      if(isRemaining)removed.push('20230515019');
      const len=b.areaList.length;b.areaList=removeAreaIds(b.areaList,removed);let changed=len!==b.areaList.length;
      if(clearWaterfall&&b.waterfall!=null){b.waterfall=null;changed=true;}
      b.areaList.forEach(a=>{
        if(!Array.isArray(a&&a.moduleList))return;
        const id=str(a.areaId);
        if(isRemaining&&id==='20230612004'){
          const old=a.moduleList.length;a.moduleList=a.moduleList.filter(m=>str(m&&m.moduleId)!=='market-button-2-001');
          if(old!==a.moduleList.length)changed=true;
        }
        if(isRemaining&&id==='20230510013')if(removeAdsBy(a.moduleList,ad=>str(ad&&ad.markId)==='1392480007'))changed=true;
        if(id==='20230515002')if(removeAdsBy(a.moduleList,ad=>str(ad&&ad.markId)==='1066197397'||str(ad&&ad.vSubject2)==='领取本月红包'))changed=true;
        if(id==='20230515008'){
          if(removeAdsBy(a.moduleList,ad=>str(ad&&ad.markId)==='1535899052'))changed=true;
          const old=a.moduleList.length;
          a.moduleList=a.moduleList.filter(m=>str(m&&m.moduleId)!=='market-banner-1-001'&&(!Array.isArray(m&&m.adverList)||m.adverList.length>0));
          if(old!==a.moduleList.length)changed=true;
        }
      });return changed;
    }
    function filterAggregationData(payload) {
      const b=areaBody(payload);if(!b)return false;let changed=false;
      ['topPullSecond','notSufficientFundsAdver','suspensionAdver'].forEach(k=>{
        if(Object.prototype.hasOwnProperty.call(b,k)){delete b[k];changed=true;}
      });
      if(Array.isArray(b.popUpList)){
        const old=b.popUpList.length;b.popUpList=b.popUpList.filter(x=>str(x&&x.isAdvert)!=='1');
        if(old!==b.popUpList.length)changed=true;
      }
      const config=b.provinceCodeChanage;
      if(Array.isArray(config&&config.areaList))config.areaList.forEach(a=>{
        if(!Array.isArray(a&&a.moduleList))return;
        if(removeAdsBy(a.moduleList, ad=>JSON.stringify(ad).includes('签到')))changed=true;
      });return changed;
    }
    function filterH5(payload) {
      const b=areaBody(payload);if(!b)return false;
      if(/\/DH\/myCardVoucher\/getBannerList(?:\?|$)/i.test(url)){
        if(!Array.isArray(b.adverList)||!b.adverList.length)return false;
        b.adverList=[];return true;
      }
      if(/\/DA\/commonBoard\/getCommonBoard(?:\?|$)/i.test(url)){
        if(!Array.isArray(b.commonBoardDbList))return false;
        const old=b.commonBoardDbList.length;
        b.commonBoardDbList=b.commonBoardDbList.filter(x=>str(x&&x.advLocation)!=='1');
        return old!==b.commonBoardDbList.length;
      }
      let changed=false;
      Object.keys(b).forEach(k=>{
        if(!Array.isArray(b[k]))return;
        const old=b[k].length;b[k]=b[k].filter(x=>str(x&&x.messageId)!=='1541887004');
        if(old!==b[k].length)changed=true;
      });return changed;
    }

    if(recharge){
      const envelope=JSON.parse(original), outParam=envelope&&envelope.data&&envelope.data.outParam;
      if(typeof outParam!=='string'||!outParam){diag('passthrough: missing-recharge-outParam');return $done({});}
      const encryptedText=dec(b64dec(outParam)).replace(/\s/g,'');
      const p=await decryptJson(encryptedText,RECHARGE_KEY,RECHARGE_KEY);
      let changed=false;
      if(/\/i\/v1\/cust\/aiMainQry\//i.test(url)){
        if(p&&str(p.showFlag)!=='0'){p.showFlag='0';changed=true;}
      }else if(Array.isArray(p&&p.specialOfferZone)&&p.specialOfferZone.length){p.specialOfferZone=[];changed=true;}
      if(!changed){diag('passthrough: recharge-unchanged');return $done({});}
      envelope.data.outParam=b64enc(enc(await encryptJson(p,RECHARGE_KEY,RECHARGE_KEY)));
      diag('modified: recharge');
      return $done({body:JSON.stringify(envelope)});
    }
    if(h5){
      const envelope=JSON.parse(original);
      if(!envelope||typeof envelope.body!=='string'){diag('passthrough: h5-body-not-string');return $done({});}
      const p=await decryptJson(envelope.body,H5_KEY,H5_IV);
      if(!filterH5(p)){diag('passthrough: h5-unchanged');return $done({});}
      envelope.body=await encryptJson(p,H5_KEY,H5_IV);
      const result=signedResult(JSON.stringify(envelope));
      diag('modified: h5');
      return $done(result);
    }
    const payload=await decryptJson(original,AES_KEY,AES_IV);
    let changed=false;
    if(/\/DN\/homePage\/getTopAreaList(?:\?|$)/i.test(url))changed=filterHomePage(payload);
    else if(/\/DN\/myPageNew\/getMyPageNew(?:\?|$)/i.test(url))changed=filterMyPage(payload);
    else if(/\/DN\/multipleInterfaces\/aggregationData(?:\?|$)/i.test(url))changed=filterAggregationData(payload);
    else if(isNavigation||isBottom)changed=filterNavigation(payload);
    else if(/\/DN\/searchWord\/getSearchWordInfo(?:\?|$)/i.test(url)){
      const b=areaBody(payload);if(Array.isArray(b&&b.searchWordList)&&b.searchWordList.length){b.searchWordList=[];changed=true;}
    }else if(/\/DA\/baseServiceFunction\/getAdverList(?:\?|$)/i.test(url))changed=filterServicePages(payload);
    if(!changed){diag('passthrough: decrypted-but-no-change');return $done({});}
    const result=signedResult(await encryptJson(payload,AES_KEY,AES_IV));
    diag('modified: main-aes');
    return $done(result);
  }catch(e){
    // Fail open: never send a broken ciphertext or partial JSON back to the app.
    const kind = String(e && e.name || 'Error').replace(/[^A-Za-z0-9]/g, '').slice(0,40);
    const msg = String(e && e.message || '').replace(/[\r\n]/g, ' ').slice(0,120);
    diag('passthrough: exception=' + kind + ' msg=' + msg);
    console.log('[China Mobile Surge] skipped (' + path + '): ' + kind + ' ' + msg);
    $done({});
  }
})();
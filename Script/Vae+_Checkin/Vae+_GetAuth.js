/* Vae+ 授权捕获。仅保存本地签到所需字段，不记录 Cookie 或私钥内容。
 * Surge http-response: requires-body=true, max-size>=262144；MITM api1.starfans.com。
 * 响应可能不是 JSON：仍应独立读取请求 Cookie、响应 Set-Cookie。
 */
(function () {
    'use strict';

    const KEY = 'VAE_AUTH_V2'; // 与 Vae_AutoSign.js 保持兼容
    const URL = /^https:\/\/api1\.starfans\.com\//i;
    const FIELDS = ['userId', 'self_userid', 'uvkey', 'uvsign', 'registrationId', 'sysModel', 'sys_v', 'app_v', 'terminal', 'app_o'];
    const REQUIRED = ['cookie', 'userId', 'sslPubKey', 'uvkey', 'uvsign'];

    function headersOf(source, name) {
        if (!source) return [];
        const values = [];
        if (Array.isArray(source)) {
            // Surge full-header-mode=true 可保留多个 Set-Cookie。
            for (const item of source) {
                if (item && String(item.field || '').toLowerCase() === name.toLowerCase()) {
                    if (item.value != null) values.push(String(item.value));
                }
            }
        } else {
            for (const key of Object.keys(source)) {
                if (key.toLowerCase() !== name.toLowerCase()) continue;
                const item = source[key];
                if (Array.isArray(item)) values.push(...item.map(String));
                else if (item != null) values.push(String(item));
            }
        }
        return values.filter(Boolean);
    }

    function params(source) {
        const out = {};
        for (const part of String(source || '').split('&')) {
            const equal = part.indexOf('=');
            if (equal === -1) continue;
            try {
                out[decodeURIComponent(part.slice(0, equal).replace(/\+/g, ' '))] =
                    decodeURIComponent(part.slice(equal + 1).replace(/\+/g, ' '));
            } catch (_) {}
        }
        return out;
    }

    function parseJson(value) {
        try {
            const parsed = JSON.parse(String(value || ''));
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch (_) {
            return {};
        }
    }

    function findKey(value, depth) {
        if (!value || typeof value !== 'object' || depth > 7) return '';
        for (const name of ['sslPubKey', 'ssl_pub_key']) {
            if (typeof value[name] === 'string' && value[name].length > 140) return value[name];
        }
        for (const name of Object.keys(value)) {
            const found = findKey(value[name], depth + 1);
            if (found) return found;
        }
        return '';
    }

    function mergeCookies(previous, responseHeaders) {
        const cookies = new Map();
        for (const part of String(previous || '').split(';')) {
            const item = part.trim();
            const equal = item.indexOf('=');
            if (equal > 0) cookies.set(item.slice(0, equal), item.slice(equal + 1));
        }
        let found = false;
        for (const value of headersOf(responseHeaders, 'Set-Cookie')) {
            // 兼容未启用 full-header-mode 时被合并成一个字符串的情况；
            // 逗号后必须出现 cookie-name= 才视为另一条 Cookie，避免切开 Expires 日期。
            for (const item of value.split(/,(?=\s*[^\s=;,]+\s*=)/)) {
                const first = item.split(';')[0].trim();
                const equal = first.indexOf('=');
                if (equal <= 0) continue;
                const name = first.slice(0, equal);
                const val = first.slice(equal + 1);
                if (!/^[!#$%&'*+.^_\x60|~\w-]+$/.test(name)) continue;
                found = true;
                if (/(?:^|;)\s*max-age\s*=\s*0\s*(?:;|$)/i.test(item)) {
                    cookies.delete(name);
                } else {
                    cookies.set(name, val);
                }
            }
        }
        return { found, cookie: Array.from(cookies, ([name, value]) => name + '=' + value).join('; ') };
    }

    try {
        const req = typeof $request === 'undefined' ? {} : $request;
        const res = typeof $response === 'undefined' ? {} : $response;
        if (!URL.test(String(req.url || ''))) return $done({});

        const body = parseJson(res.body);
        const rv = params(body.requestVar);
        const device = parseJson(rv.data);
        const action = String(rv.action || '') + ' ' + String(req.url || '');
        const saved = parseJson($persistentStore.read(KEY));

        if (/(?:logout|signout|sign-out|退出登录)/i.test(action) && body.state === true) {
            $persistentStore.write('', KEY);
            console.log('[Vae+ GetAuth] 确认退出登录，已清除旧授权');
            return $done({});
        }

        // 重新登录成功时自动清除旧会话参数，无需额外运行重置脚本。
        // 普通请求的 Cookie 轮换不触发清理，以避免误删有效会话。
        if (body.state === true && /(?:login|sign.?in)/i.test(String(rv.action || ''))) {
            Object.keys(saved).forEach(key => delete saved[key]);
            console.log('[Vae+ GetAuth] 检测到成功登录，旧授权已自动清除');
        }
        const loginUser = body.result && body.result.userInfo && body.result.userInfo.userId;
        const incomingUser = String(loginUser || device.userId || rv.userId || '');
        if (saved.userId && incomingUser && saved.userId !== incomingUser) {
            for (const key of Object.keys(saved)) delete saved[key];
            console.log('[Vae+ GetAuth] 检测到用户切换，已丢弃旧账号授权');
        }

        const oldCookie = String(saved.cookie || '');
        const requestCookie = headersOf(req.headers, 'Cookie')[0] || '';
        const setCookie = mergeCookies(requestCookie || oldCookie, res.headers);
        if (requestCookie || setCookie.found) {
            saved.cookie = setCookie.cookie;
        }
        const changedCookie = !!saved.cookie && saved.cookie !== oldCookie;

        const userAgent = headersOf(req.headers, 'User-Agent')[0] || '';
        if (userAgent) saved.userAgent = userAgent;
        for (const key of FIELDS) {
            const value = device[key] == null ? rv[key] : device[key];
            if (value != null && value !== '') saved[key] = String(value);
        }
        if (incomingUser) saved.userId = incomingUser;

        const publicKey = findKey(body, 0);
        if (publicKey) saved.sslPubKey = publicKey.replace(/-----[^-]+-----|\s/g, '');

        const missing = REQUIRED.filter(key => !saved[key]);
        if (Object.keys(saved).length) {
            saved.updatedAt = Date.now();
            if (changedCookie) {
                saved.authNoticeVersion = missing.length ? 0 : 1;
                if (typeof $notification !== 'undefined') {
                    $notification.post(
                        'Vae+ 授权获取',
                        missing.length ? 'Cookie 已捕获，授权待补齐' : '授权获取成功',
                        missing.length ? '还需捕获：' + missing.join('、') : '签到所需授权已保存，可以运行自动签到。'
                    );
                }
            } else if (!missing.length && saved.authNoticeVersion !== 1) {
                saved.authNoticeVersion = 1;
                if (typeof $notification !== 'undefined') {
                    $notification.post('Vae+ 授权获取', '授权获取成功', '签到所需授权已保存，可以运行自动签到。');
                }
            }
            $persistentStore.write(JSON.stringify(saved), KEY);
        }

        // 只输出存在性与缺失字段名，不输出 Cookie、Token、URL 查询参数或公钥。
        console.log(
            '[Vae+ GetAuth] HTTP=' + String(res.status || '?') +
            '；请求 Cookie=' + (requestCookie ? '有' : '无') +
            '；Set-Cookie=' + (setCookie.found ? '有' : '无') +
            '；本地 Cookie=' + (saved.cookie ? '已保存' : '缺失') +
            '；本次公钥=' + (publicKey ? '有' : '无') +
            '；本次设备字段=' + (FIELDS.filter(k => (device[k] != null && device[k] !== '') || (rv[k] != null && rv[k] !== '')).join(',') || '无') +
            '；授权=' + (missing.length ? '缺少 ' + missing.join(',') : '完整')
        );
    } catch (e) {
        console.log('[Vae+ GetAuth] 处理失败：' + String(e && e.message || e));
    }
    $done({});
})();

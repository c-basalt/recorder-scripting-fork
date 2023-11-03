/// <reference path="./recorder.d.ts" />

/** @param {string} [body] */
const UrlFromBody = (body) => {
    /** @type {any[]?} */
    const streams = JSON.parse(body)?.data?.playurl_info?.playurl?.stream;
    if (!streams) return null;

    const result = streams.filter(x => x.protocol_name == "http_stream")[0].format.filter(x => x.format_name == "flv")[0].codec.filter(x => x.codec_name == "avc")[0];
    const randomIdx = Math.floor(Math.random() * result.url_info.length);
    const url_info = result.url_info[randomIdx];

    return url_info.host + result.base_url + url_info.extra;
};


recorderEvents = {
    onFetchStreamUrl({ roomid, qn }) {


        // 单个链接的复用次数上限，避免反复尝试失效链接
        const REUSE_COUNT_LIMIT = 5;


        if (qn[0] !== 10000) return null;
        const playUrlRsp = fetchSync(`https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo?room_id=${roomid}&protocol=0,1&format=0,1,2&codec=0,1&qn=10000&platform=web&ptype=8&dolby=5&panorama=1`, {
            method: 'GET',
            headers: {
                'Origin': 'https://live.bilibili.com',
                'Referer': 'https://live.bilibili.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
            },
        });
        if (!playUrlRsp.ok) return null;

        let playurl = UrlFromBody(playUrlRsp.body);
        if (!playurl) return null;

        const quality = /\/live-bvc\/\d+\/live_\d+(?:_bs)?_\d+(?:_[a-f0-9]{8})?(_[A-Za-z0-9]+)?\.flv/.exec(playurl);
        if (!quality) {
            console.warn(`unknown playurl quality, fallback to recorder: ${playurl}`);
            return null;
        }

        if (!(quality[1])) {
            console.debug(`saving playurl for room: ${roomid}`);
            sharedStorage.setItem(`playurl:room:${roomid}`, playUrlRsp.body);
            sharedStorage.setItem(`playurl:room:count:${roomid}`, '0');
            return playurl;
        } else {
            console.debug(`fetch quality: ${quality[1]}`);
            let oldUrlBody = sharedStorage.getItem(`playurl:room:${roomid}`);
            if (oldUrlBody) {
                let oldUrlCount = Number(sharedStorage.getItem(`playurl:room:count:${roomid}`))
                console.debug(`checking cached playurl for room: ${roomid}, reuse count: ${oldUrlCount}`);
                const oldUrl = UrlFromBody(oldUrlBody);
                const expires = new URL(oldUrl).searchParams.get('expires');
                if ((Date.now() / 1000) + 10 < Number(expires) && oldUrlCount < REUSE_COUNT_LIMIT) {
                    sharedStorage.setItem(`playurl:room:count:${roomid}`, (oldUrlCount + 1).toString());
                    console.debug(`use cached playurl: ${oldUrl}`);
                    return oldUrl;
                } else {
                    console.debug(`removing expired playurl for room: ${roomid}`);
                    sharedStorage.removeItem(`playurl:room:${roomid}`);
                }
            }
        }

        console.debug('no raw playurl, fallback to recorder');
        return null;
    }
}

'use strict';

class Logger {
    constructor(element) {
        this.container = element;
        this.elem = window.document.createElement('ul');
        this.container.appendChild(this.elem);
    }
    log(text) {
        const _li = window.document.createElement('li');
        _li.textContent = text;
        this.elem.appendChild(_li);
        this.container.scrollTop = this.container.scrollHeight;
    }
}

class ChatView {
    constructor(element) {
        this.container = element;
        this.elem = window.document.createElement('ul');
        this.container.appendChild(this.elem);
    }
    add(text) {
        const _li = window.document.createElement('li');
        _li.textContent = text;
        this.elem.appendChild(_li);
        this.container.scrollTop = this.container.scrollHeight;
    }
}
const Log = new Logger(document.getElementById('log-container'));
const chat = new ChatView(document.getElementById('chat'));
Log.log("Start.");
const signaling_url = "./signaling.php";
const stun_config = { "iceServers": [{ "urls": "stun:stun.l.google.com:19302" }, { "urls": "stun:stun1.l.google.com:19302" }] };

const sleep = s => new Promise(a => setTimeout(a, s));

class SignalingPHP {
    constructor(id, url, conn) {
        this.url = url;
        this.conn = conn;
        this.roomId = id;
    }
    checkICE() {
        return new Promise((resolve, reject) => {
            const body = new FormData();
            body.append('mode', 'joinRoom');
            body.append('roomId', this.roomId);
            fetch(this.url, { method: 'POST', body }).then(res => res.json()).then(res => {
                if (res.result) {
                    if (res.role === "offer") {
                        resolve(false);
                    } else {
                        resolve(JSON.parse(res.sdp));
                    }
                } else {
                    Log.log(res.message);
                    reject(res.message);
                }
            }).catch(reject);
        });
    }
    offer(sdp) {
        return new Promise((resolve, reject) => {
            const body = new FormData();
            body.append('mode', 'offer');
            body.append('roomId', this.roomId);
            body.append('sdp', JSON.stringify(sdp));
            fetch(this.url, { method: 'POST', body }).then(res => res.json()).then(res => {
                if (res.result) {
                    resolve();
                } else {
                    reject(res.message)
                }
            });
        });
    }
    answer(sdp) {
        return new Promise((resolve, reject) => {
            const body = new FormData();
            body.append('mode', 'answer');
            body.append('roomId', this.roomId);
            body.append('sdp', JSON.stringify(sdp));
            fetch(this.url, { method: 'POST', body }).then(res => res.json()).then(res => {
                if (res.result) {
                    resolve();
                } else {
                    reject(res.message)
                }
            });
        });
    }
    waitAnswer() {
        return new Promise((resolve, reject) => {
            const body = new FormData();
            body.append('mode', 'getAnswer');
            body.append('roomId', this.roomId);
            (async () => {
                while (true) {
                    await sleep(450);
                    const res = await (await fetch(this.url, { method: 'POST', body })).json();
                    if (res.result && res.status === "found") {
                        resolve(JSON.parse(res.sdp));
                        break;
                    } else {
                        console.log("waiting...")
                    }
                }
            })();
        });
    }
}

const createOffer = conn => new Promise((resolve, reject) => {
    let dataChannel;
    conn.onicecandidate = e => {
        if (e.candidate === null) {
            resolve(dataChannel);
        }
    }
    conn.onnegotiationneeded = () => {
        conn.createOffer().then(sdp => {
            conn.setLocalDescription(sdp);
        });
    }
    dataChannel = conn.createDataChannel('text');
});

const waitAllIcecandidate = conn => new Promise((resolve, reject) => {
    conn.onicecandidate = e => {
        if (e.candidate === null) {
            resolve();
        }
    }
});

var _conn;
let dataChannel;

const startConnection = async roomId => {
    const conn = new RTCPeerConnection(stun_config);
    _conn = conn;
    conn.onconnectionstatechange = e => {
        if (conn.connectionState === 'connected') {
            Log.log("接続完了");
            document.getElementById('connection-main').classList.remove('hide');
        } else if (conn.connectionState === 'failed') {
            Log.log('接続失敗');
        }
    }
    const sigP = new SignalingPHP(roomId, signaling_url, conn);
    const sdp = await sigP.checkICE();

    if (sdp) {
        //CreateAnswer
        conn.ondatachannel = e => {
            dataChannel = e.channel;
            dataChannel.onmessage = e => {
                chat.add(e.data);
            }
        }
        Log.log("接続先発見");
        await conn.setRemoteDescription(sdp);
        const answer = await conn.createAnswer();
        await conn.setLocalDescription(answer);
        await waitAllIcecandidate(conn);
        await sigP.answer(conn.localDescription);
        Log.log('接続試行開始');
    } else {
        //CreateOffer
        dataChannel = await createOffer(conn);
        await sigP.offer(conn.localDescription);
        Log.log('接続待機中...');
        const answer = await sigP.waitAnswer();
        Log.log('接続先発見');
        await conn.setRemoteDescription(answer);
        Log.log('接続試行開始');
        dataChannel.onmessage = e => {
            chat.add(e.data);
        }
    }
    document.getElementById('send').addEventListener('click', e => {
        const msg = document.getElementById('msg').value;
        if (msg !== "") {
            if (dataChannel) {
                dataChannel.send(msg);
                chat.add(msg);
                document.getElementById('msg').value = "";
            }
        }
    });
}

document.getElementById('connect').addEventListener('click', e => {
    e.target.classList.add('hide');
    startConnection(document.getElementById('room-id').value);
});
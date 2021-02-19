// LIBRARIES
const { ipcRenderer, desktopCapturer } = require('electron');
const io = require('socket.io-client');
const path = require('path');
const fs = require('fs');
const screenshot = require('screenshot-desktop');
const os = require('os');
const { Peer } = require('peerjs').peerjs;

// GET CONFIG
const configStr = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8');
const config = JSON.parse(configStr);
const { host, port, processName } = config;

// SOCKET
const socket = io(`http://${host}:${port}`);

let peer;
socket.on('connection-msg', () => {
    console.log('Server connected');
    start();
    peer = new Peer({ host, port, path: '/peerjs' });
});

socket.on('stop-stream', () => {
  stop();
  if (!peer.disconnected) peer.disconnect()
});

socket.on('disconnect', () => {
  stop();
  if (!peer.disconnected) peer.disconnect()
  console.log('Server disconnected');
});

socket.on('mouse-move', ({ x, y }) => {
  ipcRenderer.send('mouse-move', { x, y });
});

socket.on('mouse-click', () => {
  ipcRenderer.send('mouse-click', {});
});

socket.on('type', (key) => {
  ipcRenderer.send('type', key);
});

socket.on('quality', (quality) => {
  switch (quality) {
    case 'hig':
      streamQuality = 0.95;
      break;
    case 'med':
      streamQuality = 0.7;
      break;
    case 'low':
      streamQuality = 0.5;
      break;
    default:
      streamQuality = 0.5;
      break;
  }
  stop();
  startStreaming();
});

let start = async () => {
  // First take of screenshot to use it as thumbnail
  let img = await screenshot().then((img) => {
    var imgStr = Buffer.from(img).toString('base64');
    return imgStr;
  }).catch((err) => {
    return err;
  });
  
  let name = os.hostname();
  
  let screenSize = getScreenSize();
  let screenX = screenSize.x;
  let screenY = screenSize.y;


  let client = {
    name,
    img,
    screenX,
    screenY
  };
  socket.emit('join-client', client);
};

let stop = () => {
  // Stops the streaming
  if (stream) {
    stream.getTracks().forEach(track => {
        track.stop();
    });
  }
};

let getScreenSize = () => {
  return {
    x: screen.width * devicePixelRatio,
    y: screen.height * devicePixelRatio
  };
}

// STREAMING
let idViewer;
let stream; 
let streamQuality = 0.5;

// Starts streaming when peerID is received from viewer
socket.on('sendPeerId', async  (id) => {
  if (peer.disconnected) peer.reconnect();
  idViewer = id;
  startStreaming();
});

let startStreaming = async () => {
  let screenSize = getScreenSize();
  let screenX = screenSize.x;
  let screenY = screenSize.y;

  stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
          maxWidth: (screenX * streamQuality),
          maxHeight: (screenY * streamQuality),
          minFrameRate: 10,
          maxFrameRate: 10
      }
    }
  });
  peer.call(idViewer, stream);
}
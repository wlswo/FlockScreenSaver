const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const geoip = require('geoip-lite'); // npm install geoip-lite

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 정적 파일 제공 (public 폴더)
app.use(express.static('public'));

const MAX_BOIDS = 100;
const boidUsers = {};

// 국가 코드를 이모티콘으로 변환하는 함수
function countryCodeToEmoji(countryCode) {
  if (!countryCode) return '';
  return countryCode
    .toUpperCase()
    .split('')
    .map(char => String.fromCodePoint(127397 + char.charCodeAt()))
    .join('');
}

io.on('connection', (socket) => {
  console.log('사용자 연결:', socket.id);
  
  socket.on('join', (data) => {
    // 이미지 URL이 빈 값이면 기본값 사용
    const imageUrl = data.imageUrl && data.imageUrl.trim() !== '' 
                      ? data.imageUrl 
                      : 'assets/clownfish.png';
    // 닉네임이 빈 값이면 "익명" 처리
    const nickname = data.nickname && data.nickname.trim() !== '' 
                      ? data.nickname.trim() 
                      : '익명';
    
    // 클라이언트 IP를 기반으로 국가 정보 조회
    let ip = socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;
    const geo = geoip.lookup(ip);
    const countryCode = geo ? geo.country : null;
    const flagEmoji = countryCodeToEmoji(countryCode);
    // 국가 이모티콘이 있다면 닉네임 앞에 붙임
    const fullNickname = flagEmoji ? flagEmoji + ' ' + nickname : nickname;
    
    const isBoid = Object.keys(boidUsers).length < MAX_BOIDS;
    if (isBoid) {
      boidUsers[socket.id] = { id: socket.id, imageUrl, nickname: fullNickname };
    }
    
    // 새 사용자는 현재 접속 중인 boid 목록 받음
    socket.emit('currentUsers', Object.values(boidUsers));
    socket.emit('boidStatus', { isBoid });
    // 모든 클라이언트에 새 사용자 입장 이벤트 전송 (닉네임 포함)
    io.emit('userJoined', { id: socket.id, imageUrl, nickname: fullNickname, isBoid });
  });
  
  socket.on('disconnect', () => {
    console.log('사용자 해제:', socket.id);
    const wasBoid = !!boidUsers[socket.id];
    if (wasBoid) {
      delete boidUsers[socket.id];
    }
    io.emit('userLeft', { id: socket.id, wasBoid });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`));

import os from 'os';
import qrcode from 'qrcode-terminal';
import { spawn } from 'child_process';

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal && alias.address.startsWith('192.168.') || alias.address.startsWith('172.') || alias.address.startsWith('10.')) {
        return alias.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIp();
const port = 5173;
const mobileUrl = `http://${localIp}:${port}/`;

console.clear();
console.log('\n======================================================');
console.log('📱 [Coffee Strike] 모바일 테스트용 QR 코드 & URL');
console.log(`🌐 모바일 접속 주소: ${mobileUrl}`);
console.log('📌 스마트폰 카메라 앱으로 아래 QR 코드를 스캔하세요:');
console.log('======================================================\n');

qrcode.generate(mobileUrl, { small: true });

console.log('\n🚀 Vite 개발 서버 구동 중 (--host 0.0.0.0)...');

const viteProcess = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', String(port)], {
  stdio: 'inherit',
  shell: true
});

viteProcess.on('exit', (code) => {
  process.exit(code ?? 0);
});

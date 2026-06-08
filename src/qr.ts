import qrcode from 'qrcode-terminal';

export function printQRCode(url: string): void {
  qrcode.generate(url, { small: true });
}
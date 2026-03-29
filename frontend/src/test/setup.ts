// グローバルテストセットアップ
// Bootstrap Icons のような CSS はテスト環境では不要なので何もしない

// Supabase Realtime のグローバルモック（WebSocket が存在しない環境向け）
if (typeof globalThis.WebSocket === 'undefined') {
  // @ts-ignore
  globalThis.WebSocket = class MockWebSocket {
    constructor() {}
    close() {}
    send() {}
  }
}

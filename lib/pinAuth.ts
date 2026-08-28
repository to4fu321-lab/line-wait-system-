// ============================================================
// PIN認証の失敗理由と表示文面
//
// 「PINが違います」以外の原因（通信不可・サーバー障害・DBへ到達できない）を
// PinAuthError で投げると、PinScreen がその文面をそのまま表示する。
// 入力ミスと障害を区別できないと、現場が原因に辿り着けない。
// （実例: 社内ネットワークがSupabaseへの直接通信を遮断していたケースで、
//   PIN照合はサーバー経由なので成功するのに「PINが違います」と表示され、
//   原因特定に時間がかかった）
//
// UIコンポーネント(.tsx)ではなくここに置くのは、純粋なロジックとして
// テストから import できるようにするため。
// ============================================================

export class PinAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PinAuthError'
  }
}

const CONTACT = '解決しない場合は管理者へご連絡ください。'

export const PIN_ERROR_MESSAGES = {
  wrongPin: 'PINが違います',
  network:  `サーバーに接続できません。通信環境をご確認ください。${CONTACT}`,
  server:   (status: number) => `サーバーでエラーが発生しました（${status}）。時間をおいて再度お試しください。${CONTACT}`,
  badResponse: `サーバーから正しい応答がありませんでした。${CONTACT}`,
  // PIN照合は通った（＝サーバーには届いている）が、ブラウザからDBへ直接
  // 接続できない状態。社内ネットワーク・Wi-Fiの制限が典型。
  database: `PINは確認できましたが、データベースに接続できませんでした。社内ネットワークやWi-Fiで通信が制限されている可能性があります。モバイル通信でお試しいただくか、${CONTACT}`,
} as const

// ── お客様（LINE）から使える機能の可否 ────────────────────────
//
//  お客様側の機能は「入口のボタンを出すか」と「開いた先で使わせるか」を
//  別々の場所で判定していたため、条件がずれて
//  「ボタンは出るのに押すと “ご利用いただけません” になる」状態が起きていた。
//  （ネット注文: 入口は products だけ、遷移先は products と
//    customer_self_order の両方を要求していた）
//
//  判定はこのファイルに集約し、入口・画面・APIすべてが同じ関数を見る。

import { resolveFeature } from './features'

/**
 * ネット注文（ECShopView）を使えるか。
 * 商品マスタ（products）が無いと在庫も価格も出せず、
 * セルフ注文（customer_self_order）が無いとお客様には開放しない。
 */
export function canCustomerOrder(rawFeatures: Record<string, unknown>): boolean {
  return resolveFeature('products', rawFeatures)
      && resolveFeature('customer_self_order', rawFeatures)
}

/**
 * LINEからお直しを依頼できるか。
 * お直し機能そのもの（repairs）と、お客様自身に入力させるか
 * （customer_self_intake）の両方が要る。店頭だけで受ける運用なら後者を切る。
 */
export function canCustomerRepair(rawFeatures: Record<string, unknown>): boolean {
  return resolveFeature('repairs', rawFeatures)
      && resolveFeature('customer_self_intake', rawFeatures)
}

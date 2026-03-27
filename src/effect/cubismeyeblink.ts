/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismModel } from "../model/cubismmodel";
import { CubismModelSettingsJson } from "../settings/cubismmodelsettingsjson";

/**
 * 自動まばたき機能
 *
 * 自動まばたき機能を提供する。
 */
export class CubismEyeBlink {
  /**
   * インスタンスを作成する
   * @param modelSetting モデルの設定情報
   * @return 作成されたインスタンス
   * @note 引数がNULLの場合、パラメータIDが設定されていない空のインスタンスを作成する。
   */
  public static create(modelSetting: CubismModelSettingsJson): CubismEyeBlink {
    return new CubismEyeBlink(modelSetting);
  }

  /**
   * まばたきのモーションの詳細設定
   * @param closing   まぶたを閉じる動作の所要時間[秒]
   * @param closed    まぶたを閉じている動作の所要時間[秒]
   * @param opening   まぶたを開く動作の所要時間[秒]
   */
  public setBlinkingSetting(
    mean: number,
    maximumDeviation: number,
    timescale: number,
  ): void {
    this._mean = mean;
    this._maximumDeviation = maximumDeviation;
    this._timescale = timescale;
  }

  /**
   * まばたきさせるパラメータIDのリストの設定
   * @param parameterIds パラメータのIDのリスト
   */
  public setParameterIds(parameterIds: string[]): void {
    this._parameterIds = parameterIds;
  }

  /**
   * まばたきさせるパラメータIDのリストの取得
   * @return パラメータIDのリスト
   */
  public getParameterIds(): string[] {
    return this._parameterIds;
  }

  /**
   * モデルのパラメータの更新
   * @param model 対象のモデル
   * @param deltaTimeSeconds デルタ時間[秒]
   */
  public updateParameters(model: CubismModel, deltaTimeSeconds: number): void {
    this._userTimeSeconds += deltaTimeSeconds;

    if (this._doBlink) {
      // --- 待機状態（次のまばたきまで待機中）---
      if (this._blinkingState === EyeState.Idling) {
        this._phase -= deltaTimeSeconds;

        if (this._phase >= 0) {
          // 目を開いたまま維持する
          this.setEyes(model, 1.0);
          return;
        }

        // まばたき開始
        this._phase = -Math.PI / 2;
        this._lastEyeOpen = 1.0;
        this._blinkingState = EyeState.ClosingEyes;
      }

      // --- まばたきモーション ---
      this._phase += deltaTimeSeconds * this._timescale;

      let eyeOpen = Math.abs(Math.sin(this._phase));

      // 閉じる → 開く への遷移を検出
      if (
        this._blinkingState === EyeState.ClosingEyes &&
        eyeOpen > this._lastEyeOpen
      ) {
        this._blinkingState = EyeState.OpeningEyes;
      }
      // 開く → 待機（まばたき完了）への遷移を検出
      else if (
        this._blinkingState === EyeState.OpeningEyes &&
        eyeOpen < this._lastEyeOpen
      ) {
        eyeOpen = 1.0;
        this._blinkingState = EyeState.Idling;
        this._phase = this.determinNextBlinkingTiming();
      }

      this.setEyes(model, eyeOpen);
      this._lastEyeOpen = eyeOpen;
    }
  }

  /**
   * コンストラクタ
   * @param modelSetting モデルの設定情報
   */
  public constructor(modelSetting: CubismModelSettingsJson) {
    this._blinkingState = EyeState.Idling;
    this._userTimeSeconds = 0.0;
    this._parameterIds = [];
    this._doBlink = true;
    this._mean = 2.5;
    this._maximumDeviation = 2.0;
    this._timescale = 10.0;
    this._phase = 0.0;
    this._lastEyeOpen = 1.0;
    this._parameterVals = {};

    if (modelSetting == null) {
      return;
    }

    this._parameterIds =
      modelSetting.getEyeBlinkParameters()?.slice() ?? this._parameterIds;
  }

  /**
   * 次の瞬きのタイミングの決定
   *
   * @return 次のまばたきを行う時刻[秒]
   */
  public determinNextBlinkingTiming(): number {
    const r: number = Math.random();
    return this._mean + (r * 2 - 1) * this._maximumDeviation;
  }

  /**
   * 目のパラメータ値を設定する
   * @param model 対象のモデル
   * @param value 目の開き具合（0.0: 閉じている, 1.0: 開いている）
   */
  public setEyes(model: CubismModel, value: number) {
    for (let i = 0; i < this._parameterIds.length; ++i) {
      model.setParameterValueById(
        this._parameterIds[i],
        // adjust blink value for current expressions parameter value
        value * (this._parameterVals[this._parameterIds[i]] ?? 1),
      );
    }
  }

  _blinkingState: number; // 現在の状態
  _parameterIds: string[]; // 操作対象のパラメータのIDのリスト
  _userTimeSeconds: number; // デルタ時間の積算値[秒]
  _doBlink: boolean; // まばたきを有効にするかどうかのフラグ
  _mean: number; // まばたきの平均間隔[秒]
  _maximumDeviation: number; // まばたきの間隔の最大偏差[秒]
  _timescale: number; // まばたきの速度倍率
  _phase: number; // まばたきモーションの現在位相[ラジアン]
  _lastEyeOpen: number; // 直前フレームの目の開き具合（状態遷移の検出に使用）
  _parameterVals: Record<string, number>; // パラメータIDをキー、表情による目の開き具合の乗数を値とするマップ

  /**
   * IDで指定された目のパラメータが、0のときに閉じるなら true 、1の時に閉じるなら false 。
   */
  static readonly CloseIfZero: boolean = true;
}

/**
 * まばたきの状態
 *
 * まばたきの状態を表す列挙型
 */
export enum EyeState {
  Idling,
  ClosingEyes,
  OpeningEyes,
}

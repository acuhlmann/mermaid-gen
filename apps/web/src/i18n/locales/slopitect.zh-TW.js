/** Traditional Chinese overrides for Slopitect flavor copy. */
import { SLOPITECT_GAMIFICATION_ZH_TW } from './slopitectGamification.zh-TW.js';

export const SLOPITECT_ZH_TW = {
  PROMPT_ACTION_COPY: {
    label: '發表意見',
    roleTag: '直說',
    roleEmoji: '🗣️',
    title: '發表意見 · 分享你對這件事的看法'
  },
  STAKEHOLDERS_MUTE_COPY: {
    stakeholdersTag: '相關方',
    watchingEmoji: '👀',
    stakeholdersEmoji: '👥'
  },
  VARIANT_PERSONAS: {
    refine: {
      name: '工程師',
      title: '有用下一步的建造者',
      tagline: '一次一個謹慎、有用的擴展。',
      entryLine: '正在設計下一步…',
      exitLine: '交付了一塊有用的磚 🧰'
    },
    erlich: {
      name: 'Erlich Bachman',
      title: '創辦人 — 駭客旅舍',
      tagline: '大膽轉向，由我親自昇華。',
      entryLine: '我問你一個問題…',
      exitLine: '已昇華。不客氣 🕶'
    },
    goMad: {
      name: '爛圖建築師',
      title: '傑出混沌研究員',
      tagline: '天才放飛 🚨',
      entryLine: '爛圖建築師已進入現場',
      exitLine: '建得更好 🛠'
    },
    critique: {
      name: '審計員',
      title: '合規檢查官',
      tagline: '協同設計評審進行中。',
      entryLine: '審計開始。',
      exitLine: '已歸檔。已蓋章。 🔴'
    },
    explain: {
      name: '資深架構師',
      title: '首席技術佈道師',
      tagline: '協同設計故事會 — 圍過來。',
      entryLine: '請想像…',
      exitLine: '架構已講清 📜'
    },
    barker: {
      name: 'Jack Barker',
      title: 'CEO — 成功劇場',
      tagline: '很高興為董事會把圖濃縮。',
      entryLine: '不知道你們怎樣，反正我很興奮……',
      exitLine: '已濃縮。三角對齊 🧘'
    }
  },
  VARIANT_TAGLINES: {
    refine: '爛圖建築師：工程師擴展構建',
    erlich: '爛圖建築師：Erlich Bachman 提出大膽方案',
    goMad: '爛圖建築師：天才放飛 🚨',
    critique: '爛圖建築師：協同設計合規評審',
    explain: '爛圖建築師：協同設計故事會',
    barker: '爛圖建築師：成功劇場模式',
    fix: '爛圖建築師：現場工頭修復爛圖'
  },
  VARIANT_BOOT_HEADLINES: {
    refine: '正在設計下一個有用步驟…',
    erlich: 'Erlich Bachman 正在親自昇華…',
    goMad: '砰！爛圖建築師來了',
    critique: '協同設計評審即將開始',
    explain: '協同設計故事會 — 圍過來',
    barker: 'Jack Barker 正在越權代勞……'
  },
  ACTION_PERSONA_SHORT_NAMES: {
    refine: '工程師',
    erlich: 'Erlich',
    explain: '架構師'
  },
  ...SLOPITECT_GAMIFICATION_ZH_TW
};

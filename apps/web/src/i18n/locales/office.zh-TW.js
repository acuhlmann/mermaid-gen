/**
 * Traditional Chinese overrides for the office-parody copy
 * (docs/office-parody.md). Template arrays replace the English bank wholesale
 * (deepMergeLocale), so ids, colleagueIds, and `{label}` / `{userTitle}`
 * slots must stay aligned with officeCast.js — the seen-template memory is
 * shared across locales. Colleague names stay Latin (identity anchors);
 * titles localize.
 */
export const OFFICE_ZH_TW = {
  OFFICE_COLLEAGUES: {
    intern: { title: '實習生(無薪 · 戰略級)' },
    scrumMaster: { title: '敏捷教練 — CSM、CSPO、SAFe 6.0' },
    helpdesk: { name: '工單機器人 Dave', title: 'IT 服務台 — 一線(僅此一線)' },
    facilities: { title: '總務暨冰箱沙皇' },
    hr: { title: '人資營運業務夥伴' },
    greybeard: { title: '資深工程師(榮退回鍋)' }
  },
  OFFICE_SLOT_FALLBACKS: { label: '這張圖', userTitle: '實習架構師' },
  OFFICE_EMAIL_TEMPLATES: [
    {
      id: 'email-fridge-cleanout',
      colleagueId: 'facilities',
      subject: '提醒:本週五清冰箱',
      body: '冰箱將於週五下午 3 點清理。所有未貼標籤的物品將歸總務所有,包括保鮮盒、調味料與架構圖。\n\n先謝過,\nGary'
    },
    {
      id: 'email-thermostat',
      colleagueId: 'facilities',
      subject: '回覆:回覆:回覆:恆溫器',
      body: '恆溫器已設定為科學上最理想的 20.5°C,並已裝進上鎖的保護盒。請不要再往感測器上貼冰寶了。我知道是三樓幹的。\n\nGary'
    },
    {
      id: 'email-room-booking',
      colleagueId: 'facilities',
      subject: '您預約的「作戰室 4」已確認',
      body: '請注意,作戰室 4 已於 2023 年改建為紓壓艙,在那之前它並不存在。您的預約依然有效。\n\nGary'
    },
    {
      id: 'email-password-expiry',
      colleagueId: 'helpdesk',
      subject: '[工單 #48291] 您的密碼將於 14 天後到期',
      body: '若要重設密碼,請先用已過期的密碼登入,再點選我們寄到您已被鎖定信箱的連結。\n\n本工單已結案,狀態:已解決。\n\n— 服務台(請勿回覆,請勿來電,請勿)'
    },
    {
      id: 'email-ticket-duplicate',
      colleagueId: 'helpdesk',
      subject: '[工單 #48292] 已作為 #48292 的重複案件結案',
      body: '您關於「{label}」的工單已結案,原因:與自身重複。若問題持續存在,那它就是一項功能。\n\n在我電腦上沒問題,\nDave'
    },
    {
      id: 'email-vpn-maintenance',
      colleagueId: 'helpdesk',
      subject: '預定停機:VPN 維護時段',
      body: 'VPN 將於週六 02:00–02:15 暫停服務;根據歷史資料,週一到週四也一樣。\n\n試過把圖關掉再開嗎?\n\n— Dave'
    },
    {
      id: 'email-compliance-training',
      colleagueId: 'hr',
      subject: '溫馨小提醒!訓練已逾期 😊',
      body: '溫馨提醒:您的《安全使用圖表》法遵訓練已逾期 847 天!只需 4 小時即可完成,內含 11 個不可跳過的單元。\n\n溫暖的問候,\nLinda — 人資營運'
    },
    {
      id: 'email-birthday-card',
      colleagueId: 'hr',
      subject: '給 Craig 的卡片 — 今天下班前簽名!',
      body: 'Craig 的生日卡正在傳閱!請為 Craig 寫句溫暖的祝福。不認識 Craig 的話,寫句通用的溫暖祝福也行。Craig 認識你。\n\nLinda'
    },
    {
      id: 'email-mandatory-fun',
      colleagueId: 'hr',
      subject: '誠摯邀請:強制團隊歡樂時光 🎉',
      body: '週四的自由參加團建活動務必出席。本季主題:「信任後倒與組織圖」。請事先研讀 {label},確保歡樂保持對齊。\n\nLinda'
    },
    {
      id: 'email-storypoints',
      colleagueId: 'scrumMaster',
      subject: '請採取行動:幫你的圖估點數',
      body: '這個衝刺能量滿滿!提醒:圖上所有方塊都要在明天的精煉會議前估好故事點數。「{label}」看起來像 13 點 — 我們在停車場時段把它拆一拆。\n\nPam',
      actionPrompt: '把最複雜的節點拆成兩個較小的步驟'
    },
    {
      id: 'email-intern-replyall',
      colleagueId: 'intern',
      subject: '回覆:回覆:轉寄:回覆:小問題',
      body: '抱歉又回覆所有人了!!但有人知道「{label}」是不是該連到另一個東西嗎?還有釘書機放哪?題外話。\n\nchad(實習生)'
    },
    {
      id: 'email-greybeard-migration',
      colleagueId: 'greybeard',
      subject: '你重新發明了批次作業',
      body: '在共用磁碟上看到你的圖了。這東西我們 2009 年就做過,靠一支 cron 排程和恐懼運作,2011 年讓正式環境掛了一整週。\n\n想知道就來問我。或者別問。它知道。\n\nUlrich'
    }
  ],
  OFFICE_IM_TEMPLATES: [
    {
      id: 'im-intern-boxes',
      colleagueId: 'intern',
      body: '小問題 — {label} 應該有這麼多箭頭嗎?替我的到職文件問的'
    },
    {
      id: 'im-intern-lunch',
      colleagueId: 'intern',
      body: '還有人看到冰箱那封信嗎??gary 是玩真的'
    },
    {
      id: 'im-scrum-standup',
      colleagueId: 'scrumMaster',
      body: '友善提醒!你已經埋頭好一陣子了 — 要不要設個時間盒?🙂'
    },
    {
      id: 'im-scrum-retro',
      colleagueId: 'scrumMaster',
      body: '正在把「{label}」加進回顧板當討論主題。能量滿滿!'
    },
    {
      id: 'im-helpdesk-restart',
      colleagueId: 'helpdesk',
      body: '今晚有排程維護。請儲存工作。與那陣煙無關。'
    },
    {
      id: 'im-helpdesk-printer',
      colleagueId: 'helpdesk',
      body: '工單 #48311(三樓印表機)已結案:不予修復。那台印表機有終身職。'
    },
    {
      id: 'im-facilities-plant',
      colleagueId: 'facilities',
      body: '幫電梯旁那盆假植物澆水的人 — 請住手。它長得太好,我不喜歡。'
    },
    {
      id: 'im-hr-survey',
      colleagueId: 'hr',
      body: '匿名身心健康問卷只剩 2 分鐘!(我們看得到你還沒開始,{userTitle}。)'
    },
    {
      id: 'im-greybeard-look',
      colleagueId: 'greybeard',
      body: '看了一眼 {label}。我們 2009 年試過。沒事的。大概。'
    },
    {
      id: 'im-greybeard-mainframe',
      colleagueId: 'greybeard',
      body: '大型主機問起你。我說你忙著畫圖。它表示理解。'
    }
  ],
  OFFICE_WALKBY_FALLBACKS: [
    {
      id: 'walkby-scrum',
      colleagueId: 'scrumMaster',
      body: '哦,這是 {label} 嗎?衝刺看板上沒有它 — 我已經追溯性地把它加成一個探針任務了。'
    },
    {
      id: 'walkby-intern',
      colleagueId: 'intern',
      body: '哇,{label} 看起來好正式。是用 AI 做的嗎?可以放進我的作品集嗎?'
    },
    {
      id: 'walkby-greybeard',
      colleagueId: 'greybeard',
      body: '{label} 喔。2009 年我們也有一個。還在跑。沒人知道在哪。'
    },
    {
      id: 'walkby-facilities',
      colleagueId: 'facilities',
      body: '圖不錯。三樓那股爆米花燒焦味,是 {label} 害的嗎?老實說。'
    },
    {
      id: 'walkby-hr',
      colleagueId: 'hr',
      body: '大家在 {label} 上的能量超棒!要不要在強制歡樂時光發表一下?😊'
    }
  ],
  OFFICE_COFFEE_SCENES: [
    {
      id: 'coffee-machine-politics',
      lines: [
        { speakerId: 'facilities', text: '新咖啡機有十四個按鈕。十二個是裝飾。' },
        { speakerId: 'greybeard', text: '舊那台只有一個按鈕和一股味道。以前比較好。' }
      ]
    },
    {
      id: 'coffee-standup',
      lines: [
        { speakerId: 'scrumMaster', text: '我夢見我們坐著開站立會議。嚇出一身冷汗。' },
        { speakerId: 'intern', text: '等等,夢裡也要上班嗎?員工手冊有寫嗎?' }
      ]
    },
    {
      id: 'coffee-diagram-glance',
      lines: [
        {
          speakerId: 'greybeard',
          text: '看到你那個 {label} 了。多了一個框。你會知道是哪個的。'
        },
        {
          speakerId: 'intern',
          text: '他都這樣。上週他還說我的識別證照片「樂觀過頭」。'
        }
      ]
    },
    {
      id: 'coffee-craig',
      lines: [
        {
          speakerId: 'hr',
          text: '簽了 Craig 的卡片沒?大家一直問 Craig 是誰。這不是卡片的重點。'
        },
        { speakerId: 'helpdesk', text: 'Craig 是工單 #31337。已結案:無法重現。' }
      ]
    },
    {
      id: 'coffee-printer',
      lines: [
        {
          speakerId: 'helpdesk',
          text: '三樓印表機又印出沒人送印的東西。就一頁。寫著「快了」。'
        },
        { speakerId: 'facilities', text: '那台印表機是承重的。不要碰那台印表機。' }
      ]
    },
    {
      id: 'coffee-vision',
      lines: [
        {
          speakerId: 'scrumMaster',
          text: '他們把路線圖改名叫「北極星旅程圖譜」了。路線圖本身從 2022 年就沒變過。'
        },
        { speakerId: 'greybeard', text: '2009 年我們叫它清單。它也沒變過。' }
      ]
    }
  ],
  OFFICE_MEETING_COPY: {
    inviteFallbackTitle: '工作小組:圖表對齊同步會議(定期)',
    inviteFallbackBody: '需要就目前的圖對齊一下。議程:對齊、下一步、就下一步對齊。點心:無。',
    joiningLine: '正在等主辦人讓你進來…',
    cancelledSubject: '已取消:圖表對齊同步會議',
    cancelledBody: '會議取消 — 主辦人行程衝突。改期至:永遠不會。行動項目仍然歸你。\n\nPam',
    proposeNewTimeGag: '已提議新時間。主辦人婉拒了你提議的時間。',
    minutesTitle: '會議紀錄',
    raiseHandPlaceholder: '對大家說點什麼…',
    leaveLabel: '離開會議',
    interjectCapLine: 'Pam:「很棒的觀點 — 先放進停車場。時間到了。」'
  },
  OFFICE_IM_QUICK_REPLIES: ['👍', '會議中', '晚點回'],
  OFFICE_CHROME_COPY: {
    doIt: '就這麼辦',
    inbox: {
      buttonTitle: '公司信箱',
      unreadAria: '收件匣 — {count} 封未讀郵件',
      noUnreadAria: '收件匣 — 沒有未讀郵件',
      title: '📥 收件匣',
      focusTimeLabel: '專注時間',
      focusTimeTitle: '同事們(大致上)會尊重專注時間',
      soundscapeLabel: '辦公室音景',
      soundscapeTitle: '辦公室環境音 — 鍵盤聲、印表機、咖啡機',
      closeAria: '關閉收件匣',
      back: '← 返回',
      emptyLine: '收件匣清空。HR 覺得這很可疑。好好珍惜。',
      markAllRead: '全部標為已讀',
      callMeeting: '📅 召開會議',
      callMeetingTitle: '針對目前的圖召開一場工作小組會議',
      callMeetingDisabledTitle: '先畫點東西 — 這場會也需要議程'
    },
    im: {
      regionAria: '即時訊息',
      dismissAria: '關閉來自 {name} 的訊息'
    },
    walkby: {
      dismissAria: '揮手送走 {name}'
    },
    coffee: {
      inviteLine: '喝杯咖啡?{name} 正在咖啡機旁開講。',
      accept: '休息 5 分鐘',
      decline: '趕死線',
      sceneAria: '咖啡時間',
      sceneTitle: '茶水間',
      done: '回去做事'
    },
    meetingInvite: {
      organizerLabel: '主辦人:',
      attendeesLabel: '與會者:',
      accept: '接受',
      decline: '婉拒',
      proposeNewTime: '另提時間'
    },
    meeting: {
      youName: '你',
      close: '關閉',
      noMinutes: '沒有行動項目。以公司標準來說,這是一場完美的會議。',
      raiseHandAria: '舉手',
      raiseHand: '✋ 舉手({count})',
      atTime: '✋ 時間到'
    }
  }
};

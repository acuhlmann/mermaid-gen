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
    intern: {
      title: '實習生(無薪 · 戰略級)',
      blurb: '愛按「回覆全部」。天真的問題偶爾一針見血。'
    },
    scrumMaster: {
      title: '敏捷教練 — CSM、CSPO、SAFe 6.0',
      blurb: '凡事皆儀式。連午餐都要設時間盒。所有會議由她主持。'
    },
    helpdesk: {
      name: '工單機器人 Dave',
      title: 'IT 服務台 — 一線(僅此一線)',
      blurb: '把工單關閉為它自己的重複項。在他機器上沒問題。'
    },
    facilities: {
      title: '總務暨冰箱沙皇',
      blurb: '發全大寫的冰箱清理通知。以鐵腕掌控恆溫器。'
    },
    hr: {
      title: '人資營運業務夥伴',
      blurb: '武器化的熱情。你的訓練已逾期 847 天。記得幫 Craig 的卡片簽名。'
    },
    greybeard: {
      title: '資深工程師(榮退回鍋)',
      blurb: '「2009 年我們試過。」維護著那台大型主機。建議好得令人不安。'
    },
    ciso: {
      title: '資安長 — 「不行部」',
      blurb: '萬物皆攻擊面,尤其是箭頭。釣魚演練由 TA 主持。誰都不信。'
    }
  },
  OFFICE_SLOT_FALLBACKS: { label: '這張圖', userTitle: '實習架構師' },
  OFFICE_WELCOME_EMAIL: {
    id: 'welcome-email-hr',
    colleagueId: 'hr',
    subject: '歡迎加入,{userTitle}!🎉(識別證照片:待定)',
    body: '歡迎來到這層樓!很開心你的加入。在強制新人訓練(已改期,時間待定)之前,先認識幾位同事:\n\n📅 Pam(敏捷教練)主持所有會議。真的是所有。\n🧃 Chad(我們的實習生)馬上會敲你。他沒有惡意。\n🖥️ 工單機器人 Dave 是 IT。請勿回覆,請勿來電,請勿。\n🧹 Gary 掌管冰箱和恆溫器。請對兩者保持敬意。\n🧓 Ulrich 看過你的架構。在 2009 年。\n🔐 Sasha(我們的資安長)已經開始懷疑你了。這是一種讚美。\n\n我是 Linda — 人資營運!你的合規訓練已經逾期了,這實屬紀錄。收件匣 📥、專注時間和辦公室音景開關都在角落,想讓我們安靜點隨時可用。\n\n溫暖的問候,\nLinda'
  },
  OFFICE_WELCOME_IM: {
    id: 'welcome-im-intern',
    colleagueId: 'intern',
    body: '嗨!!你就是新來的{userTitle}吧 — 歡迎!!咖啡機有十四顆按鈕,十二顆是裝飾。另外 gary 一定會寄冰箱信給你。別放在心上(要放在心上)'
  },
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
    },
    {
      id: 'email-ciso-phishing',
      colleagueId: 'ciso',
      subject: '你沒有點。我們注意到了。(釣魚演練報告)',
      body: '禮貌性通知:上週的模擬釣魚信(「免費架構評審 — 立即點擊」)你沒有點。統計上,人人都會點。不點屬於可疑行為,已記入你的檔案。\n\n我們會一直測,直到你點為止。\n\n什麼都別信,\nSasha — 不行部'
    },
    {
      id: 'email-ciso-password',
      colleagueId: 'ciso',
      subject: '密碼政策更新(自昨日起生效)',
      body: '密碼現須包含 16 個字元、一個表情符號、一個質數,以及一個已棄用協定的亡魂。密碼不得包含:單字、數字或字元。\n\n你目前的密碼在 4 項檢查中不及格 11 項。就某種意義而言,令人佩服。\n\nSasha'
    },
    {
      id: 'email-helpdesk-printer-firmware',
      colleagueId: 'helpdesk',
      subject: '[工單 #48313] 印表機韌體更新完成',
      body: '三樓印表機已更新至韌體 9.0.1。新功能包括:拒收 PDF、噪音更大,以及在不定期時刻印出一(1)頁寫著「快了」的紙。這是預期行為。\n\n請勿開工單。它會被結案為那台印表機的重複案件。\n\n— Dave'
    },
    {
      id: 'email-greybeard-cloud',
      colleagueId: 'greybeard',
      subject: '回覆:雲端遷移啟動會議',
      body: '雲端就是行銷做得比較好的大型主機。我遷移過一次 — 2009 年,遷到「網格」上。2010 年我們又遷了回來。悄悄地。趁半夜。\n\n你的 {label} 放哪都能跑。東西大多都能跑,直到跑不動那天。\n\nUlrich'
    },
    {
      id: 'email-scrum-retro-retro',
      colleagueId: 'scrumMaster',
      subject: '誠摯邀請:回顧會議的回顧會議(強制,有趣)',
      body: '各位!我們的回顧會議在「能量」拿了 4.2/5,但「可執行性」只有 2.9,所以我們要開一場回顧會議的回顧會議。請自備一個「開心」、一個「難過」、一個「生氣」,外加一個備用「生氣」。\n\n上次回顧會議的行動項目原封不動順延,傳統使然。\n\nPam'
    },
    {
      id: 'email-hr-wellness-webinar',
      colleagueId: 'hr',
      subject: '健康星期三:「正念畫圖」 🧘',
      body: '歡迎參加週三的引導課程:學習在方塊之間呼吸,並放下那些不再滋養你的箭頭。最後我們會為 {label} 舉行感恩圈。\n\n出席紀錄匿名且被追蹤。\n\n近乎合十,\nLinda — 人資營運'
    },
    {
      id: 'email-facilities-microwave',
      colleagueId: 'facilities',
      subject: '事故報告:微波爐',
      body: '12:47,有人用微波爐加熱了魚。大樓對此很有意見,我也是。微波爐現已納入新管理層(我)管轄。門上貼了登記表:姓名、菜色、動機。\n\n先謝過,\nGary'
    },
    {
      id: 'email-intern-first-ship',
      colleagueId: 'intern',
      subject: '我上線東西了!!!(小問題)',
      body: '各位!!我的第一個改動上線了。就是 {label} 那個。不過小問題 — 如果所有東西都著火了,但火不大,要跟誰講?純屬假設。火是假設的。大致上。\n\nchad(實習生)'
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
    },
    {
      id: 'im-ciso-password',
      colleagueId: 'ciso',
      body: '季度掃描把你的密碼標記為「好記」。不可接受。請改成一個連你自己都猜不到的。'
    },
    {
      id: 'im-ciso-arrows',
      colleagueId: 'ciso',
      body: '數了數 {label} 裡的箭頭。每一根都是攻擊面。祝你好眠。'
    },
    {
      id: 'im-helpdesk-dns',
      colleagueId: 'helpdesk',
      body: '網路很慢?是 DNS。不是 DNS。剛剛是 DNS。工單已結案。'
    },
    {
      id: 'im-greybeard-gitblame',
      colleagueId: 'greybeard',
      body: '對那次故障跑了 git blame。結果是你。2019 年。大型主機選擇原諒,但會留紀錄。'
    },
    {
      id: 'im-intern-regex',
      colleagueId: 'intern',
      body: '我寫出人生第一個正規表達式了!!它能比對一切。這樣算糟嗎?感覺充滿力量'
    },
    {
      id: 'im-scrum-velocity',
      colleagueId: 'scrumMaster',
      body: '速率快報!你平均每小時畫 4.2 個方塊 — 超棒!這件事我們別跟財務說。🙂'
    },
    {
      id: 'im-facilities-elevator',
      colleagueId: 'facilities',
      body: '電梯又開始發出那個聲音了。請走樓梯。樓梯也有聲音,但是另一種。'
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
    },
    {
      id: 'walkby-ciso',
      colleagueId: 'ciso',
      body: '嗯。{label}。畫出一個攻擊面還替對方貼好標籤,勇氣可嘉。'
    },
    {
      id: 'walkby-helpdesk',
      colleagueId: 'helpdesk',
      body: '{label} 那個方塊?我有一張關於它的工單。曾經有。現在它是「已知問題」了。恭喜。'
    },
    {
      id: 'walkby-greybeard-orchestrator',
      colleagueId: 'greybeard',
      body: '小心 {label}。上一個這種東西在 2011 年左右有了自我意識。我們現在不把「協調器」說出口。'
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
    },
    {
      id: 'coffee-dns',
      lines: [
        {
          speakerId: 'helpdesk',
          text: '事後檢討報告出來了。根因:DNS。根因的根因:也是 DNS。'
        },
        {
          speakerId: 'ciso',
          text: '永遠是 DNS。不是 DNS 的時候,就是有人在正式環境做測試。'
        },
        { speakerId: 'helpdesk', text: '那次也是走 DNS 解析的。所以官方結論:DNS。' }
      ]
    },
    {
      id: 'coffee-cloud-bill',
      lines: [
        {
          speakerId: 'scrumMaster',
          text: '財務又把雲端帳單標紅了。我已經安排了一場成本對齊儀式。'
        },
        {
          speakerId: 'greybeard',
          text: '2009 年伺服器就在我桌子底下。免費。溫暖。吵。以前比較好。'
        }
      ]
    },
    {
      id: 'coffee-standing-desk',
      lines: [
        {
          speakerId: 'hr',
          text: '升降桌到貨了!健康數據顯示我們 94% 的時間還是坐著,只是坐得比較高。'
        },
        {
          speakerId: 'facilities',
          text: '它們半夜會自己升起來。桌子。我說太多了。'
        }
      ]
    },
    {
      id: 'coffee-ai-half',
      lines: [
        {
          speakerId: 'intern',
          text: '今天 AI 幫我寫了一半的程式!!超酷。哪一半?不清楚'
        },
        {
          speakerId: 'ciso',
          text: '查清楚是哪一半。其中一半要進稽核。'
        }
      ]
    }
  ],
  OFFICE_BATTLE_SCENES: [
    {
      id: 'battle-tabs-spaces',
      topic: 'Tab 還是空格',
      lines: [
        {
          speakerId: 'greybeard',
          text: 'Tab。一次按鍵,一個字元,寬度可設定。這件事 2009 年就有定論了。'
        },
        {
          speakerId: 'intern',
          text: '風格指南說用兩個空格!!我整份讀完了。花了一個週末'
        },
        {
          speakerId: 'greybeard',
          text: '那份風格指南出自一個從沒開過終端機的委員會。'
        },
        {
          speakerId: 'intern',
          text: 'linter 站在我這邊!!!我可從來沒贏過 linter'
        }
      ],
      verdicts: {
        greybeard: '就用 Tab。linter 已重新設定。實習生會復原的,假以時日。',
        intern: '兩個空格贏了!!ulrich 說這個產業完蛋了,不過這句話他每天都說'
      }
    },
    {
      id: 'battle-friday-deploy',
      topic: '週五上線',
      lines: [
        {
          speakerId: 'scrumMaster',
          text: '衝刺週五結束,所以週五上線。這是數學!大家能量滿滿!'
        },
        {
          speakerId: 'ciso',
          text: '週五什麼都不准上。事故不放週末假,我的手機也是。'
        },
        {
          speakerId: 'scrumMaster',
          text: '我們可以在週一加開一場「上線回顧」,消化各種情緒。以及事故。'
        },
        {
          speakerId: 'ciso',
          text: '我會在事故應變會議上消化我的。請帶著你的情緒和一台筆電。'
        }
      ],
      verdicts: {
        scrumMaster: '動議通過 — 週五上線!Sasha 已預先申報這次事故,節省時間。',
        ciso: '上線改到週一。週末在法律意義上維持風平浪靜。不客氣。'
      }
    },
    {
      id: 'battle-thermostat',
      topic: '恆溫器(據稱 20.5°C)',
      lines: [
        {
          speakerId: 'facilities',
          text: '恆溫器設定為 20.5°C。這個數字來自科學,而且是最終決定。'
        },
        {
          speakerId: 'hr',
          text: 'Gary,有三個人在室內戴手套。我這邊身心健康工單都來了。'
        },
        {
          speakerId: 'facilities',
          text: '戴手套是個人成長。感測器繼續上鎖。冰寶的事我都知道。'
        },
        {
          speakerId: 'hr',
          text: '士氣隨溫度上升!有研究為證。我印了一份。摸起來冰冰的。'
        }
      ],
      verdicts: {
        facilities: '20.5°C 不變。毛衣募集已經安排好了。士氣現在是紡織品問題。',
        hr: '我們將試行 21°C!Gary 稱之為「熱帶」,並已提出正式抗議。'
      }
    },
    {
      id: 'battle-monolith',
      topic: '一個方塊還是十四個(單體之問)',
      lines: [
        {
          speakerId: 'scrumMaster',
          text: '把 {label} 拆成微服務,每個團隊都有自己的待辦清單!自治!儀式!'
        },
        {
          speakerId: 'greybeard',
          text: '你這是把一個問題變成一套分散式的問題,日誌還更難查。'
        },
        { speakerId: 'scrumMaster', text: '我們會有服務網格!有場線上研討會!' },
        {
          speakerId: 'greybeard',
          text: '我參加過一次線上研討會。2011 年。我和大型主機至今還會聊起它。'
        }
      ],
      verdicts: {
        scrumMaster: '就拆微服務!我已經為十四個新儲存庫各排了一個定期會議。',
        greybeard: '單體留下。十年後你會叫它「恢弘的模組化單體」,還會說是你的主意。'
      }
    },
    {
      id: 'battle-dns-postmortem',
      topic: '那次故障的事後檢討',
      lines: [
        {
          speakerId: 'helpdesk',
          text: '根因:DNS。檢討結案。永遠是 DNS。'
        },
        {
          speakerId: 'ciso',
          text: '是我的防火牆規則,而且我的規則正確又警覺。它擋下了可疑流量:全部流量。'
        },
        { speakerId: 'helpdesk', text: '那些流量是走 DNS 解析的。工單維持原判。' },
        {
          speakerId: 'ciso',
          text: '把一切都擋掉,是唯一零 CVE 的架構。不服去查。'
        }
      ],
      verdicts: {
        helpdesk: '「DNS」獲採納為根因,並預先核准為未來所有事故的根因。講求效率。',
        ciso: '裁定:防火牆是對的。「可用性」是業務部散播的謠言。'
      }
    },
    {
      id: 'battle-tupperware',
      topic: '無標籤保鮮盒',
      lines: [
        {
          speakerId: 'facilities',
          text: '一個無標籤容器從第二季就待在冰箱裡。這已經是總務事務了。'
        },
        {
          speakerId: 'helpdesk',
          text: '我貼過標籤。工單 #48317:「容器,內容不明,請勿重開機」。'
        },
        {
          speakerId: 'facilities',
          text: '工單編號不是標籤。標籤要有名字和日期。我這裡有。樂意提供。'
        },
        {
          speakerId: 'helpdesk',
          text: '內容物已連續上線 94 天。全樓層運行最久的服務。請勿打擾。'
        }
      ],
      verdicts: {
        facilities: '容器不見了。別問去哪了。冰箱恢復安寧。標籤機贏了。',
        helpdesk: '容器留下。它已晉升為正式環境。Gary 現在得提出變更申請。'
      }
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
    directory: {
      title: '歡迎來到辦公室',
      tagline: '你的圖有了工作場所——這層樓的人很有想法。',
      tourHint: '一次認識一位。想安靜時打開「專注時間」。',
      rosterTagline: '會寄信、傳訊息、路過插話的同事們：',
      expandLabel: '🏢 認識辦公室',
      expandTitle: '到底是誰一直在打擾我?',
      startLabel: '認識這層樓 →',
      nextLabel: '下一位 →',
      backLabel: '← 返回',
      skipLabel: '略過',
      progressLabel: '{current} / {total}',
      dismissLabel: '打卡上班',
      closeAria: '關閉辦公室通訊錄'
    },
    inbox: {
      buttonTitle: '公司信箱',
      unreadAria: '收件匣 — {count} 封未讀郵件',
      noUnreadAria: '收件匣 — 沒有未讀郵件',
      title: '📥 收件匣',
      mailAnnounce: '您有新郵件!',
      mailAnnounceLang: 'zh-TW',
      focusTimeLabel: '專注時間',
      focusTimeTitle: '同事們(大致上)會尊重專注時間',
      soundscapeLabel: '辦公室音景',
      soundscapeTitle:
        '辦公室環境音 — 鍵盤聲、滑鼠點擊、紙張、椅子吱呀、印表機、電話、飲水機、咖啡機、自動販賣機、電梯',
      narrationLabel: '朗讀',
      narrationTitle: '用每位同事的聲音朗讀路過發言和會議發言 — 郵件保持靜音',
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
    battle: {
      inviteLine: '🥊 {a} 和 {b} 又槓上了 — 「{topic}」。整層樓都在圍觀。',
      accept: '搬好板凳',
      decline: '與我無關',
      sceneAria: '座位對決',
      sceneTitle: '座位對決',
      versus: 'vs',
      settleLine: '雙方你都聽完了。總得有人是錯的:',
      sideLabel: '站 {name}',
      walkAway: '上報 HR(離場)',
      verdictHead: '全樓層裁定',
      done: '回去上工'
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

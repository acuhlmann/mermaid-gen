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
      blurb: '會先全員回覆,再全員回覆道歉。天真的問題偶爾一針見血。',
      introLine:
        '嗨!!我是 Chad——無薪、戰略級,而且大概率會因為訂書機議題全員回覆,然後再全員回覆道歉。關於你的圖有個小問題,說不定會是今天全場最聰明的一句。另外:訂書機放哪兒了?替我的到職文件問的,也替我的靈魂問的。'
    },
    scrumMaster: {
      title: '敏捷教練 — CSM、CSPO、SAFe 6.0',
      blurb: '凡事皆儀式。氣氛好得過分。連午餐都要設時間盒。',
      introLine:
        '嗨!!我是 Pam——CSM、CSPO、SAFe 6.0,對停車場話術情感流利。這次自我介紹限時四十五秒協同能量。氣氛已經很好了。太愛我們了。咱們回頭再對齊——非常感謝你在這裡!!'
    },
    helpdesk: {
      name: '工單機器人 Dave',
      title: 'IT 服務台 — 一線(僅此一線)',
      blurb: '把工單關閉為它自己的重複項。在他機器上沒問題。',
      introLine:
        '工單機器人 Dave。一線(僅此一線)。我把工單關成它自己的重複項。試過關機再開機嗎。那不是問句。在我機器上沒問題。'
    },
    facilities: {
      title: '總務暨冰箱沙皇',
      blurb: '發全大寫的冰箱清理通知。以鐵腕掌控恆溫器。',
      introLine:
        '我是 GARY。冰箱是我的。恆溫器也是。沒貼標籤的容器——以及沒標清楚的架構圖——一律歸總務部所有。友情警告。'
    },
    hr: {
      title: '人資營運業務夥伴',
      blurb: '武器化的熱情。你的訓練已逾期 847 天。記得幫 Craig 的卡片簽名。',
      introLine:
        '我是 Linda,人資營運。你的識別證照片還在處理,合規訓練不知怎麼已經逾期了,Craig 的生日卡片還需要一句暖呼呼的套話。你會融入得非常漂亮。'
    },
    greybeard: {
      title: '資深工程師(榮退回鍋)',
      blurb: '「2009 年我們試過。」維護著那台大型主機。冷笑話更冷。建議好得令人不安。',
      introLine:
        'Ulrich。資深工程師(榮退回鍋)。2009 年我們試過。靠 cron 和恐懼在跑。正式環境掛了一週。現在還在跑。我維護著那台沒人承認的大型主機。大型主機問起你了。我跟它說你在畫圖。它嘆了口氣。'
    },
    ciso: {
      title: '資安長 — 「不行部」',
      blurb: '萬物皆攻擊面,尤其是箭頭。釣魚演練由 TA 主持。誰都不信。',
      introLine:
        'Sasha。資安長。不行部。萬物皆攻擊面——尤其是你、那些箭頭,還有 2017 年那個臨時管理員密碼。已記入你的檔案。我是出於好意。'
    }
  },
  SENIOR_STAKEHOLDERS: {
    belson: {
      title: 'CTO — 讓世界變得更美好',
      blurb: '帶火氣的彌賽亞願景。Jack 向上匯報。上次打開 IDE 是在主題演講彩排。'
    },
    cfo: {
      title: 'CFO — 預算就是不行',
      blurb: '每個方塊都是成本中心。會問這張圖每月要花多少錢。什麼都不批。'
    },
    barker: {
      title: 'CEO — 成功表演學',
      blurb: '為興奮而興奮。布道「成功連體三角」。已經擅自替你決定了。'
    }
  },
  OFFICE_SLOT_FALLBACKS: { label: '這張圖', userTitle: '實習架構師', userName: '新人' },
  OFFICE_WELCOME_EMAIL: {
    id: 'welcome-email-hr',
    colleagueId: 'hr',
    subject: '歡迎加入,{userTitle}!🎉(識別證照片:待定)',
    body: '歡迎來到這層樓!很開心你的加入。在新人引導(已改期,時間待定)之前,先認識 Your Team 的幾張臉:\n\n🙋 Dinesh 會抓住別人沒看見的 bug,然後提醒你是他抓到的。\n🕶 Erlich 會問這張圖夠不夠有勇氣。請慎重回答。\n📋 Jared 已經就你的到職交接提了發現。輕輕地。堅定地。\n🤓 Richard 覺得這間辦公室有一個可命名的模式。他大概是對的。\n🧘 Jack Barker 很興奮——並且已擅自把你的第一週簡化成董事會版本。\n\nGilfoyle 和 Russ 也在這層樓。他們會自己找到你。不需要介紹。\n\n我是 Linda — 人資營運!你的合規訓練已經逾期了,這實屬紀錄。想安靜一點?工位選單裡有專注、音景和朗讀 — 也可以站起來去咖啡機那邊轉轉。\n\n溫暖的問候,\nLinda'
  },
  OFFICE_WELCOME_IM: {
    id: 'welcome-im-intern',
    colleagueId: 'intern',
    body: '嗨!!你就是新來的{userTitle}吧 — 歡迎!!不小心把歡迎串全員回覆了,又全員回覆道了歉。經典 Chad。咖啡機有十四顆按鈕,十二顆是裝飾。另外 gary 一定會寄冰箱信給你。別放在心上(要放在心上)'
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
    },
    {
      id: 'email-intern-pitch-deck',
      colleagueId: 'intern',
      subject: '小問題:圖能當路演簡報嗎',
      body: '嘿 {userName}!!隨便問一下 — 「{label}」本質上是不是帶箭頭的路演稿??因為站會有人說 deck,我點頭點了十二分鐘。\n\n另外我在 LinkedIn 寫了「顛覆白板賽道」。會不會有點兇\n\nchad(實習生)'
    }
  ],
  SENIOR_EMAIL_TEMPLATES: [
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
      id: 'email-cfo-cloud-spend',
      colleagueId: 'cfo',
      subject: '已標記:無法解釋的預算項目(「{label}」)',
      body: '財務標記了一個名為「{label}」的資源。請確認它 (a) 必不可少,且 (b) 免費。如果無法兼得,請參見 (b)。\n\n預算就是不行,\nDiane'
    },
    {
      id: 'email-belson-world',
      colleagueId: 'belson',
      subject: '我不想活在一個 {label} 永遠這麼小的世界裡',
      body: '{userName} — 我認真坐下來看了看 {label}。輕輕地。仔細地。然後沒那麼輕輕了。我不想活在一個它只是一張該死的圖、而不是人類繁榮平台的世界裡。Jack 會擅自成立工作組;我在澄清高度。放大願景。保住 logo。否則解釋一下我們為什麼資助愛好。\n\nGavin Belson',
      actionPrompt: '放大整張圖的願景 — 標題級平台敘事,不要實作細節'
    },
    {
      id: 'email-belson-undersized',
      colleagueId: 'belson',
      subject: '這他媽算什麼高度 — {label}',
      body: '{userName} — 我審了 {label}。很快。然後又審了一遍,因為我不敢相信第一遍。格局太小。用「上線」偽裝的小思維。我不為了表演提高嗓門 — 只在本該讓世界更好的東西看起來像週末草稿時提高嗓門。放大。現在。Jack 已經知道了。\n\nGavin Belson',
      actionPrompt: '把圖抬到主題演講高度 — 少一點愛好細節,多一點平台命運'
    },
    {
      id: 'email-barker-liberty',
      colleagueId: 'barker',
      subject: '我擅自做了決定(天大的好消息)',
      body: '{userName} — 今天早上我花時間看了你的 {label},我很興奮。不是因為它本身,而是因為我們可以圍繞它講出的故事。所以我擅自為它成立了一個小型工作組 — 沒什麼正式的,只是一個例行同步會、一個指導委員會和一份一頁報告。一家人就該這樣。\n\n溫暖的問候,\nJack Barker',
      actionPrompt: '新增一個名為「董事會級成果」的節點,並連接到最後一步'
    },
    {
      id: 'email-barker-excited',
      colleagueId: 'barker',
      subject: '我不知道你怎麼樣,反正我很興奮',
      body: '{userName} — {label} 進展得非常漂亮,我這麼說可是看過無數圖表的人。記住:打動不了董事會的圖只是愛好,而我們不是一家做愛好的公司。故事要簡單,價值要明顯,協同要可見。\n\n我們是一家人。\n\n溫暖的問候,\nJack'
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
    },
    {
      id: 'coffee-compression',
      lines: [
        {
          speakerId: 'intern',
          text: '要是把架構壓得夠狠,會不會直接變成一句 slogan??為路演問問'
        },
        {
          speakerId: 'greybeard',
          text: '試過。2009。那句 slogan 搞掛了正式環境。主機到現在還在引用。'
        }
      ]
    },
    {
      id: 'coffee-parking-lot',
      lines: [
        {
          speakerId: 'scrumMaster',
          text: '我們要把停車場再丟進停車場。元儀式。凡有情緒的人都請來。'
        },
        {
          speakerId: 'hr',
          text: '我帶了 Craig 的賀卡。Craig 對停車場有情緒。據說。'
        }
      ]
    }
  ],
  OFFICE_BATTLE_SCENES: [
    {
      id: 'battle-commit-credit',
      topic: '這個修復算誰的',
      lines: [
        {
          speakerId: 'dinesh',
          text: '是我發現的，我修的，提交訊息裡寫著「雜項」。雜項。我不是雜項。我有名字，識別證上就印著。'
        },
        {
          speakerId: 'gilfoyle',
          text: '缺陷已經關了。沒人會看提交訊息。工單都沒人看，那玩意兒還有標題呢。'
        },
        {
          speakerId: 'dinesh',
          text: '會有人看的。半年後有人翻紀錄，看到「雜項」，就會以為是你做的。這才是真正的結果。'
        },
        {
          speakerId: 'gilfoyle',
          text: '那得先有人在乎是誰寫的。我一次都沒想過。挺省心的。你也該試試。'
        }
      ],
      verdicts: {
        dinesh: '改好了，署我的名。紀錄現在準確了。我要的就這個。真的就只是這個。',
        gilfoyle: '訊息還是「雜項」。缺陷照樣是關的。宇宙依舊漠不關心，這本來就是我的立場。'
      }
    },
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
    },
    {
      id: 'battle-mvp',
      topic: 'MVP 到底是什麼意思',
      lines: [
        {
          speakerId: 'intern',
          text: '所以 MVP 就是最小可行產品對吧??我 LinkedIn 上寫了三遍'
        },
        {
          speakerId: 'scrumMaster',
          text: 'MVP 是 Maximum Viable PowerPoint。我們交付簡報。產品是 stretch goal。能量滿滿!'
        },
        {
          speakerId: 'intern',
          text: '這聽起來不合法,但又很像募資'
        },
        {
          speakerId: 'scrumMaster',
          text: '合法性已丟進停車場。我們來給情緒限時,再給 slogan 估故事點。'
        }
      ],
      verdicts: {
        intern: 'MVP 是能跑的東西。Chad 已更新 LinkedIn。簡報吃醋了。',
        scrumMaster: 'MVP 是簡報。產品會在未來的儀式跟上。邀請已發。'
      }
    }
  ],
  OFFICE_MEETING_COPY: {
    inviteFallbackTitle: '架構評審委員會(指導會議)',
    inviteFallbackBody:
      '領導層想看看目前這張圖。議程:重點、成本、風險。你的團隊來簡報;高層負責提問。點心:無。',
    joiningLine: '正在等主辦人讓你進來…',
    cancelledSubject: '已取消:架構評審委員會',
    cancelledBody: '會議取消 — 領導層行程衝突。改期至:永遠不會。行動項目仍然歸你。\n\nPam',
    proposeNewTimeGag: '已提議新時間。主辦人婉拒了你提議的時間。',
    minutesTitle: '會議紀錄',
    actionItemsLabel: '行動項目',
    actionItemsCount: '{count} 項待辦',
    minutesActionLede: '勾選項目後點「套用所選」，或點「全部套用」一次送到畫布。',
    minutesEmptyLede: '沒有行動項目 — 依公司標準，這是完美會議。',
    discussionNotesLabel: '討論紀要',
    raiseHandPlaceholder: '對大家說點什麼…',
    leaveLabel: '離開會議',
    interjectCapLine: 'Pam:「很棒的觀點 — 先放進停車場。時間到了。」'
  },
  OFFICE_IM_QUICK_REPLIES: ['👍', '會議中', '晚點回', '先丟停車場', '已記入檔案'],
  OFFICE_CHROME_COPY: {
    doIt: '就這麼辦',
    doSelected: '套用所選',
    doItAll: '全部套用',
    windowMinimize: '最小化',
    windowMinimizeTitle: '收合到標題列',
    windowRestore: '還原',
    windowRestoreTitle: '展開視窗',
    desk: {
      buttonLabel: '你的工位',
      buttonAria: '你的工位 — 你可以做的事',
      buttonTitle: '起身、閒晃、打擾別人',
      menuAria: '工位操作',
      menuHeading: '你在幹嘛？',
      hrProgress: '查一下我的 HR 晉升進度',
      hrProgressTitle: '人資營運計分卡 — 等級、XP，以及 Linda 對你的看法',
      coffee: '去喝杯咖啡',
      walk: '在樓層走走',
      slopChat: '開啟 Slop Chat',
      slopChatTitle: 'Slop Chat™ — 給同事發訊息或查看歷史',
      inbox: '查一下郵件',
      meeting: '召喚同步會',
      meetingTitle: '訂玻璃會議室或戴上耳機 — 選好人就開',
      team: '抓個有空的人',
      huddleAction: '圍過來開小會',
      huddleActionTitle: '全隊擠到你的螢幕前一起操作你的電腦。沒有會議室，沒有耳機。',
      outbox: '從寄件匣寄出',
      outboxTitle: '匯出或分享工位上的成品',
      codeDrawer: '打開麵條碼抽屜',
      codeDrawerShort: '麵條碼',
      codeDrawerClose: '關閉麵條碼抽屜',
      codeDrawerCloseShort: '關閉',
      codeDrawerTitle: '瞧瞧幕後的麵條程式碼',
      onboardContractor: '接入外部協作者',
      onboardContractorTitle: '透過 MCP 邀請外部代理',
      standUp: '站起來四處看看',
      standUpShort: '站起來',
      standUpRole: '樓層',
      standUpTitle: '離開螢幕，到樓層上看看你一直聽到的辦公室',
      sitDown: '回到螢幕前',
      sitDownShort: '坐下',
      sitDownTitle: '坐下，繼續做交付物',
      thinking: '打開筆記本',
      thinkingClose: '關閉筆記本',
      thinkingTitle: '你的筆記本 · 筆記、評審和執行紀錄',
      sectionSeat: '座位上',
      sectionGetUp: '起身',
      sectionUnderDesk: '桌子下面',
      ambienceAria: '辦公室聲音與專注',
      headphonesLabel: '耳機',
      headphonesOffTitle: '摘下耳機 — 聽辦公室的聲音。語音朗讀、環境音開啟，不顯示文字。',
      headphonesOnTitle: '戴上耳機 — 讀辦公室的聲音。所有人安靜下來，他們的話變成文字。',
      focusTimeLabel: '專注',
      focusTimeTitle: '專注時間 — 沒人會過來，團隊也不再插話',
      blocked: {
        busy: '部署進行中 — 誰也別離開工位。',
        meeting: '你在開會。裝得投入一點。',
        surface: '一次一件事。你已經被打斷得夠忙了。',
        noAgenda: '已經在開同步會了 — 先開完再說',
        noTeam: '團隊正忙 — 等樓層安靜一點再試',
        noOutbox: '還沒什麼可寄 — 先在畫布上放個成品',
        noThinking: '筆記本是空的 — 先跑點什麼',
        noCode: '先生成點東西 — 然後才能編輯原始碼'
      }
    },
    directory: {
      title: '認識團隊',
      tourEyebrow: '新人入職引導™',
      rosterEyebrow: '辦公室名冊',
      welcomeChapter: '人力資源',
      colleagueChapter: '同事 {current} / {total}',
      unlockedLabel: '✨ 解鎖角色',
      tagline: '你是這層樓最新的架構師。Your Team 會自我介紹。Gilfoyle 和 Russ 稍後再找你。',
      autoplayHint: '正在說話…',
      rosterTagline: 'Your Team（跳過到職引導的那兩位除外）——點 ▶ 聽他們自我介紹：',
      greeting: '歡迎加入，{name}。',
      greetingRole: '架構師',
      expandLabel: '🏢 認識團隊',
      expandTitle: '第一天介紹 — Your Team 加上人資營運的 Linda。',
      startLabel: '認識團隊 →',
      beginLabel: '開始第一天',
      skipToBuildLabel: '略過引導 →',
      skipToBuildTitle: '關閉引導，直接進入畫布。沒有惡意。（有一點。已記入檔案。）',
      dismissLabel: '完成',
      replayTourLabel: '↻ 重看開場',
      closeAria: '關閉認識團隊',
      hearLabel: '▶ 聽介紹',
      hearSpeakingLabel: '噓…他們在說話',
      hearTitle: '用他們的聲音播放這句話 — Google Cloud 文字轉語音',
      transcriptLabel: '字幕',
      transcriptOnLabel: '隱藏文字',
      transcriptTitle: '顯示語音內容為文字 — 無法收聽時使用',
      welcomeVoiceSpeakerId: 'hr',
      welcomeVoiceLine:
        '歡迎來到這層樓。我是琳達，負責人力營運。領取識別證，寫下你的名字，我來介紹 Your Team——Dinesh、Erlich、Jared、Richard 和 Jack。Gilfoyle 和 Russ 跳過到職引導。你會融入得很好的。',
      nameTag: {
        hello: '你好',
        subtitle: '我叫',
        placeholder: '新人',
        editTitle: '輸入你的名字 — 整個辦公室都會開始使用它',
        inputAria: '你在辦公室的名字'
      }
    },
    inbox: {
      buttonTitle: '公司信箱',
      unreadAria: '收件匣 — {count} 封未讀郵件',
      noUnreadAria: '收件匣 — 沒有未讀郵件',
      title: '📥 收件匣',
      mailAnnounce: '您有新郵件!',
      mailAnnounceLang: 'zh-TW',
      closeAria: '關閉收件匣',
      back: '← 返回',
      emptyLine: '收件匣清空。HR 覺得這很可疑。好好珍惜。',
      markAllRead: '全部標為已讀',
      selectEmailAria: '選擇來自 {name} 的郵件以召開會議',
      callMeeting: '📅 撥個電話',
      callMeetingWithCount: '📅 撥個電話 ({count})',
      callMeetingTitle: '就這封郵件開一場耳機同步 — 可先加減人',
      callMeetingFromSelectionTitle: '就所選郵件開耳機通話 — 挑誰進場',
      callMeetingSelectTitle: '先選郵件當議題，或直接打開名單',
      callMeetingDisabledTitle: '已經在同步中 — 先離開那場',
      callMeetingAboutEmail: '📅 就此郵件撥個電話'
    },
    meetingPicker: {
      title: '📅 召喚同步會',
      titleHuddle: '📅 拉人聊聊',
      tagline: '玻璃會議室或戴耳機 — 一個人或一整個馬戲團。',
      topicLabel: '這是關於什麼？',
      topicPlaceholder: '可選議程（反正他們也會無視）',
      topicAria: '會議主題',
      modalityAria: '這場同步在哪開',
      modalityPhysical: '訂玻璃會議室',
      modalityPhysicalTitle: '全員起身走進會議室 — 包括你',
      modalityRemote: '戴上耳機',
      modalityRemoteTitle: '大家都留在工位通話 — 樓層上看得見耳機',
      groupsAria: '快捷群組',
      groupTeam: '你的團隊',
      groupTeamTitle: '拉上日常一起幹活的人',
      groupSteering: '指導委員會',
      groupSteeringTitle: 'Pam + 高階主管 + 一個人上台講圖',
      groupFloor: '整層樓',
      groupFloorTitle: '衝隔間那邊喊一聲',
      groupSeniors: '領導層',
      groupSeniorsTitle: '約那些會問「這要花多少錢」的人',
      directoryAria: '邀請誰',
      tierTeam: '你的團隊',
      tierSenior: '領導層',
      tierOffice: '這層樓',
      facilitatorBadge: '主持',
      selectedStripLabel: '已邀',
      selectedCount: '已邀請 {count} 人',
      selectedCountOne: '已邀請 1 人',
      maxHint: '會議室最多 {max} 人 — 先去掉一位再加。',
      needSomeone: '至少選一個人（Pam 一個人開會等於對著鏡子）。',
      start: '開始同步',
      startPhysical: '訂下',
      startRemote: '撥入',
      startHuddle: '開始',
      cancel: '算了',
      closeAria: '關閉同步選擇',
      sourceEmail: '來自收件匣',
      sourceChat: '來自 Slop Chat',
      sourceDesk: '來自你的座位'
    },
    im: {
      kindLabel: 'Slop Chat™ · 即時訊息',
      regionAria: '即時訊息',
      dismissAria: '關閉來自 {name} 的訊息',
      openHistoryAria: '開啟 Slop Chat(未讀 {count} 則)',
      openHistoryTitle: 'Slop Chat™ —— 查看歷史訊息'
    },
    messenger: {
      title: '💬 Slop Chat™',
      tagline: '在線狀態提示多了 40%',
      closeAria: '關閉 Slop Chat',
      threadsAria: '對話列表',
      emptyThreads: '還沒有訊息。且行且珍惜。',
      messageSomeone: '傳訊息給誰',
      messageSomeoneTitle: '隨機找一位同事 — 他們總會回覆',
      emptyThread: '挑一位同事吧,他們「都有空」。',
      composerPlaceholder: '輸入訊息……',
      composerAria: '傳訊息給 {name}',
      send: '傳送',
      sending: '傳送中……',
      typing: '{name} 正在輸入……',
      unreadDot: '未讀',
      you: '我',
      statusOnline: '有空',
      statusBusy: '開會中',
      callMeeting: '📅 拉來聊聊',
      callMeetingTitle: '和此人開一場耳機通話 — 想叫更多人也可以',
      callMeetingDisabledTitle: '已經在同步中 — 先離開那場',
      callMeetingNoThread: '📅 召喚同步會',
      callMeetingNoThreadTitle: '打開名單 — 玻璃會議室或耳機'
    },
    walkby: {
      kindLabel: '從你肩膀上方',
      preamble: '有人從你身後盯著螢幕。裝自然一點。',
      dismissAria: '揮手送走 {name}'
    },
    huddle: {
      sceneAria: '團隊圍著你的圖開小會',
      gathering: '大家正走過來…',
      speakingLabel: '{name} 正在發言',
      hardStop: '硬性截止',
      hardStopTitle: '抱歉 — 整點有硬性截止。散了吧。'
    },
    coffee: {
      kindLabel: '茶水間 · 咖啡歇腳',
      inviteLine: '喝杯咖啡?{name} 正在咖啡機旁開講。',
      accept: '休息 5 分鐘',
      decline: '趕死線',
      sceneAria: '咖啡時間',
      sceneTitle: '茶水間',
      done: '我得去發版了'
    },
    battle: {
      kindLabel: '座位鬧劇 · 對決',
      inviteLine: '🥊 {a} 和 {b} 又槓上了 — 「{topic}」。整層樓都在圍觀。',
      accept: '搬好板凳',
      decline: '與我無關',
      sceneAria: '座位對決',
      sceneTitle: '座位對決',
      versus: 'vs',
      getOut: '溜出座位對決',
      settleLine: '雙方你都聽完了。總得有人是錯的:',
      sideLabel: '站 {name}',
      walkAway: '上報 HR(離場)',
      verdictHead: '全樓層裁定',
      done: '回去上工'
    },
    meetingInvite: {
      kindLabel: '日曆邀請 · 會議',
      organizerLabel: '主辦人:',
      attendeesLabel: '與會者:',
      accept: '接受',
      decline: '不行 — 我在趕上線',
      proposeNewTime: '另提時間'
    },
    meeting: {
      youName: '你',
      close: '關閉',
      noMinutes: '沒有行動項目。以公司標準來說,這是一場完美的會議。',
      raiseHandAria: '舉手',
      raiseHand: '✋ 舉手({count})',
      atTime: '✋ 時間到',
      dock: '🗕 看我的螢幕',
      dockTitle: '把會議縮到角落,騰出手來改圖',
      undock: '🗖 回到會議室',
      undockTitle: '把會議放回螢幕中央',
      minimize: '最小化',
      minimizeTitle: '收合到標題列,讓畫布保持可見',
      restore: '還原',
      restoreTitle: '展開會議視窗',
      dragHint: '拖曳以移動',
      speakerViewHint: '正在收聽 — 可在工位選單開啟字幕(CC)閱讀',
      discussionToggle: '討論紀要',
      discussionToggleHide: '隱藏討論紀要'
    }
  }
};

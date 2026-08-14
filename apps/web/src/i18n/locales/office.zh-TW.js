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
      title: '實習生（無薪 · 戰略級）',
      blurb: '會先全員回覆，再全員回覆道歉。天真的問題偶爾一針見血。',
      introLine:
        '嗨！！我是 Chad——無薪、戰略級，而且大概率會因為訂書機議題全員回覆，然後再全員回覆道歉。關於你的圖有個小問題，說不定會是今天全場最聰明的一句。另外：訂書機放哪兒了？替我的到職文件問的，也替我的靈魂問的。'
    },
    scrumMaster: {
      title: '敏捷教練 — CSM、CSPO、SAFe 6.0',
      blurb: '凡事皆儀式。氣氛好得過分。連午餐都要設時間盒。',
      introLine:
        '嗨！！我是 Pam——CSM、CSPO、SAFe 6.0,對停車場話術情感流利。這次自我介紹限時四十五秒協同能量。氣氛已經很好了。太愛我們了。咱們回頭再對齊——非常感謝你在這裡！！'
    },
    helpdesk: {
      name: '工單機器人 Dave',
      title: 'IT 服務台 — 一線（僅此一線）',
      blurb: '把工單關閉為它自己的重複項。在他機器上沒問題。',
      introLine:
        '工單機器人 Dave。一線（僅此一線）。我把工單關成它自己的重複項。試過關機再開機嗎。那不是問句。在我機器上沒問題。'
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
        '我是 Linda,人資營運。識別證照片、逾期訓練，還有 Craig 的生日卡片——最後那件不知怎麼也成了你的事。'
    },
    greybeard: {
      title: '資深工程師（榮退回鍋）',
      blurb: '「1979 年我們試過。」維護著那台大型主機。冷笑話更冷。建議好得令人不安。',
      introLine:
        'Ulrich。資深工程師（榮退回鍋）。1979 年我們試過。靠 JCL 和恐懼在跑。正式環境掛了一週。現在還在跑。我維護著那台沒人承認的大型主機。大型主機問起你了。我跟它說你在畫圖。它嘆了口氣。'
    },
    ciso: {
      title: '資安長 — 「不行部」',
      blurb: '萬物皆攻擊面，尤其是箭頭。釣魚演練由 TA 主持。誰都不信。',
      introLine:
        'Sasha。資安長。不行部。萬物皆攻擊面——尤其是你、那些箭頭，還有 2017 年那個臨時管理員密碼。已記入你的檔案。'
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
    subject: '歡迎加入，{userTitle}!🎉（識別證照片：待定）',
    body: '{userName}，歡迎來到這層樓！很開心你的加入。在新人引導（已改期，時間待定）之前，先認識「你的團隊」的幾張臉：\n\n🙋 Dinesh 會抓住別人沒看見的 bug,然後提醒你是他抓到的。\n🕶 Erlich 會問這張圖夠不夠有勇氣。請慎重回答。\n📋 Jared 已經就你的到職交接提了發現。輕輕地。堅定地。\n🤓 Richard 覺得這間辦公室有一個可命名的模式。他大概是對的。\n🧘 Jack Barker 很興奮——並且已擅自把你的第一週簡化成董事會版本。\n\nGilfoyle 和 Russ 也在這層樓。他們會自己找到你。不需要介紹。\n\n我是 Linda — 人資營運！你的合規訓練已經逾期了，這實屬紀錄。想安靜一點？工位選單裡有專注、音景和朗讀 — 也可以站起來去咖啡機那邊轉轉。\n\n人資營運永遠，\nLinda'
  },
  OFFICE_WELCOME_IM: {
    id: 'welcome-im-intern',
    colleagueId: 'intern',
    body: '嗨 {userName}!!你就是新來的{userTitle}吧 — 歡迎！！不小心把歡迎串全員回覆了，又全員回覆道了歉。經典 Chad。咖啡機有十四顆按鈕，十二顆是裝飾。另外 gary 一定會寄冰箱信給你。別放在心上（要放在心上）'
  },
  OFFICE_EMAIL_TEMPLATES: [
    {
      id: 'email-fridge-cleanout',
      colleagueId: 'facilities',
      subject: '提醒：本週五清冰箱',
      body: '冰箱將於週五下午 3 點清理。所有未貼標籤的物品將歸總務所有，包括保鮮盒、調味料與架構圖。\n\n先謝過，\nGary'
    },
    {
      id: 'email-thermostat',
      colleagueId: 'facilities',
      subject: '回覆：回覆：回覆：恆溫器',
      body: '恆溫器已設定為科學上最理想的 20.5°C,並已裝進上鎖的保護盒。請不要再往感測器上貼冰寶了。我知道是三樓幹的。\n\nGary'
    },
    {
      id: 'email-room-booking',
      colleagueId: 'facilities',
      subject: '您預約的「作戰室 4」已確認',
      body: '請注意，作戰室 4 已於 2023 年改建為紓壓艙，在那之前它並不存在。您的預約依然有效。\n\nGary'
    },
    {
      id: 'email-password-expiry',
      colleagueId: 'helpdesk',
      subject: '[工單 #48291] 您的密碼將於 14 天後到期',
      body: '若要重設密碼，請先用已過期的密碼登入，再點選我們寄到您已被鎖定信箱的連結。\n\n本工單已結案，狀態：已解決。\n\n— 服務台（請勿回覆，請勿來電，請勿）'
    },
    {
      id: 'email-ticket-duplicate',
      colleagueId: 'helpdesk',
      subject: '[工單 #48292] 已作為 #48292 的重複案件結案',
      body: '您關於「{label}」的工單已結案，原因：與自身重複。若問題持續存在，那它就是一項功能。\n\n在我電腦上沒問題，\nDave'
    },
    {
      id: 'email-vpn-maintenance',
      colleagueId: 'helpdesk',
      subject: '預定停機：VPN 維護時段',
      body: 'VPN 將於週六 02:00–02:15 暫停服務；根據歷史資料，週一到週四也一樣。\n\n試過把圖關掉再開嗎？\n\n— Dave'
    },
    {
      id: 'email-compliance-training',
      colleagueId: 'hr',
      training: 3,
      subject: '溫馨小提醒！訓練已逾期 😊',
      body: '溫馨提醒：您的《安全使用圖表》法遵訓練已逾期 847 天！只需 4 小時即可完成，內含 11 個不可跳過的單元。\n\n人資營運永遠，\nLinda — 人資營運'
    },
    {
      id: 'email-hr-errand-intern',
      colleagueId: 'hr',
      errand: 'intern',
      subject: '小忙一件 — 關於回覆所有人那件事',
      body: 'Chad 已經在「{label}」那條討論串上回覆所有人四次，其中兩次是為了上一次回覆所有人道歉。人資營運的研究顯示，這種事同事之間講效果比較好，所以能不能麻煩你私下提一句？最好當面。語氣溫和、帶點好奇、別上綱上線 — 你懂的。\n\n這不是正式談話，也不得留下紀錄，所以我才用電子郵件跟你講這件事。\n\n人資營運永遠，\nLinda — 人資營運'
    },
    {
      id: 'email-birthday-card',
      colleagueId: 'hr',
      subject: '給 Craig 的卡片 — 今天下班前簽名！',
      body: 'Craig 的生日卡正在傳閱！請為 Craig 寫句祝福。不認識 Craig 的話，寫句通用的也行。Craig 認識你。\n\nLinda'
    },
    {
      id: 'email-mandatory-fun',
      colleagueId: 'hr',
      subject: '誠摯邀請：強制團隊歡樂時光 🎉',
      body: '週四的自由參加團建活動務必出席。本季主題：「信任後倒與組織圖」。請事先研讀 {label},確保歡樂保持對齊。\n\nLinda'
    },
    {
      id: 'email-storypoints',
      colleagueId: 'scrumMaster',
      subject: '請採取行動：幫你的圖估點數',
      body: '這個衝刺能量滿滿！提醒：圖上所有方塊都要在明天的精煉會議前估好故事點數。「{label}」看起來像 13 點 — 我們在停車場時段把它拆一拆。\n\nPam',
      actionPrompt: '把最複雜的節點拆成兩個較小的步驟'
    },
    {
      id: 'email-intern-replyall',
      colleagueId: 'intern',
      subject: '回覆：回覆：轉寄：回覆：小問題',
      body: '抱歉又回覆所有人了！！但有人知道「{label}」是不是該連到另一個東西嗎？還有釘書機放哪？題外話。\n\nchad（實習生）'
    },
    {
      id: 'email-greybeard-migration',
      colleagueId: 'greybeard',
      subject: '你重新發明了批次作業',
      body: '在共用磁碟上看到你的圖了。這東西我們 1979 年就做過，靠一支 cron 排程和恐懼運作，1981 年讓正式環境掛了一整週。\n\n想知道就來問我。或者別問。它知道。\n\nUlrich'
    },
    {
      id: 'email-helpdesk-printer-firmware',
      colleagueId: 'helpdesk',
      subject: '[工單 #48313] 印表機韌體更新完成',
      body: '三樓印表機已更新至韌體 9.0.1。新功能包括：拒收 PDF、噪音更大，以及在不定期時刻印出一(1)頁寫著「快了」的紙。這是預期行為。\n\n請勿開工單。它會被結案為那台印表機的重複案件。\n\n— Dave'
    },
    {
      id: 'email-greybeard-cloud',
      colleagueId: 'greybeard',
      subject: '回覆：雲端遷移啟動會議',
      body: '雲端就是行銷做得比較好的大型主機。我遷移過一次 — 1979 年，遷到「網格」上。1985 年我們又遷了回來。悄悄地。趁半夜。\n\n你的 {label} 放哪都能跑。東西大多都能跑，直到跑不動那天。\n\nUlrich'
    },
    {
      id: 'email-scrum-retro-retro',
      colleagueId: 'scrumMaster',
      subject: '誠摯邀請：回顧會議的回顧會議（強制，有趣）',
      body: '各位！我們的回顧會議在「能量」拿了 4.2/5,但「可執行性」只有 2.9,所以我們要開一場回顧會議的回顧會議。請自備一個「開心」、一個「難過」、一個「生氣」,外加一個備用「生氣」。\n\n上次回顧會議的行動項目原封不動順延，傳統使然。\n\nPam'
    },
    {
      id: 'email-hr-wellness-webinar',
      colleagueId: 'hr',
      subject: '健康星期三：「正念畫圖」 🧘',
      body: '歡迎參加週三的引導課程：學習在方塊之間呼吸，並放下那些不再滋養你的箭頭。最後我們會為 {label} 舉行感恩圈。\n\n出席紀錄匿名且被追蹤。\n\n近乎合十，\nLinda — 人資營運'
    },
    {
      id: 'email-facilities-microwave',
      colleagueId: 'facilities',
      subject: '事故報告：微波爐',
      body: '12:47,有人用微波爐加熱了魚。大樓對此很有意見，我也是。微波爐現已納入新管理層（我）管轄。門上貼了登記表：姓名、菜色、動機。\n\n先謝過，\nGary'
    },
    {
      id: 'email-intern-first-ship',
      colleagueId: 'intern',
      subject: '我上線東西了！！！（小問題）',
      body: '各位！！我的第一個改動上線了。就是 {label} 那個。不過小問題 — 如果所有東西都著火了，但火不大，要跟誰講？純屬假設。火是假設的。大致上。\n\nchad（實習生）'
    },
    {
      id: 'email-intern-pitch-deck',
      colleagueId: 'intern',
      subject: '小問題：圖能當路演簡報嗎',
      body: '嘿 {userName}!!隨便問一下 — 「{label}」本質上是不是帶箭頭的路演稿？？因為站會有人說 deck,我點頭點了十二分鐘。\n\n另外我在 LinkedIn 寫了「顛覆白板賽道」。會不會有點兇\n\nchad（實習生）'
    },
    {
      id: 'email-helpdesk-slack-outage',
      colleagueId: 'helpdesk',
      subject: '[工單 #48340] Slop Chat™ 沒問題（更新）',
      body: 'Slop Chat™ 短暫進入量子態，訊息同時處於「已送出」和「沒送出」。根因：DNS、氣氛，以及一場沒人認領的部署。\n\n狀態：已解決。解決狀態：也已解決。如果你還是送不出去，那是另一張工單，而且已經結案。\n\n— Dave'
    },
    {
      id: 'email-facilities-hotdesk',
      colleagueId: 'facilities',
      subject: '共享座位：你的桌子只是一項建議',
      body: '週一起，所有辦公桌改稱「流動協作節點」。你的螢幕設定、零食和情緒支持植物將由總務重新分配。只有贏家才配貼名牌。\n\n如果發現別人坐在你的桌前，恭喜對方。協同效應自己找了座位。\n\nGary'
    },
    {
      id: 'email-scrum-definition-done',
      colleagueId: 'scrumMaster',
      subject: '完成定義已更新（v14，活文件）',
      body: 'DoD 現包括：測試（靠感覺也行）、文件（表情符號也行），以及一張停車場便利貼，證明「{label}」已完成社會化處理。\n\n沒完成的項目仍屬於「接近完成」。為這種接近歡呼吧！！\n\nPam'
    },
    {
      id: 'email-greybeard-kubernetes',
      colleagueId: 'greybeard',
      subject: '你重新發明了啟動指令稿',
      body: '你的「{label}」叢集 YAML，就是三支啟動指令稿穿著一件風衣。1988 年我們用 cron 跑這玩意。大型主機還留著收據。\n\n協調只是一種情緒。恐懼才是執行環境。\n\nUlrich'
    },
    {
      id: 'email-hr-anonymous-feedback',
      colleagueId: 'hr',
      subject: '匿名意見回饋窗口已開放 😊',
      body: '儘管說出你對公司文化的真實感受！回覆匿名、自願，並會綁定你的員工 ID 以便進行「主題分析」。\n\n目前主題：冰箱、恆溫器、Craig。\n\n人資營運永遠，\nLinda — 人資營運'
    },
    {
      id: 'email-helpdesk-2fa',
      colleagueId: 'helpdesk',
      subject: '[工單 #48355] MFA 註冊（請謹慎忽略）',
      body: '你必須在週五前用那個「必須先通過 MFA 才能下載」的 App 完成 MFA 註冊。備用代碼已寄到你目前無法登入的帳號。\n\n本工單預判了你的困惑，並已自行結案。\n\n— Dave'
    },
    {
      id: 'email-intern-standup-confession',
      colleagueId: 'intern',
      subject: '回覆：阻礙項目（我的）',
      body: '嘿 {userName} — 我的阻礙是我不知道什麼算阻礙。另外 {label} 看起來有種 A 輪募資級的嚇人。另外我在寫這封信時，剛在站會說自己正「埋頭苦幹」。這算做產品嗎\n\nchad（實習生）'
    },
    {
      id: 'email-facilities-bike-room',
      colleagueId: 'facilities',
      subject: '自行車室政策（最終版，夾帶情緒）',
      body: '自行車室不是儲藏室，不是會議室，更不是存放野心的地方。安全帽未標記超過 48 小時，即歸總務所有。跟冰箱同一條規則。同樣的殺氣。不同的味道。\n\nGary'
    }
  ],
  SENIOR_EMAIL_TEMPLATES: [
    {
      id: 'email-ciso-phishing',
      colleagueId: 'ciso',
      subject: '你沒有點。我們注意到了。（釣魚演練報告）',
      body: '禮貌性通知：上週的模擬釣魚信（「免費架構評審 — 立即點擊」）你沒有點。統計上，人人都會點。不點屬於可疑行為，已記入你的檔案。\n\n我們會一直測，直到你點為止。\n\n什麼都別信，\nSasha — 不行部'
    },
    {
      id: 'email-ciso-phishing-bait',
      colleagueId: 'ciso',
      phishing: true,
      subject: '緊急：您的圖表存取權限將在 24 小時內被撤銷',
      body: '尊敬的貴重同仁：\n\n我們的系統已偵測到您的圖表「{label}」存在異常活動。為避免您的全部工作被永久刪除，請在 24 小時內透過下方安全連結重新驗證您的憑證。\n\n此為安全團隊之正式通訊。請勿回覆本郵件。\n\n此致，\n安全團隊（內部）'
    },
    {
      id: 'email-ciso-password',
      colleagueId: 'ciso',
      subject: '密碼政策更新（自昨日起生效）',
      body: '密碼現須包含 16 個字元、一個表情符號、一個質數，以及一個已棄用協定的亡魂。密碼不得包含：單字、數字或字元。\n\n你目前的密碼在 4 項檢查中不及格 11 項。就某種意義而言，令人佩服。\n\nSasha'
    },
    {
      id: 'email-cfo-cloud-spend',
      colleagueId: 'cfo',
      subject: '已標記：無法解釋的預算項目(「{label}」)',
      body: '財務標記了一個名為「{label}」的資源。請確認它 (a) 必不可少，且 (b) 免費。如果無法兼得，請參見 (b)。\n\n預算就是不行，\nDiane'
    },
    {
      id: 'email-barker-reorg',
      colleagueId: 'barker',
      subject: '組織架構更新：成功的雙聯三角',
      body: '各位，\n\n即日起，我們透過增加一個層級來實現組織扁平化。工程與銷售現分別位於兩個雙聯三角的底邊，其共同頂點為「妥協」。沒有人會向任何人重複匯報，除非確實如此。\n\n你在「{label}」上的工作不受影響 — 在架構上、文化上，以及在由誰簽核這一點上，它受到了影響。\n\n征服是一種心態，\nJack Barker',
      actionPrompt:
        '畫出新的組織架構圖：兩個雙聯三角共享一個標記為「妥協」的頂點，工程與銷售位於底邊，我當前的工作同時向兩者匯報'
    },
    {
      id: 'email-belson-world',
      colleagueId: 'belson',
      subject: '我不想活在一個 {label} 永遠這麼小的世界裡',
      body: '{userName} — 我認真坐下來看了看 {label}。輕輕地。仔細地。然後沒那麼輕輕了。我不想活在一個它只是一張該死的圖、而不是人類繁榮平台的世界裡。Jack 會擅自成立工作組；我在澄清高度。放大願景。保住 logo。否則解釋一下我們為什麼資助愛好。\n\nGavin Belson',
      actionPrompt: '放大整張圖的願景 — 標題級平台敘事，不要實作細節'
    },
    {
      id: 'email-belson-undersized',
      colleagueId: 'belson',
      subject: '這他媽算什麼高度 — {label}',
      body: '{userName} — 我審了 {label}。很快。然後又審了一遍，因為我不敢相信第一遍。格局太小。用「上線」偽裝的小思維。我不為了表演提高嗓門 — 只在本該讓世界更好的東西看起來像週末草稿時提高嗓門。放大。現在。Jack 已經知道了。\n\nGavin Belson',
      actionPrompt: '把圖抬到主題演講高度 — 少一點愛好細節，多一點平台命運'
    },
    {
      id: 'email-barker-liberty',
      colleagueId: 'barker',
      subject: '我擅自做了決定（天大的好消息）',
      body: '{userName} — 今天早上我花時間看了你的 {label},我很興奮。不是因為它本身，而是因為我們可以圍繞它講出的故事。所以我擅自為它成立了一個小型工作組 — 沒什麼正式的，只是一個例行同步會、一個指導委員會和一份一頁報告。一家人就該這樣。\n\n征服是一種心態，\nJack Barker',
      actionPrompt: '新增一個名為「董事會級成果」的節點，並連接到最後一步'
    },
    {
      id: 'email-barker-excited',
      colleagueId: 'barker',
      subject: '我不知道你怎麼樣，反正我很興奮',
      body: '{userName} — {label} 進展得非常漂亮，我這麼說可是看過無數圖表的人。記住：打動不了董事會的圖只是愛好，而我們不是一家做愛好的公司。故事要簡單，價值要明顯，協同要可見。\n\n我們是一家人。\n\nJack Barker'
    }
  ],
  OFFICE_IM_TEMPLATES: [
    {
      id: 'im-intern-boxes',
      colleagueId: 'intern',
      body: '{userName}，小問題 — {label} 應該有這麼多箭頭嗎？替我的到職文件問的'
    },
    {
      id: 'im-intern-lunch',
      colleagueId: 'intern',
      body: '還有人看到冰箱那封信嗎？？gary 是玩真的'
    },
    {
      id: 'im-scrum-standup',
      colleagueId: 'scrumMaster',
      body: '友善提醒！你已經埋頭好一陣子了 — 要不要設個時間盒？🙂'
    },
    {
      id: 'im-scrum-retro',
      colleagueId: 'scrumMaster',
      body: '正在把「{label}」加進回顧板當討論主題。能量滿滿！'
    },
    {
      id: 'im-helpdesk-restart',
      colleagueId: 'helpdesk',
      body: '今晚有排程維護。請儲存工作。與那陣煙無關。'
    },
    {
      id: 'im-helpdesk-printer',
      colleagueId: 'helpdesk',
      body: '工單 #48311（三樓印表機）已結案：不予修復。那台印表機有終身職。'
    },
    {
      id: 'im-facilities-plant',
      colleagueId: 'facilities',
      body: '幫電梯旁那盆假植物澆水的人 — 請住手。它長得太好，我不喜歡。'
    },
    {
      id: 'im-hr-survey',
      colleagueId: 'hr',
      body: '匿名身心健康問卷只剩 2 分鐘！(我們看得到你還沒開始，{userTitle}。)'
    },
    {
      id: 'im-greybeard-look',
      colleagueId: 'greybeard',
      body: '看了一眼 {label}。我們 1979 年試過。沒事的。大概。'
    },
    {
      id: 'im-greybeard-mainframe',
      colleagueId: 'greybeard',
      body: '大型主機問起你。我說你忙著畫圖。它表示理解。'
    },
    {
      id: 'im-helpdesk-dns',
      colleagueId: 'helpdesk',
      body: '網路很慢？是 DNS。不是 DNS。剛剛是 DNS。工單已結案。'
    },
    {
      id: 'im-greybeard-gitblame',
      colleagueId: 'greybeard',
      body: '對那次故障跑了 git blame。結果是你。2019 年。大型主機選擇原諒，但會留紀錄。'
    },
    {
      id: 'im-intern-regex',
      colleagueId: 'intern',
      body: '我寫出人生第一個正規表達式了！！它能比對一切。這樣算糟嗎？感覺充滿力量'
    },
    {
      id: 'im-scrum-velocity',
      colleagueId: 'scrumMaster',
      body: '速率快報！你平均每小時畫 4.2 個方塊 — 超棒！這件事我們別跟財務說。🙂'
    },
    {
      id: 'im-facilities-elevator',
      colleagueId: 'facilities',
      body: '電梯又開始發出那個聲音了。請走樓梯。樓梯也有聲音，但是另一種。'
    },
    {
      id: 'im-intern-jira',
      colleagueId: 'intern',
      body: '幫「{label}」建了一張 Jira！！然後又建了一張 Jira 來追蹤建 Jira 這件事。最後兩張都被我結案成對方的重複項目。Dave 要嘛會驕傲，要嘛會發火。不確定'
    },
    {
      id: 'im-scrum-async',
      colleagueId: 'scrumMaster',
      body: '頻道裡非同步站會！！請貼：昨天 / 今天 / 阻礙 / 情緒 / 對阻礙的情緒。我會整理成一份沒人打開的簡報 🙂'
    },
    {
      id: 'im-helpdesk-cache',
      colleagueId: 'helpdesk',
      body: '清過快取了嗎。另一個快取清過了嗎。清除「清快取」這件事的快取了嗎。工單已按「教育意義」結案。'
    },
    {
      id: 'im-facilities-lights',
      colleagueId: 'facilities',
      body: '三樓的感應燈鬧鬼。你還在動，它就熄了。架構會過期。尊嚴也是。'
    },
    {
      id: 'im-hr-badge',
      colleagueId: 'hr',
      body: '提醒：補拍識別證時請微笑！上一批看起來「在法律意義上遭受脅迫」。我們知道是誰。匿名地。'
    },
    {
      id: 'im-greybeard-cobol',
      colleagueId: 'greybeard',
      body: '有人在 {label} 附近說了「雲端原生」。我腦內把它翻譯成 COBOL。照樣能跑。大型主機笑了。'
    },
    {
      id: 'im-intern-meeting-hell',
      colleagueId: 'intern',
      body: '我今天有 7 場討論會議的會議。這算漏斗嗎？？替我的行事曆 / 求生意志 / 已經誤按全部回覆的邀請串問問，抱歉'
    },
    {
      id: 'im-scrum-capacity',
      colleagueId: 'scrumMaster',
      body: '容量檢查！！我們已承諾 112%，情緒可用容量 40%。完美的衝刺形狀。謝謝！！'
    },
    {
      id: 'im-helpdesk-reboot-loop',
      colleagueId: 'helpdesk',
      body: '筆電卡在「正在更新 2/2」已經 14 小時。符合設計。產品稱之為「旅程」。別開工單。工單剛剛自行打開，然後離職了。'
    }
  ],
  OFFICE_WALKBY_FALLBACKS: [
    {
      id: 'walkby-scrum',
      colleagueId: 'scrumMaster',
      body: '哦，這是 {label} 嗎？衝刺看板上沒有它 — 我已經追溯性地把它加成一個探針任務了。'
    },
    {
      id: 'walkby-intern',
      colleagueId: 'intern',
      body: '哇 {userName},{label} 看起來好正式。是用 AI 做的嗎？可以放進我的作品集嗎？'
    },
    {
      id: 'walkby-greybeard',
      colleagueId: 'greybeard',
      body: '{label} 喔。1979 年我們也有一個。還在跑。沒人知道在哪。'
    },
    {
      id: 'walkby-facilities',
      colleagueId: 'facilities',
      body: '圖不錯。三樓那股爆米花燒焦味，是 {label} 害的嗎？老實說。'
    },
    {
      id: 'walkby-hr',
      colleagueId: 'hr',
      body: '大家在 {label} 上的能量超棒！要不要在強制歡樂時光發表一下？😊'
    },
    {
      id: 'walkby-helpdesk',
      colleagueId: 'helpdesk',
      body: '{label} 那個方塊？我有一張關於它的工單。曾經有。現在它是「已知問題」了。恭喜。'
    },
    {
      id: 'walkby-greybeard-orchestrator',
      colleagueId: 'greybeard',
      body: '小心 {label}。上一個這種東西在 1981 年左右有了自我意識。我們現在不把「協調器」說出口。'
    },
    {
      id: 'walkby-scrum-points',
      colleagueId: 'scrumMaster',
      body: '太愛 {label} 的能量了！！我給它估了 21 點，然後把自己的情緒拆成三個 8 點。數學正確。文化正確。謝謝！！'
    },
    {
      id: 'walkby-intern-ship',
      colleagueId: 'intern',
      body: '等等，{label} 已經上線了？？我以為「上線」是指「寫進文件」。正式環境跟畫布是一回事嗎。替我的履歷 / 生存問題問問'
    },
    {
      id: 'walkby-ciso-surface',
      colleagueId: 'ciso',
      body: '{label} 就是加了品牌包裝的攻擊面。挺可愛。我已經提交三項發現，以及一項偽裝成發現的稱讚。'
    },
    {
      id: 'walkby-helpdesk-known',
      colleagueId: 'helpdesk',
      body: '喔，{label}。已知問題。週二已知。週三被認定為功能。週四結案。不客氣。'
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
        { speakerId: 'intern', text: '等等，夢裡也要上班嗎？員工手冊有寫嗎？' }
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
          text: '簽了 Craig 的卡片沒？大家一直問 Craig 是誰。這不是卡片的重點。'
        },
        { speakerId: 'helpdesk', text: 'Craig 是工單 #31337。已結案：無法重現。' }
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
        { speakerId: 'greybeard', text: '1979 年我們叫它清單。它也沒變過。' }
      ]
    },
    {
      id: 'coffee-dns',
      lines: [
        {
          speakerId: 'helpdesk',
          text: '事後檢討報告出來了。根因：DNS。根因的根因：也是 DNS。'
        },
        {
          speakerId: 'ciso',
          text: '永遠是 DNS。不是 DNS 的時候，就是有人在正式環境做測試。'
        },
        { speakerId: 'helpdesk', text: '那次也是走 DNS 解析的。所以官方結論：DNS。' }
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
          text: '1979 年伺服器就在我桌子底下。免費。溫暖。吵。以前比較好。'
        }
      ]
    },
    {
      id: 'coffee-standing-desk',
      lines: [
        {
          speakerId: 'hr',
          text: '升降桌到貨了！健康數據顯示我們 94% 的時間還是坐著，只是坐得比較高。'
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
          text: '今天 AI 幫我寫了一半的程式！！超酷。哪一半？不清楚'
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
          text: '要是把架構壓得夠狠，會不會直接變成一句 slogan??為路演問問'
        },
        {
          speakerId: 'greybeard',
          text: '試過。1979。那句 slogan 搞掛了正式環境。主機到現在還在引用。'
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
    },
    {
      id: 'coffee-badge-photo',
      lines: [
        {
          speakerId: 'hr',
          text: '補印識別證到了。你的照片像一場進展順利的人質談判。成長！'
        },
        {
          speakerId: 'intern',
          text: '我的像是眨眼到一半突然悟出情緒股權。這算個人品牌還是求救訊號'
        }
      ]
    },
    {
      id: 'coffee-wifi-name',
      lines: [
        {
          speakerId: 'helpdesk',
          text: '訪客 Wi-Fi 還叫「DefinitelyNotAHoneypot」。參與度上升了。安全性也……就某種意義而言上升了。'
        },
        {
          speakerId: 'ciso',
          text: '它就是蜜罐。這個名字是整層樓唯一誠實的東西。已記錄。'
        }
      ]
    },
    {
      id: 'coffee-okrs',
      lines: [
        {
          speakerId: 'scrumMaster',
          text: '第三季 OKR 是「交付價值」、「感受價值」和「回顧價值」。可衡量！！'
        },
        {
          speakerId: 'greybeard',
          text: '1979 年的目標叫「別讓它掛」。關鍵結果：它沒掛。我們睡了覺。'
        }
      ]
    },
    {
      id: 'coffee-pingpong',
      lines: [
        {
          speakerId: 'facilities',
          text: '桌球桌現在是會議室。要用就預訂。帶球拍或簡報。最好帶簡報。'
        },
        {
          speakerId: 'intern',
          text: '我訂了一場叫「對齊」的會，結果有人真的帶了球。混亂。A 輪級混亂'
        }
      ]
    },
    {
      id: 'coffee-reorg-rumor',
      lines: [
        {
          speakerId: 'hr',
          text: '有組織重整傳聞。永遠都有組織重整傳聞。這次還附了一頁簡報。'
        },
        {
          speakerId: 'helpdesk',
          text: '我開了一張工單：「組織架構，行為異常」。已結案為資本主義的重複項目。'
        }
      ]
    },
    {
      id: 'coffee-dark-mode',
      lines: [
        {
          speakerId: 'intern',
          text: '為什麼所有東西都有深色模式，只有冰箱政策郵件亮得刺眼。故意的嗎？'
        },
        {
          speakerId: 'facilities',
          text: '對。恐懼必須照明充足。架構也是。幫剩菜貼標籤。'
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
          text: 'Tab。一次按鍵，一個字元，寬度可設定。這件事 1979 年就有定論了。'
        },
        {
          speakerId: 'intern',
          text: '風格指南說用兩個空格！！我整份讀完了。花了一個週末'
        },
        {
          speakerId: 'greybeard',
          text: '那份風格指南出自一個從沒開過終端機的委員會。'
        },
        {
          speakerId: 'intern',
          text: 'linter 站在我這邊！！！我可從來沒贏過 linter'
        }
      ],
      verdicts: {
        greybeard: '就用 Tab。linter 已重新設定。實習生會復原的，假以時日。',
        intern: '兩個空格贏了！！ulrich 說這個產業完蛋了，不過這句話他每天都說'
      }
    },
    {
      id: 'battle-friday-deploy',
      topic: '週五上線',
      lines: [
        {
          speakerId: 'scrumMaster',
          text: '衝刺週五結束，所以週五上線。這是數學！大家能量滿滿！'
        },
        {
          speakerId: 'ciso',
          text: '週五什麼都不准上。事故不放週末假，我的手機也是。'
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
        scrumMaster: '動議通過 — 週五上線！Sasha 已預先申報這次事故，節省時間。',
        ciso: '上線改到週一。週末在法律意義上維持風平浪靜。不客氣。'
      }
    },
    {
      id: 'battle-thermostat',
      topic: '恆溫器（據稱 20.5°C）',
      lines: [
        {
          speakerId: 'facilities',
          text: '恆溫器設定為 20.5°C。這個數字來自科學，而且是最終決定。'
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
          text: '士氣隨溫度上升！有研究為證。我印了一份。摸起來冰冰的。'
        }
      ],
      verdicts: {
        facilities: '20.5°C 不變。毛衣募集已經安排好了。士氣現在是紡織品問題。',
        hr: '我們將試行 21°C!Gary 稱之為「熱帶」,並已提出正式抗議。'
      }
    },
    {
      id: 'battle-monolith',
      topic: '一個方塊還是十四個（單體之問）',
      lines: [
        {
          speakerId: 'scrumMaster',
          text: '把 {label} 拆成微服務，每個團隊都有自己的待辦清單！自治！儀式！'
        },
        {
          speakerId: 'greybeard',
          text: '你這是把一個問題變成一套分散式的問題，日誌還更難查。'
        },
        { speakerId: 'scrumMaster', text: '我們會有服務網格！有場線上研討會！' },
        {
          speakerId: 'greybeard',
          text: '我參加過一次線上研討會。1981 年。我和大型主機至今還會聊起它。'
        }
      ],
      verdicts: {
        scrumMaster: '就拆微服務！我已經為十四個新儲存庫各排了一個定期會議。',
        greybeard: '單體留下。十年後你會叫它「恢弘的模組化單體」,還會說是你的主意。'
      }
    },
    {
      id: 'battle-dns-postmortem',
      topic: '那次故障的事後檢討',
      lines: [
        {
          speakerId: 'helpdesk',
          text: '根因：DNS。檢討結案。永遠是 DNS。'
        },
        {
          speakerId: 'ciso',
          text: '是我的防火牆規則，而且我的規則正確又警覺。它擋下了可疑流量：全部流量。'
        },
        { speakerId: 'helpdesk', text: '那些流量是走 DNS 解析的。工單維持原判。' },
        {
          speakerId: 'ciso',
          text: '把一切都擋掉，是唯一零 CVE 的架構。不服去查。'
        }
      ],
      verdicts: {
        helpdesk: '「DNS」獲採納為根因，並預先核准為未來所有事故的根因。講求效率。',
        ciso: '裁定：防火牆是對的。「可用性」是業務部散播的謠言。'
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
          text: '我貼過標籤。工單 #48317:「容器，內容不明，請勿重開機」。'
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
          text: '所以 MVP 就是最小可行產品對吧？？我 LinkedIn 上寫了三遍'
        },
        {
          speakerId: 'scrumMaster',
          text: 'MVP 是 Maximum Viable PowerPoint。我們交付簡報。產品是 stretch goal。能量滿滿！'
        },
        {
          speakerId: 'intern',
          text: '這聽起來不合法，但又很像募資'
        },
        {
          speakerId: 'scrumMaster',
          text: '合法性已丟進停車場。我們來給情緒限時，再給 slogan 估故事點。'
        }
      ],
      verdicts: {
        intern: 'MVP 是能跑的東西。Chad 已更新 LinkedIn。簡報吃醋了。',
        scrumMaster: 'MVP 是簡報。產品會在未來的儀式跟上。邀請已發。'
      }
    },
    {
      id: 'battle-remote-office',
      topic: '遠端辦公還是「滾回辦公室」',
      lines: [
        {
          speakerId: 'hr',
          text: '文化只會發生在大樓裡！到場是一項健康指標。打開攝影機是一種愛的語言。'
        },
        {
          speakerId: 'greybeard',
          text: '1979 年我就在遠端辦公。大型主機在我桌子底下。延遲很誠實。通勤只是可選的神話。'
        },
        {
          speakerId: 'hr',
          text: '我們已預訂強制到場的歡樂星期五！出席狀況會匿名追蹤，並透過刷識別證記錄。'
        },
        {
          speakerId: 'greybeard',
          text: '被追蹤的歡樂不是歡樂，是工單。Dave 會把它結案為「快樂」的重複項目。'
        }
      ],
      verdicts: {
        hr: '就混合辦公！混合辦公就是帶著 Wi-Fi 焦慮來辦公室。識別證印表機歡呼吧。',
        greybeard: '遠端辦公保留。大樓可以留著它的歡樂星期五。大型主機從沒回覆邀請。'
      }
    },
    {
      id: 'battle-jira-notion',
      topic: 'Jira 對 Notion（第二大腦之戰）',
      lines: [
        {
          speakerId: 'scrumMaster',
          text: '不在 Jira 裡，就不是真的！！工單是真理。待辦清單是命運。能量滿滿！'
        },
        {
          speakerId: 'intern',
          text: '但 Notion 才是情緒住的地方啊？？我巢狀了十二個資料庫，然後把自己的實習職位弄丟在裡面'
        },
        {
          speakerId: 'scrumMaster',
          text: '我們會透過一場儀式和一個無人負責的 Zap，把 Notion 同步進 Jira。對齊！！'
        },
        {
          speakerId: 'intern',
          text: '我已經建了一個 Notion 頁面介紹這個 Zap。還有路線圖表情。我們又行了'
        }
      ],
      verdicts: {
        scrumMaster: 'Jira 獲勝。Notion 改任一面樂觀說謊的鏡子。Pam 已經幫說謊估了故事點。',
        intern: 'Notion 贏了！！Jira 現在是「紀錄系統」，意思就是沒人會打開它。情緒股權。'
      }
    },
    {
      id: 'battle-emoji-reacts',
      topic: '👍 到底算不算決策',
      lines: [
        {
          speakerId: 'helpdesk',
          text: '按讚就是 ACK。ACK 就是閉環。閉環就是和平。我用一個表情結束過戰爭。'
        },
        {
          speakerId: 'ciso',
          text: '按讚不是同意，不是變更核准，也不是資安審查。已永久記錄在頻道裡。'
        },
        {
          speakerId: 'helpdesk',
          text: '那你就別給事故按 🔥。那也不是操作手冊，只是帶嚴重等級的情緒。'
        },
        {
          speakerId: 'ciso',
          text: '🔥 表示我看到你了。看到不等於核准。趁正式環境還沒替你學會，先搞清楚差別。'
        }
      ],
      verdicts: {
        helpdesk: '表情決策有效。CAB 現在接受 👍 作為法定人數。效率就是一顆黃心。',
        ciso: '表情不算核准。CAB 仍然是一場會議。你的檔案仍然是一份檔案。'
      }
    }
  ],
  OFFICE_MEETING_COPY: {
    inviteFallbackTitle: '工作組同步',
    steeringInviteTitle: '架構評審委員會（指導會議）',
    quickSyncTitle: '快速同步',
    quickSyncTitleRemote: '耳機同步',
    defaultSyncTitle: '工作組同步',
    defaultRemoteTitle: '耳機同步',
    inviteFallbackBody:
      '領導層想看看目前這張圖。議程：重點、成本、風險。你的團隊來簡報；高層負責提問。點心：無。',
    allHandsInviteTitle: '全員大會：對齊、高度與前行之路',
    allHandsInviteBody:
      'Gavin 將主持一場全公司全員大會。所有人參加。議程：願景、高度，以及我們接下來往哪走。會留出提問時間，但不會有答案。請打開攝影機。',
    joiningLine: '正在等主辦人讓你進來…',
    cancelledSubject: '已取消：工作組同步',
    cancelledBody: '會議取消 — 領導層行程衝突。改期至：永遠不會。行動項目仍然歸你。\n\nPam',
    proposeNewTimeGag: '已提議新時間。主辦人婉拒了你提議的時間。',
    minutesTitle: '會議紀錄',
    actionItemsLabel: '行動項目',
    actionItemsCount: '{count} 項待辦',
    minutesActionLede: '勾選項目後點「套用所選」，或點「全部套用」一次送到畫布。',
    minutesEmptyLede: '沒有行動項目 — 依公司標準，這是完美會議。',
    discussionNotesLabel: '討論紀要',
    speakPlaceholder: '對大家說點什麼…',
    leaveLabel: '離開會議',
    escalateLede: '這個房間已經跑完了議程。再往上提一級。',
    escalateToSteering: '升級到指導委員會',
    escalateToCab: '升級到變更諮詢委員會(CAB)聽證會',
    interjectCapLine: 'Pam:「很棒的觀點 — 先放進停車場。時間到了。」'
  },
  OFFICE_IM_QUICK_REPLIES: [
    '👍',
    '照我上一封信說的',
    '先丟停車場',
    '請指示',
    '再跟進一下',
    '已記入你的檔案',
    '我這台能跑',
    '協同效應？'
  ],
  OFFICE_CHROME_COPY: {
    doIt: '就這麼辦',
    doSelected: '套用所選',
    doItAll: '全部套用',
    windowMinimize: '最小化',
    windowMinimizeTitle: '收到工作列',
    sheetExpand: '放大此視窗',
    sheetCollapse: '縮小此視窗',
    desk: {
      attribution: {
        aria: '第三方供應商致謝',
        label: '已審批供應商',
        tag: '法務工單',
        disclaimer:
          '非官方粉絲惡搞。與 Pied Piper 無關，與 HBO 無關，與你的雇主無關。採購部讀過服務條款了。',
        links: [
          {
            id: 'elevenlabs',
            label: 'ElevenLabs',
            href: 'https://elevenlabs.io',
            title: '辦公室環境音與提示音效 — 非商業用途並署名'
          },
          {
            id: 'silicon-valley',
            label: 'Silicon Valley',
            href: 'https://www.hbo.com/silicon-valley',
            title: 'HBO《矽谷群瞎傳》 — 角色致敬，並非官方聯名'
          },
          {
            id: 'mermaid',
            label: 'Mermaid',
            href: 'https://mermaid.js.org',
            title: '畫布上的流程圖與關係圖繪製'
          },
          {
            id: 'antv',
            label: 'AntV',
            href: 'https://infographic.antv.antgroup.com',
            title: '資訊圖槽位的版面與範本'
          },
          {
            id: 'vega-lite',
            label: 'Vega-Lite',
            href: 'https://vega.github.io/vega-lite/',
            title: '數據圖槽位的資料視覺化'
          },
          {
            id: 'three',
            label: 'Three.js',
            href: 'https://threejs.org',
            title: '3D 隱喻的空間場景'
          }
        ]
      },
      buttonLabel: '你的工位',
      buttonAria: '你的工位 — 你可以做的事',
      buttonTitle: '郵件、聊天、會議、匯出和辦公室聲音設定',
      menuAria: '工位操作',
      commsAria: '郵件、聊天和會議',
      menuHeading: '你在幹嘛？',
      hrProgress: '查一下我的 HR 晉升進度',
      hrProgressTitle: '人資營運計分卡 — 等級、XP，以及 Linda 對你的看法',
      coffee: '去喝杯咖啡',
      walk: '在樓層走走',
      slopChat: '開啟 Slop Chat',
      slopChatShort: '聊天',
      slopChatTitle: 'Slop Chat™ — 給同事發訊息或查看歷史',
      inbox: '查一下郵件',
      inboxShort: '郵件',
      meeting: '開個會',
      meetingShort: '會議',
      meetingTitle: '訂玻璃會議室或戴上耳機 — 選好人就開',
      team: '抓個有空的人',
      teamTitle: '拉一位同事過來，只聽一個人的意見',
      teamToggleAria: '把整個團隊叫過來',
      huddleAction: '都過來一下',
      huddleActionTitle: '全隊擠到你螢幕前 — 每人說一句，然後各回各位。沒有會議室，沒有耳機。',
      pairAction: '結對',
      pairActionTitle: '他們拉張椅子坐下，你不趕人就一直待著',
      outbox: '拿去收發室',
      outboxTitle: '儲存、複製或分享工位上的成品',
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
      officeViewShortcut: 'Shift+O',
      sitDown: '回到螢幕前',
      sitDownShort: '坐下',
      sitDownTitle: '坐下，繼續做交付物',
      thinking: '打開筆記本',
      thinkingShort: '筆記本',
      thinkingRole: '思考',
      thinkingClose: '關閉筆記本',
      thinkingTitle: '你的筆記本 · 筆記、評審和執行紀錄',
      thinkingLiveWorking: '還在寫…',
      thinkingLiveTitle: '蓋子底下還在寫 · {status} — 打開筆記本看看',
      thinkingLiveAria: '筆記本還在寫：{status}。打開可查看執行進度。',
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
      tagline:
        '你是這層樓最新的架構師。琳達會速通全員介紹——然後把你丟回座位。Gilfoyle 和 Russ 稍後再找你。',
      autoplayHint: '正在說話…',
      rosterTagline: 'Your Team（跳過到職引導的那兩位除外）——真想聽完整自我介紹再點 ▶：',
      greeting: '歡迎加入，{name}。',
      greetingRole: '架構師',
      expandLabel: '🏢 認識團隊',
      expandTitle: '第一天到職 — 人力營運的 Linda、Your Team，然後是座位精靈。',
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
        '歡迎來到這層樓。我是琳達，人力營運——工牌照片、逾期訓練，以及邊微笑邊記錄你罪狀的人。速通一輪，因為沒人扛得住五段串行自我介紹：Dinesh 會抓到 bug，並確保你他媽感謝他。Erlich 會問這張圖夠不夠有勇氣——說夠，否則他會孵化你的靈魂。Jared 已經給你的到職開了發現項；他很抱歉。Richard 正在安靜地給一個模式命名，祝福他。Jack Barker 超興奮，已經為董事會簡化了這一刻。Gilfoyle 和 Russ 故意翹了——他們會找到你，而且不會客氣。繼續走。',
      welcomeClosingLine:
        '第一天到此為止。你的座位在那邊——坐下，熬過那個小到職精靈，再開一個交付件，別等有人約一個關於約同步的同步會。合規不知怎麼已經逾期了，Craig 的生日卡片還在冰箱上，要是你為釘書機全員回覆，我會親手弄死你。',
      nameTag: {
        hello: '你好',
        subtitle: '我叫',
        placeholder: '新人',
        editTitle: '輸入你的名字 — 整個辦公室都會開始使用它',
        inputAria: '你在辦公室的名字'
      }
    },
    colleaguePicker: {
      directoryAria: '挑一位同事',
      tierTeam: '你的團隊',
      tierSenior: '管理層',
      tierOffice: '這層樓'
    },
    arrivals: {
      regionAria: '工位來件 — 郵件與聊天',
      emailKindLabel: '公司信箱 · 新郵件',
      imKindLabel: 'Slop Chat™ · 即時訊息',
      emailAnnounce: '{name} 寄信給你了',
      imAnnounce: '{name} 傳訊息給你了',
      openMail: '看一下信箱',
      openChat: '開啟 Slop Chat',
      dismissAria: '忽略來自 {name} 的來件'
    },
    inbox: {
      buttonTitle: '公司信箱',
      dragHint: '拖曳以移動',
      compose: '✉️ 寫新郵件',
      composeTitle: '寫信給樓裡任何人',
      composeToLabel: '收件人',
      composeSubjectLabel: '主旨',
      composeSubjectPlaceholder: 'RE: 某件緊急的事（大概並不緊急）',
      composeBodyLabel: '內文',
      composeBodyPlaceholder: '你盡量專業一點。他們不會。',
      composeSend: '寄出',
      composeSending: '寄送中……',
      composeCancel: '取消',
      composePickSomeone: '先挑一個收件人',
      unreadAria: '收件匣 — {count} 封未讀郵件',
      noUnreadAria: '收件匣 — 沒有未讀郵件',
      title: '📥 收件匣',
      mailAnnounce: '您有新郵件！',
      mailAnnounceLang: 'zh-TW',
      closeAria: '關閉收件匣',
      back: '← 返回',
      emptyLine: '收件匣清空。HR 覺得這很可疑。好好珍惜。',
      markAllRead: '全部標為已讀',
      selectEmailAria: '選擇來自 {name} 的郵件以召開會議',
      callMeeting: '📅 撥個電話',
      callMeetingWithCount: '📅 撥個電話 ({count})',
      callMeetingTitle: '就這封郵件開一場耳機會議 — 可先加減人',
      callMeetingFromSelectionTitle: '就所選郵件開耳機通話 — 挑誰進場',
      callMeetingSelectTitle: '先選郵件當議題，或直接打開名單',
      callMeetingDisabledTitle: '已經在開會 — 先離開那場',
      callMeetingAboutEmail: '📅 就此郵件撥個電話'
    },
    errand: {
      startCta: '🚶 去找 {name}',
      startCtaTitle: '站起來走過去。這件事會一直掛在辦公區，直到你跟對方說上話。'
    },
    phishing: {
      link: '🔗 立即重新驗證你的憑證',
      linkTitle: '這看起來很正式。',
      report: '🛡️ 檢舉釣魚郵件',
      reportTitle: '轉寄給「拒絕部」',
      caught:
        '那是我發的。那是一次測試。你在 1.2 秒內就失敗了，這是新紀錄，我已經把這條紀錄附進你的檔案。人力營運會就補訓事宜聯絡你。',
      approved: '你檢舉了。很好。那封是我發的。所有的都是我發的。別太放鬆。'
    },
    training: {
      title: '🎓 圖表安全操作規範',
      stepLabel: '第 {step} 份 / 共 {total} 份',
      loading: 'Linda 正在準備你的模組…',
      closeAria: '關閉訓練',
      dragHint: '拖曳以移動',
      startCta: '🎓 開始第 {module} 模組',
      assignedSubject: '需要處理：已為你指派第 {module} 模組 😊',
      assignedBody:
        '鑑於近期發生的資安事件，你已被納入《圖表安全操作規範》第 {module} 模組（共 {total} 個）。\n\n這不是處分。處分由另一個團隊負責，而那個團隊也是我們。\n\n人資營運永遠，\nLinda — 人資營運',
      certificateSubject: '完成證書（暫定）🎓',
      certificateBody:
        '恭喜！你已完成《圖表安全操作規範》第 {module} 模組（共 {total} 個）。\n\n證書已附在信中。並沒有附上 — 證書由一套 2019 年就已下線的系統核發，你的完成紀錄被存進了一份無人認領的試算表。\n\n第 {next} 模組現已逾期。\n\n人資營運永遠，\nLinda — 人資營運'
    },
    meetingPicker: {
      title: '📅 開個會',
      dragHint: '拖曳以移動',
      titleHuddle: '📅 拉人聊聊',
      topicPlaceholder: '可選議程（反正他們也會無視）',
      topicAria: '會議主題',
      modalityAria: '這場會議在哪開',
      modalityPhysical: '會議室',
      modalityPhysicalTitle: '全員起身走進會議室 — 包括你',
      modalityRemote: '耳機',
      modalityRemoteTitle: '大家都留在工位通話 — 樓層上看得見耳機',
      groupsAria: '快捷群組',
      groupTeam: '你的團隊',
      groupTeamTitle: '拉上日常一起幹活的人',
      groupSteering: '指導委員會',
      groupSteeringTitle: 'Pam + 高階主管 + 一個人上台講圖',
      groupFloor: '整層樓',
      groupFloorTitle: '衝開放辦公區那邊喊一聲',
      groupSeniors: '領導層',
      groupSeniorsTitle: '約那些會問「這要花多少錢」的人',
      directoryAria: '邀請誰',
      tierTeam: '你的團隊',
      tierSenior: '領導層',
      tierOffice: '這層樓',
      facilitatorBadge: '主持',
      selectedCount: '已邀請 {count} 人',
      selectedCountOne: '已邀請 1 人',
      maxHint: '會議室最多 {max} 人 — 先去掉一位再加。',
      start: '開始會議',
      startPhysical: '訂下',
      startRemote: '撥入',
      startHuddle: '開始',
      cancel: '算了',
      closeAria: '關閉會議選擇'
    },
    im: {
      kindLabel: 'Slop Chat™ · 即時訊息',
      regionAria: '即時訊息',
      dismissAria: '關閉來自 {name} 的訊息',
      announce: '{name} 傳訊息給你',
      showFull: '查看完整訊息',
      showFullAria: '在 Slop Chat 中開啟 {name} 的完整訊息',
      openHistoryAria: '開啟 Slop Chat(未讀 {count} 則)',
      openHistoryTitle: 'Slop Chat™ —— 查看歷史訊息'
    },
    messenger: {
      title: '💬 Slop Chat™',
      dragHint: '拖曳以移動',
      newMessage: '✉️ 新訊息',
      newMessageTitle: '和樓裡任何人開一個對話',
      pickColleague: '挑一位同事',
      pickColleagueHint: '選一個人傳訊息 — 他們「都有空」。',
      tagline: '在線狀態提示多了 40%',
      closeAria: '關閉 Slop Chat',
      threadsAria: '對話列表',
      emptyThreads: '還沒有訊息。且行且珍惜。',
      messageSomeone: '傳訊息給誰',
      messageSomeoneTitle: '隨機找一位同事 — 他們總會回覆',
      emptyThread: '挑一位同事吧，他們「都有空」。',
      composerPlaceholder: '輸入訊息……',
      composerAria: '傳訊息給 {name}',
      send: '傳送',
      sending: '傳送中……',
      typing: '{name} 正在輸入……',
      unreadDot: '未讀',
      you: '我',
      statusOnline: '有空',
      statusBusy: '開會中',
      statusHuddle: '在你螢幕前',
      statusBattle: '吵架中',
      statusCoffee: '接咖啡中',
      statusDesk: '在你座位旁',
      callMeeting: '📅 撥個電話',
      callMeetingTitle: '和此人開一場耳機通話 — 想叫更多人也可以',
      callMeetingDisabledTitle: '已經在開會 — 先離開那場',
      callMeetingNoThread: '📅 開個會',
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
      fetchingLabel: '思考中……',
      watching: '團隊正在看筆記本…',
      pinSpeakerAria: '釘選 {name} 的建議',
      pinSpeakerTitle: '釘選 {name} 的說法 — 或者現在就問他',
      delegate: '就這麼辦',
      delegateTitle: '帶著這條要求打開筆記本',
      unpinAria: '取消釘選這條建議',
      hardStop: '硬性截止',
      hardStopTitle: '抱歉 — 整點有硬性截止。散了吧。',
      pairSceneAria: '結對看你的圖',
      pairGathering: '{name} 正拉椅子過來…',
      pairWatching: '{name} 正在看筆記本…',
      pairEnd: '謝了 — 我懂了',
      pairEndTitle: '{name} 回自己座位'
    },
    coffee: {
      kindLabel: '咖啡歇腳',
      inviteLine: '要喝杯咖啡嗎？',
      declineAria: '不用了，{name}',
      accept: '休息 5 分鐘',
      decline: '趕死線',
      sceneAria: '茶水間咖啡時間',
      sceneTitle: '茶水間',
      speakingLabel: '{name}…',
      done: '我得去發版了'
    },
    battle: {
      kindLabel: '開放辦公鬧劇 · 神聖戰爭',
      inviteLine: '🥊 {a} 和 {b} 又槓上了 — 「{topic}」。整層樓都在圍觀。',
      accept: '搬好板凳',
      decline: '與我無關',
      sceneAria: '樓層神聖戰爭',
      sceneTitle: '神聖戰爭',
      versus: 'vs',
      inviteTagline: '全樓層都在圍觀。',
      declineAria: '與我無關 — 走開',
      dismissAria: '離開這場神聖戰爭',
      speakingLabel: '{name}…',
      getOut: '走開，別摻和',
      settleLine: '雙方你都聽完了。總得有人是錯的：',
      sideLabel: '站 {name}',
      walkAway: '上報 HR（離場）',
      verdictHead: '全樓層裁定',
      done: '回去上工'
    },
    meetingInvite: {
      kindLabel: '日曆邀請 · 會議',
      organizerLabel: '主辦人：',
      attendeesLabel: '與會者：',
      accept: '接受',
      decline: '不行 — 我在趕上線',
      proposeNewTime: '另提時間'
    },
    meeting: {
      youName: '你',
      close: '關閉',
      noMinutes: '沒有行動項目。以公司標準來說，這是一場完美的會議。',
      speakAria: '對大家說話',
      speak: '🗣️ 說話 ({count})',
      atTime: '✋ 時間到',
      dock: '🗕 看我的螢幕',
      dockTitle: '把會議縮到角落，騰出手來改圖',
      undock: '🗖 回到會議室',
      undockTitle: '把會議放回螢幕中央',
      minimize: '最小化',
      minimizeTitle: '收合到標題列，讓畫布保持可見',
      restore: '還原',
      restoreTitle: '展開會議視窗',
      dragHint: '拖曳以移動',
      speakerViewHint: '正在收聽 — 可在工位選單開啟字幕(CC)閱讀',
      discussionToggle: '討論紀要',
      discussionToggleHide: '隱藏討論紀要'
    },
    floor: {
      eyebrow: 'ARCHISLOP CORP. · 3 樓',
      title: '樓層',
      subtitle: '開放辦公。牆拆了說是為了協作，會一個都沒少。',
      stageAria: '辦公室樓層的等距視圖',
      back: '🪑 回到螢幕前',
      backTitle: '坐下，繼續做交付物',
      hint: '點擊地板走動。點同事認識他們，或雙擊走過去交談。Esc 讓你坐下。',
      narration: {
        atDesk: '在自己的工位。',
        inMeeting: '在玻璃會議室裡。',
        walkingTo: '正走向 {name}。',
        standingWith: '站在 {name} 旁邊。',
        walkingToDesk: '正走向 {name} 的工位。',
        standingAtDesk: '站在 {name} 的工位旁。',
        walkingToProp: '正走向 {prop}。',
        standingAtProp: '站在 {prop} 旁。',
        walkingHome: '正走回自己的工位。',
        walkingFloor: '正走過樓層。',
        standingFloor: '站在地板上。方向鍵邁步；Esc 走回工位。',
        arriving: '{name} 正朝你的工位走來。',
        leaving: '{name} 正走回自己的工位。',
        inHuddle: '你的團隊圍在你工位旁開小會。',
        overhearing: '{name} 和 {partner} 正在旁邊聊天。你可以加入。',
        onErrand: '站在辦公區。{from} 請你去找 {name} 私下聊一句。'
      },
      arrival: {
        eyebrow: 'ARCHISLOP CORP. · 入職第一天',
        title: '歡迎來到樓層',
        subtitle: '馬上有人接待你。不會有。',
        skip: '跳過儀式 →',
        receptionEyebrow: '前台',
        receptionBody:
          '簽到、拿工牌，裝得像做過一樣。琳達會速通全員介紹——然後把你按回工位做入職嚮導。',
        checkIn: '簽到 →',
        clockIn: '🪑 打卡 — 坐到工位',
        clockInEarly: '🪑 去工位（我懂了）',
        narration: {
          atReception: '在前台。簽到開始。',
          welcome: '琳達正在歡迎你。',
          walkingToColleague: '正走向 {name}。',
          standingWithColleague: '站在 {name} 旁邊。',
          colleagueIntroducing: '{name} 在工位上。',
          walkingToDesk: '正走向你的工位。'
        }
      },
      close: '關閉',
      youName: '你',
      youTitle: '架構師 — 新人',
      youBlurb: '你的工位。你的交付物。你的顯示器——這層樓唯一在幹活的螢幕。',
      sitHere: '🪑 在這裡坐下',
      message: '💬 發訊息',
      messageTitle: '打開與對方的 Slop Chat™',
      seniorNote: '沒有日曆邀請免談。',
      teamNote: '是你的隊友 — 從畫布給他們交代。',
      away: {
        atLabel: '{who}，{prop}',
        atProp: '不在工位：{prop}。',
        elsewhere: '不在工位。'
      },
      talk: {
        eyebrow: '當面聊聊',
        action: '💬 走過去說',
        actionTitle: '走過去說点什麼 — 或雙擊對方',
        walking: '正在走過去……',
        thinking: '對方正在想怎麼回……',
        placeholder: '說點什麼……',
        send: '發送',
        youLabel: '你',
        leave: '🪑 回工位',
        leaveTitle: '結束對話，走回螢幕前'
      },
      peek: {
        eyebrow: '從肩膀上方偷看',
        action: '👀 看他們螢幕',
        actionTitle: '走過去看看對方在忙什麼',
        walking: '正在走過去。裝得像有事找。',
        back: '🪑 回工位',
        backTitle: '走回自己的螢幕',
        looks: {
          terminal: '一個終端。綠字黑底，回滾到天邊。',
          tabs: '四十個標籤頁。其中一個是正事。',
          spreadsheet: '一張表。標籤叫 FINAL_v7_actual。',
          slides: '簡報。第四頁標題是「Slide 4」。',
          tickets: '工單佇列，按被無視了多久排序。',
          calendar: '日曆。滿螢幕純色。'
        }
      },
      props: {
        eyebrow: '動手試試',
        walking: '正在過去。',
        working: '稍等……',
        blocked: '現在不行 — 你還有別的事。',
        back: '🪑 回工位',
        backTitle: '走回自己的螢幕',
        look: '🔍 湊近看看',
        lookTitle: '好好看一眼',
        items: {
          coffeeMachine: {
            glyph: '☕',
            name: '咖啡機',
            note: '茶水間 · 從未除垢',
            useLabel: '咖啡機 — 來一杯',
            useTitle: '走過去沖一杯',
            line: '它研磨、嘶嘶響，吐出棕色液體。很快會有人過來找你說話。',
            blocked: '已經在給別人做了。等你的輪次。',
            details: [
              '一張護貝的：除垢值日表。最後一個簽名的人早就離職了。',
              '瀝水架上六個杯子。有一個寫著「全世界最將就」。那是大家的。',
              '「該清潔了」的指示燈被一小塊膠帶蓋住了。',
              'Gary 貼在咖啡豆罐上的標籤：設施部財產。不是福利。'
            ]
          },
          printer: {
            glyph: '🖨️',
            name: '印表機',
            note: '前台 · MFP-3 “SLOPMASTER”',
            useLabel: '印表機 — 看看它',
            useTitle: '走過去看一眼',
            line: 'PC LOAD LETTER。這層樓從來沒人裝過信紙。佇列顯示 41 個任務，全是 2023 年的。',
            details: [
              '蓋子上貼著：「已損壞 — Dave」。底下壓著更舊的一張：「已損壞 — Dave」。',
              '出紙匣最上面是一份 60 頁的簡報。第一頁寫著「草稿 — 請勿外傳」。',
              '有人把 wifi 密碼寫在紙匣上。是錯的，而且已經被更正過兩次。',
              '一張便利貼：「響兩聲就走開」。它正在響一聲。'
            ]
          },
          whiteboard: {
            glyph: '📋',
            name: '白板',
            note: '工位旁 · 請勿擦除',
            useLabel: '白板 — 讀讀上面寫的',
            useTitle: '走過去讀一下',
            line: '兩輪重組前的架構，油性筆寫的。三個框、一根箭頭，還有被劃了兩道的 SYNERGY。',
            // Slice 16 — see the note on the default bundle. `line` and
            // `details` stay the empty state; these two take over once your
            // diagram is on the board.
            lineYours:
              '有人把舊架構擦掉了。現在上面是你的——{count} 個框，油性筆寫的，已經被袖子蹭花了一處。',
            detailsYours: [
              '框上寫著：{labels}。其中一個被畫了星號。沒人知道是誰畫的，也不知道指的是哪一個。',
              '多了一根你那版上沒有的箭頭。它從一個框出發，又回到同一個框。',
              '下面另一種筆跡寫著「這個歸誰管」。沒有箭頭說明是哪一個。',
              'SYNERGY 還活在角落裡，被劃了兩道。它總是活著。'
            ],
            details: [
              '右下角小字：「這只是暫時的」。日期是四年前。',
              '第四個框被擦掉了一半。還能認出 BILLING 這個詞。',
              '角落裡有人畫了一匹很不錯的馬。從來沒有人提起過。',
              '在「請勿擦除」下面，另一種筆跡寫著「為什麼」。再下面：「問 Ulrich」。'
            ]
          }
        }
      },
      interrupt: {
        gotIt: ['都給你了。', '我正好要走。', '{prop}我用完了，你來吧。', '嗯，你先。'],
        gaveUp: [
          '喔——你先吧。',
          '我也沒那麼需要{prop}。',
          '我等一下再來。',
          '你先。沒事。真的沒事。'
        ]
      },
      shopTalk: {
        coffeeMachine: [
          [
            '它本來就該發出這種聲音嗎？',
            '它從三月起就一直這樣響。我報修過兩次。現在這聲音已經算是架構的一部分了。'
          ],
          ['燕麥奶又沒了。', '我們有過一次燕麥奶。那是試辦。試辦沒有續約。'],
          ['有人把杯子留在水槽裡了。', '我知道是誰的。我在等它自己長出點什麼。'],
          ['冰箱上貼的這張表是什麼？', '那是值日表。從來沒有人真的值過日。那是一種願景。'],
          [
            '這上面寫著無咖啡因。',
            '是寫著無咖啡因。一直都寫著。那你自己想想，為什麼你十一點還醒著。'
          ],
          ['你有出去買過咖啡嗎？', '我春天出去過一次。還行。外面有天氣。']
        ],
        printer: [
          [
            '它顯示 PC LOAD LETTER。這是什麼意思？',
            '工單 #48314 已建立。分類：印表機。狀態：等待使用者。請問您試過另一個紙匣嗎。'
          ],
          ['它把所有東西都印歪了。', '這是設計如此。已關閉為 WONTFIX。請為本次服務評分：🔥'],
          ['我的東西印出來了嗎？', '您的文件在佇列裡。佇列裡有 212 份文件。其中大部分是同一份。'],
          [
            '它側面有一扇小門是開著的。',
            '那扇門不在手冊裡。我已經把那扇門呈報上去了。那扇門現在是已知問題。'
          ]
        ],
        whiteboard: [
          ['這塊白板還有人在用嗎？', '別擦。千萬別擦。那上面有一半還在正式環境跑著。'],
          ['這個箭頭是什麼意思？', '這個箭頭比我來得早。我第二週就不問了。'],
          ['我們要不要乾脆重畫一遍？', '我們重畫過了。三月。這就是重畫過的版本。'],
          ['這上面有一半是別人的字跡。', '那一半是重組之前留下的。這裡沒有人看得懂，也沒有人敢擦。']
        ]
      },
      errand: {
        eyebrow: '你還欠一趟',
        body: '{from} 請你去跟 {name} 私下聊一句。你們說什麼，只有你們知道。',
        action: '🚶 走過去聊聊',
        actionTitle: '走過去 — 只要你開口說話，這件事就算辦完了',
        drop: '今天算了',
        dropTitle: '放著不管。沒有人在追蹤這件事。Linda 說沒有人在追蹤這件事。'
      },
      join: {
        eyebrow: '在你耳邊',
        body: '{name} 正在{prop}那邊和 {partner} 聊天。兩個人都沒注意到你。',
        action: '💬 加入他們',
        actionTitle: '走過去說點什麼 — 他們自己是不會帶上你的'
      },
      meeting: {
        eyebrow: '玻璃會議室',
        eyebrowRemote: '耳機同步會',
        leave: '🚪 離開',
        leaveTitle: '話沒說完就走。Pam 會記進紀要。',
        sitOut: '🪑 我的螢幕',
        sitOutTitle: '坐下 — 會議繼續，你不在房間裡',
        endedLine: '散會。紀要在你的螢幕上。',
        readMinutes: '🪑 看紀要',
        readMinutesTitle: '坐下 — 會議把紀要交給你的螢幕'
      },
      huddle: {
        eyebrow: '團隊圍聚',
        heading: '你的團隊，圍在你工位旁',
        pairEyebrow: '結對',
        pairHeading: '{name}，就坐在你旁邊'
      },
      zones: {
        reception: '前台',
        leadership: '領導區',
        kitchen: '茶水間',
        meeting: '會議室',
        pod: '你的工位區',
        hrCorner: '人力資源'
      }
    },
    talk: {
      kindLabel: '在你座位旁',
      placeholder: '隨口說一句…',
      placeholderNamed: '跟 {name} 說一句…',
      aria: '隨口說一句 —— 誰適合誰接話',
      ariaNamed: '跟 {name} 說一句',
      roomTitle: '對著辦公室說 —— 誰適合誰接話',
      send: '說出口',
      sendTitle: '隨口說說，沒人會動畫布',
      sending: '…',
      pending: '有人抬起頭…',
      pendingNamed: '{name} 抬起頭…',
      dismissAria: '繼續做事',
      adopt: '照做',
      openThread: '打開這條對話',
      clearTargetTitle: '改成對著辦公室說',
      clearTargetAria: '不再單獨跟 {name} 說'
    },
    osTray: {
      aria: '已開啟的工作站視窗',
      taskbarAria: '工作站工作列',
      trayAria: '狀態列',
      brand: 'ArchiSlop OS',
      tidy: '收拾一下',
      restore: '還原視窗',
      tidyTitle: '把每個視窗送回它開啟時的位置',
      presence: {
        aria: '{status}。起身去看看。',
        ariaChat: '{status}。開啟 Slop Chat。',
        ariaStay: '{status}。',
        title: '起身去看看',
        titleChat: '開啟 Slop Chat',
        titleStay: '已在你的螢幕上',
        overflow: '+{count}',
        pair: '{name} 正在和你結對',
        mob: '{count} 人圍著你的螢幕',
        walkby: '{name} 就在你座位旁',
        battle: '{name} 對陣 {other}',
        coffee: '咖啡時間',
        meeting: '{name} 正在召集會議',
        talk: '{name} 在等你回覆',
        talkMany: '{count} 人在等你回覆',
        quiet: '辦公區一片安靜'
      }
    }
  }
};

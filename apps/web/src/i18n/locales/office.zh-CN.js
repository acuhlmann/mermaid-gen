/**
 * Simplified Chinese overrides for the office-parody copy
 * (docs/office-parody.md). Template arrays replace the English bank wholesale
 * (deepMergeLocale), so ids, colleagueIds, and `{label}` / `{userTitle}`
 * slots must stay aligned with officeCast.js — the seen-template memory is
 * shared across locales. Colleague names stay Latin (identity anchors);
 * titles localize.
 */
export const OFFICE_ZH_CN = {
  OFFICE_COLLEAGUES: {
    intern: {
      title: '实习生（无薪 · 战略级）',
      blurb: '会先全员回复，再全员回复道歉。天真的问题偶尔一针见血。',
      introLine:
        '嗨！！我是 Chad——无薪、战略级，而且大概率会因为订书机议题全员回复，然后再全员回复道歉。关于你的图有个小问题，说不定会是今天全场最聪明的一句。另外：订书机放哪儿了？替我的入职文档问问，也替我的灵魂问问。'
    },
    scrumMaster: {
      title: '敏捷教练 — CSM、CSPO、SAFe 6.0',
      blurb: '万事皆仪式。气氛好得过分。连午饭都要设时间盒。',
      introLine:
        '嗨！！我是 Pam——CSM、CSPO、SAFe 6.0，对停车场话术情感流利。这次自我介绍限时四十五秒协同能量。气氛已经很好了。太爱我们了。咱们回头再对齐——非常感谢你在这里！！'
    },
    helpdesk: {
      name: '工单机器人 Dave',
      title: 'IT 服务台 — 一线（仅此一线）',
      blurb: '把工单关闭为它自己的重复项。在他机器上没问题。',
      introLine:
        '工单机器人 Dave。一线（仅此一线）。我把工单关成它自己的重复项。试过关机再开机吗。那不是问句。在我机器上没问题。'
    },
    facilities: {
      title: '后勤与冰箱沙皇',
      blurb: '发全大写的冰箱清理通知。以铁腕掌控恒温器。',
      introLine:
        '我是 GARY。冰箱是我的。恒温器也是。没贴标签的容器——以及没标清楚的架构图——一律归后勤部所有。友情警告。'
    },
    hr: {
      title: '人力运营业务伙伴',
      blurb: '武器化的热情。你的培训已逾期 847 天。记得给 Craig 的贺卡签名。',
      introLine:
        '我是 Linda，人力运营。工牌照片、逾期培训，还有 Craig 的生日贺卡——最后那件不知怎么也成了你的事。'
    },
    greybeard: {
      title: '资深工程师（荣休返聘）',
      blurb: '“1979 年我们试过。”维护着那台大型机。冷笑话更冷。建议好得让人不安。',
      introLine:
        'Ulrich。资深工程师（荣休返聘）。1979 年我们试过。靠 JCL 和恐惧在跑。正式环境挂了一周。现在还在跑。我维护着那台没人承认的大型机。大型机问起你了。我跟它说你在画图。它叹了口气。'
    },
    ciso: {
      title: '首席信息安全官 — “不行部”',
      blurb: '万物皆攻击面，尤其是箭头。钓鱼演练由 TA 主持。谁都不信。',
      introLine:
        'Sasha。CISO。不行部。万物皆攻击面——尤其是你、那些箭头，还有 2017 年那个临时管理员密码。已记入你的档案。我是出于好意。'
    }
  },
  SENIOR_STAKEHOLDERS: {
    belson: {
      title: 'CTO — 让世界变得更美好',
      blurb: '带火气的弥赛亚愿景。Jack 向上汇报。上次打开 IDE 是在主题演讲彩排。'
    },
    cfo: {
      title: 'CFO — 预算就是不行',
      blurb: '每个方框都是成本中心。会问这张图每月要花多少钱。什么都不批。'
    },
    barker: {
      title: 'CEO — 成功表演学',
      blurb: '为兴奋而兴奋。布道"成功连体三角"。已经擅自替你决定了。'
    }
  },
  OFFICE_SLOT_FALLBACKS: { label: '这张图', userTitle: '实习架构师', userName: '新人' },
  OFFICE_WELCOME_EMAIL: {
    id: 'welcome-email-hr',
    colleagueId: 'hr',
    subject: '欢迎加入，{userTitle}！🎉（工牌照片：待定）',
    body: '欢迎来到这层楼！非常高兴你的加入。在入职引导（已改期，时间待定）之前，先认识 Your Team 的几张脸：\n\n🙋 Dinesh 会抓住别人没看见的 bug，然后提醒你是他抓到的。\n🕶 Erlich 会问这张图够不够有勇气。请慎重回答。\n📋 Jared 已经就你的入职交接提了发现。轻轻地。坚定地。\n🤓 Richard 觉得这间办公室有一个可命名的模式。他大概是对的。\n🧘 Jack Barker 很兴奋——并且已擅自把你的第一周简化成董事会版本。\n\nGilfoyle 和 Russ 也在这层楼。他们会自己找到你。不需要介绍。\n\n我是 Linda — 人力运营！你的合规培训已经逾期了，这实属纪录。想安静一点？工位菜单里有专注、音景和朗读 — 也可以站起来去咖啡机那边转转。\n\n暖暖的问候，\nLinda'
  },
  OFFICE_WELCOME_IM: {
    id: 'welcome-im-intern',
    colleagueId: 'intern',
    body: '嗨！！你就是新来的{userTitle}吧 — 欢迎！！不小心把欢迎帖全员回复了，又全员回复道了歉。经典 Chad。咖啡机有十四个按钮，十二个是装饰。另外 gary 一定会给你发冰箱邮件。别往心里去（要往心里去）'
  },
  OFFICE_EMAIL_TEMPLATES: [
    {
      id: 'email-fridge-cleanout',
      colleagueId: 'facilities',
      subject: '提醒:本周五清理冰箱',
      body: '冰箱将于周五下午 3 点清理。所有未贴标签的物品将归后勤部所有,包括饭盒、调味料和架构图。\n\n先行致谢,\nGary'
    },
    {
      id: 'email-thermostat',
      colleagueId: 'facilities',
      subject: '回复:回复:回复:恒温器',
      body: '恒温器已设定为科学上最优的 20.5°C,并已装入上锁的保护罩。请不要再往传感器上贴冰袋了。我知道是三楼干的。\n\nGary'
    },
    {
      id: 'email-room-booking',
      colleagueId: 'facilities',
      subject: '您预订的“作战室 4”已确认',
      body: '请注意,作战室 4 已于 2023 年改建为健康舱,而在那之前它并不存在。您的预订依然有效。\n\nGary'
    },
    {
      id: 'email-password-expiry',
      colleagueId: 'helpdesk',
      subject: '[工单 #48291] 您的密码将在 14 天后过期',
      body: '如需重置密码,请先用已过期的密码登录,再点击我们发送到您已被锁定邮箱里的链接。\n\n此工单已关闭,状态:已解决。\n\n— 服务台(请勿回复,请勿来电,请勿)'
    },
    {
      id: 'email-ticket-duplicate',
      colleagueId: 'helpdesk',
      subject: '[工单 #48292] 已作为 #48292 的重复项关闭',
      body: '您关于“{label}”的工单已被关闭,原因:与其自身重复。如果问题仍然存在,那它就是一个特性。\n\n在我机器上没问题,\nDave'
    },
    {
      id: 'email-vpn-maintenance',
      colleagueId: 'helpdesk',
      subject: '计划停机:VPN 维护窗口',
      body: 'VPN 将于周六 02:00–02:15 不可用;根据历史数据,周一至周四也一样。\n\n试过把图关掉再打开吗?\n\n— Dave'
    },
    {
      id: 'email-compliance-training',
      colleagueId: 'hr',
      subject: '友情提示!培训已逾期 😊',
      body: '友情提示:您的《安全使用图表》合规培训已逾期 847 天!完成仅需 4 小时,包含 11 个不可跳过的模块。\n\n暖暖的问候,\nLinda — 人力运营'
    },
    {
      id: 'email-birthday-card',
      colleagueId: 'hr',
      subject: '给 Craig 的贺卡 — 今天下班前签名!',
      body: 'Craig 的生日贺卡正在传阅!请为 Craig 写一句暖心的祝福。如果您不认识 Craig,写句通用的暖心话也行。Craig 认识您。\n\nLinda'
    },
    {
      id: 'email-mandatory-fun',
      colleagueId: 'hr',
      subject: '诚邀参加:强制团队欢乐时光 🎉',
      body: '周四的自愿团建活动必须出席。本季度主题:“信任背摔与组织架构图”。请提前研读 {label},确保欢乐保持对齐。\n\nLinda'
    },
    {
      id: 'email-storypoints',
      colleagueId: 'scrumMaster',
      subject: '需要行动:给你的图估故事点',
      body: '这个冲刺能量满满!提醒:图上所有方框都须在明天的梳理会前估好故事点。“{label}”看起来像 13 点 — 我们在停车场环节把它拆解一下。\n\nPam',
      actionPrompt: '把最复杂的节点拆分成两个更小的步骤'
    },
    {
      id: 'email-intern-replyall',
      colleagueId: 'intern',
      subject: '回复:回复:转发:回复:小问题',
      body: '抱歉又全员回复了!!但有人知道“{label}”是不是应该连到另一个东西吗?另外订书机放哪儿了?无关问题。\n\nchad(实习生)'
    },
    {
      id: 'email-greybeard-migration',
      colleagueId: 'greybeard',
      subject: '你重新发明了批处理任务',
      body: '在共享盘上看到了你的图。这东西我们 1979 年就做过,靠一个 cron 任务和恐惧运行,1981 年把生产环境搞挂了一周。\n\n想知道细节就来问我。或者别问。它知道。\n\nUlrich'
    },
    {
      id: 'email-helpdesk-printer-firmware',
      colleagueId: 'helpdesk',
      subject: '[工单 #48313] 打印机固件升级完成',
      body: '三楼打印机已升级到固件 9.0.1。新特性包括:拒收 PDF、噪音更响,以及在不定期的时刻打印一(1)页写着“快了”的纸。这是预期行为。\n\n请勿开工单。它会被关闭为那台打印机的重复项。\n\n— Dave'
    },
    {
      id: 'email-greybeard-cloud',
      colleagueId: 'greybeard',
      subject: '回复:云迁移启动会',
      body: '云就是营销做得更好的大型机。我迁移过一次 — 1979 年,迁到“网格”上。1985 年我们又迁了回来。悄悄地。趁夜里。\n\n你的 {label} 放哪儿都能跑。东西大多都能跑,直到跑不动那天。\n\nUlrich'
    },
    {
      id: 'email-scrum-retro-retro',
      colleagueId: 'scrumMaster',
      subject: '诚邀参加:回顾会的回顾会(强制,有趣)',
      body: '各位!我们的回顾会在“能量”上拿了 4.2/5,但“可执行性”只有 2.9,所以我们要开一场回顾会的回顾会。请自备一个“开心”、一个“难过”、一个“愤怒”,外加一个备用“愤怒”。\n\n上次回顾会的行动项原封不动顺延,传统使然。\n\nPam'
    },
    {
      id: 'email-hr-wellness-webinar',
      colleagueId: 'hr',
      subject: '健康星期三:“正念画图” 🧘',
      body: '欢迎参加周三的引导课程:学习在方框之间呼吸,并放下那些不再滋养你的箭头。最后我们将为 {label} 举行感恩圈环节。\n\n出席记录匿名且被跟踪。\n\n近乎合十,\nLinda — 人力运营'
    },
    {
      id: 'email-facilities-microwave',
      colleagueId: 'facilities',
      subject: '事故报告:微波炉',
      body: '12:47,有人用微波炉热了鱼。大楼对此很有意见,我也是。微波炉现已归新管理层(我)管辖。门上贴了登记表:姓名、菜品、动机。\n\n先行致谢,\nGary'
    },
    {
      id: 'email-intern-first-ship',
      colleagueId: 'intern',
      subject: '我上线东西啦!!!(小问题)',
      body: '各位!!我的第一个改动上线了。就是 {label} 那个。不过小问题 — 如果所有东西都着火了,但火不大,该报告给谁?纯属假设。火是假设的。基本上。\n\nchad(实习生)'
    },
    {
      id: 'email-intern-pitch-deck',
      colleagueId: 'intern',
      subject: '小问题:图能当路演 PPT 吗',
      body: '嘿 {userName}!!随便问一下 — “{label}” 本质上是不是带箭头的路演稿??因为站会上有人说 deck,我点头点了十二分钟。\n\n另外我在领英写了“颠覆白板赛道”。会不会有点猛\n\nchad(实习生)'
    }
  ],
  SENIOR_EMAIL_TEMPLATES: [
    {
      id: 'email-ciso-phishing',
      colleagueId: 'ciso',
      subject: '你没有点击。我们注意到了。(钓鱼演练报告)',
      body: '礼节性通知:上周的模拟钓鱼邮件(“免费架构评审 — 立即点击”)你没有点。统计上讲,人人都会点。不点属于可疑行为,已记入你的档案。\n\n我们会一直测,直到你点为止。\n\n什么都别信,\nSasha — 不行部'
    },
    {
      id: 'email-ciso-password',
      colleagueId: 'ciso',
      subject: '密码策略更新(自昨日起生效)',
      body: '密码现须包含 16 个字符、一个表情符号、一个质数,以及一个已弃用协议的亡魂。密码不得包含:单词、数字或字符。\n\n你当前的密码在 4 项检查中挂了 11 项。某种意义上,令人佩服。\n\nSasha'
    },
    {
      id: 'email-cfo-cloud-spend',
      colleagueId: 'cfo',
      subject: '已标记:无法解释的预算项("{label}")',
      body: '财务标记了一个名为“{label}”的资源。请确认它 (a) 必不可少,且 (b) 免费。如果无法兼得,请参见 (b)。\n\n预算就是不行,\nDiane'
    },
    {
      id: 'email-belson-world',
      colleagueId: 'belson',
      subject: '我不想活在一个 {label} 永远这么小的世界里',
      body: '{userName} — 我认真坐下来看了看 {label}。轻轻地。仔细地。然后没那么轻轻了。我不想活在一个它只是一张该死的图、而不是人类繁荣平台的世界里。Jack 会擅自成立工作组;我在澄清高度。放大愿景。保住 logo。否则解释一下我们为什么资助爱好。\n\nGavin Belson',
      actionPrompt: '放大整张图的愿景 — 标题级平台叙事,不要实现细节'
    },
    {
      id: 'email-belson-undersized',
      colleagueId: 'belson',
      subject: '这他妈算什么高度 — {label}',
      body: '{userName} — 我审了 {label}。很快。然后又审了一遍,因为我不敢相信第一遍。格局太小。用「上线」伪装的小思维。我不为了表演提高嗓门 — 只在本该让世界更好的东西看起来像周末草稿时提高嗓门。放大。现在。Jack 已经知道了。\n\nGavin Belson',
      actionPrompt: '把图抬到主题演讲高度 — 少一点爱好细节,多一点平台命运'
    },
    {
      id: 'email-barker-liberty',
      colleagueId: 'barker',
      subject: '我擅自做了决定(天大的好消息)',
      body: '{userName} — 今天早上我花时间看了你的 {label},我很兴奋。不是因为它本身,而是因为我们可以围绕它讲出的故事。所以我擅自为它成立了一个小型工作组 — 没什么正式的,只是一个例行同步会、一个指导委员会和一份一页纸报告。一家人就该这样。\n\n温暖的问候,\nJack Barker',
      actionPrompt: '添加一个名为"董事会级成果"的节点,并连接到最后一步'
    },
    {
      id: 'email-barker-excited',
      colleagueId: 'barker',
      subject: '我不知道你怎么样,反正我很兴奋',
      body: '{userName} — {label} 进展得非常漂亮,我这么说可是看过无数图表的人。记住:打动不了董事会的图只是爱好,而我们不是一家做爱好的公司。故事要简单,价值要明显,协同要可见。\n\n我们是一家人。\n\n温暖的问候,\nJack'
    }
  ],
  OFFICE_IM_TEMPLATES: [
    {
      id: 'im-intern-boxes',
      colleagueId: 'intern',
      body: '小问题 — {label} 是应该有这么多箭头吗?替我的入职文档问问'
    },
    {
      id: 'im-intern-lunch',
      colleagueId: 'intern',
      body: '还有人看到冰箱那封邮件吗??gary 是来真的'
    },
    {
      id: 'im-scrum-standup',
      colleagueId: 'scrumMaster',
      body: '友情 ping 一下!你已经埋头很久了 — 要不要设个时间盒?🙂'
    },
    {
      id: 'im-scrum-retro',
      colleagueId: 'scrumMaster',
      body: '正在把“{label}”加到回顾板上作为讨论话题。能量满满!'
    },
    {
      id: 'im-helpdesk-restart',
      colleagueId: 'helpdesk',
      body: '今晚有计划维护。请保存工作。与那股烟无关。'
    },
    {
      id: 'im-helpdesk-printer',
      colleagueId: 'helpdesk',
      body: '工单 #48311(三楼打印机)已关闭,状态:不予修复。那台打印机有终身教职。'
    },
    {
      id: 'im-facilities-plant',
      colleagueId: 'facilities',
      body: '往电梯旁那盆假植物浇水的人 — 请住手。它长势喜人,我不喜欢。'
    },
    {
      id: 'im-hr-survey',
      colleagueId: 'hr',
      body: '匿名健康调查只剩 2 分钟了!(我们看得到您还没开始,{userTitle}。)'
    },
    {
      id: 'im-greybeard-look',
      colleagueId: 'greybeard',
      body: '看了眼 {label}。我们 1979 年试过。没事的。大概。'
    },
    {
      id: 'im-greybeard-mainframe',
      colleagueId: 'greybeard',
      body: '大型机问起你了。我说你忙着画图。它表示理解。'
    },
    {
      id: 'im-helpdesk-dns',
      colleagueId: 'helpdesk',
      body: '网络慢?是 DNS。不是 DNS。刚才是 DNS。工单已关闭。'
    },
    {
      id: 'im-greybeard-gitblame',
      colleagueId: 'greybeard',
      body: '对那次故障跑了 git blame。结果是你。2019 年。大型机选择原谅,但会记日志。'
    },
    {
      id: 'im-intern-regex',
      colleagueId: 'intern',
      body: '我写出人生第一个正则了!!它能匹配一切。这算坏事吗?感觉充满力量'
    },
    {
      id: 'im-scrum-velocity',
      colleagueId: 'scrumMaster',
      body: '速率播报!你平均每小时画 4.2 个方框 — 太棒了!这事儿咱们别告诉财务。🙂'
    },
    {
      id: 'im-facilities-elevator',
      colleagueId: 'facilities',
      body: '电梯又开始发出那个声音了。请走楼梯。楼梯也有声音,但是另一种。'
    }
  ],
  OFFICE_WALKBY_FALLBACKS: [
    {
      id: 'walkby-scrum',
      colleagueId: 'scrumMaster',
      body: '哦,这是 {label} 吗?冲刺看板上可没有它 — 我已经把它追溯性地加成一个探针任务了。'
    },
    {
      id: 'walkby-intern',
      colleagueId: 'intern',
      body: '哇,{label} 看起来好正式。是用 AI 做的吗?我能放进作品集吗?'
    },
    {
      id: 'walkby-greybeard',
      colleagueId: 'greybeard',
      body: '{label} 啊。1979 年我们也有一个。现在还在跑。没人知道在哪。'
    },
    {
      id: 'walkby-facilities',
      colleagueId: 'facilities',
      body: '图不错。三楼一股爆米花糊味,是 {label} 干的吗?老实说。'
    },
    {
      id: 'walkby-hr',
      colleagueId: 'hr',
      body: '大家围绕 {label} 的能量太棒了!考虑过在强制欢乐时光上展示它吗?😊'
    },
    {
      id: 'walkby-helpdesk',
      colleagueId: 'helpdesk',
      body: '{label} 那个框?我有个关于它的工单。曾经有。现在它是“已知问题”了。恭喜。'
    },
    {
      id: 'walkby-greybeard-orchestrator',
      colleagueId: 'greybeard',
      body: '小心 {label}。上一个这种东西在 1981 年前后有了自我意识。我们现在不把“编排器”说出口。'
    }
  ],
  OFFICE_COFFEE_SCENES: [
    {
      id: 'coffee-machine-politics',
      lines: [
        { speakerId: 'facilities', text: '新咖啡机有十四个按钮。十二个是装饰。' },
        { speakerId: 'greybeard', text: '老那台只有一个按钮和一股味儿。还是从前好。' }
      ]
    },
    {
      id: 'coffee-standup',
      lines: [
        { speakerId: 'scrumMaster', text: '我梦见我们坐着开站会。惊出一身冷汗。' },
        { speakerId: 'intern', text: '等等,梦里也要工作吗?员工手册里有写吗?' }
      ]
    },
    {
      id: 'coffee-diagram-glance',
      lines: [
        {
          speakerId: 'greybeard',
          text: '看到你那个 {label} 了。多了一个框。你会知道是哪个的。'
        },
        {
          speakerId: 'intern',
          text: '他老这样。上周他还说我的工牌照片“乐观得过头”。'
        }
      ]
    },
    {
      id: 'coffee-craig',
      lines: [
        {
          speakerId: 'hr',
          text: '签了 Craig 的贺卡吗?大家一直问 Craig 是谁。这不是贺卡的重点。'
        },
        { speakerId: 'helpdesk', text: 'Craig 是工单 #31337。已关闭:无法复现。' }
      ]
    },
    {
      id: 'coffee-printer',
      lines: [
        {
          speakerId: 'helpdesk',
          text: '三楼打印机又打出了没人发送的东西。就一页。写着“快了”。'
        },
        { speakerId: 'facilities', text: '那台打印机是承重的。别碰那台打印机。' }
      ]
    },
    {
      id: 'coffee-vision',
      lines: [
        {
          speakerId: 'scrumMaster',
          text: '他们把路线图改名叫“北极星旅程图谱”了。路线图本身 2022 年起就没变过。'
        },
        { speakerId: 'greybeard', text: '1979 年我们管它叫清单。它也没变过。' }
      ]
    },
    {
      id: 'coffee-dns',
      lines: [
        {
          speakerId: 'helpdesk',
          text: '复盘报告发布了。根因:DNS。根因的根因:也是 DNS。'
        },
        {
          speakerId: 'ciso',
          text: '永远是 DNS。不是 DNS 的时候,就是有人在生产环境做测试。'
        },
        { speakerId: 'helpdesk', text: '那次也是走 DNS 解析的。所以官方结论:DNS。' }
      ]
    },
    {
      id: 'coffee-cloud-bill',
      lines: [
        {
          speakerId: 'scrumMaster',
          text: '财务又把云账单标红了。我已经安排了一场成本对齐仪式。'
        },
        {
          speakerId: 'greybeard',
          text: '1979 年服务器就在我桌子底下。免费。暖和。吵。还是从前好。'
        }
      ]
    },
    {
      id: 'coffee-standing-desk',
      lines: [
        {
          speakerId: 'hr',
          text: '升降桌到货了!健康数据显示我们 94% 的时间仍然坐着,但坐得更高了。'
        },
        {
          speakerId: 'facilities',
          text: '它们夜里会自己升起来。桌子。我说得太多了。'
        }
      ]
    },
    {
      id: 'coffee-ai-half',
      lines: [
        {
          speakerId: 'intern',
          text: '今天 AI 帮我写了一半的代码!!超酷。哪一半?不清楚'
        },
        {
          speakerId: 'ciso',
          text: '查清楚是哪一半。其中一半要进审计。'
        }
      ]
    },
    {
      id: 'coffee-compression',
      lines: [
        {
          speakerId: 'intern',
          text: '要是把架构压得够狠,会不会直接变成一句 slogan??为路演问问'
        },
        {
          speakerId: 'greybeard',
          text: '试过。1979。那句 slogan 搞挂了生产。主机到现在还在引用。'
        }
      ]
    },
    {
      id: 'coffee-parking-lot',
      lines: [
        {
          speakerId: 'scrumMaster',
          text: '我们要把停车场再放进停车场。元仪式。凡有情绪的人都请来。'
        },
        {
          speakerId: 'hr',
          text: '我带了 Craig 的贺卡。Craig 对停车场有情绪。据说。'
        }
      ]
    }
  ],
  OFFICE_BATTLE_SCENES: [
    {
      id: 'battle-commit-credit',
      topic: '这个修复算谁的',
      lines: [
        {
          speakerId: 'dinesh',
          text: '是我发现的，我修的，提交信息里写着"杂项"。杂项。我不是杂项。我有名字，工牌上就印着。'
        },
        {
          speakerId: 'gilfoyle',
          text: '缺陷已经关了。没人会看提交信息。工单都没人看，那玩意儿还有标题呢。'
        },
        {
          speakerId: 'dinesh',
          text: '会有人看的。半年后有人翻记录，看到"杂项"，就会以为是你干的。这才是真正的结果。'
        },
        {
          speakerId: 'gilfoyle',
          text: '那得先有人在乎是谁写的。我一次都没想过。挺省心的。你也该试试。'
        }
      ],
      verdicts: {
        dinesh: '改好了，署我的名。记录现在准确了。我要的就这个。真的就只是这个。',
        gilfoyle: '信息还是"杂项"。缺陷照样是关的。宇宙依旧漠不关心，这本来就是我的立场。'
      }
    },
    {
      id: 'battle-tabs-spaces',
      topic: 'Tab 还是空格',
      lines: [
        {
          speakerId: 'greybeard',
          text: 'Tab。一次击键,一个字符,宽度可配置。这事儿 1979 年就定论了。'
        },
        {
          speakerId: 'intern',
          text: '风格指南说用两个空格!!我通读了全文。花了整个周末'
        },
        {
          speakerId: 'greybeard',
          text: '那份风格指南出自一个从没打开过终端的委员会。'
        },
        {
          speakerId: 'intern',
          text: 'linter 站在我这边!!!我可从来没赢过 linter'
        }
      ],
      verdicts: {
        greybeard: '就用 Tab。linter 已被重新配置。实习生会缓过来的,假以时日。',
        intern: '两个空格赢了!!ulrich 说这个行业完蛋了,不过这话他每天都说'
      }
    },
    {
      id: 'battle-friday-deploy',
      topic: '周五上线',
      lines: [
        {
          speakerId: 'scrumMaster',
          text: '冲刺周五结束,所以周五上线。这是数学!大家能量满满!'
        },
        {
          speakerId: 'ciso',
          text: '周五什么都不许上。故障不过周末,我的手机也是。'
        },
        {
          speakerId: 'scrumMaster',
          text: '我们可以在周一加一场“上线回顾会”,消化各种情绪。以及故障。'
        },
        {
          speakerId: 'ciso',
          text: '我会在故障桥接会上消化我的。请带上你的情绪和一台笔记本。'
        }
      ],
      verdicts: {
        scrumMaster: '动议通过 — 周五上线!Sasha 已提前申报了这次事故,节省时间。',
        ciso: '上线改到周一。周末在法律意义上保持无事发生。不用谢。'
      }
    },
    {
      id: 'battle-thermostat',
      topic: '恒温器(据称 20.5°C)',
      lines: [
        {
          speakerId: 'facilities',
          text: '恒温器设定为 20.5°C。这个数字来自科学,而且是最终决定。'
        },
        {
          speakerId: 'hr',
          text: 'Gary,有三个人在室内戴手套。我这边健康工单都来了。'
        },
        {
          speakerId: 'facilities',
          text: '戴手套是个人成长。传感器继续上锁。冰袋的事我都知道。'
        },
        {
          speakerId: 'hr',
          text: '士气随温度上升!有研究为证。我打印了一份。摸上去冰凉。'
        }
      ],
      verdicts: {
        facilities: '20.5°C 不变。毛衣募集已经安排上了。士气现在是纺织品问题。',
        hr: '我们将试行 21°C!Gary 管它叫“热带”,并已提交正式抗议。'
      }
    },
    {
      id: 'battle-monolith',
      topic: '一个框还是十四个框(单体之问)',
      lines: [
        {
          speakerId: 'scrumMaster',
          text: '把 {label} 拆成微服务,每个团队都有自己的待办!自治!仪式!'
        },
        {
          speakerId: 'greybeard',
          text: '你这是把一个问题变成一套分布式的问题,日志还更难查。'
        },
        { speakerId: 'scrumMaster', text: '我们会有服务网格!有个网络研讨会!' },
        {
          speakerId: 'greybeard',
          text: '我参加过一次网络研讨会。1981 年。我和大型机至今还会聊起它。'
        }
      ],
      verdicts: {
        scrumMaster: '就拆微服务!我已经为十四个新仓库各订了一个例会。',
        greybeard: '单体留下。十年后你会管它叫“恢弘的模块化单体”,并说是你的主意。'
      }
    },
    {
      id: 'battle-dns-postmortem',
      topic: '那次故障的复盘',
      lines: [
        {
          speakerId: 'helpdesk',
          text: '根因:DNS。复盘关闭。永远是 DNS。'
        },
        {
          speakerId: 'ciso',
          text: '是我的防火墙规则,而且我的规则是正确且警觉的。它拦下了可疑流量:全部流量。'
        },
        { speakerId: 'helpdesk', text: '那些流量是走 DNS 解析的。工单维持原判。' },
        {
          speakerId: 'ciso',
          text: '把一切都拦掉,是唯一零 CVE 的架构。不服去查。'
        }
      ],
      verdicts: {
        helpdesk: '“DNS”被采纳为根因,并预先批准为未来所有故障的根因。讲究效率。',
        ciso: '裁定:防火墙是对的。“可用性”是销售部散布的谣言。'
      }
    },
    {
      id: 'battle-tupperware',
      topic: '无标签饭盒',
      lines: [
        {
          speakerId: 'facilities',
          text: '一个无标签容器从二季度起就待在冰箱里。这已经是后勤事务了。'
        },
        {
          speakerId: 'helpdesk',
          text: '我贴过标签。工单 #48317:“容器,内容不明,请勿重启”。'
        },
        {
          speakerId: 'facilities',
          text: '工单号不是标签。标签要有名字和日期。我这儿有。乐意提供。'
        },
        {
          speakerId: 'helpdesk',
          text: '内容物已连续在线 94 天。全楼层运行时间最长的服务。请勿打扰。'
        }
      ],
      verdicts: {
        facilities: '容器没了。别问去哪儿了。冰箱恢复了安宁。标签机赢了。',
        helpdesk: '容器留下。它已晋升为生产环境。Gary 现在得提变更申请。'
      }
    },
    {
      id: 'battle-mvp',
      topic: 'MVP 到底是什么意思',
      lines: [
        {
          speakerId: 'intern',
          text: '所以 MVP 就是最小可行产品对吧??我领英上写了三遍'
        },
        {
          speakerId: 'scrumMaster',
          text: 'MVP 是 Maximum Viable PowerPoint。我们交付幻灯片。产品是 stretch goal。能量满满!'
        },
        {
          speakerId: 'intern',
          text: '这听起来不合法,但又很像融资'
        },
        {
          speakerId: 'scrumMaster',
          text: '合法性已放进停车场。我们来给情绪限时,再给 slogan 估故事点。'
        }
      ],
      verdicts: {
        intern: 'MVP 是能跑的东西。Chad 已更新领英。幻灯片吃醋了。',
        scrumMaster: 'MVP 是幻灯片。产品会在未来的仪式里跟上。邀请已发。'
      }
    }
  ],
  OFFICE_MEETING_COPY: {
    inviteFallbackTitle: '工作组同步',
    steeringInviteTitle: '架构评审委员会(指导会议)',
    quickSyncTitle: '快速同步',
    quickSyncTitleRemote: '耳机同步',
    defaultSyncTitle: '工作组同步',
    defaultRemoteTitle: '耳机同步',
    inviteFallbackBody:
      '领导层想看看当前这张图。议程:重点、成本、风险。你的团队来展示;高层负责提问。零食:无。',
    joiningLine: '正在等待组织者放你进来…',
    cancelledSubject: '已取消:工作组同步',
    cancelledBody: '会议取消 — 领导层行程冲突。改期至:永不。行动项仍归你负责。\n\nPam',
    proposeNewTimeGag: '已提议新时间。组织者拒绝了你提议的时间。',
    minutesTitle: '会议纪要',
    actionItemsLabel: '行动项',
    actionItemsCount: '{count} 项待办',
    minutesActionLede: '勾选项目后点「应用所选」，或点「全部应用」一次送到画布。',
    minutesEmptyLede: '没有行动项 — 按公司标准，这是完美会议。',
    discussionNotesLabel: '讨论纪要',
    speakPlaceholder: '对全场说点什么…',
    leaveLabel: '离开会议',
    interjectCapLine: 'Pam:“观点很棒 — 先放停车场。时间到了。”'
  },
  OFFICE_IM_QUICK_REPLIES: ['👍', '开会中', '停车场', '请指示'],
  OFFICE_CHROME_COPY: {
    doIt: '就这么办',
    doSelected: '应用所选',
    doItAll: '全部应用',
    windowMinimize: '最小化',
    windowMinimizeTitle: '收起到标题栏',
    windowRestore: '还原',
    windowRestoreTitle: '展开窗口',
    desk: {
      buttonLabel: '你的工位',
      buttonAria: '你的工位 — 你可以做的事',
      buttonTitle: '起身、闲逛、打扰别人',
      menuAria: '工位操作',
      menuHeading: '你在干嘛？',
      hrProgress: '查一下我的 HR 晋升进度',
      hrProgressTitle: '人力运营记分卡 — 等级、XP，以及 Linda 对你的看法',
      coffee: '去喝杯咖啡',
      walk: '在楼层走走',
      slopChat: '打开 Slop Chat',
      slopChatTitle: 'Slop Chat™ — 给同事发消息或查看历史',
      inbox: '查一下邮件',
      meeting: '开个会',
      meetingTitle: '订玻璃会议室或戴上耳机 — 选好人就开',
      team: '抓个有空的人',
      huddleAction: '围过来开小会',
      huddleActionTitle: '全队挤到你的屏幕前一起操作你的电脑。没有会议室，没有耳机。',
      outbox: '拿去收发室',
      outboxTitle: '保存、复制或分享工位上的成品',
      codeDrawer: '打开面条码抽屉',
      codeDrawerShort: '面条码',
      codeDrawerClose: '关闭面条码抽屉',
      codeDrawerCloseShort: '关闭',
      codeDrawerTitle: '瞧瞧幕后的面条代码',
      onboardContractor: '接入外部协作者',
      onboardContractorTitle: '通过 MCP 邀请外部代理',
      standUp: '站起来四处看看',
      standUpShort: '站起来',
      standUpRole: '楼层',
      standUpTitle: '离开屏幕，到楼层上看看你一直听到的办公室',
      sitDown: '回到屏幕前',
      sitDownShort: '坐下',
      sitDownTitle: '坐下，继续做交付物',
      thinking: '打开笔记本',
      thinkingClose: '关闭笔记本',
      thinkingTitle: '你的笔记本 · 笔记、评审和运行记录',
      sectionSeat: '座位上',
      sectionGetUp: '起身',
      sectionUnderDesk: '桌子下面',
      ambienceAria: '办公室声音与专注',
      headphonesLabel: '耳机',
      headphonesOffTitle: '摘下耳机 — 听办公室的声音。语音朗读、环境音开启，不显示文字。',
      headphonesOnTitle: '戴上耳机 — 读办公室的声音。所有人安静下来，他们的话变成文字。',
      focusTimeLabel: '专注',
      focusTimeTitle: '专注时间 — 没人会过来，团队也不再插话',
      blocked: {
        busy: '部署进行中 — 谁也别离开工位。',
        meeting: '你在开会。装得投入一点。',
        surface: '一次一件事。你已经被打断得够忙了。',
        noAgenda: '已经在开同步会了 — 先开完再说',
        noTeam: '团队正忙 — 等楼层安静一点再试',
        noOutbox: '还没什么可寄 — 先在画布上放个成品',
        noThinking: '笔记本是空的 — 先跑点什么',
        noCode: '先生成点什么 — 然后才能编辑源码'
      }
    },
    directory: {
      title: '认识团队',
      tourEyebrow: '新人入职引导™',
      rosterEyebrow: '办公室名册',
      welcomeChapter: '人力资源',
      colleagueChapter: '同事 {current} / {total}',
      unlockedLabel: '✨ 解锁角色',
      tagline:
        '你是这层楼最新的架构师。琳达会速通全员介绍——然后把你丢回工位。Gilfoyle 和 Russ 稍后再找你。',
      autoplayHint: '正在说话…',
      rosterTagline: 'Your Team（跳过入职引导的那两位除外）——真想听完整自我介绍再点 ▶：',
      greeting: '欢迎加入，{name}。',
      greetingRole: '架构师',
      expandLabel: '🏢 认识团队',
      expandTitle: '第一天入职 — 人力运营的 Linda、Your Team，然后是工位向导。',
      startLabel: '认识团队 →',
      beginLabel: '开始第一天',
      skipToBuildLabel: '跳过引导 →',
      skipToBuildTitle: '关闭引导，直接进入画布。没有恶意。（有一点。已记入档案。）',
      dismissLabel: '完成',
      replayTourLabel: '↻ 重看开场',
      closeAria: '关闭认识团队',
      hearLabel: '▶ 听介绍',
      hearSpeakingLabel: '嘘…他们在说话',
      hearTitle: '用他们的声音播放这句话 — Google Cloud 文字转语音',
      transcriptLabel: '字幕',
      transcriptOnLabel: '隐藏文字',
      transcriptTitle: '显示语音内容为文字 — 无法收听时使用',
      welcomeVoiceSpeakerId: 'hr',
      welcomeVoiceLine:
        '欢迎来到这层楼。我是琳达，人力运营——工牌照片、逾期培训，以及边微笑边记录你罪状的人。速通一轮，因为没人扛得住五段串行自我介绍：Dinesh 会抓到 bug，并确保你他妈感谢他。Erlich 会问这张图够不够有勇气——说够，否则他会孵化你的灵魂。Jared 已经给你的入职开了发现项；他很抱歉。Richard 正在安静地给一个模式命名，祝福他。Jack Barker 超兴奋，已经为董事会简化了这一刻。Gilfoyle 和 Russ 故意翘了——他们会找到你，而且不会客气。继续走。',
      welcomeClosingLine:
        '第一天到此为止。你的工位在那边——坐下，熬过那个小入职向导，再开一个交付件，别等有人约一个关于约同步的同步会。合规不知怎么已经逾期了，Craig 的生日贺卡还在冰箱上，要是你为订书机全员回复，我会亲手弄死你。温暖地！',
      nameTag: {
        hello: '你好',
        subtitle: '我叫',
        placeholder: '新人',
        editTitle: '输入你的名字 — 整个办公室都会开始使用它',
        inputAria: '你在办公室的名字'
      }
    },
    inbox: {
      buttonTitle: '公司邮箱',
      unreadAria: '收件箱 — {count} 封未读邮件',
      noUnreadAria: '收件箱 — 没有未读邮件',
      title: '📥 收件箱',
      mailAnnounce: '您有新邮件！',
      mailAnnounceLang: 'zh-CN',
      closeAria: '关闭收件箱',
      back: '← 返回',
      emptyLine: '收件箱清零。HR 觉得这很可疑。且行且珍惜。',
      markAllRead: '全部标为已读',
      selectEmailAria: '选择来自 {name} 的邮件以召开会议',
      callMeeting: '📅 拨个电话',
      callMeetingWithCount: '📅 拨个电话 ({count})',
      callMeetingTitle: '就这封邮件开一场耳机会议 — 可先加减人',
      callMeetingFromSelectionTitle: '就所选邮件开耳机通话 — 挑谁进场',
      callMeetingSelectTitle: '先选邮件当议题，或直接打开名单',
      callMeetingDisabledTitle: '已经在开会 — 先离开那场',
      callMeetingAboutEmail: '📅 就此邮件拨个电话'
    },
    meetingPicker: {
      title: '📅 开个会',
      titleHuddle: '📅 拉人聊聊',
      tagline: '玻璃会议室或戴耳机 — 一个人或一整个马戏团。',
      topicLabel: '这是关于什么？',
      topicPlaceholder: '可选议程（反正他们也会无视）',
      topicAria: '会议主题',
      modalityAria: '这场会议在哪开',
      modalityPhysical: '订玻璃会议室',
      modalityPhysicalTitle: '全员起身走进会议室 — 包括你',
      modalityRemote: '戴上耳机',
      modalityRemoteTitle: '大家都留在工位通话 — 楼层上看得见耳机',
      groupsAria: '快捷群组',
      groupTeam: '你的团队',
      groupTeamTitle: '拉上日常一起干活的人',
      groupSteering: '指导委员会',
      groupSteeringTitle: 'Pam + 高管 + 一个人上台讲图',
      groupFloor: '整层楼',
      groupFloorTitle: '冲隔间那边喊一声',
      groupSeniors: '领导层',
      groupSeniorsTitle: '约那些会问「这要花多少钱」的人',
      directoryAria: '邀请谁',
      tierTeam: '你的团队',
      tierSenior: '领导层',
      tierOffice: '这层楼',
      facilitatorBadge: '主持',
      selectedStripLabel: '已邀',
      selectedCount: '已邀请 {count} 人',
      selectedCountOne: '已邀请 1 人',
      maxHint: '会议室最多 {max} 人 — 先去掉一位再加。',
      needSomeone: '至少选一个人（Pam 一个人开会等于对着镜子）。',
      start: '开始会议',
      startPhysical: '订下',
      startRemote: '拨入',
      startHuddle: '开始',
      cancel: '算了',
      closeAria: '关闭会议选择',
      sourceEmail: '来自收件箱',
      sourceChat: '来自 Slop Chat',
      sourceDesk: '来自你的工位'
    },
    im: {
      kindLabel: 'Slop Chat™ · 即时消息',
      regionAria: '即时消息',
      dismissAria: '关闭来自 {name} 的消息',
      openHistoryAria: '打开 Slop Chat(未读 {count} 条)',
      openHistoryTitle: 'Slop Chat™ —— 查看历史消息'
    },
    messenger: {
      title: '💬 Slop Chat™',
      tagline: '在线状态提示多了 40%',
      closeAria: '关闭 Slop Chat',
      threadsAria: '会话列表',
      emptyThreads: '还没有消息。且行且珍惜。',
      messageSomeone: '给谁发条消息',
      messageSomeoneTitle: '随机找一位同事 — 他们总会回复',
      emptyThread: '挑一位同事吧,他们「都有空」。',
      composerPlaceholder: '输入消息……',
      composerAria: '发消息给 {name}',
      send: '发送',
      sending: '发送中……',
      typing: '{name} 正在输入……',
      unreadDot: '未读',
      you: '我',
      statusOnline: '空闲',
      statusBusy: '开会中',
      callMeeting: '📅 拨个电话',
      callMeetingTitle: '和此人开一场耳机通话 — 想叫更多人也可以',
      callMeetingDisabledTitle: '已经在开会 — 先离开那场',
      callMeetingNoThread: '📅 开个会',
      callMeetingNoThreadTitle: '打开名单 — 玻璃会议室或耳机'
    },
    walkby: {
      kindLabel: '从你肩膀上方',
      preamble: '有人从你身后盯着屏幕。装自然一点。',
      dismissAria: '挥手送走 {name}'
    },
    huddle: {
      sceneAria: '团队围着你的图开小会',
      gathering: '大家正走过来…',
      speakingLabel: '{name} 正在发言',
      hardStop: '硬性截止',
      hardStopTitle: '抱歉 — 整点有硬性截止。散了吧。'
    },
    coffee: {
      kindLabel: '茶水间 · 咖啡歇脚',
      inviteLine: '喝杯咖啡?{name} 正在咖啡机旁开讲。',
      accept: '歇 5 分钟',
      decline: '赶死线',
      sceneAria: '咖啡时间',
      sceneTitle: '茶水间',
      done: '我得去发版了'
    },
    battle: {
      kindLabel: '工位闹剧 · 对决',
      inviteLine: '🥊 {a} 和 {b} 又杠上了 — “{topic}”。全楼层都在围观。',
      accept: '搬好小板凳',
      decline: '与我无关',
      sceneAria: '工位对决',
      sceneTitle: '工位对决',
      versus: 'vs',
      getOut: '溜出工位对决',
      settleLine: '双方你都听完了。总得有人是错的:',
      sideLabel: '站 {name}',
      walkAway: '上报 HR(离场)',
      verdictHead: '全楼层裁定',
      done: '回去搬砖'
    },
    meetingInvite: {
      kindLabel: '日历邀请 · 会议',
      organizerLabel: '组织者:',
      attendeesLabel: '参会者:',
      accept: '接受',
      decline: '不行 — 我在赶上线',
      proposeNewTime: '另提时间'
    },
    meeting: {
      youName: '你',
      close: '关闭',
      noMinutes: '没有行动项。以公司标准衡量,这是一场完美的会议。',
      speakAria: '对全场说话',
      speak: '🗣️ 说话 ({count})',
      atTime: '✋ 时间到',
      dock: '🗕 看我的屏幕',
      dockTitle: '把会议缩到角落,腾出手来改图',
      undock: '🗖 回到会议室',
      undockTitle: '把会议放回屏幕中央',
      minimize: '最小化',
      minimizeTitle: '收起到标题栏,让画布保持可见',
      restore: '还原',
      restoreTitle: '展开会议窗口',
      dragHint: '拖动以移动',
      speakerViewHint: '正在收听 — 可在工位菜单打开字幕(CC)阅读',
      discussionToggle: '讨论纪要',
      discussionToggleHide: '隐藏讨论纪要'
    }
  }
};

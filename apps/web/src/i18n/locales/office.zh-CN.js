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
      blurb: '爱点“回复全部”。天真的问题偶尔一针见血。',
      introLine:
        '嗨！！我是 Chad——无薪、战略级，而且大概率会因为订书机议题全员回复。关于你的图有个小问题，说不定会是今天全场最聪明的一句。另外：订书机放哪儿了？'
    },
    scrumMaster: {
      title: '敏捷教练 — CSM、CSPO、SAFe 6.0',
      blurb: '万事皆仪式。连午饭都要设时间盒。所有会议由她主持。',
      introLine:
        '嗨！我是 Pam——CSM、CSPO、SAFe 6.0，对停车场话术情感流利。这次自我介绍限时四十五秒协同能量。气氛很好。咱们回头再对齐。'
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
        '我是 Linda，人力运营。你的工牌照片还在处理，合规培训不知怎么已经逾期了，Craig 的生日贺卡还需要一句暖乎乎的套话。你会融入得非常漂亮。'
    },
    greybeard: {
      title: '资深工程师（荣休返聘）',
      blurb: '“2009 年我们试过。”维护着那台大型机。建议好得让人不安。',
      introLine:
        'Ulrich。资深工程师（荣休返聘）。2009 年我们试过。靠 cron 和恐惧在跑。我维护着那台没人承认的大型机。大型机问起你了。我跟它说你在画图。'
    },
    ciso: {
      title: '首席信息安全官 — “不行部”',
      blurb: '万物皆攻击面，尤其是箭头。钓鱼演练由 TA 主持。谁都不信。',
      introLine:
        'Sasha。CISO。不行部。万物皆攻击面——尤其是你、那些箭头，还有 2017 年那个临时管理员密码。已记入你的档案。我是出于好意。'
    }
  },
  SENIOR_STAKEHOLDERS: {
    cto: {
      title: 'CTO — 只发 keynote，不写代码',
      blurb: '规模化愿景。引用自己的大会演讲。上次打开 IDE 是 2016 年。'
    },
    cfo: {
      title: 'CFO — 预算就是不行',
      blurb: '每个方框都是成本中心。会问这张图每月要花多少钱。什么都不批。'
    }
  },
  OFFICE_SLOT_FALLBACKS: { label: '这张图', userTitle: '实习架构师', userName: '新人' },
  OFFICE_WELCOME_EMAIL: {
    id: 'welcome-email-hr',
    colleagueId: 'hr',
    subject: '欢迎加入，{userTitle}！🎉（工牌照片：待定）',
    body: '欢迎来到这层楼！非常高兴你的加入。在强制入职培训（已改期，时间待定）之前，先认识几位同事：\n\n📅 Pam（敏捷教练）主持所有会议。真的是所有。\n🧃 Chad（我们的实习生）马上会给你发消息。他没有恶意。\n🖥️ 工单机器人 Dave 是 IT。请勿回复，请勿来电，请勿。\n🧹 Gary 掌管冰箱和恒温器。请对两者保持敬意。\n🧓 Ulrich 见过你的架构。在 2009 年。\n🔐 Sasha（我们的 CISO）已经开始怀疑你了。这是一种夸奖。\n\n我是 Linda — 人力运营！你的合规培训已经逾期了，这实属纪录。收件箱 📥、专注时间和办公室音景开关都在角落里，想让我们安静点随时可用。\n\n暖暖的问候，\nLinda'
  },
  OFFICE_WELCOME_IM: {
    id: 'welcome-im-intern',
    colleagueId: 'intern',
    body: '嗨！！你就是新来的{userTitle}吧 — 欢迎！！咖啡机有十四个按钮，十二个是装饰。另外 gary 一定会给你发冰箱邮件。别往心里去（要往心里去）'
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
      body: '在共享盘上看到了你的图。这东西我们 2009 年就做过,靠一个 cron 任务和恐惧运行,2011 年把生产环境搞挂了一周。\n\n想知道细节就来问我。或者别问。它知道。\n\nUlrich'
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
      body: '云就是营销做得更好的大型机。我迁移过一次 — 2009 年,迁到“网格”上。2010 年我们又迁了回来。悄悄地。趁夜里。\n\n你的 {label} 放哪儿都能跑。东西大多都能跑,直到跑不动那天。\n\nUlrich'
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
      id: 'email-exec-board-preread',
      colleagueId: 'exec',
      subject: '需要预读材料:董事会会问到 {label}',
      body: '各位 — 董事会外出会议就在周四,我需要一份关于 {label} 的一页纸报告。一页。就一页。装不进一页的不是战略,是爱好。\n\n四分钟后有硬停,\nThe VP',
      actionPrompt: '把图简化到最核心的三个要素'
    },
    {
      id: 'email-cfo-cloud-spend',
      colleagueId: 'cfo',
      subject: '已标记:无法解释的预算项("{label}")',
      body: '财务标记了一个名为“{label}”的资源。请确认它 (a) 必不可少,且 (b) 免费。如果无法兼得,请参见 (b)。\n\n预算就是不行,\nDiane'
    },
    {
      id: 'email-cto-conference',
      colleagueId: 'cto',
      subject: '在某场主题演讲上见过一模一样的(想法?)',
      body: '刚从 VisionaryConf 回来。有一页幻灯片和你的 {label} 几乎一样 — 只不过他们的会脉动,还带 AI 光环。我们的能脉动吗?把负责脉动的人拉进来。\n\n向前,\nMarcus',
      actionPrompt: '加一个大胆的愿景元素,让整张图更有未来感'
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
      body: '看了眼 {label}。我们 2009 年试过。没事的。大概。'
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
      body: '{label} 啊。2009 年我们也有一个。现在还在跑。没人知道在哪。'
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
      body: '小心 {label}。上一个这种东西在 2011 年前后有了自我意识。我们现在不把“编排器”说出口。'
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
        { speakerId: 'greybeard', text: '2009 年我们管它叫清单。它也没变过。' }
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
          text: '2009 年服务器就在我桌子底下。免费。暖和。吵。还是从前好。'
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
          text: '试过。2009。那句 slogan 搞挂了生产。主机到现在还在引用。'
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
      id: 'battle-tabs-spaces',
      topic: 'Tab 还是空格',
      lines: [
        {
          speakerId: 'greybeard',
          text: 'Tab。一次击键,一个字符,宽度可配置。这事儿 2009 年就定论了。'
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
          text: '我参加过一次网络研讨会。2011 年。我和大型机至今还会聊起它。'
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
    inviteFallbackTitle: '架构评审委员会(指导会议)',
    inviteFallbackBody:
      '领导层想看看当前这张图。议程:重点、成本、风险。你的团队来展示;高层负责提问。零食:无。',
    joiningLine: '正在等待组织者放你进来…',
    cancelledSubject: '已取消:架构评审委员会',
    cancelledBody: '会议取消 — 领导层行程冲突。改期至:永不。行动项仍归你负责。\n\nPam',
    proposeNewTimeGag: '已提议新时间。组织者拒绝了你提议的时间。',
    minutesTitle: '会议纪要',
    raiseHandPlaceholder: '对全场说点什么…',
    leaveLabel: '离开会议',
    interjectCapLine: 'Pam:“观点很棒 — 先放停车场。时间到了。”'
  },
  OFFICE_IM_QUICK_REPLIES: ['👍', '开会中', '回头聊', '先放停车场', '已记入档案'],
  OFFICE_CHROME_COPY: {
    doIt: '就这么办',
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
      im: '给谁发条消息',
      slopChat: '打开 Slop Chat',
      slopChatTitle: 'Slop Chat™ — 查看历史消息',
      inbox: '查一下邮件',
      meeting: '召集会议',
      team: '和团队聊聊',
      outbox: '从发件箱寄出',
      outboxTitle: '导出或分享工位上的成品',
      settings: '调整一下工位',
      settingsTitle: '访客代理和代码抽屉',
      thinking: '打开笔记本',
      thinkingClose: '关闭笔记本',
      thinkingTitle: '你的笔记本 · 笔记、评审和运行记录',
      sectionSeat: '座位上',
      sectionGetUp: '起身',
      sectionUnderDesk: '桌子下面',
      blocked: {
        busy: '部署进行中 — 谁也别离开工位。',
        meeting: '你在开会。装得投入一点。',
        surface: '一次一件事。你已经被打断得够忙了。',
        noAgenda: '先画点什么 — 这场会也需要议程',
        noTeam: '先在画布上画点东西 — 团队还没东西可以回应',
        noOutbox: '还没什么可寄 — 先在画布上放个成品',
        noThinking: '笔记本是空的 — 先跑点什么'
      }
    },
    directory: {
      title: '认识团队',
      tourEyebrow: '新人入职引导™',
      rosterEyebrow: '办公室名册',
      welcomeChapter: '人力资源',
      colleagueChapter: '同事 {current} / {total}',
      unlockedLabel: '✨ 解锁角色',
      tagline: '你是这层楼最新的架构师。白板是你的交付物，打扰是免费的。',
      autoplayHint: '正在说话…',
      rosterTagline: '会发邮件、发消息、路过插话的同事们——点 ▶ 听他们自我介绍：',
      greeting: '欢迎加入，{name}。',
      greetingRole: '架构师',
      expandLabel: '🏢 认识办公室',
      expandTitle: '到底是谁一直在打扰我？（剧透：全都是）',
      startLabel: '认识团队 →',
      skipToBuildLabel: '跳过仪式 — 让我直接开搞 →',
      skipToBuildTitle: '关闭引导，直接进入画布。没有恶意。（有一点。已记入档案。）',
      dismissLabel: '打卡上班 — 开始第一天',
      replayTourLabel: '↻ 重看开场',
      closeAria: '关闭认识办公室',
      hearLabel: '▶ 听介绍',
      hearSpeakingLabel: '嘘…他们在说话',
      hearTitle: '用他们的声音播放这句话 — Google Cloud 文字转语音',
      transcriptLabel: '字幕',
      transcriptOnLabel: '隐藏文字',
      transcriptTitle: '显示语音内容为文字 — 无法收听时使用',
      welcomeVoiceSpeakerId: 'hr',
      welcomeVoiceLine:
        '欢迎来到这层楼。我是琳达，负责人力运营。领取工牌，写下你的名字，我来介绍团队。你会融入得很好的。',
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
      togglesAria: '收件箱氛围控制',
      focusTimeLabel: '专注',
      focusTimeTitle: '同事们(基本上)会尊重专注时间',
      soundscapeLabel: '音景',
      soundscapeTitle:
        '办公室环境音 — 键盘声、鼠标点击、纸张、椅子吱呀、打印机、电话、饮水机、咖啡机、自动售货机、电梯',
      narrationLabel: '朗读',
      narrationTitle: '朗读路过发言、会议、隔间争论和咖啡闲聊 — 邮件和即时消息保持静音',
      closeAria: '关闭收件箱',
      back: '← 返回',
      emptyLine: '收件箱清零。HR 觉得这很可疑。且行且珍惜。',
      markAllRead: '全部标为已读',
      callMeeting: '📅 召集会议',
      callMeetingTitle: '就当前图表召集一场工作组会议',
      callMeetingDisabledTitle: '先画点什么 — 这场会也需要议程'
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
      emptyThread: '挑一位同事吧,他们「都有空」。',
      composerPlaceholder: '输入消息……',
      composerAria: '发消息给 {name}',
      send: '发送',
      sending: '发送中……',
      typing: '{name} 正在输入……',
      unreadDot: '未读',
      you: '我',
      statusOnline: '空闲',
      statusBusy: '开会中'
    },
    walkby: {
      kindLabel: '路过 · 从你肩膀上方',
      dismissAria: '挥手送走 {name}'
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
      raiseHandAria: '举手',
      raiseHand: '✋ 举手({count})',
      atTime: '✋ 时间到',
      dock: '🗕 看我的屏幕',
      dockTitle: '把会议缩到角落,腾出手来改图',
      undock: '🗖 回到会议室',
      undockTitle: '把会议放回屏幕中央'
    }
  }
};

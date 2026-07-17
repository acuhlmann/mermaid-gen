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
      blurb: '爱点“回复全部”。天真的问题偶尔一针见血。'
    },
    scrumMaster: {
      title: '敏捷教练 — CSM、CSPO、SAFe 6.0',
      blurb: '万事皆仪式。连午饭都要设时间盒。所有会议由她主持。'
    },
    helpdesk: {
      name: '工单机器人 Dave',
      title: 'IT 服务台 — 一线（仅此一线）',
      blurb: '把工单关闭为它自己的重复项。在他机器上没问题。'
    },
    facilities: {
      title: '后勤与冰箱沙皇',
      blurb: '发全大写的冰箱清理通知。以铁腕掌控恒温器。'
    },
    hr: {
      title: '人力运营业务伙伴',
      blurb: '武器化的热情。你的培训已逾期 847 天。记得给 Craig 的贺卡签名。'
    },
    greybeard: {
      title: '资深工程师（荣休返聘）',
      blurb: '“2009 年我们试过。”维护着那台大型机。建议好得让人不安。'
    }
  },
  OFFICE_SLOT_FALLBACKS: { label: '这张图', userTitle: '实习架构师' },
  OFFICE_WELCOME_EMAIL: {
    id: 'welcome-email-hr',
    colleagueId: 'hr',
    subject: '欢迎加入，{userTitle}！🎉（工牌照片：待定）',
    body: '欢迎来到这层楼！非常高兴你的加入。在强制入职培训（已改期，时间待定）之前，先认识几位同事：\n\n📅 Pam（敏捷教练）主持所有会议。真的是所有。\n🧃 Chad（我们的实习生）马上会给你发消息。他没有恶意。\n🖥️ 工单机器人 Dave 是 IT。请勿回复，请勿来电，请勿。\n🧹 Gary 掌管冰箱和恒温器。请对两者保持敬意。\n🧓 Ulrich 见过你的架构。在 2009 年。\n\n我是 Linda — 人力运营！你的合规培训已经逾期了，这实属纪录。收件箱 📥、专注时间和办公室音景开关都在角落里，想让我们安静点随时可用。\n\n暖暖的问候，\nLinda'
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
    }
  ],
  OFFICE_MEETING_COPY: {
    inviteFallbackTitle: '工作组:图表对齐同步会(例会)',
    inviteFallbackBody: '需要就当前图表对齐一下。议程:对齐、下一步、就下一步对齐。零食:无。',
    joiningLine: '正在等待组织者放你进来…',
    cancelledSubject: '已取消:图表对齐同步会',
    cancelledBody: '会议取消 — 组织者行程冲突。改期至:永不。行动项仍归你负责。\n\nPam',
    proposeNewTimeGag: '已提议新时间。组织者拒绝了你提议的时间。',
    minutesTitle: '会议纪要',
    raiseHandPlaceholder: '对全场说点什么…',
    leaveLabel: '离开会议',
    interjectCapLine: 'Pam:“观点很棒 — 先放停车场。时间到了。”'
  },
  OFFICE_IM_QUICK_REPLIES: ['👍', '开会中', '回头聊'],
  OFFICE_CHROME_COPY: {
    doIt: '就这么办',
    directory: {
      title: '欢迎来到办公室',
      tagline: '你的图有了工作场所——这层楼的人很有想法。',
      tourHint: '一次认识一位。想安静时打开「专注时间」。',
      rosterTagline: '会发邮件、发消息、路过插话的同事们：',
      expandLabel: '🏢 认识办公室',
      expandTitle: '到底是谁一直在打扰我？',
      startLabel: '认识这层楼 →',
      nextLabel: '下一位 →',
      backLabel: '← 返回',
      skipLabel: '跳过',
      progressLabel: '{current} / {total}',
      dismissLabel: '打卡上班',
      closeAria: '关闭办公室通讯录'
    },
    inbox: {
      buttonTitle: '公司邮箱',
      unreadAria: '收件箱 — {count} 封未读邮件',
      noUnreadAria: '收件箱 — 没有未读邮件',
      title: '📥 收件箱',
      mailAnnounce: '您有新邮件！',
      mailAnnounceLang: 'zh-CN',
      focusTimeLabel: '专注时间',
      focusTimeTitle: '同事们(基本上)会尊重专注时间',
      soundscapeLabel: '办公室音景',
      soundscapeTitle: '办公室环境音 — 键盘声、纸张、打印机、电话、饮水机、咖啡机',
      closeAria: '关闭收件箱',
      back: '← 返回',
      emptyLine: '收件箱清零。HR 觉得这很可疑。且行且珍惜。',
      markAllRead: '全部标为已读',
      callMeeting: '📅 召集会议',
      callMeetingTitle: '就当前图表召集一场工作组会议',
      callMeetingDisabledTitle: '先画点什么 — 这场会也需要议程'
    },
    im: {
      regionAria: '即时消息',
      dismissAria: '关闭来自 {name} 的消息'
    },
    walkby: {
      dismissAria: '挥手送走 {name}'
    },
    coffee: {
      inviteLine: '喝杯咖啡?{name} 正在咖啡机旁开讲。',
      accept: '歇 5 分钟',
      decline: '赶死线',
      sceneAria: '咖啡时间',
      sceneTitle: '茶水间',
      done: '回去干活'
    },
    meetingInvite: {
      organizerLabel: '组织者:',
      attendeesLabel: '参会者:',
      accept: '接受',
      decline: '拒绝',
      proposeNewTime: '另提时间'
    },
    meeting: {
      youName: '你',
      close: '关闭',
      noMinutes: '没有行动项。以公司标准衡量,这是一场完美的会议。',
      raiseHandAria: '举手',
      raiseHand: '✋ 举手({count})',
      atTime: '✋ 时间到'
    }
  }
};

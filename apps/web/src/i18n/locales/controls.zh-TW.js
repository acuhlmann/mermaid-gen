/** Traditional Chinese overrides for UI chrome. */
export const CONTROLS_ZH_TW = {
  actions: {
    definition: '這是什麼？',
    definitionPersona: '快速參考',
    definitionTitle: '快速參考 · 這個元素是什麼意思？',
    stakeholders: '相關方',
    stakeholdersTitle: '相關方 · 點擊召集圓桌',
    renderMode: '渲染為…',
    renderModePersona: '模式切換',
    renderModeTitle: '模式切換 · 用另一種模式重新渲染所選內容',
    refine: '精修',
    innovate: '創新',
    goMad: '放飛',
    goMadder: '更瘋',
    goMaddest: '最瘋',
    maxMadness: '極致放飛',
    coDesign: '協同設計',
    critique: '評審',
    fix: '修復',
    fixPersona: '現場工頭',
    fixTitle: '現場工頭 · 修復這坨爛圖',
    explain: '講解',
    clear: '清空',
    clearTitle: '清空 · 拆掉重來',
    demolish: '拆除',
    mute: '靜音',
    unmute: '取消靜音',
    muteAria: '靜音相關方',
    unmuteAria: '取消靜音相關方',
    muteTitle: '相關方正在圍觀 · 點擊靜音',
    unmuteTitle: '相關方已靜音 · 點擊取消靜音'
  },
  prompt: {
    yourTopic: '你的主題',
    doIt: '開始',
    mic: '麥克風',
    holdToSpeak: '按住說話',
    holdToDictate: '按住語音輸入',
    tapToDictate: '點擊語音輸入',
    tapToDictatePrompt: '點擊語音輸入提示',
    tapToStop: '點擊停止聽寫',
    voiceNeedsHttps: '語音輸入需要安全連線（HTTPS），localhost 除外',
    voiceUnsupported: '此瀏覽器不支援語音輸入',
    slopNextTitle: '接下來要改什麼？',
    slopNextPlaceholder: '告訴智慧代理要改什麼…',
    slopNextLabel: '新提示',
    closePrompt: '關閉提示'
  },
  settings: {
    label: '設定',
    show: '顯示設定',
    hide: '隱藏設定',
    title: '設定 · 邀請智慧代理、模式、模型',
    region: '工作階段設定',
    externalAgents: '外部智慧代理',
    waitingHandshake: '等待握手：',
    externalAgentFallback: '外部智慧代理',
    brain: '模型',
    fast: '快速',
    quality: '高品質',
    mode: '模式',
    thinking: '思考',
    aiCluster: 'AI 模型與思考'
  },
  contentModes: {
    mermaid: '圖表',
    mermaidShort: '圖表',
    mermaidSubtitle: 'Mermaid 架構圖',
    infographic: '資訊圖',
    infographicShort: '資訊圖',
    infographicSubtitle: 'AntV 敘事版面',
    metaphor3d: '3D 隱喻',
    metaphor3dShort: '3D',
    metaphor3dSubtitle: 'Three.js 空間場景',
    chart: '圖表',
    chartShort: '圖表',
    chartSubtitle: 'Vega-Lite 資料檢視',
    anything: '任意頁面',
    anythingShort: '任意',
    anythingSubtitle: 'HTML/CSS/JS 沙箱',
    anotherMode: '其他模式',
    renderMenu: '目標渲染模式'
  },
  hotkeys: {
    title: '鍵盤快捷鍵',
    close: '關閉快捷鍵說明',
    hint: '選中圖表元素後可使用單鍵快捷鍵。輸入文字時快捷鍵無效。',
    refine: '精修 — 潤色標籤與結構',
    innovate: '創新 — 更大膽的重設計',
    goMad: '放飛 — 混沌變換',
    exec: '高管 — 濃縮要點',
    critique: '評審 — 結構化審查',
    explain: '講解 — 這是什麼意思？',
    toggleHelp: '切換此說明',
    esc: '關閉選單 / 對話框',
    arrows: '在環形操作中移動焦點',
    activate: '啟用目前焦點操作'
  },
  clearDialog: {
    prompts: [
      {
        title: '🚧 拆除許可申請中',
        body: '確定要推平這件傑作嗎？這坨爛圖只會留在我們的記憶裡（大概還有三份 Confluence 頁面）。'
      },
      {
        title: '🏗️ 拆遷球待命',
        body: '你確定嗎？一旦拆掉，相關方至少要開一次復盤，再來一輪組織調整。'
      },
      {
        title: '⛏️ 準備碾成碎石？',
        body: '拆除圖表會重置一切——包括我們一連串勇敢的架構決策連擊。'
      },
      {
        title: '💣 控制性爆破？',
        body: '架構本應永恆，除非你按了按鈕。最後機會，保住這坨爛圖。'
      }
    ],
    save: '保住爛圖',
    saveAria: '保住爛圖',
    demolish: '拆掉它！',
    demolishAria: '拆掉它'
  },
  explainDumb: {
    rephrasePlain: '用更直白的語言重述 — 再點一次會更簡單'
  }
};

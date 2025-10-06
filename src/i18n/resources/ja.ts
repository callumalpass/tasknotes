import { TranslationTree } from "../types";

export const ja: TranslationTree = {
	common: {
		appName: "TaskNotes",
		cancel: "キャンセル",
		confirm: "確認",
		close: "閉じる",
		save: "保存",
		language: "言語",
		systemDefault: "システムの既定",
		languages: {
			en: "英語",
			fr: "フランス語",
			ru: "ロシア語",
			zh: "中国語",
			de: "ドイツ語",
			es: "スペイン語",
			ja: "日本語",
		},
		weekdays: {
			sunday: "日曜日",
			monday: "月曜日",
			tuesday: "火曜日",
			wednesday: "水曜日",
			thursday: "木曜日",
			friday: "金曜日",
			saturday: "土曜日",
		},
		months: {
			january: "1月",
			february: "2月",
			march: "3月",
			april: "4月",
			may: "5月",
			june: "6月",
			july: "7月",
			august: "8月",
			september: "9月",
			october: "10月",
			november: "11月",
			december: "12月",
		},
	},
	views: {
		agenda: {
			title: "アジェンダ",
			today: "今日",
			overdue: "期限切れ",
			refreshCalendars: "カレンダーを更新",
			actions: {
				previousPeriod: "前の期間",
				nextPeriod: "次の期間",
				goToToday: "今日に移動",
				refreshCalendars: "カレンダー購読を更新",
			},
			loading: "アジェンダを読み込み中...",
			dayToggle: "日の切り替え",
			overdueToggle: "期限切れセクションの切り替え",
			expandAllDays: "すべての日を展開",
			collapseAllDays: "すべての日を折りたたみ",
			notices: {
				calendarNotReady: "カレンダーサービスはまだ準備できていません",
				calendarRefreshed: "カレンダー購読が更新されました",
				refreshFailed: "更新に失敗しました",
			},
			empty: {
				noItemsScheduled: "予定されたアイテムがありません",
				noItemsFound: "アイテムが見つかりませんでした",
			},
		},
		taskList: {
			title: "タスク",
			expandAllGroups: "すべてのグループを展開",
			collapseAllGroups: "すべてのグループを折りたたみ",
			noTasksFound: "選択されたフィルターにタスクが見つかりませんでした。",
		},
		notes: {
			title: "ノート",
			refreshButton: "更新中...",
			notices: {
				indexingDisabled: "ノートのインデックス作成が無効になっています",
			},
			empty: {
				noNotesFound: "ノートが見つかりませんでした",
			},
		},
		miniCalendar: {
			title: "ミニカレンダー",
		},
		advancedCalendar: {
			title: "高度なカレンダー",
			filters: {
				showFilters: "フィルターを表示",
				hideFilters: "フィルターを非表示",
			},
			viewOptions: {
				calendarSubscriptions: "カレンダー購読",
				timeEntries: "時間エントリ",
				timeblocks: "タイムブロック",
				scheduledDates: "予定日",
				dueDates: "期限日",
				allDaySlot: "終日スロット",
				scheduledTasks: "予定タスク",
				recurringTasks: "繰り返しタスク",
			},
			buttons: {
				refresh: "更新",
				refreshHint: "カレンダー購読を更新",
			},
			notices: {
				icsServiceNotAvailable: "ICS購読サービスが利用できません",
				calendarRefreshedAll: "すべてのカレンダー購読が正常に更新されました",
				refreshFailed: "一部のカレンダー購読の更新に失敗しました",
				timeblockSpecificTime:
					"タイムブロックには具体的な時間が必要です。週表示または日表示で時間範囲を選択してください。",
				timeblockMoved: 'タイムブロック「{title}」を{date}に移動しました',
				timeblockUpdated: 'タイムブロック「{title}」の時間を更新しました',
				timeblockMoveFailed: "タイムブロックの移動に失敗しました：{message}",
				timeblockResized: 'タイムブロック「{title}」の期間を更新しました',
				timeblockResizeFailed: "タイムブロックのサイズ変更に失敗しました：{message}",
				taskScheduled: 'タスク「{title}」を{date}に予定しました',
				scheduleTaskFailed: "タスクの予定に失敗しました",
				endTimeAfterStart: "終了時刻は開始時刻より後である必要があります",
				timeEntryNotFound: "時間エントリが見つかりません",
				timeEntryDeleted: "時間エントリを削除しました",
				deleteTimeEntryFailed: "時間エントリの削除に失敗しました",
			},
			timeEntry: {
				estimatedSuffix: "見積",
				trackedSuffix: "記録",
				recurringPrefix: "繰り返し：",
				completedPrefix: "完了：",
				createdPrefix: "作成：",
				modifiedPrefix: "変更：",
				duePrefix: "期限：",
				scheduledPrefix: "予定：",
			},
			contextMenus: {
				openTask: "タスクを開く",
				deleteTimeEntry: "時間エントリを削除",
				deleteTimeEntryTitle: "時間エントリを削除",
				deleteTimeEntryConfirm:
					"この時間エントリ{duration}を削除してもよろしいですか？この操作は元に戻せません。",
				deleteButton: "削除",
				cancelButton: "キャンセル",
			},
		},
		basesCalendar: {
			title: "ベースカレンダー",
			today: "今日",
			buttonText: {
				month: "月",
				week: "週",
				day: "日",
				year: "年",
				list: "一覧",
				customDays: "{count}日",
			},
			errors: {
				failedToInitialize: "カレンダーの初期化に失敗しました",
			},
		},
		kanban: {
			title: "かんばん",
			newTask: "新しいタスク",
			addCard: "+ カードを追加",
			noTasks: "タスクなし",
			notices: {
				loadFailed: "かんばんボードの読み込みに失敗しました",
				movedTask: 'タスクを"{0}"に移動しました',
			},
			errors: {
				loadingBoard: "ボードの読み込みエラー。",
			},
		},
		pomodoro: {
			title: "ポモドーロ",
			status: {
				focus: "フォーカス",
				ready: "開始準備完了",
				paused: "一時停止",
				working: "作業中",
				shortBreak: "短い休憩",
				longBreak: "長い休憩",
				breakPrompt: "素晴らしい仕事です！{length}休憩の時間です",
				breakLength: {
					short: "短い",
					long: "長い",
				},
				breakComplete: "休憩完了！次のポモドーロの準備はできましたか？",
			},
			buttons: {
				start: "開始",
				pause: "一時停止",
				stop: "停止",
				resume: "再開",
				startShortBreak: "短い休憩を開始",
				startLongBreak: "長い休憩を開始",
				skipBreak: "休憩をスキップ",
				chooseTask: "タスクを選択...",
				changeTask: "タスクを変更...",
				clearTask: "タスクをクリア",
				selectDifferentTask: "別のタスクを選択",
			},
			notices: {
				noTasks:
					"アーカイブされていないタスクが見つかりません。最初にタスクを作成してください。",
				loadFailed: "タスクの読み込みに失敗しました",
			},
			statsLabel: "今日完了",
		},
		pomodoroStats: {
			title: "ポモドーロ統計",
			heading: "ポモドーロ統計",
			refresh: "更新",
			sections: {
				overview: "概要",
				today: "今日",
				week: "今週",
				allTime: "全期間",
				recent: "最近のセッション",
			},
			overviewCards: {
				todayPomos: {
					label: "今日のポモ",
					change: {
						more: "昨日より{count}多い",
						less: "昨日より{count}少ない",
					},
				},
				totalPomos: {
					label: "総ポモ数",
				},
				todayFocus: {
					label: "今日のフォーカス",
					change: {
						more: "昨日より{duration}多い",
						less: "昨日より{duration}少ない",
					},
				},
				totalFocus: {
					label: "総フォーカス時間",
				},
			},
			stats: {
				pomodoros: "ポモドーロ",
				streak: "連続記録",
				minutes: "分",
				average: "平均長さ",
				completion: "完了",
			},
			recents: {
				empty: "まだセッションが記録されていません",
				duration: "{minutes}分",
				status: {
					completed: "完了",
					interrupted: "中断",
				},
			},
		},
		stats: {
			title: "統計",
			taskProjectStats: "タスクとプロジェクトの統計",
			sections: {
				filters: "フィルター",
				overview: "概要",
				today: "今日",
				thisWeek: "今週",
				thisMonth: "今月",
				projectBreakdown: "プロジェクト内訳",
				dateRange: "日付範囲",
			},
			filters: {
				minTime: "最小時間（分）",
			},
		},
		releaseNotes: {
			title: "TaskNotes {version} の新機能",
			header: "TaskNotes {version} の新機能",
			viewAllLink: "GitHubですべてのリリースノートを表示 →",
			starMessage: "TaskNotesが役に立ったら、GitHubでスターをお願いします",
		},
	},
	settings: {
		tabs: {
			general: "一般",
			taskProperties: "タスクプロパティ",
			defaults: "デフォルトとテンプレート",
			appearance: "外観とUI",
			features: "機能",
			integrations: "統合",
		},
		features: {
			inlineTasks: {
				header: "インラインタスク",
				description:
					"あらゆるノート内でシームレスなタスク管理のためのインラインタスク機能を設定します。",
			},
			overlays: {
				taskLinkToggle: {
					name: "タスクリンクオーバーレイ",
					description: "タスクリンクにホバーした際のインタラクティブオーバーレイを表示",
				},
			},
			instantConvert: {
				toggle: {
					name: "インスタントタスク変換",
					description:
						"キーボードショートカットを使用したテキストからタスクへのインスタント変換を有効にする",
				},
				folder: {
					name: "インラインタスク変換フォルダー",
					description:
						"インラインタスク変換用のフォルダー。現在のノートに相対的にするには{{currentNotePath}}を使用",
				},
			},
			nlp: {
				header: "自然言語処理",
				description: "自然言語入力からタスクの詳細をスマートに解析することを有効にします。",
				enable: {
					name: "自然言語タスク入力を有効にする",
					description: "タスク作成時に自然言語から期限日、優先度、コンテキストを解析",
				},
				defaultToScheduled: {
					name: "デフォルトで予定に設定",
					description:
						"NLPがコンテキストなしで日付を検出した場合、期限ではなく予定として扱う",
				},
				language: {
					name: "NLP言語",
					description: "自然言語処理パターンと日付解析の言語",
				},
				statusTrigger: {
					name: "ステータス提案トリガー",
					description:
						"ステータス提案をトリガーするテキスト（無効にするには空白のままにする）",
				},
			},
			pomodoro: {
				header: "ポモドーロタイマー",
				description: "時間管理と生産性追跡のための組み込みポモドーロタイマー。",
				workDuration: {
					name: "作業時間",
					description: "作業間隔の時間（分）",
				},
				shortBreak: {
					name: "短い休憩時間",
					description: "短い休憩の時間（分）",
				},
				longBreak: {
					name: "長い休憩時間",
					description: "長い休憩の時間（分）",
				},
				longBreakInterval: {
					name: "長い休憩間隔",
					description: "長い休憩前の作業セッション数",
				},
				autoStartBreaks: {
					name: "自動休憩開始",
					description: "作業セッション後に休憩タイマーを自動開始",
				},
				autoStartWork: {
					name: "自動作業開始",
					description: "休憩後に作業セッションを自動開始",
				},
				notifications: {
					name: "ポモドーロ通知",
					description: "ポモドーロセッション終了時に通知を表示",
				},
			},
			uiLanguage: {
				header: "インターフェース言語",
				description: "TaskNotesのメニュー、通知、ビューの言語を変更します。",
				dropdown: {
					name: "UI言語",
					description: "TaskNotesインターフェーステキストに使用する言語を選択",
				},
			},
			pomodoroSound: {
				enabledName: "サウンド有効",
				enabledDesc: "ポモドーロセッション終了時にサウンドを再生",
				volumeName: "サウンド音量",
				volumeDesc: "ポモドーロサウンドの音量（0-100）",
			},
			dataStorage: {
				name: "ポモドーロデータストレージ",
				description: "ポモドーロセッションデータの保存場所と管理方法を設定します。",
				dailyNotes: "デイリーノート",
			},
			notifications: {
				header: "通知",
				description: "タスクリマインダー通知とアラートを設定します。",
				enableName: "通知を有効にする",
				enableDesc: "タスクリマインダー通知を有効にする",
				typeName: "通知タイプ",
				typeDesc: "表示する通知のタイプ",
				systemLabel: "システム通知",
				inAppLabel: "アプリ内通知",
			},
			overdue: {
				hideCompletedName: "期限切れから完了タスクを非表示",
				hideCompletedDesc: "期限切れタスク計算から完了タスクを除外",
			},
			indexing: {
				disableName: "ノートインデックス作成を無効にする",
				disableDesc:
					"パフォーマンス向上のためノートコンテンツの自動インデックス作成を無効にする",
			},
			suggestions: {
				debounceName: "提案デバウンス",
				debounceDesc: "提案を表示する前の遅延（ミリ秒）",
			},
			timeTracking: {
				autoStopName: "時間追跡の自動停止",
				autoStopDesc: "タスクが完了とマークされたときに時間追跡を自動停止",
				stopNotificationName: "時間追跡停止通知",
				stopNotificationDesc: "時間追跡が自動停止されたときに通知を表示",
			},
			recurring: {
				maintainOffsetName: "繰り返しタスクで期限日オフセットを維持",
				maintainOffsetDesc:
					"繰り返しタスクが完了したときに期限日と予定日の間のオフセットを保持",
			},
			timeblocking: {
				header: "タイムブロッキング",
				description:
					"デイリーノートでの軽量スケジューリングのためのタイムブロック機能を設定します。アドバンスドカレンダービューで、Shift + クリック＆ドラッグでタイムブロックを作成できます。",
				enableName: "タイムブロッキングを有効にする",
				enableDesc:
					"デイリーノートでの軽量スケジューリングのためのタイムブロック機能を有効にする",
				showBlocksName: "タイムブロックを表示",
				showBlocksDesc: "デイリーノートからのタイムブロックをデフォルトで表示",
				usage: "使用方法：アドバンスドカレンダービューで、Shift + ドラッグでタイムブロックを作成。ドラッグで既存のブロックを移動。端を調整して時間を変更。",
			},
			performance: {
				header: "パフォーマンスと動作",
				description: "プラグインのパフォーマンスと動作オプションを設定します。",
			},
			timeTrackingSection: {
				header: "時間追跡",
				description: "自動時間追跡の動作を設定します。",
			},
			recurringSection: {
				header: "繰り返しタスク",
				description: "繰り返しタスク管理の動作を設定します。",
			},
		},
		defaults: {
			header: {
				basicDefaults: "基本デフォルト",
				dateDefaults: "日付デフォルト",
				defaultReminders: "デフォルトリマインダー",
				bodyTemplate: "ボディテンプレート",
				instantTaskConversion: "インスタントタスク変換",
			},
			description: {
				basicDefaults:
					"タスク作成を高速化するために新しいタスクのデフォルト値を設定します。",
				dateDefaults: "新しいタスクのデフォルト期限日と予定日を設定します。",
				defaultReminders: "新しいタスクに追加されるデフォルトリマインダーを設定します。",
				bodyTemplate: "新しいタスクコンテンツに使用するテンプレートファイルを設定します。",
				instantTaskConversion:
					"テキストをタスクにインスタント変換する際の動作を設定します。",
			},
			basicDefaults: {
				defaultStatus: {
					name: "デフォルトステータス",
					description: "新しいタスクのデフォルトステータス",
				},
				defaultPriority: {
					name: "デフォルト優先度",
					description: "新しいタスクのデフォルト優先度",
				},
				defaultContexts: {
					name: "デフォルトコンテキスト",
					description: "デフォルトコンテキストのカンマ区切りリスト（例：@home、@work）",
					placeholder: "@home, @work",
				},
				defaultTags: {
					name: "デフォルトタグ",
					description: "デフォルトタグのカンマ区切りリスト（#なし）",
					placeholder: "important, urgent",
				},
				defaultProjects: {
					name: "デフォルトプロジェクト",
					description: "新しいタスクのデフォルトプロジェクトリンク",
					selectButton: "プロジェクトを選択",
					selectTooltip: "デフォルトでリンクするプロジェクトノートを選択",
					removeTooltip: "デフォルトプロジェクトから{name}を削除",
				},
				useParentNoteAsProject: {
					name: "インスタント変換時に親ノートをプロジェクトとして使用",
					description:
						"インスタントタスク変換使用時に親ノートを自動的にプロジェクトとしてリンク",
				},
				defaultTimeEstimate: {
					name: "デフォルト時間見積もり",
					description: "デフォルト時間見積もり（分）（0 = デフォルトなし）",
					placeholder: "60",
				},
				defaultRecurrence: {
					name: "デフォルト繰り返し",
					description: "新しいタスクのデフォルト繰り返しパターン",
				},
			},
			dateDefaults: {
				defaultDueDate: {
					name: "デフォルト期限日",
					description: "新しいタスクのデフォルト期限日",
				},
				defaultScheduledDate: {
					name: "デフォルト予定日",
					description: "新しいタスクのデフォルト予定日",
				},
			},
			reminders: {
				addReminder: {
					name: "デフォルトリマインダーを追加",
					description:
						"すべての新しいタスクに追加される新しいデフォルトリマインダーを作成",
					buttonText: "リマインダーを追加",
				},
				emptyState:
					"デフォルトリマインダーが設定されていません。リマインダーを追加して新しいタスクについて自動的に通知を受け取ります。",
				emptyStateButton: "リマインダーを追加",
				reminderDescription: "リマインダーの説明",
				unnamedReminder: "名前なしリマインダー",
				deleteTooltip: "リマインダーを削除",
				fields: {
					description: "説明：",
					type: "タイプ：",
					offset: "オフセット：",
					unit: "単位：",
					direction: "方向：",
					relatedTo: "関連先：",
					date: "日付：",
					time: "時間：",
				},
				types: {
					relative: "相対（タスク日付の前/後）",
					absolute: "絶対（特定の日付/時間）",
				},
				units: {
					minutes: "分",
					hours: "時間",
					days: "日",
				},
				directions: {
					before: "前",
					after: "後",
				},
				relatedTo: {
					due: "期限日",
					scheduled: "予定日",
				},
			},
			bodyTemplate: {
				useBodyTemplate: {
					name: "ボディテンプレートを使用",
					description: "タスクボディコンテンツにテンプレートファイルを使用",
				},
				bodyTemplateFile: {
					name: "ボディテンプレートファイル",
					description:
						"タスクボディコンテンツのテンプレートファイルへのパス。{{title}}、{{date}}、{{time}}、{{priority}}、{{status}}などのテンプレート変数をサポート。",
					placeholder: "Templates/Task Template.md",
					ariaLabel: "ボディテンプレートファイルへのパス",
				},
				variablesHeader: "テンプレート変数：",
				variables: {
					title: "{{title}} - タスクタイトル",
					details: "{{details}} - モーダルからユーザー提供の詳細",
					date: "{{date}} - 現在の日付（YYYY-MM-DD）",
					time: "{{time}} - 現在の時間（HH:MM）",
					priority: "{{priority}} - タスク優先度",
					status: "{{status}} - タスクステータス",
					contexts: "{{contexts}} - タスクコンテキスト",
					tags: "{{tags}} - タスクタグ",
					projects: "{{projects}} - タスクプロジェクト",
				},
			},
			instantConversion: {
				useDefaultsOnInstantConvert: {
					name: "インスタント変換でタスクデフォルトを使用",
					description:
						"テキストをタスクにインスタント変換する際にデフォルトタスク設定を適用",
				},
			},
			options: {
				noDefault: "デフォルトなし",
				none: "なし",
				today: "今日",
				tomorrow: "明日",
				nextWeek: "来週",
				daily: "毎日",
				weekly: "毎週",
				monthly: "毎月",
				yearly: "毎年",
			},
		},
		general: {
			taskStorage: {
				header: "タスクストレージ",
				description: "タスクの保存場所と識別方法を設定します。",
				defaultFolder: {
					name: "デフォルトタスクフォルダー",
					description: "新しいタスクのデフォルト場所",
				},
				moveArchived: {
					name: "アーカイブしたタスクをフォルダーに移動",
					description: "アーカイブしたタスクを自動的にアーカイブフォルダーに移動",
				},
				archiveFolder: {
					name: "アーカイブフォルダー",
					description: "アーカイブ時にタスクを移動するフォルダー",
				},
			},
			taskIdentification: {
				header: "タスク識別",
				description: "TaskNotesがノートをタスクとして識別する方法を選択します。",
				identifyBy: {
					name: "タスクの識別方法",
					description: "タグまたはフロントマタープロパティでタスクを識別するかを選択",
					options: {
						tag: "タグ",
						property: "プロパティ",
					},
				},
				taskTag: {
					name: "タスクタグ",
					description: "ノートをタスクとして識別するタグ（#なし）",
				},
				taskProperty: {
					name: "タスクプロパティ名",
					description: 'フロントマタープロパティ名（例："category"）',
				},
				taskPropertyValue: {
					name: "タスクプロパティ値",
					description: 'ノートをタスクとして識別する値（例："task"）',
				},
			},
			folderManagement: {
				header: "フォルダー管理",
				excludedFolders: {
					name: "除外フォルダー",
					description: "ノートタブから除外するフォルダーのカンマ区切りリスト",
				},
			},
			taskInteraction: {
				header: "タスクインタラクション",
				description: "タスクをクリックする際の動作を設定します。",
				singleClick: {
					name: "シングルクリックアクション",
					description: "タスクカードをシングルクリックした際に実行するアクション",
				},
				doubleClick: {
					name: "ダブルクリックアクション",
					description: "タスクカードをダブルクリックした際に実行するアクション",
				},
				actions: {
					edit: "タスクを編集",
					openNote: "ノートを開く",
					none: "アクションなし",
				},
			},
		},
		taskProperties: {
			taskStatuses: {
				header: "タスクステータス",
				description:
					"タスクで利用可能なステータスオプションをカスタマイズします。これらのステータスはタスクライフサイクルを制御し、タスクがいつ完了と見なされるかを決定します。",
				howTheyWork: {
					title: "ステータスの動作：",
					value: '値：タスクファイルに保存される内部識別子（例："in-progress"）',
					label: 'ラベル：インターフェースに表示される表示名（例："進行中"）',
					color: "色：ステータスドットとバッジの視覚的インジケーター色",
					completed:
						"完了：チェックすると、このステータスのタスクは完了と見なされ、異なってフィルタリングされる場合があります",
					autoArchive:
						"自動アーカイブ：有効にすると、指定された遅延後にタスクが自動的にアーカイブされます（1-1440分）",
					orderNote:
						"以下の順序は、タスクステータスバッジをクリックしてステータスを切り替える際のシーケンスを決定します。",
				},
				addNew: {
					name: "新しいステータスを追加",
					description: "タスクの新しいステータスオプションを作成",
					buttonText: "ステータスを追加",
				},
				validationNote:
					'注意：少なくとも2つのステータスが必要で、少なくとも1つのステータスが"完了"としてマークされている必要があります。',
				emptyState:
					"カスタムステータスが設定されていません。ステータスを追加して開始してください。",
				emptyStateButton: "ステータスを追加",
				fields: {
					value: "値：",
					label: "ラベル：",
					color: "色：",
					completed: "完了：",
					autoArchive: "自動アーカイブ：",
					delayMinutes: "遅延（分）：",
				},
				placeholders: {
					value: "in-progress",
					label: "進行中",
				},
				badges: {
					completed: "完了",
				},
				deleteConfirm: 'ステータス"{label}"を削除してもよろしいですか？',
			},
			taskPriorities: {
				header: "タスク優先度",
				description:
					"タスクで利用可能な優先度レベルをカスタマイズします。優先度の重みは、タスクビューでの並び順と視覚的階層を決定します。",
				howTheyWork: {
					title: "優先度の動作：",
					value: '値：タスクファイルに保存される内部識別子（例："high"）',
					label: '表示ラベル：インターフェースに表示される表示名（例："高優先度"）',
					color: "色：優先度ドットとバッジの視覚的インジケーター色",
					weight: "重み：並び替え用の数値（重みが高いほどリストで先に表示）",
					weightNote:
						"タスクは優先度の重みで自動的に降順で並び替えられます（最高重みが最初）。重みは任意の正の数値です。",
				},
				addNew: {
					name: "新しい優先度を追加",
					description: "タスクの新しい優先度レベルを作成",
					buttonText: "優先度を追加",
				},
				validationNote:
					"注意：少なくとも1つの優先度が必要です。重みが高いほど並び替えと視覚的階層で優先されます。",
				emptyState:
					"カスタム優先度が設定されていません。優先度を追加して開始してください。",
				emptyStateButton: "優先度を追加",
				fields: {
					value: "値：",
					label: "ラベル：",
					color: "色：",
					weight: "重み：",
				},
				placeholders: {
					value: "high",
					label: "高優先度",
				},
				weightLabel: "重み：{weight}",
				deleteConfirm: "少なくとも1つの優先度が必要です",
				deleteTooltip: "優先度を削除",
			},
			fieldMapping: {
				header: "フィールドマッピング",
				warning:
					"⚠️ 警告：TaskNotesはこれらのプロパティ名を読み書きします。タスク作成後にこれらを変更すると不整合が生じる可能性があります。",
				description:
					"TaskNotesが各フィールドに使用するフロントマタープロパティを設定します。",
				resetButton: {
					name: "フィールドマッピングをリセット",
					description: "すべてのフィールドマッピングをデフォルト値にリセット",
					buttonText: "デフォルトにリセット",
				},
				notices: {
					resetSuccess: "フィールドマッピングをデフォルトにリセットしました",
					resetFailure: "フィールドマッピングのリセットに失敗しました",
					updateFailure:
						"{label}のフィールドマッピング更新に失敗しました。再試行してください。",
				},
				table: {
					fieldHeader: "TaskNotesフィールド",
					propertyHeader: "あなたのプロパティ名",
				},
				fields: {
					title: "タイトル",
					status: "ステータス",
					priority: "優先度",
					due: "期限日",
					scheduled: "予定日",
					contexts: "コンテキスト",
					projects: "プロジェクト",
					timeEstimate: "時間見積もり",
					recurrence: "繰り返し",
					dateCreated: "作成日",
					completedDate: "完了日",
					dateModified: "変更日",
					archiveTag: "アーカイブタグ",
					timeEntries: "時間エントリ",
					completeInstances: "完了インスタンス",
					blockedBy: "ブロック元",
					pomodoros: "ポモドーロ",
					icsEventId: "ICSイベントID",
					icsEventTag: "ICSイベントタグ",
					reminders: "リマインダー",
				},
			},
			customUserFields: {
				header: "カスタムユーザーフィールド",
				description:
					"すべてのビューで型認識フィルターオプションとして表示されるカスタムフロントマタープロパティを定義します。各行：表示名、プロパティ名、タイプ。",
				addNew: {
					name: "新しいユーザーフィールドを追加",
					description: "フィルターとビューに表示される新しいカスタムフィールドを作成",
					buttonText: "ユーザーフィールドを追加",
				},
				emptyState:
					"カスタムユーザーフィールドが設定されていません。フィールドを追加してタスクのカスタムプロパティを作成してください。",
				emptyStateButton: "ユーザーフィールドを追加",
				fields: {
					displayName: "表示名：",
					propertyKey: "プロパティキー：",
					type: "タイプ：",
				},
				placeholders: {
					displayName: "表示名",
					propertyKey: "property-name",
				},
				types: {
					text: "テキスト",
					number: "数値",
					boolean: "ブール",
					date: "日付",
					list: "リスト",
				},
				defaultNames: {
					unnamedField: "名前なしフィールド",
					noKey: "no-key",
				},
				deleteTooltip: "フィールドを削除",
			},
		},
		appearance: {
			taskCards: {
				header: "タスクカード",
				description: "すべてのビューでタスクカードの表示方法を設定します。",
				defaultVisibleProperties: {
					name: "デフォルト表示プロパティ",
					description: "タスクカードにデフォルトで表示するプロパティを選択します。",
				},
				propertyGroups: {
					coreProperties: "コアプロパティ",
					organization: "組織",
					customProperties: "カスタムプロパティ",
				},
				properties: {
					status: "ステータスドット",
					priority: "優先度ドット",
					due: "期限日",
					scheduled: "予定日",
					timeEstimate: "時間見積もり",
					totalTrackedTime: "総追跡時間",
					recurrence: "繰り返し",
					completedDate: "完了日",
					createdDate: "作成日",
					modifiedDate: "変更日",
					projects: "プロジェクト",
					contexts: "コンテキスト",
					tags: "タグ",
					blocked: "ブロック中",
					blocking: "ブロックしている",
				},
			},
			taskFilenames: {
				header: "タスクファイル名",
				description: "タスクファイル作成時の命名方法を設定します。",
				storeTitleInFilename: {
					name: "ファイル名にタイトルを保存",
					description:
						"タスクタイトルをファイル名として使用。タスクタイトルが変更されるとファイル名も更新されます（推奨）。",
				},
				filenameFormat: {
					name: "ファイル名形式",
					description: "タスクファイル名の生成方法",
					options: {
						title: "タスクタイトル（非更新）",
						zettel: "Zettelkasten形式（YYMMDD + 午前0時からのbase36秒）",
						timestamp: "完全タイムスタンプ（YYYY-MM-DD-HHMMSS）",
						custom: "カスタムテンプレート",
					},
				},
				customTemplate: {
					name: "カスタムファイル名テンプレート",
					description:
						"カスタムファイル名のテンプレート。利用可能な変数：{title}, {titleLower}, {titleUpper}, {titleSnake}, {titleKebab}, {titleCamel}, {titlePascal}, {date}, {shortDate}, {time}, {time12}, {time24}, {timestamp}, {dateTime}, {year}, {month}, {monthName}, {monthNameShort}, {day}, {dayName}, {dayNameShort}, {hour}, {hour12}, {minute}, {second}, {milliseconds}, {ms}, {ampm}, {week}, {quarter}, {unix}, {unixMs}, {timezone}, {timezoneShort}, {utcOffset}, {utcOffsetShort}, {utcZ}, {zettel}, {nano}, {priority}, {priorityShort}, {status}, {statusShort}, {dueDate}, {scheduledDate}",
					placeholder: "{date}-{title}-{dueDate}",
					helpText:
						"注意：{dueDate}と{scheduledDate}はYYYY-MM-DD形式で、設定されていない場合は空になります。",
				},
			},
			displayFormatting: {
				header: "表示形式",
				description: "プラグイン全体での日付、時間、その他のデータの表示方法を設定します。",
				timeFormat: {
					name: "時間形式",
					description: "プラグイン全体で12時間または24時間形式で時間を表示",
					options: {
						twelveHour: "12時間（AM/PM）",
						twentyFourHour: "24時間",
					},
				},
			},
			calendarView: {
				header: "カレンダービュー",
				description: "カレンダービューの外観と動作をカスタマイズします。",
				defaultView: {
					name: "デフォルトビュー",
					description: "カレンダータブを開く際に表示されるカレンダービュー",
					options: {
						monthGrid: "月グリッド",
						weekTimeline: "週タイムライン",
						dayTimeline: "日タイムライン",
						yearView: "年ビュー",
						customMultiDay: "カスタム複数日",
					},
				},
				customDayCount: {
					name: "カスタムビュー日数",
					description: "カスタム複数日ビューで表示する日数",
					placeholder: "3",
				},
				firstDayOfWeek: {
					name: "週の最初の日",
					description: "週ビューで最初の列にする曜日",
				},
				showWeekends: {
					name: "週末を表示",
					description: "カレンダービューで週末を表示",
				},
				showWeekNumbers: {
					name: "週番号を表示",
					description: "カレンダービューで週番号を表示",
				},
				showTodayHighlight: {
					name: "今日のハイライトを表示",
					description: "カレンダービューで現在の日をハイライト",
				},
				showCurrentTimeIndicator: {
					name: "現在時刻インジケーターを表示",
					description: "タイムラインビューで現在時刻を示すラインを表示",
				},
				selectionMirror: {
					name: "選択ミラー",
					description: "ドラッグして時間範囲を選択する際に視覚的プレビューを表示",
				},
				calendarLocale: {
					name: "カレンダーロケール",
					description:
						'日付形式とカレンダーシステムのカレンダーロケール（例："en"、"fa"はFarsi/Persian、"de"はGerman）。ブラウザーから自動検出するには空白のままにします。',
					placeholder: "自動検出",
				},
			},
			defaultEventVisibility: {
				header: "デフォルトイベント表示",
				description:
					"アドバンスドカレンダーを開く際にデフォルトで表示されるイベントタイプを設定します。ユーザーはカレンダービューでこれらをオン/オフできます。",
				showScheduledTasks: {
					name: "予定タスクを表示",
					description: "予定日のあるタスクをデフォルトで表示",
				},
				showDueDates: {
					name: "期限日を表示",
					description: "タスクの期限日をデフォルトで表示",
				},
				showDueWhenScheduled: {
					name: "予定がある場合も期限日を表示",
					description: "既に予定日があるタスクでも期限日を表示",
				},
				showTimeEntries: {
					name: "時間エントリを表示",
					description: "完了した時間追跡エントリをデフォルトで表示",
				},
				showRecurringTasks: {
					name: "繰り返しタスクを表示",
					description: "繰り返しタスクインスタンスをデフォルトで表示",
				},
				showICSEvents: {
					name: "ICSイベントを表示",
					description: "ICS購読からのイベントをデフォルトで表示",
				},
			},
			timeSettings: {
				header: "時間設定",
				description: "タイムラインビューの時間関連表示設定を構成します。",
				timeSlotDuration: {
					name: "タイムスロット間隔",
					description: "タイムラインビューでの各タイムスロットの間隔",
					options: {
						fifteenMinutes: "15分",
						thirtyMinutes: "30分",
						sixtyMinutes: "60分",
					},
				},
				startTime: {
					name: "開始時刻",
					description: "タイムラインビューで表示される最早時刻（HH:MM形式）",
					placeholder: "06:00",
				},
				endTime: {
					name: "終了時刻",
					description: "タイムラインビューで表示される最遅時刻（HH:MM形式）",
					placeholder: "22:00",
				},
				initialScrollTime: {
					name: "初期スクロール時刻",
					description: "タイムラインビューを開く際にスクロールする時刻（HH:MM形式）",
					placeholder: "09:00",
				},
				eventMinHeight: {
					name: "イベント最小高さ",
					description: "タイムラインビューでのイベントの最小高さ（ピクセル）",
					placeholder: "15",
				},
			},
			uiElements: {
				header: "UI要素",
				description: "様々なUI要素の表示を設定します。",
				showTrackedTasksInStatusBar: {
					name: "ステータスバーに追跡タスクを表示",
					description: "Obsidianのステータスバーに現在追跡中のタスクを表示",
				},
				showProjectSubtasksWidget: {
					name: "プロジェクトサブタスクウィジェットを表示",
					description: "現在のプロジェクトノートのサブタスクを表示するウィジェットを表示",
				},
				projectSubtasksPosition: {
					name: "プロジェクトサブタスク位置",
					description: "プロジェクトサブタスクウィジェットの位置",
					options: {
						top: "ノートの上部",
						bottom: "ノートの下部",
					},
				},
				showExpandableSubtasks: {
					name: "展開可能サブタスクを表示",
					description: "タスクカードでサブタスクセクションの展開/折りたたみを許可",
				},
				subtaskChevronPosition: {
					name: "サブタスクシェブロン位置",
					description: "タスクカードの展開/折りたたみシェブロンの位置",
					options: {
						left: "左側",
						right: "右側",
					},
				},
				viewsButtonAlignment: {
					name: "ビューボタン配置",
					description: "タスクインターフェースのビュー/フィルターボタンの配置",
					options: {
						left: "左側",
						right: "右側",
					},
				},
			},
			projectAutosuggest: {
				header: "プロジェクト自動提案",
				description: "タスク作成時のプロジェクト提案の表示方法をカスタマイズします。",
				requiredTags: {
					name: "必須タグ",
					description:
						"これらのタグのいずれかを持つノートのみを表示（カンマ区切り）。すべてのノートを表示するには空白のままにします。",
					placeholder: "project, active, important",
				},
				includeFolders: {
					name: "含めるフォルダー",
					description:
						"これらのフォルダー内のノートのみを表示（カンマ区切りパス）。すべてのフォルダーを表示するには空白のままにします。",
					placeholder: "Projects/, Work/Active, Personal",
				},
				requiredPropertyKey: {
					name: "必須プロパティキー",
					description:
						"このフロントマタープロパティが下記の値と一致するノートのみを表示。無視するには空白のままにします。",
					placeholder: "type",
				},
				requiredPropertyValue: {
					name: "必須プロパティ値",
					description:
						"プロパティがこの値と等しいノートのみが提案されます。プロパティの存在を要求するには空白のままにします。",
					placeholder: "project",
				},
				customizeDisplay: {
					name: "提案表示をカスタマイズ",
					description:
						"プロジェクト提案の表示方法と表示情報を設定する高度なオプションを表示。",
				},
				enableFuzzyMatching: {
					name: "ファジーマッチングを有効にする",
					description:
						"プロジェクト検索でタイプミスと部分一致を許可。大きなボルトでは遅くなる可能性があります。",
				},
				displayRowsHelp: "各プロジェクト提案に表示する最大3行の情報を設定します。",
				displayRows: {
					row1: {
						name: "行1",
						description:
							"形式：{property|flags}。プロパティ：title、aliases、file.path、file.parent。フラグ：n(Label)はラベルを表示、sは検索可能にします。例：{title|n(Title)|s}",
						placeholder: "{title|n(Title)}",
					},
					row2: {
						name: "行2（オプション）",
						description:
							"一般的なパターン：{aliases|n(Aliases)}、{file.parent|n(Folder)}、literal:カスタムテキスト",
						placeholder: "{aliases|n(Aliases)}",
					},
					row3: {
						name: "行3（オプション）",
						description:
							"{file.path|n(Path)}やカスタムフロントマターフィールドなどの追加情報",
						placeholder: "{file.path|n(Path)}",
					},
				},
				quickReference: {
					header: "クイックリファレンス",
					properties:
						"利用可能プロパティ：title、aliases、file.path、file.parent、または任意のフロントマターフィールド",
					labels: 'ラベル追加：{title|n(Title)} → "Title: My Project"',
					searchable: "検索可能にする：{description|s}は+検索に説明を含めます",
					staticText: "静的テキスト：literal:My Custom Label",
					alwaysSearchable:
						"ファイル名、タイトル、エイリアスはデフォルトで常に検索可能です。",
				},
			},
			dataStorage: {
				name: "ストレージ場所",
				description: "ポモドーロセッション履歴を保存する場所",
				pluginData: "プラグインデータ（推奨）",
				dailyNotes: "デイリーノート",
				notices: {
					locationChanged: "ポモドーロストレージ場所を{location}に変更しました",
				},
			},
			notifications: {
				description: "タスクリマインダー通知とアラートを設定します。",
			},
			performance: {
				description: "プラグインのパフォーマンスと動作オプションを設定します。",
			},
			timeTrackingSection: {
				description: "自動時間追跡動作を設定します。",
			},
			recurringSection: {
				description: "繰り返しタスク管理の動作を設定します。",
			},
			timeblocking: {
				description:
					"デイリーノートでの軽量スケジューリングのためのタイムブロック機能を設定します。",
				usage: "使用方法：アドバンスドカレンダービューで、Shift +ドラッグでタイムブロックを作成。ドラッグで既存のタイムブロックを移動。エッジをリサイズして時間を調整。",
			},
		},
		integrations: {
			basesIntegration: {
				header: "Bases統合",
				description:
					"Obsidian Basesプラグインとの統合を設定します。これは実験的機能で、現在非公開のObsidian APIに依存しています。動作が変更または破損する可能性があります。",
				enable: {
					name: "Bases統合を有効にする",
					description:
						"TaskNotesビューをObsidian Basesプラグイン内で使用できるようにします。これが機能するにはBasesプラグインが有効である必要があります。",
				},
				notices: {
					enabled:
						"Bases統合が有効になりました。設定を完了するためにObsidianを再起動してください。",
					disabled:
						"Bases統合が無効になりました。削除を完了するためにObsidianを再起動してください。",
				},
			},
			calendarSubscriptions: {
				header: "カレンダー購読",
				description:
					"ICS/iCal URLを介して外部カレンダーを購読し、タスクと一緒にイベントを表示します。",
				defaultNoteTemplate: {
					name: "デフォルトノートテンプレート",
					description: "ICSイベントから作成されるノートのテンプレートファイルへのパス",
					placeholder: "Templates/Event Template.md",
				},
				defaultNoteFolder: {
					name: "デフォルトノートフォルダー",
					description: "ICSイベントから作成されるノートのフォルダー",
					placeholder: "Calendar/Events",
				},
				filenameFormat: {
					name: "ICSノートファイル名形式",
					description: "ICSイベントから作成されるノートのファイル名生成方法",
					options: {
						title: "イベントタイトル",
						zettel: "Zettelkasten形式",
						timestamp: "タイムスタンプ",
						custom: "カスタムテンプレート",
					},
				},
				customTemplate: {
					name: "カスタムICSファイル名テンプレート",
					description: "カスタムICSイベントファイル名のテンプレート",
					placeholder: "{date}-{title}",
				},
			},
			subscriptionsList: {
				header: "カレンダー購読リスト",
				addSubscription: {
					name: "カレンダー購読を追加",
					description: "ICS/iCal URLまたはローカルファイルから新しいカレンダー購読を追加",
					buttonText: "購読を追加",
				},
				refreshAll: {
					name: "すべての購読を更新",
					description: "有効なすべてのカレンダー購読を手動で更新",
					buttonText: "すべて更新",
				},
				newCalendarName: "新しいカレンダー",
				emptyState:
					"カレンダー購読が設定されていません。購読を追加して外部カレンダーを同期してください。",
				notices: {
					addSuccess: "新しいカレンダー購読が追加されました - 詳細を設定してください",
					addFailure: "購読の追加に失敗しました",
					serviceUnavailable: "ICS購読サービスが利用できません",
					refreshSuccess: "すべてのカレンダー購読が正常に更新されました",
					refreshFailure: "一部のカレンダー購読の更新に失敗しました",
					updateFailure: "購読の更新に失敗しました",
					deleteSuccess: '購読"{name}"を削除しました',
					deleteFailure: "購読の削除に失敗しました",
					enableFirst: "最初に購読を有効にしてください",
					refreshSubscriptionSuccess: '"{name}"を更新しました',
					refreshSubscriptionFailure: "購読の更新に失敗しました",
				},
				labels: {
					enabled: "有効：",
					name: "名前：",
					type: "タイプ：",
					url: "URL：",
					filePath: "ファイルパス：",
					color: "色：",
					refreshMinutes: "更新（分）：",
				},
				typeOptions: {
					remote: "リモートURL",
					local: "ローカルファイル",
				},
				placeholders: {
					calendarName: "カレンダー名",
					url: "ICS/iCal URL",
					filePath: "ローカルファイルパス（例：Calendar.ics）",
					localFile: "Calendar.ics",
				},
				statusLabels: {
					enabled: "有効",
					disabled: "無効",
					remote: "リモート",
					localFile: "ローカルファイル",
					remoteCalendar: "リモートカレンダー",
					localFileCalendar: "ローカルファイル",
					synced: "{timeAgo}に同期",
					error: "エラー",
				},
				actions: {
					refreshNow: "今すぐ更新",
					deleteSubscription: "購読を削除",
				},
				confirmDelete: {
					title: "購読を削除",
					message: '購読"{name}"を削除してもよろしいですか？この操作は元に戻せません。',
					confirmText: "削除",
				},
			},
			autoExport: {
				header: "自動ICSエクスポート",
				description: "すべてのタスクを自動的にICSファイルにエクスポートします。",
				enable: {
					name: "自動エクスポートを有効にする",
					description: "すべてのタスクでICSファイルを自動的に更新し続ける",
				},
				filePath: {
					name: "エクスポートファイルパス",
					description: "ICSファイルを保存するパス（ボルトルートからの相対パス）",
					placeholder: "tasknotes-calendar.ics",
				},
				interval: {
					name: "更新間隔（5から1440分の間）",
					description: "エクスポートファイルを更新する頻度",
					placeholder: "60",
				},
				exportNow: {
					name: "今すぐエクスポート",
					description: "即座にエクスポートを手動でトリガー",
					buttonText: "今すぐエクスポート",
				},
				status: {
					title: "エクスポートステータス：",
					lastExport: "最後のエクスポート：{time}",
					nextExport: "次のエクスポート：{time}",
					noExports: "まだエクスポートされていません",
					notScheduled: "スケジュールされていません",
					notInitialized:
						"自動エクスポートサービスが初期化されていません - Obsidianを再起動してください",
				},
				notices: {
					reloadRequired:
						"自動エクスポートの変更を有効にするためにObsidianを再読み込みしてください。",
					exportSuccess: "タスクが正常にエクスポートされました",
					exportFailure:
						"エクスポートに失敗しました - 詳細はコンソールを確認してください",
					serviceUnavailable: "自動エクスポートサービスが利用できません",
				},
			},
			httpApi: {
				header: "HTTP API",
				description: "外部統合と自動化のためのHTTP APIを有効にします。",
				enable: {
					name: "HTTP APIを有効にする",
					description: "APIアクセス用のローカルHTTPサーバーを開始",
				},
				port: {
					name: "APIポート",
					description: "HTTP APIサーバーのポート番号",
					placeholder: "3000",
				},
				authToken: {
					name: "API認証トークン",
					description: "API認証に必要なトークン（認証なしの場合は空白のままにする）",
					placeholder: "your-secret-token",
				},
				endpoints: {
					header: "利用可能なAPIエンドポイント",
					expandIcon: "▶",
					collapseIcon: "▼",
				},
			},
			webhooks: {
				header: "Webhook",
				description: {
					overview:
						"WebhookはTaskNotesイベントが発生したときに外部サービスにリアルタイム通知を送信します。",
					usage: "自動化ツール、同期サービス、またはカスタムアプリケーションと統合するためにWebhookを設定します。",
				},
				addWebhook: {
					name: "Webhookを追加",
					description: "新しいWebhookエンドポイントを登録",
					buttonText: "Webhookを追加",
				},
				emptyState: {
					message:
						"Webhookが設定されていません。Webhookを追加してリアルタイム通知を受信してください。",
					buttonText: "Webhookを追加",
				},
				labels: {
					active: "アクティブ：",
					url: "URL：",
					events: "イベント：",
					transform: "変換：",
				},
				placeholders: {
					url: "Webhook URL",
					noEventsSelected: "イベントが選択されていません",
					rawPayload: "Rawペイロード（変換なし）",
				},
				statusLabels: {
					active: "アクティブ",
					inactive: "非アクティブ",
					created: "{timeAgo}に作成",
				},
				actions: {
					editEvents: "イベントを編集",
					delete: "削除",
				},
				notices: {
					urlUpdated: "Webhook URLが更新されました",
					enabled: "Webhookが有効になりました",
					disabled: "Webhookが無効になりました",
					created: "Webhookが正常に作成されました",
					deleted: "Webhookが削除されました",
					updated: "Webhookが更新されました",
				},
				confirmDelete: {
					title: "Webhookを削除",
					message:
						"このWebhookを削除してもよろしいですか？\n\nURL：{url}\n\nこの操作は元に戻せません。",
					confirmText: "削除",
				},
				cardHeader: "Webhook",
				cardFields: {
					active: "アクティブ：",
					url: "URL：",
					events: "イベント：",
					transform: "変換：",
				},
				eventsDisplay: {
					noEvents: "イベントが選択されていません",
				},
				transformDisplay: {
					noTransform: "Rawペイロード（変換なし）",
				},
				secretModal: {
					title: "Webhookシークレットが生成されました",
					description:
						"Webhookシークレットが生成されました。再度表示することはできないため、このシークレットを保存してください：",
					usage: "受信アプリケーションでWebhookペイロードを検証するためにこのシークレットを使用してください。",
					gotIt: "了解",
				},
				editModal: {
					title: "Webhookを編集",
					eventsHeader: "購読するイベント",
				},
				events: {
					taskCreated: {
						label: "タスク作成",
						description: "新しいタスクが作成されたとき",
					},
					taskUpdated: {
						label: "タスク更新",
						description: "タスクが変更されたとき",
					},
					taskCompleted: {
						label: "タスク完了",
						description: "タスクが完了とマークされたとき",
					},
					taskDeleted: {
						label: "タスク削除",
						description: "タスクが削除されたとき",
					},
					taskArchived: {
						label: "タスクアーカイブ",
						description: "タスクがアーカイブされたとき",
					},
					taskUnarchived: {
						label: "タスクアーカイブ解除",
						description: "タスクのアーカイブが解除されたとき",
					},
					timeStarted: {
						label: "時間開始",
						description: "時間追跡が開始されたとき",
					},
					timeStopped: {
						label: "時間停止",
						description: "時間追跡が停止されたとき",
					},
					pomodoroStarted: {
						label: "ポモドーロ開始",
						description: "ポモドーロセッションが開始されたとき",
					},
					pomodoroCompleted: {
						label: "ポモドーロ完了",
						description: "ポモドーロセッションが終了したとき",
					},
					pomodoroInterrupted: {
						label: "ポモドーロ中断",
						description: "ポモドーロセッションが停止されたとき",
					},
					recurringCompleted: {
						label: "繰り返しインスタンス完了",
						description: "繰り返しタスクインスタンスが完了したとき",
					},
					reminderTriggered: {
						label: "リマインダー起動",
						description: "タスクリマインダーがアクティブになったとき",
					},
				},
				modals: {
					secretGenerated: {
						title: "Webhookシークレットが生成されました",
						description:
							"Webhookシークレットが生成されました。再度表示することはできないため、このシークレットを保存してください：",
						usage: "受信アプリケーションでWebhookペイロードを検証するためにこのシークレットを使用してください。",
						buttonText: "了解",
					},
					edit: {
						title: "Webhookを編集",
						eventsSection: "購読するイベント",
						transformSection: "変換設定（オプション）",
						headersSection: "ヘッダー設定",
						transformFile: {
							name: "変換ファイル",
							description:
								"Webhookペイロードを変換するボルト内の.jsまたは.jsonファイルへのパス",
							placeholder: "discord-transform.js",
						},
						customHeaders: {
							name: "カスタムヘッダーを含める",
							description:
								"TaskNotesヘッダー（イベントタイプ、署名、配信ID）を含める。Discord、Slack、および厳格なCORSポリシーを持つその他のサービスではオフにしてください。",
						},
						buttons: {
							cancel: "キャンセル",
							save: "変更を保存",
						},
						notices: {
							selectAtLeastOneEvent: "少なくとも1つのイベントを選択してください",
						},
					},
					add: {
						title: "Webhookを追加",
						eventsSection: "購読するイベント",
						transformSection: "変換設定（オプション）",
						headersSection: "ヘッダー設定",
						url: {
							name: "Webhook URL",
							description: "Webhookペイロードが送信されるエンドポイント",
							placeholder: "https://your-service.com/webhook",
						},
						transformFile: {
							name: "変換ファイル",
							description:
								"Webhookペイロードを変換するボルト内の.jsまたは.jsonファイルへのパス",
							placeholder: "discord-transform.js",
						},
						customHeaders: {
							name: "カスタムヘッダーを含める",
							description:
								"TaskNotesヘッダー（イベントタイプ、署名、配信ID）を含める。Discord、Slack、および厳格なCORSポリシーを持つその他のサービスではオフにしてください。",
						},
						transformHelp: {
							title: "変換ファイルを使用してWebhookペイロードをカスタマイズできます：",
							jsFiles: ".jsファイル：",
							jsDescription: " カスタムJavaScript変換",
							jsonFiles: ".jsonファイル：",
							jsonDescription: " テンプレートと ",
							jsonVariable: "${data.task.title}",
							leaveEmpty: "空白のまま：",
							leaveEmptyDescription: " Rawデータを送信",
							example: "例：",
							exampleFile: "discord-transform.js",
						},
						buttons: {
							cancel: "キャンセル",
							add: "Webhookを追加",
						},
						notices: {
							urlRequired: "Webhook URLが必要です",
							selectAtLeastOneEvent: "少なくとも1つのイベントを選択してください",
						},
					},
				},
			},
			otherIntegrations: {
				header: "その他のプラグイン統合",
				description: "他のObsidianプラグインとの統合を設定します。",
			},
			timeFormats: {
				justNow: "たった今",
				minutesAgo: "{minutes}分前",
				hoursAgo: "{hours}時間前",
				daysAgo: "{days}日前",
			},
		},
	},
	notices: {
		languageChanged: "言語を{language}に変更しました。",
		exportTasksFailed: "タスクのICSファイルエクスポートに失敗しました",
	},
	commands: {
		openCalendarView: "ミニカレンダービューを開く",
		openAdvancedCalendarView: "アドバンスドカレンダービューを開く",
		openTasksView: "タスクビューを開く",
		openNotesView: "ノートビューを開く",
		openAgendaView: "アジェンダビューを開く",
		openPomodoroView: "ポモドーロタイマーを開く",
		openKanbanView: "かんばんボードを開く",
		openPomodoroStats: "ポモドーロ統計を開く",
		openStatisticsView: "タスクとプロジェクト統計を開く",
		createNewTask: "新しいタスクを作成",
		convertToTaskNote: "タスクをTaskNoteに変換",
		convertAllTasksInNote: "ノート内のすべてのタスクを変換",
		insertTaskNoteLink: "taskNoteリンクを挿入",
		createInlineTask: "新しいインラインタスクを作成",
		quickActionsCurrentTask: "現在のタスクのクイックアクション",
		goToTodayNote: "今日のノートに移動",
		startPomodoro: "ポモドーロタイマーを開始",
		stopPomodoro: "ポモドーロタイマーを停止",
		pauseResumePomodoro: "ポモドーロタイマーを一時停止/再開",
		refreshCache: "キャッシュを更新",
		exportAllTasksIcs: "すべてのタスクをICSファイルとしてエクスポート",
		viewReleaseNotes: "リリースノートを表示",
	},
	modals: {
		task: {
			titlePlaceholder: "何をする必要がありますか？",
			titleLabel: "タイトル",
			titleDetailedPlaceholder: "タスクタイトル...",
			detailsLabel: "詳細",
			detailsPlaceholder: "詳細を追加...",
			projectsLabel: "プロジェクト",
			projectsAdd: "プロジェクトを追加",
			projectsTooltip: "ファジー検索を使用してプロジェクトノートを選択",
			projectsRemoveTooltip: "プロジェクトを削除",
			contextsLabel: "コンテキスト",
			contextsPlaceholder: "context1, context2",
			tagsLabel: "タグ",
			tagsPlaceholder: "tag1, tag2",
			timeEstimateLabel: "時間見積もり（分）",
			timeEstimatePlaceholder: "30",
			customFieldsLabel: "カスタムフィールド",
			actions: {
				due: "期限日を設定",
				scheduled: "予定日を設定",
				status: "ステータスを設定",
				priority: "優先度を設定",
				recurrence: "繰り返しを設定",
				reminders: "リマインダーを設定",
			},
			buttons: {
				openNote: "ノートを開く",
				save: "保存",
			},
			tooltips: {
				dueValue: "期限：{value}",
				scheduledValue: "予定：{value}",
				statusValue: "ステータス：{value}",
				priorityValue: "優先度：{value}",
				recurrenceValue: "繰り返し：{value}",
				remindersSingle: "1件のリマインダーが設定されました",
				remindersPlural: "{count}件のリマインダーが設定されました",
			},
			dateMenu: {
				dueTitle: "期限日を設定",
				scheduledTitle: "予定日を設定",
			},
			userFields: {
				textPlaceholder: "{field}を入力...",
				numberPlaceholder: "0",
				datePlaceholder: "YYYY-MM-DD",
				listPlaceholder: "item1, item2, item3",
				pickDate: "{field}日付を選択",
			},
			recurrence: {
				daily: "毎日",
				weekly: "毎週",
				everyTwoWeeks: "2週間ごと",
				weekdays: "平日",
				weeklyOn: "毎週{days}曜日",
				monthly: "毎月",
				everyThreeMonths: "3か月ごと",
				monthlyOnOrdinal: "毎月{ordinal}",
				monthlyByWeekday: "毎月（曜日による）",
				yearly: "毎年",
				yearlyOn: "毎年{month}{day}",
				custom: "カスタム",
				countSuffix: "{count}回",
				untilSuffix: "{date}まで",
				ordinal: "{number}{suffix}",
			},
		},
		taskCreation: {
			title: "タスクを作成",
			actions: {
				fillFromNaturalLanguage: "自然言語からフォームを埋める",
				hideDetailedOptions: "詳細オプションを非表示",
				showDetailedOptions: "詳細オプションを表示",
			},
			nlPlaceholder: "明日の午後3時に食料品を買う @home #errands\n\nここに詳細を追加...",
			notices: {
				titleRequired: "タスクタイトルを入力してください",
				success: 'タスク"{title}"が正常に作成されました',
				successShortened:
					'タスク"{title}"が正常に作成されました（長さのためファイル名が短縮されました）',
				failure: "タスクの作成に失敗しました：{message}",
			},
		},
		taskEdit: {
			title: "タスクを編集",
			sections: {
				completions: "完了",
				taskInfo: "タスク情報",
			},
			metadata: {
				totalTrackedTime: "総追跡時間：",
				created: "作成：",
				modified: "変更：",
				file: "ファイル：",
			},
			buttons: {
				archive: "アーカイブ",
				unarchive: "アーカイブ解除",
			},
			notices: {
				titleRequired: "タスクタイトルを入力してください",
				noChanges: "保存する変更がありません",
				updateSuccess: 'タスク"{title}"が正常に更新されました',
				updateFailure: "タスクの更新に失敗しました：{message}",
				fileMissing: "タスクファイルが見つかりませんでした：{path}",
				openNoteFailure: "タスクノートを開けませんでした",
				archiveSuccess: "タスクが正常に{action}されました",
				archiveFailure: "タスクのアーカイブに失敗しました",
			},
			archiveAction: {
				archived: "アーカイブ",
				unarchived: "アーカイブ解除",
			},
		},
		storageLocation: {
			title: {
				migrate: "ポモドーロデータを移行しますか？",
				switch: "デイリーノートストレージに切り替えますか？",
			},
			message: {
				migrate:
					"これにより、既存のポモドーロセッションデータがデイリーノートのフロントマターに移行されます。データは日付でグループ化され、各デイリーノートに保存されます。",
				switch: "ポモドーロセッションデータは、プラグインデータファイルではなくデイリーノートのフロントマターに保存されます。",
			},
			whatThisMeans: "これが意味すること：",
			bullets: {
				dailyNotesRequired: "Daily Notesコアプラグインは有効のままである必要があります",
				storedInNotes: "データはデイリーノートのフロントマターに保存されます",
				migrateData: "既存のプラグインデータは移行され、その後クリアされます",
				futureSessions: "今後のセッションはデイリーノートに保存されます",
				dataLongevity: "これによりノートとのデータの永続性が向上します",
			},
			finalNote: {
				migrate:
					"⚠️ 必要に応じてバックアップを取ってください。この変更は自動的に元に戻すことはできません。",
				switch: "将来いつでもプラグインストレージに戻すことができます。",
			},
			buttons: {
				migrate: "データを移行",
				switch: "ストレージを切り替え",
			},
		},
		dueDate: {
			title: "期限日を設定",
			taskLabel: "タスク：{title}",
			sections: {
				dateTime: "期限日と時間",
				quickOptions: "クイックオプション",
			},
			descriptions: {
				dateTime: "このタスクをいつ完了すべきかを設定",
			},
			inputs: {
				date: {
					ariaLabel: "タスクの期限日",
					placeholder: "YYYY-MM-DD",
				},
				time: {
					ariaLabel: "タスクの期限時間（オプション）",
					placeholder: "HH:MM",
				},
			},
			quickOptions: {
				today: "今日",
				todayAriaLabel: "期限日を今日に設定",
				tomorrow: "明日",
				tomorrowAriaLabel: "期限日を明日に設定",
				nextWeek: "来週",
				nextWeekAriaLabel: "期限日を来週に設定",
				now: "今",
				nowAriaLabel: "期限日と時間を今に設定",
				clear: "クリア",
				clearAriaLabel: "期限日をクリア",
			},
			errors: {
				invalidDateTime: "有効な日付と時間の形式を入力してください",
				updateFailed: "期限日の更新に失敗しました。再試行してください。",
			},
		},
		scheduledDate: {
			title: "予定日を設定",
			taskLabel: "タスク：{title}",
			sections: {
				dateTime: "予定日と時間",
				quickOptions: "クイックオプション",
			},
			descriptions: {
				dateTime: "このタスクに取り組む予定を設定",
			},
			inputs: {
				date: {
					ariaLabel: "タスクの予定日",
					placeholder: "YYYY-MM-DD",
				},
				time: {
					ariaLabel: "タスクの予定時間（オプション）",
					placeholder: "HH:MM",
				},
			},
			quickOptions: {
				today: "今日",
				todayAriaLabel: "予定日を今日に設定",
				tomorrow: "明日",
				tomorrowAriaLabel: "予定日を明日に設定",
				nextWeek: "来週",
				nextWeekAriaLabel: "予定日を来週に設定",
				now: "今",
				nowAriaLabel: "予定日と時間を今に設定",
				clear: "クリア",
				clearAriaLabel: "予定日をクリア",
			},
			errors: {
				invalidDateTime: "有効な日付と時間の形式を入力してください",
				updateFailed: "予定日の更新に失敗しました。再試行してください。",
			},
		},
	},
	contextMenus: {
		task: {
			status: "ステータス",
			statusSelected: "✓ {label}",
			priority: "優先度",
			prioritySelected: "✓ {label}",
			dueDate: "期限日",
			scheduledDate: "予定日",
			reminders: "リマインダー",
			remindBeforeDue: "期限前にリマインド…",
			remindBeforeScheduled: "予定前にリマインド…",
			manageReminders: "すべてのリマインダーを管理…",
			clearReminders: "すべてのリマインダーをクリア",
			startTimeTracking: "時間追跡を開始",
			stopTimeTracking: "時間追跡を停止",
			archive: "アーカイブ",
			unarchive: "アーカイブ解除",
			openNote: "ノートを開く",
			copyTitle: "タスクタイトルをコピー",
			noteActions: "ノートアクション",
			rename: "名前変更",
			renameTitle: "ファイル名変更",
			renamePlaceholder: "新しい名前を入力",
			delete: "削除",
			deleteTitle: "ファイル削除",
			deleteMessage: '"{name}"を削除してもよろしいですか？',
			deleteConfirm: "削除",
			copyPath: "パスをコピー",
			copyUrl: "Obsidian URLをコピー",
			showInExplorer: "ファイルエクスプローラーで表示",
			addToCalendar: "カレンダーに追加",
			calendar: {
				google: "Googleカレンダー",
				outlook: "Outlookカレンダー",
				yahoo: "Yahooカレンダー",
				downloadIcs: ".icsファイルをダウンロード",
			},
			recurrence: "繰り返し",
			clearRecurrence: "繰り返しをクリア",
			customRecurrence: "カスタム繰り返し...",
			createSubtask: "サブタスクを作成",
			subtasks: {
				loading: "サブタスクを読み込み中...",
				noSubtasks: "サブタスクが見つかりません",
				loadFailed: "サブタスクの読み込みに失敗しました",
			},
			markComplete: "この日付で完了としてマーク",
			markIncomplete: "この日付で未完了としてマーク",
			quickReminders: {
				atTime: "イベント時刻に",
				fiveMinutes: "5分前",
				fifteenMinutes: "15分前",
				oneHour: "1時間前",
				oneDay: "1日前",
			},
			notices: {
				toggleCompletionFailure: "繰り返しタスクの完了切り替えに失敗しました：{message}",
				updateDueDateFailure: "タスク期限日の更新に失敗しました：{message}",
				updateScheduledFailure: "タスク予定日の更新に失敗しました：{message}",
				updateRemindersFailure: "リマインダーの更新に失敗しました",
				clearRemindersFailure: "リマインダーのクリアに失敗しました",
				addReminderFailure: "リマインダーの追加に失敗しました",
				archiveFailure: "タスクアーカイブの切り替えに失敗しました：{message}",
				copyTitleSuccess: "タスクタイトルをクリップボードにコピーしました",
				copyFailure: "クリップボードへのコピーに失敗しました",
				renameSuccess: '"{name}"に名前変更しました',
				renameFailure: "ファイルの名前変更に失敗しました",
				copyPathSuccess: "ファイルパスをクリップボードにコピーしました",
				copyUrlSuccess: "Obsidian URLをクリップボードにコピーしました",
				updateRecurrenceFailure: "タスク繰り返しの更新に失敗しました：{message}",
			},
		},
		ics: {
			showDetails: "詳細を表示",
			createTask: "イベントからタスクを作成",
			createNote: "イベントからノートを作成",
			linkNote: "既存のノートをリンク",
			copyTitle: "タイトルをコピー",
			copyLocation: "場所をコピー",
			copyUrl: "URLをコピー",
			copyMarkdown: "Markdownとしてコピー",
			subscriptionUnknown: "不明なカレンダー",
			notices: {
				copyTitleSuccess: "イベントタイトルをクリップボードにコピーしました",
				copyLocationSuccess: "場所をクリップボードにコピーしました",
				copyUrlSuccess: "イベントURLをクリップボードにコピーしました",
				copyMarkdownSuccess: "イベント詳細をMarkdownとしてコピーしました",
				copyFailure: "クリップボードへのコピーに失敗しました",
				taskCreated: "タスクを作成しました：{title}",
				taskCreateFailure: "イベントからのタスク作成に失敗しました",
				noteCreated: "ノートが正常に作成されました",
				creationFailure: "作成モーダルを開けませんでした",
				linkSuccess: 'ノート"{name}"をイベントにリンクしました',
				linkFailure: "ノートのリンクに失敗しました",
				linkSelectionFailure: "ノート選択を開けませんでした",
			},
			markdown: {
				titleFallback: "無題のイベント",
				calendar: "**カレンダー：** {value}",
				date: "**日時：** {value}",
				location: "**場所：** {value}",
				descriptionHeading: "### 説明",
				url: "**URL：** {value}",
				at: " {time}に",
			},
		},
		date: {
			increment: {
				plusOneDay: "+1日",
				minusOneDay: "-1日",
				plusOneWeek: "+1週",
				minusOneWeek: "-1週",
			},
			basic: {
				today: "今日",
				tomorrow: "明日",
				thisWeekend: "今週末",
				nextWeek: "来週",
				nextMonth: "来月",
			},
			weekdaysLabel: "平日",
			selected: "✓ {label}",
			pickDateTime: "日時を選択…",
			clearDate: "日付をクリア",
			modal: {
				title: "日時を設定",
				dateLabel: "日付",
				timeLabel: "時間（オプション）",
				select: "選択",
			},
		},
	},
	services: {
		pomodoro: {
			notices: {
				alreadyRunning: "ポモドーロが既に実行中です",
				resumeCurrentSession:
					"新しいセッションを開始する代わりに現在のセッションを再開してください",
				timerAlreadyRunning: "タイマーが既に実行中です",
				resumeSessionInstead:
					"新しいセッションを開始する代わりに現在のセッションを再開してください",
				shortBreakStarted: "短い休憩を開始しました",
				longBreakStarted: "長い休憩を開始しました",
				paused: "ポモドーロが一時停止されました",
				resumed: "ポモドーロが再開されました",
				stoppedAndReset: "ポモドーロが停止およびリセットされました",
				migrationSuccess:
					"{count}件のポモドーロセッションがデイリーノートに正常に移行されました。",
				migrationFailure:
					"ポモドーロデータの移行に失敗しました。再試行するか、詳細についてはコンソールを確認してください。",
			},
		},
		icsSubscription: {
			notices: {
				calendarNotFound:
					'カレンダー"{name}"が見つかりません（404）。ICS URLが正しく、カレンダーが公開アクセス可能であることを確認してください。',
				calendarAccessDenied:
					'カレンダー"{name}"のアクセスが拒否されました（500）。これはMicrosoft Outlookサーバーの制限によるものかもしれません。カレンダー設定からICS URLを再生成してみてください。',
				fetchRemoteFailed: 'リモートカレンダー"{name}"の取得に失敗しました：{error}',
				readLocalFailed: 'ローカルカレンダー"{name}"の読み込みに失敗しました：{error}',
			},
		},
		calendarExport: {
			notices: {
				generateLinkFailed: "カレンダーリンクの生成に失敗しました",
				noTasksToExport: "エクスポートするタスクが見つかりません",
				downloadSuccess: "{count}件のタスクを含む{filename}をダウンロードしました",
				downloadFailed: "カレンダーファイルのダウンロードに失敗しました",
				singleDownloadSuccess: "{filename}をダウンロードしました",
			},
		},
		filter: {
			groupLabels: {
				noProject: "プロジェクトなし",
				noTags: "タグなし",
				invalidDate: "無効な日付",
				due: {
					overdue: "期限切れ",
					today: "今日",
					tomorrow: "明日",
					nextSevenDays: "次の7日間",
					later: "後で",
					none: "期限日なし",
				},
				scheduled: {
					past: "過去の予定",
					today: "今日",
					tomorrow: "明日",
					nextSevenDays: "次の7日間",
					later: "後で",
					none: "予定日なし",
				},
			},
			errors: {
				noDatesProvided: "日付が提供されていません",
			},
			folders: {
				root: "（ルート）",
			},
		},
		instantTaskConvert: {
			notices: {
				noCheckboxTasks: "現在のノートにチェックボックスタスクが見つかりません。",
				convertingTasks: "{count}件のタスクを変換中...",
				conversionSuccess: "✅ {count}件のタスクをTaskNotesに正常に変換しました！",
				partialConversion:
					"{successCount}件のタスクが変換されました。{failureCount}件が失敗しました。",
				batchConversionFailed: "バッチ変換の実行に失敗しました。再試行してください。",
				invalidParameters: "無効な入力パラメーター。",
				emptyLine: "現在の行が空であるか、有効なコンテンツが含まれていません。",
				parseError: "タスクの解析エラー：{error}",
				invalidTaskData: "無効なタスクデータ。",
				replaceLineFailed: "タスク行の置換に失敗しました。",
				conversionComplete: "タスクが変換されました：{title}",
				conversionCompleteShortened:
					'タスクが変換されました："{title}"（長さのためファイル名が短縮されました）',
				fileExists:
					"この名前のファイルが既に存在します。再試行するかタスクの名前を変更してください。",
				conversionFailed: "タスクの変換に失敗しました。再試行してください。",
			},
		},
		icsNote: {
			notices: {
				templateNotFound: "テンプレートが見つかりません：{path}",
				templateProcessError: "テンプレートの処理エラー：{template}",
				linkedToEvent: "ノートをICSイベントにリンクしました：{title}",
			},
		},
		task: {
			notices: {
				templateNotFound: "タスクボディテンプレートが見つかりません：{path}",
				templateReadError: "タスクボディテンプレートの読み込みエラー：{template}",
				moveTaskFailed: "{operation}タスクの移動に失敗しました：{error}",
			},
		},
		autoExport: {
			notices: {
				exportFailed: "TaskNotes自動エクスポートに失敗しました：{error}",
			},
		},
		notification: {
			notices: {
				// NotificationService uses Notice for in-app notifications
				// but the message comes from the reminder content, so no hardcoded strings to translate
			},
		},
	},
	ui: {
		icsCard: {
			untitledEvent: "無題のイベント",
			allDay: "終日",
			calendarEvent: "カレンダーイベント",
			calendarFallback: "カレンダー",
		},
		noteCard: {
			createdLabel: "作成：",
			dailyBadge: "デイリー",
			dailyTooltip: "デイリーノート",
		},
		taskCard: {
			blockedBadge: "ブロック中",
			blockedBadgeTooltip: "このタスクは他のタスクを待っています",
			blockingBadge: "ブロックしている",
			blockingBadgeTooltip: "このタスクは他のタスクをブロックしています",
			blockingToggle: "{count} 件のタスクをブロック",
			loadingDependencies: "依存関係を読み込み中…",
			blockingEmpty: "依存タスクはありません",
			blockingLoadError: "依存関係の読み込みに失敗しました",
		},
		propertyEventCard: {
			unknownFile: "不明なファイル",
		},
		filterHeading: {
			allViewName: "すべて",
		},
		filterBar: {
			saveView: "ビューを保存",
			saveViewNamePlaceholder: "ビュー名を入力...",
			saveButton: "保存",
			views: "ビュー",
			savedFilterViews: "保存されたフィルタービュー",
			filters: "フィルター",
			properties: "プロパティ",
			sort: "ソート",
			newTask: "新規",
			expandAllGroups: "すべてのグループを展開",
			collapseAllGroups: "すべてのグループを折りたたみ",
			searchTasksPlaceholder: "タスクを検索...",
			searchTasksTooltip: "タスクタイトルを検索",
			filterUnavailable: "フィルターバーが一時的に利用できません",
			toggleFilter: "フィルターを切り替え",
			activeFiltersTooltip: "アクティブフィルター – クリックで変更、右クリックでクリア",
			configureVisibleProperties: "表示プロパティを設定",
			sortAndGroupOptions: "ソートとグループオプション",
			sortMenuHeader: "ソート",
			orderMenuHeader: "順序",
			groupMenuHeader: "グループ",
			createNewTask: "新しいタスクを作成",
			filter: "フィルター",
			displayOrganization: "表示と整理",
			viewOptions: "ビューオプション",
			addFilter: "フィルターを追加",
			addFilterGroup: "フィルターグループを追加",
			addFilterTooltip: "新しいフィルター条件を追加",
			addFilterGroupTooltip: "ネストしたフィルターグループを追加",
			clearAllFilters: "すべてのフィルターとグループをクリア",
			saveCurrentFilter: "現在のフィルターをビューとして保存",
			closeFilterModal: "フィルターモーダルを閉じる",
			deleteFilterGroup: "フィルターグループを削除",
			deleteCondition: "条件を削除",
			all: "すべて",
			any: "いずれか",
			followingAreTrue: "以下が真：",
			where: "ここで",
			selectProperty: "選択...",
			chooseProperty: "フィルターするタスクプロパティを選択",
			chooseOperator: "プロパティ値の比較方法を選択",
			enterValue: "フィルターする値を入力",
			selectValue: "フィルターする{property}を選択",
			sortBy: "ソート順：",
			toggleSortDirection: "ソート方向を切り替え",
			chooseSortMethod: "タスクのソート方法を選択",
			groupBy: "グループ化：",
			chooseGroupMethod: "共通プロパティでタスクをグループ化",
			toggleViewOption: "{option}を切り替え",
			expandCollapseFilters: "クリックでフィルター条件を展開/折りたたみ",
			expandCollapseSort: "クリックでソートとグループオプションを展開/折りたたみ",
			expandCollapseViewOptions: "クリックでビュー固有オプションを展開/折りたたみ",
			naturalLanguageDates: "自然言語日付",
			naturalLanguageExamples: "自然言語日付の例を表示",
			enterNumericValue: "フィルターする数値を入力",
			enterDateValue: "自然言語またはISO形式で日付を入力",
			pickDateTime: "日時を選択",
			noSavedViews: "保存されたビューがありません",
			savedViews: "保存されたビュー",
			yourSavedFilters: "保存されたフィルター設定",
			dragToReorder: "ドラッグしてビューを並び替え",
			loadSavedView: "保存されたビューを読み込み：{name}",
			deleteView: "ビューを削除",
			deleteViewTitle: "ビューを削除",
			deleteViewMessage: 'ビュー"{name}"を削除してもよろしいですか？',
			manageAllReminders: "すべてのリマインダーを管理...",
			clearAllReminders: "すべてのリマインダーをクリア",
			customRecurrence: "カスタム繰り返し...",
			clearRecurrence: "繰り返しをクリア",
			sortOptions: {
				dueDate: "期限日",
				scheduledDate: "予定日",
				priority: "優先度",
				status: "ステータス",
				title: "タイトル",
				createdDate: "作成日",
				tags: "タグ",
				ascending: "昇順",
				descending: "降順",
			},
			group: {
				none: "なし",
				status: "ステータス",
				priority: "優先度",
				context: "コンテキスト",
				project: "プロジェクト",
				dueDate: "期限日",
				scheduledDate: "予定日",
				tags: "タグ",
			},
			notices: {
				propertiesMenuFailed: "プロパティメニューの表示に失敗しました",
			},
		},
	},
	components: {
		propertyVisibilityDropdown: {
			coreProperties: "コアプロパティ",
			organization: "組織",
			customProperties: "カスタムプロパティ",
			failed: "プロパティメニューの表示に失敗しました",
			properties: {
				statusDot: "ステータスドット",
				priorityDot: "優先度ドット",
				dueDate: "期限日",
				scheduledDate: "予定日",
				timeEstimate: "時間見積もり",
				totalTrackedTime: "総追跡時間",
				recurrence: "繰り返し",
				completedDate: "完了日",
				createdDate: "作成日",
				modifiedDate: "変更日",
				projects: "プロジェクト",
				contexts: "コンテキスト",
				tags: "タグ",
				blocked: "ブロック中",
				blocking: "ブロックしている",
			},
		},
		reminderContextMenu: {
			remindBeforeDue: "期限前にリマインド...",
			remindBeforeScheduled: "予定前にリマインド...",
			manageAllReminders: "すべてのリマインダーを管理...",
			clearAllReminders: "すべてのリマインダーをクリア",
			quickReminders: {
				atTime: "イベント時刻に",
				fiveMinutesBefore: "5分前",
				fifteenMinutesBefore: "15分前",
				oneHourBefore: "1時間前",
				oneDayBefore: "1日前",
			},
		},
		recurrenceContextMenu: {
			daily: "毎日",
			weeklyOn: "毎週{day}曜日",
			everyTwoWeeksOn: "2週間ごとの{day}曜日",
			monthlyOnThe: "毎月{ordinal}",
			everyThreeMonthsOnThe: "3か月ごとの{ordinal}",
			yearlyOn: "毎年{month}{ordinal}",
			weekdaysOnly: "平日のみ",
			customRecurrence: "カスタム繰り返し...",
			clearRecurrence: "繰り返しをクリア",
			customRecurrenceModal: {
				title: "カスタム繰り返し",
				startDate: "開始日",
				startDateDesc: "繰り返しパターンが始まる日付",
				startTime: "開始時刻",
				startTimeDesc: "繰り返しインスタンスが表示される時刻（オプション）",
				frequency: "頻度",
				interval: "間隔",
				intervalDesc: "X日/週/月/年ごと",
				daysOfWeek: "曜日",
				daysOfWeekDesc: "特定の曜日を選択（週次繰り返し用）",
				monthlyRecurrence: "月次繰り返し",
				monthlyRecurrenceDesc: "月次繰り返し方法を選択",
				yearlyRecurrence: "年次繰り返し",
				yearlyRecurrenceDesc: "年次繰り返し方法を選択",
				endCondition: "終了条件",
				endConditionDesc: "繰り返しの終了時期を選択",
				neverEnds: "終了しない",
				endAfterOccurrences: "{count}回後に終了",
				endOnDate: "{date}に終了",
				onDayOfMonth: "毎月{day}日",
				onTheWeekOfMonth: "毎月{week}{day}曜日",
				onDateOfYear: "毎年{month}{day}",
				onTheWeekOfYear: "毎年{month}の{week}{day}曜日",
				frequencies: {
					daily: "毎日",
					weekly: "毎週",
					monthly: "毎月",
					yearly: "毎年",
				},
				weekPositions: {
					first: "第1",
					second: "第2",
					third: "第3",
					fourth: "第4",
					last: "最終",
				},
				weekdays: {
					monday: "月曜日",
					tuesday: "火曜日",
					wednesday: "水曜日",
					thursday: "木曜日",
					friday: "金曜日",
					saturday: "土曜日",
					sunday: "日曜日",
				},
				weekdaysShort: {
					mon: "月",
					tue: "火",
					wed: "水",
					thu: "木",
					fri: "金",
					sat: "土",
					sun: "日",
				},
				cancel: "キャンセル",
				save: "保存",
			},
		},
	},
};

export type JaTranslationSchema = typeof ja;
